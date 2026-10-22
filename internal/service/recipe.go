package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/repository"
)

var (
	ErrNotFound     = errors.New("レシピが見つかりません")
	ErrNameRequired = errors.New("名前を入力してください")

	ErrImageNotFound = errors.New("画像が見つかりません")

	ErrImportEmpty        = errors.New("取り込むレシピがありません")
	ErrCookedCountInvalid = errors.New("作った回数は0以上の整数にしてください")
)

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

func (s *RecipeService) Create(ctx context.Context, name, body string, tags []string) (model.Recipe, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return model.Recipe{}, ErrNameRequired
	}
	return s.repo.Create(ctx, name, body, normalizeTags(tags))
}

func (s *RecipeService) Update(ctx context.Context, id int64, name, body string, tags []string) (model.Recipe, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return model.Recipe{}, ErrNameRequired
	}
	rec, err := s.repo.Update(ctx, id, name, body, normalizeTags(tags))
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
