package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/repository"
)

var (
	ErrDateInvalid   = errors.New("日付が不正です")
	ErrPeriodInvalid = errors.New("期間が不正です")
	ErrMealInvalid   = errors.New("時間帯が不正です")

	ErrMemoRequired = errors.New("メモを入力してください")

	ErrPlanServingsInvalid = errors.New("人数は1〜99の整数にしてください")

	ErrPlanNotFound = errors.New("献立に置いたものが見つかりません")
)

const dateLayout = "2006-01-02"

const (
	mealBreakfast = "breakfast"
	mealLunch     = "lunch"
	mealDinner    = "dinner"

	// mealCandidate は日付の無い行だけが取る、献立の候補を表すmeal。
	mealCandidate = "candidate"
)

type PlanService struct {
	repo *repository.PlanRepository
}

func NewPlanService(repo *repository.PlanRepository) *PlanService {
	return &PlanService{repo: repo}
}

// List は毎日と候補と、from〜toの日付に置いた行を返す。from・toは実在する"YYYY-MM-DD"だけ受け付ける。
func (s *PlanService) List(ctx context.Context, from, to string) ([]model.Plan, error) {
	f, err := time.Parse(dateLayout, from)
	if err != nil {
		return nil, ErrDateInvalid
	}
	t, err := time.Parse(dateLayout, to)
	if err != nil {
		return nil, ErrDateInvalid
	}
	if f.After(t) {
		return nil, ErrPeriodInvalid
	}
	return s.repo.List(ctx, from, to)
}

// checkArea はdateとmealの組を検査し、保存するmealを返す。
// 日付の無い行は、mealが無ければ毎日、candidateなら候補で、朝・昼・夜は付けられない。
// 日付の行は朝・昼・夜のどれかが要り、candidateは付けられない。
func checkArea(date, meal *string) (*string, error) {
	if date == nil {
		if meal != nil && *meal != mealCandidate {
			return nil, ErrMealInvalid
		}
		return meal, nil
	}
	if _, err := time.Parse(dateLayout, *date); err != nil {
		return nil, ErrDateInvalid
	}
	if meal == nil {
		return nil, ErrMealInvalid
	}
	switch *meal {
	case mealBreakfast, mealLunch, mealDinner:
		return meal, nil
	}
	return nil, ErrMealInvalid
}

// Add はdateとmealのエリアのindex番目にレシピを置く。dateがnilなら毎日(mealもnil)か候補(mealがcandidate)。
// indexが負なら先頭に置く。
func (s *PlanService) Add(ctx context.Context, date, meal *string, recipeID int64, index int) (model.Plan, error) {
	meal, err := checkArea(date, meal)
	if err != nil {
		return model.Plan{}, err
	}
	if index < 0 {
		index = 0
	}
	e, err := s.repo.Add(ctx, date, meal, recipeID, index)
	return e, convertErr(err)
}

// AddMemo はdateとmealのエリアのindex番目にメモを置く。メモは前後の空白を除いて保存し、空なら置かない。
// 置き先とindexの扱いはAddと同じ。
func (s *PlanService) AddMemo(ctx context.Context, date, meal *string, memo string, index int) (model.Plan, error) {
	meal, err := checkArea(date, meal)
	if err != nil {
		return model.Plan{}, err
	}
	memo = strings.TrimSpace(memo)
	if memo == "" {
		return model.Plan{}, ErrMemoRequired
	}
	if index < 0 {
		index = 0
	}
	return s.repo.AddMemo(ctx, date, meal, memo, index)
}

// Move は置いた行idをdateとmealのエリアのindex番目へ動かす。indexは動かす行を除いた並びでの位置で、負なら先頭になる。
func (s *PlanService) Move(ctx context.Context, id int64, date, meal *string, index int) (model.Plan, error) {
	meal, err := checkArea(date, meal)
	if err != nil {
		return model.Plan{}, err
	}
	if index < 0 {
		index = 0
	}
	e, err := s.repo.Move(ctx, id, date, meal, index)
	if errors.Is(err, repository.ErrNotFound) {
		return e, ErrPlanNotFound
	}
	return e, err
}

// UpdateMemo はメモの行idの文を書き換える。前後の空白を除いて保存し、空なら書き換えない。
func (s *PlanService) UpdateMemo(ctx context.Context, id int64, memo string) (model.Plan, error) {
	memo = strings.TrimSpace(memo)
	if memo == "" {
		return model.Plan{}, ErrMemoRequired
	}
	e, err := s.repo.UpdateMemo(ctx, id, memo)
	if errors.Is(err, repository.ErrNotFound) {
		return e, ErrPlanNotFound
	}
	return e, err
}

// UpdateServings はレシピの行idの献立の人数を書き換える。nilはレシピの人数に戻す。1〜99の範囲外は書き換えない。
func (s *PlanService) UpdateServings(ctx context.Context, id int64, servings *int64) (model.Plan, error) {
	if servings != nil && (*servings < 1 || *servings > maxServings) {
		return model.Plan{}, ErrPlanServingsInvalid
	}
	e, err := s.repo.UpdateServings(ctx, id, servings)
	if errors.Is(err, repository.ErrNotFound) {
		return e, ErrPlanNotFound
	}
	return e, err
}

// Delete は置いた行idを献立から外す。レシピは変えない。
func (s *PlanService) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}
