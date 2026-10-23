package config

import "os"

// Config はアプリケーション全体の設定。環境変数から読み込む。
type Config struct {
	// Addr は待ち受けアドレス(KONDATE_ADDR、既定 ":8080")。
	Addr string
	// DBPath はSQLiteファイルのパス(KONDATE_DB_PATH、既定 "data/kondate.db")。
	DBPath string
	// DevMode がtrueのとき、画面ファイルをembedではなくディスクから配信し、画面の背景に開発モードの模様を出す(DEV_MODE=1)。
	DevMode bool
}

// Load は環境変数から設定を読み込む。
func Load() Config {
	return Config{
		Addr:    getEnv("KONDATE_ADDR", ":8080"),
		DBPath:  getEnv("KONDATE_DB_PATH", "data/kondate.db"),
		DevMode: os.Getenv("DEV_MODE") == "1",
	}
}

// getEnv は環境変数の値を返す。未設定または空文字のときはfallbackを返す。
func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
