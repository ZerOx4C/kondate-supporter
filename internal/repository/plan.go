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

// List は毎日と、from〜to(両端を含む)の日付に置いた行を返す。毎日が先で、その後は日付順、
// 同じエリアの中は並び順。0件のときは空スライスを返す。
func (r *PlanRepository) List(ctx context.Context, from, to string) ([]model.PlanEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, date, recipe_id FROM plan_entries
		WHERE date IS NULL OR date BETWEEN ? AND ?
		ORDER BY date IS NOT NULL, date, position, id`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []model.PlanEntry{}
	for rows.Next() {
		var e model.PlanEntry
		if err := rows.Scan(&e.ID, &e.Date, &e.RecipeID); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// Add はdateのエリアの0始まりのindex番目にレシピを置き、置いた行を返す。indexが件数以上なら末尾に置く。
// dateがnilなら毎日。レシピが無ければErrNotFoundを返す。
// 並び順を表すpositionは連番とは限らないので、index番目の行のpositionを探し、それ以降を1つずつずらして入れる。
func (r *PlanRepository) Add(ctx context.Context, date *string, recipeID int64, index int) (model.PlanEntry, error) {
	var e model.PlanEntry
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		pos, err := slotPosition(ctx, tx, date, index, 0)
		if err != nil {
			return err
		}
		err = tx.QueryRowContext(ctx,
			`INSERT INTO plan_entries (date, position, recipe_id)
			SELECT ?, ?, id FROM recipes WHERE id = ?
			RETURNING id, date, recipe_id`, date, pos, recipeID).Scan(&e.ID, &e.Date, &e.RecipeID)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	})
	return e, err
}

// slotPosition はdateのエリアの0始まりのindex番目に入れるためのpositionを返す。index番目以降の行は1つずつずらす。
// indexが件数以上なら末尾のpositionを返す。excludeIDの行は並びに数えない(動かす行自身を除くため。Addは0を渡す)。
func slotPosition(ctx context.Context, tx *sql.Tx, date *string, index int, excludeID int64) (int64, error) {
	var pos int64
	err := tx.QueryRowContext(ctx,
		`SELECT position FROM plan_entries WHERE date IS ? AND id <> ? ORDER BY position, id LIMIT 1 OFFSET ?`,
		date, excludeID, index).Scan(&pos)
	switch {
	case err == nil:
		_, err = tx.ExecContext(ctx,
			`UPDATE plan_entries SET position = position + 1 WHERE date IS ? AND position >= ? AND id <> ?`,
			date, pos, excludeID)
	case errors.Is(err, sql.ErrNoRows):
		err = tx.QueryRowContext(ctx,
			`SELECT COALESCE(MAX(position) + 1, 0) FROM plan_entries WHERE date IS ? AND id <> ?`,
			date, excludeID).Scan(&pos)
	}
	return pos, err
}

// Move は行idをdateのエリアのindex番目へ動かし、動かした行を返す。indexは動かす行自身を除いた並びでの位置。
// 同じエリアなら並べ替えになる。行が無ければErrNotFoundを返す。
func (r *PlanRepository) Move(ctx context.Context, id int64, date *string, index int) (model.PlanEntry, error) {
	var e model.PlanEntry
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		pos, err := slotPosition(ctx, tx, date, index, id)
		if err != nil {
			return err
		}
		err = tx.QueryRowContext(ctx,
			`UPDATE plan_entries SET date = ?, position = ? WHERE id = ? RETURNING id, date, recipe_id`,
			date, pos, id).Scan(&e.ID, &e.Date, &e.RecipeID)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	})
	return e, err
}

// Delete は行idを献立から外す。行が無くてもエラーにしない。
func (r *PlanRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM plan_entries WHERE id = ?`, id)
	return err
}
