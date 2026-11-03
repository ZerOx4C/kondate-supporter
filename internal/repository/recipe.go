package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"kondate-supporter/internal/model"
)

// ErrNotFound は対象の行が存在しないことを表す。
var ErrNotFound = errors.New("not found")

// recipeColumns はmodel.Recipeの各フィールドに対応するSELECT/RETURNING列。
// typeof(image)は列の型だけを見るので、画像の本体は読まない。
// EXISTSはブックマークの有無。その後ろはタグ名のJSON配列(タグのid昇順、無ければ"[]")、
// 末尾は材料のJSON配列(並び順どおり、無ければ"[]")で、scanRecipeが読む。
const recipeColumns = `id, name, body, cooked_count, servings, typeof(image) = 'blob', image_version,
	EXISTS (SELECT 1 FROM recipe_bookmarks b WHERE b.recipe_id = recipes.id),
	(SELECT json_group_array(t.name ORDER BY t.id) FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.recipe_id = recipes.id),
	(SELECT json_group_array(json_object('name', i.name, 'quantity', i.quantity, 'format', i.format) ORDER BY i.position)
		FROM recipe_ingredients i WHERE i.recipe_id = recipes.id)`

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
		rec, err := scanRecipe(rows)
		if err != nil {
			return nil, err
		}
		recipes = append(recipes, rec)
	}
	return recipes, rows.Err()
}

func (r *RecipeRepository) Get(ctx context.Context, id int64) (model.Recipe, error) {
	return scanReturned(r.db.QueryRowContext(ctx, `SELECT `+recipeColumns+` FROM recipes WHERE id = ?`, id))
}

// Create はレシピ・タグ・材料を追加し、追加後のレシピを返す。
func (r *RecipeRepository) Create(ctx context.Context, name, body string, servings int64, tags []string, ingredients []model.Ingredient) (model.Recipe, error) {
	var rec model.Recipe
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `INSERT INTO recipes (name, body, servings) VALUES (?, ?, ?)`, name, body, servings)
		if err != nil {
			return err
		}
		id, err := res.LastInsertId()
		if err != nil {
			return err
		}
		if err := replaceTags(ctx, tx, id, tags); err != nil {
			return err
		}
		if err := replaceIngredients(ctx, tx, id, ingredients); err != nil {
			return err
		}
		rec, err = scanReturned(tx.QueryRowContext(ctx, `SELECT `+recipeColumns+` FROM recipes WHERE id = ?`, id))
		return err
	})
	return rec, err
}

// Import はレシピを配列の順に1つのトランザクションで追加し、追加した件数を返す。
// タグは足すだけで外さないため、未使用のタグは生まれず deleteUnusedTags は呼ばない。
func (r *RecipeRepository) Import(ctx context.Context, recs []model.Recipe) (int, error) {
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		for _, rec := range recs {
			res, err := tx.ExecContext(ctx,
				`INSERT INTO recipes (name, body, cooked_count) VALUES (?, ?, ?)`, rec.Name, rec.Body, rec.CookedCount)
			if err != nil {
				return err
			}
			id, err := res.LastInsertId()
			if err != nil {
				return err
			}
			if err := addTags(ctx, tx, id, rec.Tags); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return len(recs), nil
}

// Update は名前・本文・人数・タグ・材料を更新し、更新後のレシピを返す。cooked_countは変更しない。
// タグと材料は丸ごと置き換える。存在しないidに付けると外部キー違反になるため、UPDATEを先に行う。
func (r *RecipeRepository) Update(ctx context.Context, id int64, name, body string, servings int64, tags []string, ingredients []model.Ingredient) (model.Recipe, error) {
	var rec model.Recipe
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE recipes SET name = ?, body = ?, servings = ? WHERE id = ?`, name, body, servings, id)
		if err != nil {
			return err
		}
		if err := requireAffected(res); err != nil {
			return err
		}
		if err := replaceTags(ctx, tx, id, tags); err != nil {
			return err
		}
		if err := replaceIngredients(ctx, tx, id, ingredients); err != nil {
			return err
		}
		rec, err = scanReturned(tx.QueryRowContext(ctx, `SELECT `+recipeColumns+` FROM recipes WHERE id = ?`, id))
		return err
	})
	return rec, err
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

// SetBookmark はブックマークを付け(付いていれば何もしない)、更新後のレシピを返す。
// 存在しないidにはVALUESで入れると外部キー違反になるため、recipesから選んで入れる。
func (r *RecipeRepository) SetBookmark(ctx context.Context, id int64) (model.Recipe, error) {
	var rec model.Recipe
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO recipe_bookmarks (recipe_id) SELECT id FROM recipes WHERE id = ? ON CONFLICT(recipe_id) DO NOTHING`, id)
		if err != nil {
			return err
		}
		rec, err = scanReturned(tx.QueryRowContext(ctx, `SELECT `+recipeColumns+` FROM recipes WHERE id = ?`, id))
		return err
	})
	return rec, err
}

// DeleteBookmark はブックマークを外し(付いていなければ何もしない)、更新後のレシピを返す。
func (r *RecipeRepository) DeleteBookmark(ctx context.Context, id int64) (model.Recipe, error) {
	var rec model.Recipe
	err := inTx(ctx, r.db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM recipe_bookmarks WHERE recipe_id = ?`, id); err != nil {
			return err
		}
		var err error
		rec, err = scanReturned(tx.QueryRowContext(ctx, `SELECT `+recipeColumns+` FROM recipes WHERE id = ?`, id))
		return err
	})
	return rec, err
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

// rowScanner は *sql.Row と *sql.Rows の両方を受けるためのScan部分。
type rowScanner interface {
	Scan(dest ...any) error
}

// scanRecipe はrecipeColumnsの順に並んだ1行を読む。
func scanRecipe(row rowScanner) (model.Recipe, error) {
	var rec model.Recipe
	var tags, ingredients string
	if err := row.Scan(&rec.ID, &rec.Name, &rec.Body, &rec.CookedCount, &rec.Servings, &rec.HasImage, &rec.ImageVersion, &rec.Bookmarked, &tags, &ingredients); err != nil {
		return model.Recipe{}, err
	}
	if err := json.Unmarshal([]byte(tags), &rec.Tags); err != nil {
		return model.Recipe{}, err
	}
	if err := json.Unmarshal([]byte(ingredients), &rec.Ingredients); err != nil {
		return model.Recipe{}, err
	}
	return rec, nil
}

// scanReturned は1行を読む(SELECTでもRETURNINGでもよい)。行が無ければErrNotFoundを返す。
func scanReturned(row *sql.Row) (model.Recipe, error) {
	rec, err := scanRecipe(row)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Recipe{}, ErrNotFound
	}
	return rec, err
}

// Delete はレシピを消し、どのレシピにも付いていないタグを消す。recipe_tagsはCASCADEで消える。
func (r *RecipeRepository) Delete(ctx context.Context, id int64) error {
	return inTx(ctx, r.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `DELETE FROM recipes WHERE id = ?`, id)
		if err != nil {
			return err
		}
		if err := requireAffected(res); err != nil {
			return err
		}
		return deleteUnusedTags(ctx, tx)
	})
}

// ListTags は使われているタグ名をid昇順で返す。0件のときは空スライスを返す。
func (r *RecipeRepository) ListTags(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT name FROM tags ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tags = append(tags, name)
	}
	return tags, rows.Err()
}

// ListIngredientNames は使われている材料名を、使っているレシピが多い順(同数は最初に使ったレシピのid順、
// 同じレシピでは並び順)に重複なしで返す。0件のときは空スライスを返す。
func (r *RecipeRepository) ListIngredientNames(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		WITH ordered AS (
			SELECT name, recipe_id, ROW_NUMBER() OVER (ORDER BY recipe_id, position) AS seq
			FROM recipe_ingredients
		)
		SELECT name FROM ordered
		GROUP BY name
		ORDER BY COUNT(DISTINCT recipe_id) DESC, MIN(seq)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	names := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// replaceTagsはレシピのタグをnamesに置き換える。紐付けを全部消して付け直した後に、
// どのレシピにも付いていないタグを消す(付けたままのタグのidを変えないため)。
func replaceTags(ctx context.Context, tx *sql.Tx, recipeID int64, names []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM recipe_tags WHERE recipe_id = ?`, recipeID); err != nil {
		return err
	}
	if err := addTags(ctx, tx, recipeID, names); err != nil {
		return err
	}
	return deleteUnusedTags(ctx, tx)
}

// replaceIngredients はレシピの材料をingsに置き換える。全部消して、並び順を表すpositionを0から振って入れ直す。
func replaceIngredients(ctx context.Context, tx *sql.Tx, recipeID int64, ings []model.Ingredient) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM recipe_ingredients WHERE recipe_id = ?`, recipeID); err != nil {
		return err
	}
	for i, ing := range ings {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO recipe_ingredients (recipe_id, position, name, quantity, format) VALUES (?, ?, ?, ?, ?)`,
			recipeID, i, ing.Name, ing.Quantity, ing.Format); err != nil {
			return err
		}
	}
	return nil
}

// addTags はレシピにnamesのタグを付ける。タグが無ければ作る。
func addTags(ctx context.Context, tx *sql.Tx, recipeID int64, names []string) error {
	for _, name := range names {
		if _, err := tx.ExecContext(ctx, `INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING`, name); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO recipe_tags (recipe_id, tag_id) SELECT ?, id FROM tags WHERE name = ?`, recipeID, name); err != nil {
			return err
		}
	}
	return nil
}

func deleteUnusedTags(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM recipe_tags)`)
	return err
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
