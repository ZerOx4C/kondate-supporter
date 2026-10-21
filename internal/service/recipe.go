package service

import (
	"context"
	"errors"
	"strings"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/repository"
)

var (
	ErrNotFound     = errors.New("レシピが見つかりません")
	ErrNameRequired = errors.New("名前を入力してください")

	ErrImageNotFound = errors.New("画像が見つかりません")
)

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

func (s *RecipeService) Create(ctx context.Context, name, body string) (model.Recipe, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return model.Recipe{}, ErrNameRequired
	}
	id, err := s.repo.Create(ctx, name, body)
	if err != nil {
		return model.Recipe{}, err
	}
	return model.Recipe{ID: id, Name: name, Body: body}, nil
}

func (s *RecipeService) Update(ctx context.Context, id int64, name, body string) (model.Recipe, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return model.Recipe{}, ErrNameRequired
	}
	rec, err := s.repo.Update(ctx, id, name, body)
	return rec, convertErr(err)
}

func (s *RecipeService) IncrementCookedCount(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.IncrementCookedCount(ctx, id)
	return rec, convertErr(err)
}

func (s *RecipeService) DecrementCookedCount(ctx context.Context, id int64) (model.Recipe, error) {
	rec, err := s.repo.DecrementCookedCount(ctx, id)
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
