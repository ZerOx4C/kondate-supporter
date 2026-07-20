package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// parsePathInt64 はパスパラメータkeyを64bit整数として取り出す。
func parsePathInt64(r *http.Request, key string) (int64, error) {
	return strconv.ParseInt(r.PathValue(key), 10, 64)
}

// parseDateRangeQuery はクエリパラメータfrom/to(どちらも省略可)を
// YYYY-MM-DD形式として検証して取り出す。
func parseDateRangeQuery(r *http.Request) (from, to string, err error) {
	from = r.URL.Query().Get("from")
	to = r.URL.Query().Get("to")
	if from != "" {
		if _, err := time.Parse(time.DateOnly, from); err != nil {
			return "", "", errors.New("fromはYYYY-MM-DD形式である必要があります")
		}
	}
	if to != "" {
		if _, err := time.Parse(time.DateOnly, to); err != nil {
			return "", "", errors.New("toはYYYY-MM-DD形式である必要があります")
		}
	}
	return from, to, nil
}
