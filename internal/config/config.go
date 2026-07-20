package config

import "os"

type Config struct {
	Addr    string
	DBPath  string
	DevMode bool
}

func Load() Config {
	return Config{
		Addr:    getEnv("KONDATE_ADDR", ":8080"),
		DBPath:  getEnv("KONDATE_DB_PATH", "data/kondate.db"),
		DevMode: os.Getenv("DEV_MODE") == "1",
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
