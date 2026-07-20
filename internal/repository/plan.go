package repository

import "database/sql"

// PlanRepository は model.Plan のDBアクセスを提供する。
// TODO: CRUDメソッドを実装する。
type PlanRepository struct {
	db *sql.DB
}

func NewPlanRepository(db *sql.DB) *PlanRepository {
	return &PlanRepository{db: db}
}
