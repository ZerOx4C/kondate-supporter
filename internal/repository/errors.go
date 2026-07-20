package repository

import (
	"errors"

	"modernc.org/sqlite"
)

var (
	ErrNotFound        = errors.New("見つかりません")
	ErrDuplicateName   = errors.New("同名のレコードが既に存在します")
	ErrIngredientInUse = errors.New("使用中の食材です")
)

// SQLiteの拡張結果コード(公式ドキュメントで定義された固定値)。
const (
	sqliteConstraintUnique     = 2067 // SQLITE_CONSTRAINT_UNIQUE
	sqliteConstraintForeignKey = 787  // SQLITE_CONSTRAINT_FOREIGNKEY
)

// classifySQLiteError はSQLite由来の制約違反エラーをrepository層の
// sentinel errorに変換する。該当しなければerrをそのまま返す。
func classifySQLiteError(err error) error {
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		switch sqliteErr.Code() {
		case sqliteConstraintUnique:
			return ErrDuplicateName
		case sqliteConstraintForeignKey:
			return ErrIngredientInUse
		}
	}
	return err
}
