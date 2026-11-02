package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/repository"
)

var (
	ErrNotFound     = errors.New("レシピが見つかりません")
	ErrNameRequired = errors.New("名前を入力してください")

	ErrServingsInvalid = errors.New("人数は0〜99の整数にしてください")

	ErrImageNotFound = errors.New("画像が見つかりません")

	ErrImportEmpty        = errors.New("取り込むレシピがありません")
	ErrCookedCountInvalid = errors.New("作った回数は0以上の整数にしてください")

	ErrAmountTooManyNumbers = errors.New("量に書ける数は1つまでです(分数・範囲・桁区切りは使えません)")
	ErrAmountTooLarge       = errors.New("量の数が大きすぎます")
)

// IngredientInput は受け取る材料1行。Amountは量の文字列。
type IngredientInput struct {
	Name   string
	Amount string
}

// IngredientError は不正だった材料の行。Rowは送られた配列での1始まりの行番号。
// Unwrapを持たせないのは、ErrNameRequiredを包んでもレシピ名のエラーとして扱われないようにするため。
type IngredientError struct {
	Row int
	Err error
}

func (e *IngredientError) Error() string {
	return fmt.Sprintf("材料%d行目: %s", e.Row, e.Err)
}

// amountNumber は量の中の数(半角・全角の数字の並びで、間に小数点が1つあってもよい)。
// unicode.IsDigitは他の文字体系の数字も含むため使わない。
var amountNumber = regexp.MustCompile(`[0-9０-９]+(?:[.．][0-9０-９]+)?`)

var halfWidth = strings.NewReplacer("０", "0", "１", "1", "２", "2", "３", "3", "４", "4",
	"５", "5", "６", "6", "７", "7", "８", "8", "９", "9", "．", ".")

// maxServings は人数の上限。
const maxServings = 99

// maxReportedImportErrors はエラー文言に並べる不正な件の上限。
const maxReportedImportErrors = 10

// ImportItem は取り込む1件。Err はhandlerがその件を読めなかったときの理由で、読めたらnil。
type ImportItem struct {
	Recipe model.Recipe
	Err    error
}

// ImportItemError は不正だった1件。Index は1始まり。
type ImportItemError struct {
	Index int
	Err   error
}

// ImportError は取り込みで不正だった件の一覧。
type ImportError struct {
	Items []ImportItemError
}

func (e *ImportError) Error() string {
	var sb strings.Builder
	for i, item := range e.Items {
		if i > 0 {
			sb.WriteByte('\n')
		}
		if i == maxReportedImportErrors {
			fmt.Fprintf(&sb, "ほか%d件", len(e.Items)-maxReportedImportErrors)
			break
		}
		fmt.Fprintf(&sb, "%d件目: %s", item.Index, item.Err)
	}
	return sb.String()
}

type RecipeService struct {
	repo *repository.RecipeRepository
}

func NewRecipeService(repo *repository.RecipeRepository) *RecipeService {
	return &RecipeService{repo: repo}
}

func (s *RecipeService) List(ctx context.Context) ([]model.Recipe, error) {
	return s.repo.List(ctx)
}

func (s *RecipeService) Get(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.Get(ctx, id)
	return rec, convertErr(err)
}

func (s *RecipeService) Create(ctx context.Context, name, body string, servings int64, tags []string, ingredients []IngredientInput) (model.Recipe, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return model.Recipe{}, ErrNameRequired
	}
	if servings < 0 || servings > maxServings {
		return model.Recipe{}, ErrServingsInvalid
	}
	ings, err := normalizeIngredients(ingredients)
	if err != nil {
		return model.Recipe{}, err
	}
	return s.repo.Create(ctx, name, body, servings, normalizeTags(tags), ings)
}

func (s *RecipeService) Update(ctx context.Context, id int64, name, body string, servings int64, tags []string, ingredients []IngredientInput) (model.Recipe, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return model.Recipe{}, ErrNameRequired
	}
	if servings < 0 || servings > maxServings {
		return model.Recipe{}, ErrServingsInvalid
	}
	ings, err := normalizeIngredients(ingredients)
	if err != nil {
		return model.Recipe{}, err
	}
	rec, err := s.repo.Update(ctx, id, name, body, servings, normalizeTags(tags), ings)
	return rec, convertErr(err)
}

// Import は全件を検査してから、配列の順に1つのトランザクションで登録する。
// 1件でも不正なら何も登録せず *ImportError を返す。
func (s *RecipeService) Import(ctx context.Context, items []ImportItem) (int, error) {
	if len(items) == 0 {
		return 0, ErrImportEmpty
	}
	recs := make([]model.Recipe, len(items))
	var bad []ImportItemError
	for i, item := range items {
		rec := item.Recipe
		rec.Name = strings.TrimSpace(rec.Name)
		rec.Tags = normalizeTags(rec.Tags)
		switch {
		case item.Err != nil:
			bad = append(bad, ImportItemError{Index: i + 1, Err: item.Err})
		case rec.Name == "":
			bad = append(bad, ImportItemError{Index: i + 1, Err: ErrNameRequired})
		case rec.CookedCount < 0:
			bad = append(bad, ImportItemError{Index: i + 1, Err: ErrCookedCountInvalid})
		}
		recs[i] = rec
	}
	if len(bad) > 0 {
		return 0, &ImportError{Items: bad}
	}
	return s.repo.Import(ctx, recs)
}

// ListTags は使われているタグ名をid昇順で返す。
func (s *RecipeService) ListTags(ctx context.Context) ([]string, error) {
	return s.repo.ListTags(ctx)
}

// normalizeTags はタグ名の前後の空白を除き、空を捨て、完全一致の重複を最初の1つにまとめる。
// 大文字・小文字は区別する。
func normalizeTags(tags []string) []string {
	seen := make(map[string]bool, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
	}
	return out
}

// normalizeIngredients は名前と量の前後の空白を除き、両方空の行を捨て、量から数量と書式を取り出す。
// 不正な行があれば、先頭の1件を *IngredientError で返す。
func normalizeIngredients(in []IngredientInput) ([]model.Ingredient, error) {
	out := make([]model.Ingredient, 0, len(in))
	for i, item := range in {
		name := strings.TrimSpace(item.Name)
		amount := strings.TrimSpace(item.Amount)
		if name == "" && amount == "" {
			continue
		}
		if name == "" {
			return nil, &IngredientError{Row: i + 1, Err: ErrNameRequired}
		}
		quantity, format, err := parseAmount(amount)
		if err != nil {
			return nil, &IngredientError{Row: i + 1, Err: err}
		}
		out = append(out, model.Ingredient{Name: name, Quantity: quantity, Format: format})
	}
	return out, nil
}

// parseAmount は量の文字列から数量と書式を取り出す。数が無ければ数量はnilで、書式は量そのもの。
func parseAmount(amount string) (*float64, string, error) {
	locs := amountNumber.FindAllStringIndex(amount, -1)
	switch {
	case len(locs) == 0:
		return nil, amount, nil
	case len(locs) > 1:
		return nil, "", ErrAmountTooManyNumbers
	}
	start, end := locs[0][0], locs[0][1]
	// 正規表現を通った文字列なので、構文エラーは起こらない。残るのは範囲外だけで、
	// 大きすぎれば無限大、小さすぎれば0になる。
	q, _ := strconv.ParseFloat(halfWidth.Replace(amount[start:end]), 64)
	if math.IsInf(q, 0) {
		return nil, "", ErrAmountTooLarge
	}
	return &q, amount[:start] + "{0}" + amount[end:], nil
}

func (s *RecipeService) IncrementCookedCount(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.IncrementCookedCount(ctx, id)
	return rec, convertErr(err)
}

func (s *RecipeService) DecrementCookedCount(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.DecrementCookedCount(ctx, id)
	return rec, convertErr(err)
}

func (s *RecipeService) SetBookmark(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.SetBookmark(ctx, id)
	return rec, convertErr(err)
}

func (s *RecipeService) DeleteBookmark(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.DeleteBookmark(ctx, id)
	return rec, convertErr(err)
}

func (s *RecipeService) SetImage(ctx context.Context, id int64, data []byte) (model.Recipe, error) {
	rec, err := s.repo.SetImage(ctx, id, data)
	return rec, convertErr(err)
}

func (s *RecipeService) DeleteImage(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.DeleteImage(ctx, id)
	return rec, convertErr(err)
}

// GetImage は画像のバイト列を返す。画像が無ければErrImageNotFoundを返す。
func (s *RecipeService) GetImage(ctx context.Context, id int64) ([]byte, error) {
	data, err := s.repo.GetImage(ctx, id)
	if err != nil {
		return nil, convertErr(err)
	}
	if len(data) == 0 {
		return nil, ErrImageNotFound
	}
	return data, nil
}

func (s *RecipeService) Delete(ctx context.Context, id int64) error {
	return convertErr(s.repo.Delete(ctx, id))
}

// convertErr はrepositoryのErrNotFoundをserviceのErrNotFoundに置き換える。
func convertErr(err error) error {
	if errors.Is(err, repository.ErrNotFound) {
		return ErrNotFound
	}
	return err
}
