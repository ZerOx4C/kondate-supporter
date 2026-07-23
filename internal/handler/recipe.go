package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"kondate-supporter/internal/imagestore"
	"kondate-supporter/internal/repository"
)

// maxImageUploadSize はレシピ画像アップロードの上限サイズ。RaspberryPi Zero
// のメモリ制約を踏まえ、無制限アップロードを許さない。
const maxImageUploadSize = 8 << 20 // 8MB

// RecipeHandler はレシピ関連のHTTPエンドポイントを提供する。
type RecipeHandler struct {
	repo       *repository.RecipeRepository
	imageStore *imagestore.Store
}

func NewRecipeHandler(repo *repository.RecipeRepository, imageStore *imagestore.Store) *RecipeHandler {
	return &RecipeHandler{repo: repo, imageStore: imageStore}
}

type recipeIngredientRequest struct {
	IngredientID int64   `json:"ingredientId"`
	Quantity     float64 `json:"quantity"`
}

type recipeRequest struct {
	Name        string                    `json:"name"`
	URL         string                    `json:"url"`
	Servings    int                       `json:"servings"`
	Ingredients []recipeIngredientRequest `json:"ingredients"`
	Steps       []string                  `json:"steps"`
}

func (req recipeRequest) validate() (name, url string, servings int, items []repository.RecipeIngredientInput, steps []string, err error) {
	name = strings.TrimSpace(req.Name)
	if name == "" {
		return "", "", 0, nil, nil, errors.New("nameは必須です")
	}
	url = strings.TrimSpace(req.URL)

	if req.Servings <= 0 {
		return "", "", 0, nil, nil, errors.New("servingsは1以上である必要があります")
	}

	seen := make(map[int64]struct{}, len(req.Ingredients))
	items = make([]repository.RecipeIngredientInput, 0, len(req.Ingredients))
	for _, ing := range req.Ingredients {
		if ing.Quantity <= 0 {
			return "", "", 0, nil, nil, errors.New("ingredientsのquantityは正の数である必要があります")
		}
		if _, dup := seen[ing.IngredientID]; dup {
			return "", "", 0, nil, nil, errors.New("ingredientsに同じingredientIdが重複しています")
		}
		seen[ing.IngredientID] = struct{}{}
		items = append(items, repository.RecipeIngredientInput{
			IngredientID: ing.IngredientID,
			Quantity:     ing.Quantity,
		})
	}

	steps = make([]string, 0, len(req.Steps))
	for _, s := range req.Steps {
		text := strings.TrimSpace(s)
		if text == "" {
			return "", "", 0, nil, nil, errors.New("stepsは空文字を含められません")
		}
		steps = append(steps, text)
	}

	return name, url, req.Servings, items, steps, nil
}

type recipeIngredientResponse struct {
	IngredientID int64   `json:"ingredientId"`
	Name         string  `json:"name"`
	Unit         string  `json:"unit"`
	Quantity     float64 `json:"quantity"`
}

type recipeResponse struct {
	ID          int64                      `json:"id"`
	Name        string                     `json:"name"`
	URL         string                     `json:"url"`
	Servings    int                        `json:"servings"`
	Ingredients []recipeIngredientResponse `json:"ingredients"`
	Steps       []string                   `json:"steps"`
	HasImage    bool                       `json:"hasImage"`
}

func toRecipeResponse(detail repository.RecipeDetail) recipeResponse {
	ingredients := make([]recipeIngredientResponse, 0, len(detail.Ingredients))
	for _, ing := range detail.Ingredients {
		ingredients = append(ingredients, recipeIngredientResponse{
			IngredientID: ing.IngredientID,
			Name:         ing.Name,
			Unit:         ing.Unit,
			Quantity:     ing.Quantity,
		})
	}
	steps := detail.Steps
	if steps == nil {
		steps = []string{}
	}
	return recipeResponse{
		ID:          detail.Recipe.ID,
		Name:        detail.Recipe.Name,
		URL:         detail.Recipe.URL,
		Servings:    detail.Recipe.Servings,
		Ingredients: ingredients,
		Steps:       steps,
		HasImage:    detail.Recipe.ImageExt != "",
	}
}

func (h *RecipeHandler) List(w http.ResponseWriter, r *http.Request) {
	details, err := h.repo.ListWithIngredients(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}
	responses := make([]recipeResponse, 0, len(details))
	for _, d := range details {
		responses = append(responses, toRecipeResponse(d))
	}
	writeJSON(w, http.StatusOK, responses)
}

func (h *RecipeHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, url, servings, items, steps, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Create(r.Context(), name, url, servings, items, steps)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toRecipeResponse(detail))
}

func (h *RecipeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	detail, err := h.repo.Get(r.Context(), id)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(detail))
}

func (h *RecipeHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, url, servings, items, steps, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Update(r.Context(), id, name, url, servings, items, steps)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(detail))
}

func (h *RecipeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		h.handleError(w, err)
		return
	}
	_ = h.imageStore.Delete(id) // 画像ファイル削除の失敗は致命的ではないため無視する
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *RecipeHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	if _, err := h.repo.Get(r.Context(), id); err != nil {
		h.handleError(w, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxImageUploadSize)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "画像が大きすぎるか、形式が不正です")
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "imageフィールドが必要です")
		return
	}
	defer file.Close()

	ext, err := h.imageStore.Save(id, file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "対応していない画像形式です")
		return
	}

	if err := h.repo.UpdateImageExt(r.Context(), id, ext); err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *RecipeHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	detail, err := h.repo.Get(r.Context(), id)
	if err != nil {
		h.handleError(w, err)
		return
	}
	if detail.Recipe.ImageExt == "" {
		writeError(w, http.StatusNotFound, "画像が登録されていません")
		return
	}
	http.ServeFile(w, r, h.imageStore.Path(id, detail.Recipe.ImageExt))
}

func (h *RecipeHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	if _, err := h.repo.Get(r.Context(), id); err != nil {
		h.handleError(w, err)
		return
	}
	if err := h.imageStore.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}
	if err := h.repo.UpdateImageExt(r.Context(), id, ""); err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *RecipeHandler) handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "レシピが見つかりません")
	case errors.Is(err, repository.ErrIngredientNotFound):
		writeError(w, http.StatusBadRequest, "存在しない食材が指定されています")
	case errors.Is(err, repository.ErrInUse):
		writeError(w, http.StatusConflict, "献立で使用中のレシピは削除できません")
	default:
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
	}
}
