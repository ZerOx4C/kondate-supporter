package main

import (
	"io/fs"
	"log"
	"net/http"
	"os"

	"kondate-supporter/internal/config"
	"kondate-supporter/internal/handler"
	"kondate-supporter/web"
)

func main() {
	cfg := config.Load()

	var staticFS fs.FS
	if cfg.DevMode {
		staticFS = os.DirFS("web/static")
	} else {
		var err error
		staticFS, err = web.StaticFS()
		if err != nil {
			log.Fatalf("static files: %v", err)
		}
	}

	router := handler.NewRouter(staticFS)

	log.Printf("listening on %s (dev mode: %v)", cfg.Addr, cfg.DevMode)
	if err := http.ListenAndServe(cfg.Addr, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
