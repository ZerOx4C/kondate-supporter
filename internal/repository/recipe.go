package repository

import (
	"context"
	"database/sql"
	"errors"

	"kondate-supporter/internal/model"
)

// ErrNotFound は対象の行が存在しないことを表す。
var ErrNotFound = errors.New("not found")

// recipeColumns はmodel.Recipeの各フィールドに対応するSELECT/RETURNING列。
// typeof(image)は列の型だけを見るので、画像の本体は読まない。
const recipeColumns = `id, name, body, cooked_count, typeof(image) = 'blob', image_version`

type RecipeRepository struct {
	db *sql.DB
}

func NewRecipeRepository(db *sql.DB) *RecipeRepository {
	return &RecipeRepository{db: db}
}

// List はレシピをid昇順で返す。0件のときは空スライスを返す。
func (r *RecipeRepository) List(ctx context.Context) ([]model.Recipe, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+recipeColumns+` FROM recipes ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recipes := []model.Recipe{}
	for rows.Next() {
		var rec model.Recipe
		if err := rows.Scan(&rec.ID, &rec.Name, &rec.Body, &rec.CookedCount, &rec.HasImage, &rec.ImageVersion); err != nil {
			return nil, err
		}
		recipes = append(recipes, rec)
	}
	return recipes, rows.Err()
}

func (r *RecipeRepository) Get(ctx context.Context, id int64) (model.Recipe, error) {
	var rec model.Recipe
	err := r.db.QueryRowContext(ctx, `SELECT `+recipeColumns+` FROM recipes WHERE id = ?`, id).
		Scan(&rec.ID, &rec.Name, &rec.Body, &rec.CookedCount, &rec.HasImage, &rec.ImageVersion)
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

// Update は名前と本文を更新し、更新後のレシピを返す。cooked_countは変更しない。
func (r *RecipeRepository) Update(ctx context.Context, id int64, name, body string) (model.Recipe, error) {
	return scanReturned(r.db.QueryRowContext(ctx,
		`UPDATE recipes SET name = ?, body = ? WHERE id = ? RETURNING `+recipeColumns, name, body, id))
}

// IncrementCookedCount は作った回数を1増やし、更新後のレシピを返す。
func (r *RecipeRepository) IncrementCookedCount(ctx context.Context, id int64) (model.Recipe, error) {
	return scanReturned(r.db.QueryRowContext(ctx,
		`UPDATE recipes SET cooked_count = cooked_count + 1 WHERE id = ? RETURNING `+recipeColumns, id))
}

// DecrementCookedCount は作った回数を1減らし(0未満にはしない)、更新後のレシピを返す。
func (r *RecipeRepository) DecrementCookedCount(ctx context.Context, id int64) (model.Recipe, error) {
	return scanReturned(r.db.QueryRowContext(ctx,
		`UPDATE recipes SET cooked_count = MAX(cooked_count - 1, 0) WHERE id = ? RETURNING `+recipeColumns, id))
}

// SetImage は画像を保存してimage_versionを1増やし、更新後のレシピを返す。
func (r *RecipeRepository) SetImage(ctx context.Context, id int64, data []byte) (model.Recipe, error) {
	return scanReturned(r.db.QueryRowContext(ctx,
		`UPDATE recipes SET image = ?, image_version = image_version + 1 WHERE id = ? RETURNING `+recipeColumns, data, id))
}

// DeleteImage は画像を外し、更新後のレシピを返す。image_versionは戻さない。
func (r *RecipeRepository) DeleteImage(ctx context.Context, id int64) (model.Recipe, error) {
	return scanReturned(r.db.QueryRowContext(ctx,
		`UPDATE recipes SET image = NULL WHERE id = ? RETURNING `+recipeColumns, id))
}

// GetImage は画像のバイト列を返す。レシピが無ければErrNotFound、画像が無ければnilを返す。
func (r *RecipeRepository) GetImage(ctx context.Context, id int64) ([]byte, error) {
	var data []byte
	err := r.db.QueryRowContext(ctx, `SELECT image FROM recipes WHERE id = ?`, id).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return data, err
}

// scanReturned はUPDATE ... RETURNINGの行を読む。行が無ければErrNotFoundを返す。
func scanReturned(row *sql.Row) (model.Recipe, error) {
	var rec model.Recipe
	err := row.Scan(&rec.ID, &rec.Name, &rec.Body, &rec.CookedCount, &rec.HasImage, &rec.ImageVersion)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Recipe{}, ErrNotFound
	}
	return rec, err
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
