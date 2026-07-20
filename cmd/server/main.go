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
	"kondate-supporter/web"
)

func main() {
	cfg := config.Load()

	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	if err := db.Migrate(conn); err != nil {
		log.Fatalf("migrate db: %v", err)
	}

	staticFS, err := staticFileSystem(cfg.DevMode)
	if err != nil {
		log.Fatalf("load static files: %v", err)
	}

	ingredientRepo := repository.NewIngredientRepository(conn)
	stockRepo := repository.NewStockRepository(conn)
	recipeRepo := repository.NewRecipeRepository(conn)

	ingredientHandler := handler.NewIngredientHandler(ingredientRepo)
	stockHandler := handler.NewStockHandler(stockRepo)
	recipeHandler := handler.NewRecipeHandler(recipeRepo)

	router := handler.NewRouter(staticFS, ingredientHandler, stockHandler, recipeHandler)

	log.Printf("listening on %s (dev mode: %v)", cfg.Addr, cfg.DevMode)
	if err := http.ListenAndServe(cfg.Addr, router); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func staticFileSystem(devMode bool) (fs.FS, error) {
	if devMode {
		return os.DirFS("web/static"), nil
	}
	return web.StaticFS()
}
