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

	ErrPlanEntryNotFound = errors.New("献立に置いたレシピが見つかりません")
)

const dateLayout = "2006-01-02"

type PlanService struct {
	repo *repository.PlanRepository
}

func NewPlanService(repo *repository.PlanRepository) *PlanService {
	return &PlanService{repo: repo}
}

// List は毎日と、from〜toの日付に置いた行を返す。from・toは実在する"YYYY-MM-DD"だけ受け付ける。
func (s *PlanService) List(ctx context.Context, from, to string) ([]model.PlanEntry, error) {
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

// Add はdateのエリアのindex番目にレシピを置く。dateがnilなら毎日。indexが負なら先頭に置く。
func (s *PlanService) Add(ctx context.Context, date *string, recipeID int64, index int) (model.PlanEntry, error) {
	if date != nil {
		if _, err := time.Parse(dateLayout, *date); err != nil {
			return model.PlanEntry{}, ErrDateInvalid
		}
	}
	if index < 0 {
		index = 0
	}
	e, err := s.repo.Add(ctx, date, recipeID, index)
	return e, convertErr(err)
}

// Move は置いた行idをdateのエリアのindex番目へ動かす。indexは動かす行を除いた並びでの位置で、負なら先頭になる。
func (s *PlanService) Move(ctx context.Context, id int64, date *string, index int) (model.PlanEntry, error) {
	if date != nil {
		if _, err := time.Parse(dateLayout, *date); err != nil {
			return model.PlanEntry{}, ErrDateInvalid
		}
	}
	if index < 0 {
		index = 0
	}
	e, err := s.repo.Move(ctx, id, date, index)
	if errors.Is(err, repository.ErrNotFound) {
		return e, ErrPlanEntryNotFound
	}
	return e, err
}

// Delete は置いた行idを献立から外す。レシピとブックマークは変えない。
func (s *PlanService) Delete(ctx context.Context, id int64) error {
	return s.repo.Delete(ctx, id)
}
