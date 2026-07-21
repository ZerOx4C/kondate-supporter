// kondate-supporter APIを呼び出すための最小限のfetchラッパー。

async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function checkHealth() {
  try {
    const data = await apiRequest('/healthz');
    return data.status === 'ok';
  } catch {
    return false;
  }
}

function listIngredients() {
  return apiRequest('/api/ingredients');
}

function createIngredient(name, unit) {
  return apiRequest('/api/ingredients', {
    method: 'POST',
    body: JSON.stringify({ name, unit }),
  });
}

function updateIngredient(id, name, unit) {
  return apiRequest(`/api/ingredients/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, unit }),
  });
}

function deleteIngredient(id) {
  return apiRequest(`/api/ingredients/${id}`, { method: 'DELETE' });
}

function listStocks() {
  return apiRequest('/api/stocks');
}

function updateStockQuantity(ingredientId, quantity) {
  return apiRequest(`/api/stocks/${ingredientId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

function listRecipes() {
  return apiRequest('/api/recipes');
}

function getRecipe(id) {
  return apiRequest(`/api/recipes/${id}`);
}

function createRecipe(name, description, servings, ingredients) {
  return apiRequest('/api/recipes', {
    method: 'POST',
    body: JSON.stringify({ name, description, servings, ingredients }),
  });
}

function updateRecipe(id, name, description, servings, ingredients) {
  return apiRequest(`/api/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description, servings, ingredients }),
  });
}

function deleteRecipe(id) {
  return apiRequest(`/api/recipes/${id}`, { method: 'DELETE' });
}

function listPlans(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return apiRequest(`/api/plans${query ? `?${query}` : ''}`);
}

function getPlan(id) {
  return apiRequest(`/api/plans/${id}`);
}

function createPlan(date, recipeId, servings, mealTime) {
  return apiRequest('/api/plans', {
    method: 'POST',
    body: JSON.stringify({ date, recipeId, servings, mealTime }),
  });
}

function updatePlan(id, date, recipeId, servings, mealTime) {
  return apiRequest(`/api/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ date, recipeId, servings, mealTime }),
  });
}

function deletePlan(id) {
  return apiRequest(`/api/plans/${id}`, { method: 'DELETE' });
}

function getPlanSummary(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return apiRequest(`/api/plans/summary${query ? `?${query}` : ''}`);
}

function getShoppingList(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return apiRequest(`/api/shoppinglist${query ? `?${query}` : ''}`);
}
