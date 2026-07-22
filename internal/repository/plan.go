package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// PlanDetail はplanとrecipeをLEFT JOINした結果。repository層はHTTP/JSONを
// 意識しないため、JSONタグは付けない。RecipeIDがnilの行はレシピに依存しない
// メモ行(外食予定や作り置きなど)を表す。
type PlanDetail struct {
	ID             int64
	Date           string
	RecipeID       *int64
	RecipeName     string
	RecipeServings int
	Servings       int
	MealTime       string
	Note           string
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
		SELECT p.id, p.date, p.recipe_id, r.name, r.servings, p.servings, p.meal_time, p.note
		FROM plans p
		LEFT JOIN recipes r ON r.id = p.recipe_id
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
	// 同じ日付の中では朝→昼→夜→その他の順に並べ、献立画面で時系列に見えるようにする。
	query.WriteString(`ORDER BY p.date,
		CASE p.meal_time
			WHEN 'morning' THEN 0
			WHEN 'noon' THEN 1
			WHEN 'night' THEN 2
			ELSE 3
		END,
		p.id`)

	rows, err := r.db.QueryContext(ctx, query.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := []PlanDetail{}
	for rows.Next() {
		var (
			p              PlanDetail
			recipeID       sql.NullInt64
			recipeName     sql.NullString
			recipeServings sql.NullInt64
		)
		if err := rows.Scan(&p.ID, &p.Date, &recipeID, &recipeName, &recipeServings, &p.Servings, &p.MealTime, &p.Note); err != nil {
			return nil, err
		}
		applyRecipeJoinResult(&p, recipeID, recipeName, recipeServings)
		plans = append(plans, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return plans, nil
}

func (r *PlanRepository) Get(ctx context.Context, id int64) (PlanDetail, error) {
	var (
		p              PlanDetail
		recipeID       sql.NullInt64
		recipeName     sql.NullString
		recipeServings sql.NullInt64
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT p.id, p.date, p.recipe_id, r.name, r.servings, p.servings, p.meal_time, p.note
		FROM plans p
		LEFT JOIN recipes r ON r.id = p.recipe_id
		WHERE p.id = ?
	`, id).Scan(&p.ID, &p.Date, &recipeID, &recipeName, &recipeServings, &p.Servings, &p.MealTime, &p.Note)
	if errors.Is(err, sql.ErrNoRows) {
		return PlanDetail{}, ErrNotFound
	}
	if err != nil {
		return PlanDetail{}, err
	}
	applyRecipeJoinResult(&p, recipeID, recipeName, recipeServings)
	return p, nil
}

// applyRecipeJoinResult はLEFT JOINで取得したレシピ情報をPlanDetailに反映する。
// recipeIDがNULLの行(メモ行)ではRecipeIDをnilのままにする。
func applyRecipeJoinResult(p *PlanDetail, recipeID sql.NullInt64, recipeName sql.NullString, recipeServings sql.NullInt64) {
	if !recipeID.Valid {
		return
	}
	id := recipeID.Int64
	p.RecipeID = &id
	p.RecipeName = recipeName.String
	p.RecipeServings = int(recipeServings.Int64)
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

func (r *PlanRepository) Create(ctx context.Context, date string, recipeID *int64, servings int, mealTime, note string) (PlanDetail, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return PlanDetail{}, err
	}
	defer tx.Rollback()

	if recipeID != nil {
		if err := validateRecipeExists(ctx, tx, *recipeID); err != nil {
			return PlanDetail{}, err
		}
	}

	res, err := tx.ExecContext(ctx,
		"INSERT INTO plans (date, recipe_id, servings, meal_time, note) VALUES (?, ?, ?, ?, ?)",
		date, recipeID, servings, mealTime, note,
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

func (r *PlanRepository) Update(ctx context.Context, id int64, date string, recipeID *int64, servings int, mealTime, note string) (PlanDetail, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return PlanDetail{}, err
	}
	defer tx.Rollback()

	if recipeID != nil {
		if err := validateRecipeExists(ctx, tx, *recipeID); err != nil {
			return PlanDetail{}, err
		}
	}

	res, err := tx.ExecContext(ctx,
		"UPDATE plans SET date = ?, recipe_id = ?, servings = ?, meal_time = ?, note = ? WHERE id = ?",
		date, recipeID, servings, mealTime, note, id,
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
