package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

// PlanDetail はplanとrecipeをLEFT JOINした結果。repository層はHTTP/JSONを
// 意識しないため、JSONタグは付けない。RecipeIDがnilの行はレシピに依存しない
// メモ行(外食予定や作り置きなど)を表す。
type PlanDetail struct {
	ID                  int64
	Date                string
	RecipeID            *int64
	RecipeName          string
	RecipeServings      int
	Servings            int
	MealTime            string
	Note                string
	IngredientOverrides []PlanIngredientOverride
}

// PlanIngredientOverride は献立ごとに上書きされた食材必要量1件分。
// 読み書き両方で同じ形を使う。
type PlanIngredientOverride struct {
	IngredientID int64
	Quantity     float64
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

	ids := make([]int64, len(plans))
	for i, p := range plans {
		ids[i] = p.ID
	}
	overridesByPlan, err := queryPlanIngredientOverrides(ctx, r.db, ids)
	if err != nil {
		return nil, err
	}
	for i := range plans {
		plans[i].IngredientOverrides = overridesByPlan[plans[i].ID]
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

	overridesByPlan, err := queryPlanIngredientOverrides(ctx, r.db, []int64{id})
	if err != nil {
		return PlanDetail{}, err
	}
	p.IngredientOverrides = overridesByPlan[id]
	return p, nil
}

// queryPlanIngredientOverrides は指定された献立IDすべてについて、
// 食材必要量の上書きをまとめて取得する(N+1を避けるため2クエリ構成)。
func queryPlanIngredientOverrides(ctx context.Context, db *sql.DB, planIDs []int64) (map[int64][]PlanIngredientOverride, error) {
	if len(planIDs) == 0 {
		return map[int64][]PlanIngredientOverride{}, nil
	}
	placeholders := make([]string, len(planIDs))
	args := make([]any, len(planIDs))
	for i, id := range planIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`
		SELECT plan_id, ingredient_id, quantity
		FROM plan_ingredient_overrides
		WHERE plan_id IN (%s)
		ORDER BY plan_id, ingredient_id
	`, strings.Join(placeholders, ","))

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int64][]PlanIngredientOverride)
	for rows.Next() {
		var planID int64
		var o PlanIngredientOverride
		if err := rows.Scan(&planID, &o.IngredientID, &o.Quantity); err != nil {
			return nil, err
		}
		result[planID] = append(result[planID], o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
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

func (r *PlanRepository) Update(ctx context.Context, id int64, date string, recipeID *int64, servings int, mealTime, note string, overrides []PlanIngredientOverride) (PlanDetail, error) {
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
	if len(overrides) > 0 {
		ids := make([]int64, len(overrides))
		for i, o := range overrides {
			ids[i] = o.IngredientID
		}
		if err := validateIngredientsExist(ctx, tx, ids); err != nil {
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

	if _, err := tx.ExecContext(ctx, "DELETE FROM plan_ingredient_overrides WHERE plan_id = ?", id); err != nil {
		return PlanDetail{}, classifySQLiteError(err)
	}
	for _, o := range overrides {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO plan_ingredient_overrides (plan_id, ingredient_id, quantity) VALUES (?, ?, ?)",
			id, o.IngredientID, o.Quantity,
		); err != nil {
			return PlanDetail{}, classifySQLiteError(err)
		}
	}

	if err := tx.Commit(); err != nil {
		return PlanDetail{}, err
	}
	return r.Get(ctx, id)
}

// Delete は献立と、それに紐づく食材必要量の上書きを同一トランザクションで削除する。
func (r *PlanRepository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM plan_ingredient_overrides WHERE plan_id = ?", id); err != nil {
		return classifySQLiteError(err)
	}

	res, err := tx.ExecContext(ctx, "DELETE FROM plans WHERE id = ?", id)
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
