package repository

import (
	"context"
	"database/sql"
	"errors"

	"kondate-supporter/internal/model"
)

// SeasoningRepository は model.Seasoning のDBアクセスを提供する。
// 調味料は在庫管理の対象外のため、stocksに相当するテーブルは扱わない。
type SeasoningRepository struct {
	db *sql.DB
}

func NewSeasoningRepository(db *sql.DB) *SeasoningRepository {
	return &SeasoningRepository{db: db}
}

func (r *SeasoningRepository) List(ctx context.Context) ([]model.Seasoning, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name FROM seasonings ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seasonings := []model.Seasoning{}
	for rows.Next() {
		var s model.Seasoning
		if err := rows.Scan(&s.ID, &s.Name); err != nil {
			return nil, err
		}
		seasonings = append(seasonings, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return seasonings, nil
}

func (r *SeasoningRepository) Get(ctx context.Context, id int64) (model.Seasoning, error) {
	var s model.Seasoning
	err := r.db.QueryRowContext(ctx, "SELECT id, name FROM seasonings WHERE id = ?", id).
		Scan(&s.ID, &s.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Seasoning{}, ErrNotFound
	}
	if err != nil {
		return model.Seasoning{}, err
	}
	return s, nil
}

func (r *SeasoningRepository) Create(ctx context.Context, name string) (model.Seasoning, error) {
	res, err := r.db.ExecContext(ctx, "INSERT INTO seasonings (name) VALUES (?)", name)
	if err != nil {
		return model.Seasoning{}, classifySQLiteError(err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return model.Seasoning{}, err
	}
	return model.Seasoning{ID: id, Name: name}, nil
}

func (r *SeasoningRepository) Update(ctx context.Context, id int64, name string) (model.Seasoning, error) {
	res, err := r.db.ExecContext(ctx, "UPDATE seasonings SET name = ? WHERE id = ?", name, id)
	if err != nil {
		return model.Seasoning{}, classifySQLiteError(err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return model.Seasoning{}, err
	}
	if affected == 0 {
		return model.Seasoning{}, ErrNotFound
	}
	return model.Seasoning{ID: id, Name: name}, nil
}

// Delete は調味料を削除する。recipe_seasoningsから参照中の調味料は
// 外部キー制約違反となり、ErrInUseに変換される。
func (r *SeasoningRepository) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM seasonings WHERE id = ?", id)
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
