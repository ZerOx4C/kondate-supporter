package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// PlanDetail はplanとrecipeをJOINした結果。repository層はHTTP/JSONを
// 意識しないため、JSONタグは付けない。
type PlanDetail struct {
	ID         int64
	Date       string
	RecipeID   int64
	RecipeName string
	Servings   int
}

// PlanRepository は model.Plan のDBアクセスを提供する。
type PlanRepository struct {
	db *sql.DB
}

func NewPlanRepository(db *sql.DB) *PlanRepository {
	return &PlanRepository{db: db}
}

// List は指定された日付範囲(片方または両方省略可)の献立をレシピ名込みで返す。
func (r *PlanRepository) List(ctx context.Context, from, to string) ([]PlanDetail, error) {
	query := strings.Builder{}
	query.WriteString(`
		SELECT p.id, p.date, p.recipe_id, r.name, p.servings
		FROM plans p
		JOIN recipes r ON r.id = p.recipe_id
	`)
	var conditions []string
	var args []any
	if from != "" {
		conditions = append(conditions, "p.date >= ?")
		args = append(args, from)
	}
	if to != "" {
		conditions = append(conditions, "p.date <= ?")
		args = append(args, to)
	}
	if len(conditions) > 0 {
		query.WriteString("WHERE " + strings.Join(conditions, " AND ") + " ")
	}
	query.WriteString("ORDER BY p.date, p.id")

	rows, err := r.db.QueryContext(ctx, query.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := []PlanDetail{}
	for rows.Next() {
		var p PlanDetail
		if err := rows.Scan(&p.ID, &p.Date, &p.RecipeID, &p.RecipeName, &p.Servings); err != nil {
			return nil, err
		}
		plans = append(plans, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return plans, nil
}

func (r *PlanRepository) Get(ctx context.Context, id int64) (PlanDetail, error) {
	var p PlanDetail
	err := r.db.QueryRowContext(ctx, `
		SELECT p.id, p.date, p.recipe_id, r.name, p.servings
		FROM plans p
		JOIN recipes r ON r.id = p.recipe_id
		WHERE p.id = ?
	`, id).Scan(&p.ID, &p.Date, &p.RecipeID, &p.RecipeName, &p.Servings)
	if errors.Is(err, sql.ErrNoRows) {
		return PlanDetail{}, ErrNotFound
	}
	if err != nil {
		return PlanDetail{}, err
	}
	return p, nil
}

// validateRecipeExists は指定されたレシピIDが存在するか検証する。
// SQLiteの外部キー制約には頼らず、事前に明示的なクエリで検出する。
func validateRecipeExists(ctx context.Context, tx *sql.Tx, recipeID int64) error {
	var count int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM recipes WHERE id = ?", recipeID).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		return ErrRecipeNotFound
	}
	return nil
}

func (r *PlanRepository) Create(ctx context.Context, date string, recipeID int64, servings int) (PlanDetail, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return PlanDetail{}, err
	}
	defer tx.Rollback()

	if err := validateRecipeExists(ctx, tx, recipeID); err != nil {
		return PlanDetail{}, err
	}

	res, err := tx.ExecContext(ctx,
		"INSERT INTO plans (date, recipe_id, servings) VALUES (?, ?, ?)",
		date, recipeID, servings,
	)
	if err != nil {
		return PlanDetail{}, classifySQLiteError(err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return PlanDetail{}, err
	}

	if err := tx.Commit(); err != nil {
		return PlanDetail{}, err
	}
	return r.Get(ctx, id)
}

func (r *PlanRepository) Update(ctx context.Context, id int64, date string, recipeID int64, servings int) (PlanDetail, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return PlanDetail{}, err
	}
	defer tx.Rollback()

	if err := validateRecipeExists(ctx, tx, recipeID); err != nil {
		return PlanDetail{}, err
	}

	res, err := tx.ExecContext(ctx,
		"UPDATE plans SET date = ?, recipe_id = ?, servings = ? WHERE id = ?",
		date, recipeID, servings, id,
	)
	if err != nil {
		return PlanDetail{}, classifySQLiteError(err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return PlanDetail{}, err
	}
	if affected == 0 {
		return PlanDetail{}, ErrNotFound
	}

	if err := tx.Commit(); err != nil {
		return PlanDetail{}, err
	}
	return r.Get(ctx, id)
}

// Delete は献立を削除する。plansを参照する子テーブルは無いため
// トランザクションは不要。
func (r *PlanRepository) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM plans WHERE id = ?", id)
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
	return nil
}
