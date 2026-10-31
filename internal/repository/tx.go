package repository

import (
	"context"
	"database/sql"
)

// inTx はfnをトランザクション内で実行する。fnがエラーを返せばロールバックする。
// 接続は1本に制限しているため、fnの中では必ず引数のtxを使うこと。dbを使うと
// 空き接続を待ち続けて止まる。
func inTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}
