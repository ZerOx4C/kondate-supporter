package repository

import (
	"context"
	"database/sql"
	"errors"

	"kondate-supporter/internal/model"
)

// IngredientRepository は model.Ingredient のDBアクセスを提供する。
type IngredientRepository struct {
	db *sql.DB
}

func NewIngredientRepository(db *sql.DB) *IngredientRepository {
	return &IngredientRepository{db: db}
}

func (r *IngredientRepository) List(ctx context.Context) ([]model.Ingredient, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, unit FROM ingredients ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ingredients := []model.Ingredient{}
	for rows.Next() {
		var ing model.Ingredient
		if err := rows.Scan(&ing.ID, &ing.Name, &ing.Unit); err != nil {
			return nil, err
		}
		ingredients = append(ingredients, ing)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ingredients, nil
}

func (r *IngredientRepository) Get(ctx context.Context, id int64) (model.Ingredient, error) {
	var ing model.Ingredient
	err := r.db.QueryRowContext(ctx, "SELECT id, name, unit FROM ingredients WHERE id = ?", id).
		Scan(&ing.ID, &ing.Name, &ing.Unit)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Ingredient{}, ErrNotFound
	}
	if err != nil {
		return model.Ingredient{}, err
	}
	return ing, nil
}

// Create は食材を作成し、同じトランザクションで対応する在庫行(quantity=0)も作成する。
// これにより「stocksは常にingredientsと1:1で存在する」という前提を保てる。
func (r *IngredientRepository) Create(ctx context.Context, name, unit string) (model.Ingredient, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.Ingredient{}, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, "INSERT INTO ingredients (name, unit) VALUES (?, ?)", name, unit)
	if err != nil {
		return model.Ingredient{}, classifySQLiteError(err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return model.Ingredient{}, err
	}

	if _, err := tx.ExecContext(ctx, "INSERT INTO stocks (ingredient_id, quantity) VALUES (?, 0)", id); err != nil {
		return model.Ingredient{}, classifySQLiteError(err)
	}

	if err := tx.Commit(); err != nil {
		return model.Ingredient{}, err
	}

	return model.Ingredient{ID: id, Name: name, Unit: unit}, nil
}

func (r *IngredientRepository) Update(ctx context.Context, id int64, name, unit string) (model.Ingredient, error) {
	res, err := r.db.ExecContext(ctx, "UPDATE ingredients SET name = ?, unit = ? WHERE id = ?", name, unit, id)
	if err != nil {
		return model.Ingredient{}, classifySQLiteError(err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return model.Ingredient{}, err
	}
	if affected == 0 {
		return model.Ingredient{}, ErrNotFound
	}
	return model.Ingredient{ID: id, Name: name, Unit: unit}, nil
}

// Delete は食材と対応する在庫行を削除する。recipe_ingredientsから参照中の
// 食材は外部キー制約違反となり、ErrIngredientInUseに変換される。
func (r *IngredientRepository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM stocks WHERE ingredient_id = ?", id); err != nil {
		return classifySQLiteError(err)
	}

	res, err := tx.ExecContext(ctx, "DELETE FROM ingredients WHERE id = ?", id)
	if err != nil {
		return classifySQLiteError(err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}

	return tx.Commit()
}
