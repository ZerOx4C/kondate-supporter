package repository

import "database/sql"

// StockRepository は model.Stock のDBアクセスを提供する。
// TODO: CRUDメソッドを実装する。
type StockRepository struct {
	db *sql.DB
}

func NewStockRepository(db *sql.DB) *StockRepository {
	return &StockRepository{db: db}
}
