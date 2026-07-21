package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"kondate-supporter/internal/model"
)

// RecipeIngredientInput はレシピ作成・更新時に指定する材料1件分の入力。
type RecipeIngredientInput struct {
	IngredientID int64
	Quantity     float64
}

// RecipeIngredientDetail は材料と食材情報をJOINした結果。repository層は
// HTTP/JSONを意識しないため、JSONタグは付けない。
type RecipeIngredientDetail struct {
	IngredientID int64
	Name         string
	Unit         string
	Quantity     float64
}

// RecipeDetail はレシピ本体と材料リストをまとめた結果。
type RecipeDetail struct {
	Recipe      model.Recipe
	Ingredients []RecipeIngredientDetail
}

// RecipeRepository は model.Recipe と model.RecipeIngredient の
// DBアクセスを提供する。
type RecipeRepository struct {
	db *sql.DB
}

func NewRecipeRepository(db *sql.DB) *RecipeRepository {
	return &RecipeRepository{db: db}
}

func (r *RecipeRepository) List(ctx context.Context) ([]model.Recipe, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, description, servings FROM recipes ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recipes := []model.Recipe{}
	for rows.Next() {
		var rec model.Recipe
		if err := rows.Scan(&rec.ID, &rec.Name, &rec.Description, &rec.Servings); err != nil {
			return nil, err
		}
		recipes = append(recipes, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return recipes, nil
}

// ListWithIngredients は全レシピを、各レシピの材料情報付きで返す。
// recipesを1回、recipe_ingredientsを1回の計2クエリで取得し、N+1を避ける。
func (r *RecipeRepository) ListWithIngredients(ctx context.Context) ([]RecipeDetail, error) {
	recipes, err := r.List(ctx)
	if err != nil {
		return nil, err
	}
	ingredientsByRecipe, err := queryAllRecipeIngredients(ctx, r.db)
	if err != nil {
		return nil, err
	}
	details := make([]RecipeDetail, 0, len(recipes))
	for _, rec := range recipes {
		details = append(details, RecipeDetail{Recipe: rec, Ingredients: ingredientsByRecipe[rec.ID]})
	}
	return details, nil
}

// queryAllRecipeIngredients は全recipe_ingredientsをJOIN取得し、recipe_idごとにグルーピングする。
func queryAllRecipeIngredients(ctx context.Context, db *sql.DB) (map[int64][]RecipeIngredientDetail, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT ri.recipe_id, i.id, i.name, i.unit, ri.quantity
		FROM recipe_ingredients ri
		JOIN ingredients i ON i.id = ri.ingredient_id
		ORDER BY ri.recipe_id, ri.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int64][]RecipeIngredientDetail)
	for rows.Next() {
		var recipeID int64
		var d RecipeIngredientDetail
		if err := rows.Scan(&recipeID, &d.IngredientID, &d.Name, &d.Unit, &d.Quantity); err != nil {
			return nil, err
		}
		result[recipeID] = append(result[recipeID], d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *RecipeRepository) Get(ctx context.Context, id int64) (RecipeDetail, error) {
	var rec model.Recipe
	err := r.db.QueryRowContext(ctx,
		"SELECT id, name, description, servings FROM recipes WHERE id = ?", id,
	).Scan(&rec.ID, &rec.Name, &rec.Description, &rec.Servings)
	if errors.Is(err, sql.ErrNoRows) {
		return RecipeDetail{}, ErrNotFound
	}
	if err != nil {
		return RecipeDetail{}, err
	}

	ingredients, err := queryRecipeIngredients(ctx, r.db, id)
	if err != nil {
		return RecipeDetail{}, err
	}
	return RecipeDetail{Recipe: rec, Ingredients: ingredients}, nil
}

// queryRecipeIngredients は*sql.DB/*sql.Txどちらでも呼べるよう
// 必要最小限のインターフェースを受け取る。
func queryRecipeIngredients(ctx context.Context, q interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}, recipeID int64) ([]RecipeIngredientDetail, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT i.id, i.name, i.unit, ri.quantity
		FROM recipe_ingredients ri
		JOIN ingredients i ON i.id = ri.ingredient_id
		WHERE ri.recipe_id = ?
		ORDER BY ri.id
	`, recipeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	details := []RecipeIngredientDetail{}
	for rows.Next() {
		var d RecipeIngredientDetail
		if err := rows.Scan(&d.IngredientID, &d.Name, &d.Unit, &d.Quantity); err != nil {
			return nil, err
		}
		details = append(details, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return details, nil
}

// validateIngredientsExist は指定された食材IDがすべて存在するか検証する。
// 存在しないIDが1つでもあればErrIngredientNotFoundを返す。SQLiteの外部キー
// 制約(削除時の「使用中」判定と同じエラーコード)には頼らず、事前に
// 明示的なクエリで検出する。
func validateIngredientsExist(ctx context.Context, tx *sql.Tx, items []RecipeIngredientInput) error {
	if len(items) == 0 {
		return nil
	}
	idSet := make(map[int64]struct{}, len(items))
	for _, item := range items {
		idSet[item.IngredientID] = struct{}{}
	}
	placeholders := make([]string, 0, len(idSet))
	args := make([]any, 0, len(idSet))
	for id := range idSet {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}
	query := fmt.Sprintf("SELECT COUNT(*) FROM ingredients WHERE id IN (%s)", strings.Join(placeholders, ","))
	var count int
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&count); err != nil {
		return err
	}
	if count != len(idSet) {
		return ErrIngredientNotFound
	}
	return nil
}

// Create はレシピ本体と材料リストを同一トランザクションで作成する。
func (r *RecipeRepository) Create(ctx context.Context, name, description string, servings int, items []RecipeIngredientInput) (RecipeDetail, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return RecipeDetail{}, err
	}
	defer tx.Rollback()

	if err := validateIngredientsExist(ctx, tx, items); err != nil {
		return RecipeDetail{}, err
	}

	res, err := tx.ExecContext(ctx,
		"INSERT INTO recipes (name, description, servings) VALUES (?, ?, ?)",
		name, description, servings,
	)
	if err != nil {
		return RecipeDetail{}, classifySQLiteError(err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return RecipeDetail{}, err
	}

	for _, item := range items {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)",
			id, item.IngredientID, item.Quantity,
		); err != nil {
			return RecipeDetail{}, classifySQLiteError(err)
		}
	}

	if err := tx.Commit(); err != nil {
		return RecipeDetail{}, err
	}
	return r.Get(ctx, id)
}

// Update はレシピ本体を更新し、材料リストを全削除→再INSERTする
// (delete-then-insert。個人利用規模では差分更新より単純さを優先)。
func (r *RecipeRepository) Update(ctx context.Context, id int64, name, description string, servings int, items []RecipeIngredientInput) (RecipeDetail, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return RecipeDetail{}, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx,
		"UPDATE recipes SET name = ?, description = ?, servings = ? WHERE id = ?",
		name, description, servings, id,
	)
	if err != nil {
		return RecipeDetail{}, classifySQLiteError(err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return RecipeDetail{}, err
	}
	if affected == 0 {
		return RecipeDetail{}, ErrNotFound
	}

	if err := validateIngredientsExist(ctx, tx, items); err != nil {
		return RecipeDetail{}, err
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM recipe_ingredients WHERE recipe_id = ?", id); err != nil {
		return RecipeDetail{}, classifySQLiteError(err)
	}
	for _, item := range items {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)",
			id, item.IngredientID, item.Quantity,
		); err != nil {
			return RecipeDetail{}, classifySQLiteError(err)
		}
	}

	if err := tx.Commit(); err != nil {
		return RecipeDetail{}, err
	}
	return r.Get(ctx, id)
}

// Delete はレシピと紐づく材料行を削除する。plansから参照中のレシピは
// 外部キー制約違反となり、ErrInUseに変換される。
func (r *RecipeRepository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM recipe_ingredients WHERE recipe_id = ?", id); err != nil {
		return classifySQLiteError(err)
	}

	res, err := tx.ExecContext(ctx, "DELETE FROM recipes WHERE id = ?", id)
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
