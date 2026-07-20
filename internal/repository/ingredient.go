package repository

import "database/sql"

// IngredientRepository は model.Ingredient のDBアクセスを提供する。
// TODO: CRUDメソッドを実装する。
type IngredientRepository struct {
	db *sql.DB
}

func NewIngredientRepository(db *sql.DB) *IngredientRepository {
	return &IngredientRepository{db: db}
}
