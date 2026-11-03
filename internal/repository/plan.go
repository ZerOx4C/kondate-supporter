package repository

import (
	"context"
	"database/sql"
	"errors"

	"kondate-supporter/internal/model"
)

type PlanRepository struct {
	db *sql.DB
}

func NewPlanRepository(db *sql.DB) *PlanRepository {
	return &PlanRepository{db: db}
}

const planColumns = "id, date, meal, recipe_id, memo, servings"

func scanPlan(row interface{ Scan(...any) error }) (model.Plan, error) {
	var e model.Plan
	err := row.Scan(&e.ID, &e.Date, &e.Meal, &e.RecipeID, &e.Memo, &e.Servings)
	return e, err
}

// List は毎日と候補と、from〜to(両端を含む)の日付に置いた行を返す。毎日、候補の順で、その後は日付順、
// 同じ日付の中は朝・昼・夜の順、同じエリアの中は並び順。0件のときは空スライスを返す。
func (r *PlanRepository) List(ctx context.Context, from, to string) ([]model.Plan, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+planColumns+` FROM plans
		WHERE date IS NULL OR date BETWEEN ? AND ?
		ORDER BY date IS NOT NULL, date,
			CASE meal WHEN 'candidate' THEN 0 WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 END,
			position, id`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := []model.Plan{}
	for rows.Next() {
		e, err := scanPlan(rows)
		if err != nil {
			return nil, err
		}
		plans = append(plans, e)
	}
	return plans, rows.Err()
}

// Get は行idを返す。メモの行もそのまま返す。行が無ければErrNotFoundを返す。
func (r *PlanRepository) Get(ctx context.Context, id int64) (model.Plan, error) {
	e, err := scanPlan(r.db.QueryRowContext(ctx,
		`SELECT `+planColumns+` FROM plans WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return e, ErrNotFound
	}
	return e, err
}

// Add はdateとmealのエリアの0始まりのindex番目にレシピを置き、置いた行を返す。indexが件数以上なら末尾に置く。
// dateがnilなら毎日(mealもnil)か候補(mealがcandidate)。レシピが無ければErrNotFoundを返す。
// 並び順を表すpositionは連番とは限らないので、index番目の行のpositionを探し、それ以降を1つずつずらして入れる。
func (r *PlanRepository) Add(ctx context.Context, date, meal *string, recipeID int64, index int) (model.Plan, error) {
	var e model.Plan
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		pos, err := slotPosition(ctx, tx, date, meal, index, 0)
		if err != nil {
			return err
		}
		e, err = scanPlan(tx.QueryRowContext(ctx,
			`INSERT INTO plans (date, meal, position, recipe_id)
			SELECT ?, ?, ?, id FROM recipes WHERE id = ?
			RETURNING `+planColumns, date, meal, pos, recipeID))
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	})
	return e, err
}

// AddMemo はdateとmealのエリアの0始まりのindex番目にメモを置き、置いた行を返す。置く位置の決め方はAddと同じ。
func (r *PlanRepository) AddMemo(ctx context.Context, date, meal *string, memo string, index int) (model.Plan, error) {
	var e model.Plan
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		pos, err := slotPosition(ctx, tx, date, meal, index, 0)
		if err != nil {
			return err
		}
		e, err = scanPlan(tx.QueryRowContext(ctx,
			`INSERT INTO plans (date, meal, position, memo) VALUES (?, ?, ?, ?)
			RETURNING `+planColumns, date, meal, pos, memo))
		return err
	})
	return e, err
}

// slotPosition はdateとmealのエリアの0始まりのindex番目に入れるためのpositionを返す。index番目以降の行は1つずつずらす。
// indexが件数以上なら末尾のpositionを返す。excludeIDの行は並びに数えない(動かす行自身を除くため。Addは0を渡す)。
func slotPosition(ctx context.Context, tx *sql.Tx, date, meal *string, index int, excludeID int64) (int64, error) {
	var pos int64
	err := tx.QueryRowContext(ctx,
		`SELECT position FROM plans WHERE date IS ? AND meal IS ? AND id <> ? ORDER BY position, id LIMIT 1 OFFSET ?`,
		date, meal, excludeID, index).Scan(&pos)
	switch {
	case err == nil:
		_, err = tx.ExecContext(ctx,
			`UPDATE plans SET position = position + 1 WHERE date IS ? AND meal IS ? AND position >= ? AND id <> ?`,
			date, meal, pos, excludeID)
	case errors.Is(err, sql.ErrNoRows):
		err = tx.QueryRowContext(ctx,
			`SELECT COALESCE(MAX(position) + 1, 0) FROM plans WHERE date IS ? AND meal IS ? AND id <> ?`,
			date, meal, excludeID).Scan(&pos)
	}
	return pos, err
}

// Move は行idをdateとmealのエリアのindex番目へ動かし、動かした行を返す。indexは動かす行自身を除いた並びでの位置。
// 同じエリアなら並べ替えになる。行が無ければErrNotFoundを返す。
func (r *PlanRepository) Move(ctx context.Context, id int64, date, meal *string, index int) (model.Plan, error) {
	var e model.Plan
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		pos, err := slotPosition(ctx, tx, date, meal, index, id)
		if err != nil {
			return err
		}
		e, err = scanPlan(tx.QueryRowContext(ctx,
			`UPDATE plans SET date = ?, meal = ?, position = ? WHERE id = ? RETURNING `+planColumns,
			date, meal, pos, id))
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	})
	return e, err
}

// UpdateMemo はメモの行idの文を書き換え、書き換えた行を返す。行が無いときとレシピの行のときはErrNotFoundを返す。
func (r *PlanRepository) UpdateMemo(ctx context.Context, id int64, memo string) (model.Plan, error) {
	e, err := scanPlan(r.db.QueryRowContext(ctx,
		`UPDATE plans SET memo = ? WHERE id = ? AND memo IS NOT NULL RETURNING `+planColumns, memo, id))
	if errors.Is(err, sql.ErrNoRows) {
		return e, ErrNotFound
	}
	return e, err
}

// UpdateServings はレシピの行idの献立の人数を書き換え、書き換えた行を返す。servingsがnilならレシピの人数に戻す。
// 行が無いときとメモの行のときはErrNotFoundを返す。
func (r *PlanRepository) UpdateServings(ctx context.Context, id int64, servings *int64) (model.Plan, error) {
	e, err := scanPlan(r.db.QueryRowContext(ctx,
		`UPDATE plans SET servings = ? WHERE id = ? AND recipe_id IS NOT NULL RETURNING `+planColumns, servings, id))
	if errors.Is(err, sql.ErrNoRows) {
		return e, ErrNotFound
	}
	return e, err
}

// Delete は行idを献立から外す。行が無くてもエラーにしない。
func (r *PlanRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM plans WHERE id = ?`, id)
	return err
}
