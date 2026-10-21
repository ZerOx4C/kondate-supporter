package main

import (
	"io/fs"
	"log"
	"net/http"
	"os"

	"kondate-supporter/internal/config"
	"kondate-supporter/internal/db"
	"kondate-supporter/internal/handler"
	"kondate-supporter/internal/repository"
	"kondate-supporter/internal/service"
	"kondate-supporter/web"
)

func main() {
	cfg := config.Load()

	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer conn.Close()
	if err := db.Migrate(conn); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	var staticFS fs.FS
	if cfg.DevMode {
		staticFS = os.DirFS("web/static")
	} else {
		staticFS, err = web.StaticFS()
		if err != nil {
			log.Fatalf("static files: %v", err)
		}
	}

	recipeRepo := repository.NewRecipeRepository(conn)
	recipeSvc := service.NewRecipeService(recipeRepo)
	recipeHandler := handler.NewRecipeHandler(recipeSvc)

	router := handler.NewRouter(staticFS, recipeHandler)

	log.Printf("listening on %s (db: %s, dev mode: %v)", cfg.Addr, cfg.DBPath, cfg.DevMode)
	if err := http.ListenAndServe(cfg.Addr, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
