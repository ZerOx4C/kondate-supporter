const rangeForm = document.getElementById('range-form');
const rangeFromField = document.getElementById('range-from');
const rangeToField = document.getElementById('range-to');
const planListBody = document.getElementById('plan-list');
const planForm = document.getElementById('plan-form');
const planIdField = document.getElementById('plan-id');
const planDateField = document.getElementById('plan-date');
const planMealTimeField = document.getElementById('plan-meal-time');
const planRecipeField = document.getElementById('plan-recipe');
const planServingsField = document.getElementById('plan-servings');
const planSubmitButton = document.getElementById('plan-submit');
const planCancelButton = document.getElementById('plan-cancel');
const planErrorEl = document.getElementById('plan-error');
const summaryListBody = document.getElementById('summary-list');
const summaryEmptyEl = document.getElementById('summary-empty');
const recipeSearchField = document.getElementById('recipe-search-field');
const recipeIngredientFilterOpenButton = document.getElementById('recipe-ingredient-filter-open');
const recipeIngredientFilterDialog = document.getElementById('recipe-ingredient-filter-dialog');
const recipeIngredientFilterCloseButton = document.getElementById('recipe-ingredient-filter-close');
const recipeIngredientSearchField = document.getElementById('recipe-ingredient-search-field');
const recipeIngredientFilterListEl = document.getElementById('recipe-ingredient-filter-list');
const recipeSelectedIngredientsEl = document.getElementById('recipe-selected-ingredients');
const recipePickerListEl = document.getElementById('recipe-picker-list');
const recipePickerCurrentNameEl = document.getElementById('recipe-picker-current-name');

const mealTimeLabels = { morning: '朝', noon: '昼', night: '夜', other: 'その他' };

let currentRecipes = [];
let filterableIngredients = [];
let selectedIngredientFilterIds = new Set();
let selectedRecipeId = null;

function buildFilterableIngredients(recipes) {
  const map = new Map();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      if (!map.has(ing.ingredientId)) {
        map.set(ing.ingredientId, { id: ing.ingredientId, name: ing.name });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

function renderIngredientFilterList() {
  const query = recipeIngredientSearchField.value.trim().toLowerCase();
  const items = query
    ? filterableIngredients.filter((i) => i.name.toLowerCase().includes(query))
    : filterableIngredients;

  recipeIngredientFilterListEl.innerHTML = '';
  for (const ingredient of items) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIngredientFilterIds.has(ingredient.id);
    checkbox.addEventListener('change', () => onToggleIngredientFilter(ingredient.id, checkbox.checked));
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(ingredient.name));
    li.appendChild(label);
    recipeIngredientFilterListEl.appendChild(li);
  }
}

function onToggleIngredientFilter(ingredientId, checked) {
  if (checked) selectedIngredientFilterIds.add(ingredientId);
  else selectedIngredientFilterIds.delete(ingredientId);
  renderSelectedIngredientChips();
  renderRecipePickerList();
}

function renderSelectedIngredientChips() {
  recipeSelectedIngredientsEl.innerHTML = '';
  for (const id of selectedIngredientFilterIds) {
    const ingredient = filterableIngredients.find((i) => i.id === id);
    if (!ingredient) continue;
    const chip = document.createElement('span');
    chip.className = 'ingredient-chip';
    chip.textContent = ingredient.name;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      selectedIngredientFilterIds.delete(id);
      renderIngredientFilterList();
      renderSelectedIngredientChips();
      renderRecipePickerList();
    });
    chip.appendChild(removeButton);
    recipeSelectedIngredientsEl.appendChild(chip);
  }
}

function getFilteredRecipes() {
  const query = recipeSearchField.value.trim().toLowerCase();
  return currentRecipes.filter((recipe) => {
    if (query && !recipe.name.toLowerCase().includes(query)) return false;
    if (selectedIngredientFilterIds.size > 0) {
      const recipeIngredientIds = new Set(recipe.ingredients.map((i) => i.ingredientId));
      for (const id of selectedIngredientFilterIds) {
        if (!recipeIngredientIds.has(id)) return false;
      }
    }
    return true;
  });
}

function renderRecipePickerList() {
  const recipes = getFilteredRecipes();
  recipePickerListEl.innerHTML = '';
  for (const recipe of recipes) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = recipe.name;
    button.className = 'recipe-picker-item';
    if (recipe.id === selectedRecipeId) button.classList.add('selected');
    button.addEventListener('click', () => selectRecipe(recipe));
    li.appendChild(button);
    recipePickerListEl.appendChild(li);
  }
}

function selectRecipe(recipe) {
  selectedRecipeId = recipe.id;
  planRecipeField.value = recipe.id;
  recipePickerCurrentNameEl.textContent = recipe.name;
  renderRecipePickerList();
}

recipeSearchField.addEventListener('input', renderRecipePickerList);
recipeIngredientSearchField.addEventListener('input', renderIngredientFilterList);

recipeIngredientFilterOpenButton.addEventListener('click', () => {
  recipeIngredientSearchField.value = '';
  renderIngredientFilterList();
  recipeIngredientFilterDialog.showModal();
  recipeIngredientSearchField.focus();
});

recipeIngredientFilterCloseButton.addEventListener('click', () => {
  recipeIngredientFilterDialog.close();
});

recipeIngredientFilterDialog.addEventListener('click', (e) => {
  if (e.target === recipeIngredientFilterDialog) recipeIngredientFilterDialog.close();
});

function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function resetPlanForm() {
  planForm.reset();
  planIdField.value = '';
  planRecipeField.value = '';
  selectedRecipeId = null;
  recipePickerCurrentNameEl.textContent = '(未選択)';
  recipeSearchField.value = '';
  recipeIngredientSearchField.value = '';
  selectedIngredientFilterIds.clear();
  renderIngredientFilterList();
  renderSelectedIngredientChips();
  renderRecipePickerList();
  planSubmitButton.textContent = '追加';
  planCancelButton.hidden = true;
}

function startEditPlan(plan) {
  planIdField.value = plan.id;
  planDateField.value = plan.date;
  planMealTimeField.value = plan.mealTime;
  planServingsField.value = plan.servings;

  selectedIngredientFilterIds.clear();
  recipeIngredientSearchField.value = '';
  recipeSearchField.value = '';
  renderIngredientFilterList();
  renderSelectedIngredientChips();

  const recipe = currentRecipes.find((r) => r.id === plan.recipeId);
  selectedRecipeId = plan.recipeId;
  planRecipeField.value = plan.recipeId;
  recipePickerCurrentNameEl.textContent = recipe ? recipe.name : plan.recipeName;
  renderRecipePickerList();

  planSubmitButton.textContent = '更新';
  planCancelButton.hidden = false;
}

async function onDeletePlan(plan) {
  if (!confirm(`${plan.date}の「${plan.recipeName}」を削除しますか?`)) return;
  planErrorEl.textContent = '';
  try {
    await deletePlan(plan.id);
    await refresh();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

function renderPlans(plans) {
  planListBody.innerHTML = '';
  for (const plan of plans) {
    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = plan.date;
    tr.appendChild(dateTd);

    const mealTimeTd = document.createElement('td');
    mealTimeTd.textContent = mealTimeLabels[plan.mealTime] || plan.mealTime;
    tr.appendChild(mealTimeTd);

    const recipeTd = document.createElement('td');
    recipeTd.textContent = plan.recipeName;
    tr.appendChild(recipeTd);

    const servingsTd = document.createElement('td');
    servingsTd.textContent = plan.servings;
    tr.appendChild(servingsTd);

    const actionTd = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => startEditPlan(plan));
    actionTd.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => onDeletePlan(plan));
    actionTd.appendChild(deleteButton);

    tr.appendChild(actionTd);
    planListBody.appendChild(tr);
  }
}

async function loadPlans() {
  planErrorEl.textContent = '';
  try {
    const plans = await listPlans(rangeFromField.value, rangeToField.value);
    renderPlans(plans);
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

function renderSummary(items) {
  summaryListBody.innerHTML = '';
  summaryEmptyEl.hidden = items.length > 0;
  for (const item of items) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = item.name;
    tr.appendChild(nameTd);

    const requiredTd = document.createElement('td');
    requiredTd.textContent = `${item.required}${item.unit}`;
    tr.appendChild(requiredTd);

    const remainingTd = document.createElement('td');
    remainingTd.textContent = `${item.remaining}${item.unit}`;
    tr.appendChild(remainingTd);

    summaryListBody.appendChild(tr);
  }
}

async function loadSummary() {
  planErrorEl.textContent = '';
  try {
    const items = await getPlanSummary(rangeFromField.value, rangeToField.value);
    renderSummary(items);
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

async function refresh() {
  await loadPlans();
  await loadSummary();
}

rangeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  refresh();
});

planCancelButton.addEventListener('click', resetPlanForm);

planForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  planErrorEl.textContent = '';
  if (!planRecipeField.value) {
    planErrorEl.textContent = 'レシピを選択してください';
    return;
  }
  const date = planDateField.value;
  const mealTime = planMealTimeField.value;
  const recipeId = Number(planRecipeField.value);
  const servings = Number(planServingsField.value);
  try {
    if (planIdField.value) {
      await updatePlan(planIdField.value, date, recipeId, servings, mealTime);
    } else {
      await createPlan(date, recipeId, servings, mealTime);
    }
    resetPlanForm();
    await refresh();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
});

async function init() {
  const today = new Date();
  const weekLater = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  rangeFromField.value = toDateInputValue(today);
  rangeToField.value = toDateInputValue(weekLater);
  planDateField.value = toDateInputValue(today);

  planErrorEl.textContent = '';
  try {
    currentRecipes = await listRecipes();
    filterableIngredients = buildFilterableIngredients(currentRecipes);
    renderIngredientFilterList();
    renderRecipePickerList();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
  await refresh();
}

init();
