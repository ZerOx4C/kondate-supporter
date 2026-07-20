package repository

import (
	"context"
	"database/sql"
)

// StockDetail は在庫と食材情報をJOINした結果。repository層はHTTP/JSONを
// 意識しないため、JSONタグは付けない(レスポンス整形はhandler層の責務)。
type StockDetail struct {
	IngredientID int64
	Name         string
	Unit         string
	Quantity     float64
	UpdatedAt    string
}

// StockRepository は model.Stock のDBアクセスを提供する。
type StockRepository struct {
	db *sql.DB
}

func NewStockRepository(db *sql.DB) *StockRepository {
	return &StockRepository{db: db}
}

func (r *StockRepository) List(ctx context.Context) ([]StockDetail, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT i.id, i.name, i.unit, s.quantity, s.updated_at
		FROM stocks s
		JOIN ingredients i ON i.id = s.ingredient_id
		ORDER BY i.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	details := []StockDetail{}
	for rows.Next() {
		var d StockDetail
		if err := rows.Scan(&d.IngredientID, &d.Name, &d.Unit, &d.Quantity, &d.UpdatedAt); err != nil {
			return nil, err
		}
		details = append(details, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return details, nil
}

// UpdateQuantity は食材IDに対応する在庫数量を更新する。
// stocksは食材作成時に自動生成されるため、対象行が無い場合はErrNotFoundを返す。
func (r *StockRepository) UpdateQuantity(ctx context.Context, ingredientID int64, quantity float64) error {
	res, err := r.db.ExecContext(ctx,
		"UPDATE stocks SET quantity = ?, updated_at = datetime('now') WHERE ingredient_id = ?",
		quantity, ingredientID,
	)
	if err != nil {
		return err
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
