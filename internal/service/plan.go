package service

import (
	"context"
	"errors"
	"time"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/repository"
)

var (
	ErrDateInvalid   = errors.New("日付が不正です")
	ErrPeriodInvalid = errors.New("期間が不正です")
	ErrMealInvalid   = errors.New("時間帯が不正です")

	ErrPlanNotFound = errors.New("献立に置いたレシピが見つかりません")
)

const dateLayout = "2006-01-02"

const (
	mealBreakfast = "breakfast"
	mealLunch     = "lunch"
	mealDinner    = "dinner"
)

type PlanService struct {
	repo *repository.PlanRepository
}

func NewPlanService(repo *repository.PlanRepository) *PlanService {
	return &PlanService{repo: repo}
}

// List は毎日と、from〜toの日付に置いた行を返す。from・toは実在する"YYYY-MM-DD"だけ受け付ける。
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
// 毎日(dateがnil)はmealを付けられず、日付の行は朝・昼・夜のどれかが要る。
func checkArea(date, meal *string) (*string, error) {
	if date == nil {
		if meal != nil {
			return nil, ErrMealInvalid
		}
		return nil, nil
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

// Add はdateとmealのエリアのindex番目にレシピを置く。dateがnilなら毎日で、mealは付けられない。
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

// Delete は置いた行idを献立から外す。レシピとブックマークは変えない。
func (s *PlanService) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}
