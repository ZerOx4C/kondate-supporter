package db

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Open はpathのSQLiteファイルを開く。親ディレクトリが無ければ作る。
func Open(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create db dir: %w", err)
		}
	}

	// modernc.org/sqliteはコネクションプールが新規接続を作るたびにDSNの
	// _pragmaパラメータを適用する。conn.Exec()による事後設定だと、プールが
	// 新規接続を作った場合に設定が反映されないことがあるため、DSNに埋め込む。
	dsn := fmt.Sprintf("%s?_pragma=busy_timeout(5000)", path)

	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// 書き込みを単一接続に直列化し、SQLITE_BUSY(database is locked)を防ぐ。
	// 個人利用・単一プロセス常時稼働という前提のため、これで十分安全。
	conn.SetMaxOpenConns(1)

	return conn, nil
}

// Migrate は migrations 配下のうち schema_migrations に未記録のものを、
// ファイル名昇順・1ファイル1トランザクションで適用する。
func Migrate(conn *sql.DB) error {
	if _, err := conn.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name       TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	for _, name := range names {
		var applied int
		if err := conn.QueryRow(
			"SELECT COUNT(*) FROM schema_migrations WHERE name = ?", name,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied > 0 {
			continue
		}

		content, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		tx, err := conn.Begin()
		if err != nil {
			return fmt.Errorf("begin tx for %s: %w", name, err)
		}
		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.Exec(
			"INSERT INTO schema_migrations (name) VALUES (?)", name,
		); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
		log.Printf("applied migration: %s", name)
	}

	return nil
}
