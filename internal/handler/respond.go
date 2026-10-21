package handler

import (
	"encoding/json"
	"net/http"
)

// writeJSON はvをJSONとして書き出す。vがnilのときはボディを書かない。
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// writeError は {"error": msg} をJSONとして書き出す。
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
