package repository

import "database/sql"

// RecipeRepository は model.Recipe と model.RecipeIngredient の
// DBアクセスを提供する。
// TODO: CRUDメソッドを実装する。
type RecipeRepository struct {
	db *sql.DB
}

func NewRecipeRepository(db *sql.DB) *RecipeRepository {
	return &RecipeRepository{db: db}
}
