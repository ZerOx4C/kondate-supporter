package repository

import (
	"context"
	"database/sql"
	"errors"

	"kondate-supporter/internal/model"
)

// ErrNotFound は対象の行が存在しないことを表す。
var ErrNotFound = errors.New("not found")

type RecipeRepository struct {
	db *sql.DB
}

func NewRecipeRepository(db *sql.DB) *RecipeRepository {
	return &RecipeRepository{db: db}
}

// List はレシピをid昇順で返す。0件のときは空スライスを返す。
func (r *RecipeRepository) List(ctx context.Context) ([]model.Recipe, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, body FROM recipes ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recipes := []model.Recipe{}
	for rows.Next() {
		var rec model.Recipe
		if err := rows.Scan(&rec.ID, &rec.Name, &rec.Body); err != nil {
			return nil, err
		}
		recipes = append(recipes, rec)
	}
	return recipes, rows.Err()
}

func (r *RecipeRepository) Get(ctx context.Context, id int64) (model.Recipe, error) {
	var rec model.Recipe
	err := r.db.QueryRowContext(ctx, `SELECT id, name, body FROM recipes WHERE id = ?`, id).
		Scan(&rec.ID, &rec.Name, &rec.Body)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Recipe{}, ErrNotFound
	}
	return rec, err
}

// Create はレシピを追加し、採番されたidを返す。
func (r *RecipeRepository) Create(ctx context.Context, name, body string) (int64, error) {
	res, err := r.db.ExecContext(ctx, `INSERT INTO recipes (name, body) VALUES (?, ?)`, name, body)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *RecipeRepository) Update(ctx context.Context, id int64, name, body string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE recipes SET name = ?, body = ? WHERE id = ?`, name, body, id)
	if err != nil {
		return err
	}
	return requireAffected(res)
}

func (r *RecipeRepository) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM recipes WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return requireAffected(res)
}

// requireAffected は影響行数が0のときErrNotFoundを返す。
func requireAffected(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
