const planListBody = document.getElementById('plan-list');
const planForm = document.getElementById('plan-form');
const planIdField = document.getElementById('plan-id');
const planDateField = document.getElementById('plan-date');
const planMealTimeField = document.getElementById('plan-meal-time');
const planRecipeField = document.getElementById('plan-recipe');
const planServingsField = document.getElementById('plan-servings');
const planErrorEl = document.getElementById('plan-error');
const planDialog = document.getElementById('plan-dialog');
const planDialogTitle = document.getElementById('plan-dialog-title');
const planDialogCancelButton = document.getElementById('plan-dialog-cancel');
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
}

function closePlanDialog() {
  planDialog.close();
  resetPlanForm();
}

function openPlanDialog(plan, defaultDate) {
  resetPlanForm();
  if (plan) {
    planDialogTitle.textContent = '献立を編集';
    planIdField.value = plan.id;
    planDateField.value = plan.date;
    planMealTimeField.value = plan.mealTime;
    planServingsField.value = plan.servings;

    const recipe = currentRecipes.find((r) => r.id === plan.recipeId);
    selectedRecipeId = plan.recipeId;
    planRecipeField.value = plan.recipeId;
    recipePickerCurrentNameEl.textContent = recipe ? recipe.name : plan.recipeName;
    renderRecipePickerList();
  } else {
    planDialogTitle.textContent = '献立を追加';
    planDateField.value = defaultDate || toDateInputValue(new Date());
  }
  planDialog.showModal();
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

function groupPlansByDate(plans) {
  const map = new Map();
  for (const plan of plans) {
    if (!map.has(plan.date)) map.set(plan.date, []);
    map.get(plan.date).push(plan);
  }
  return map;
}

function enumerateDateRange(fromStr, toStr) {
  const dates = [];
  if (!fromStr || !toStr) return dates;
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  for (let d = from; d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    dates.push(toDateInputValue(d));
  }
  return dates;
}

function createPlanPanel(plan) {
  const panel = document.createElement('div');
  panel.className = 'plan-panel';

  const text = document.createElement('span');
  text.textContent = `[${mealTimeLabels[plan.mealTime] || plan.mealTime}] ${plan.recipeName} (${plan.servings}人分)`;
  panel.appendChild(text);

  const actions = document.createElement('span');
  actions.className = 'plan-panel-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = '編集';
  editButton.addEventListener('click', () => openPlanDialog(plan));
  actions.appendChild(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = '削除';
  deleteButton.className = 'danger';
  deleteButton.addEventListener('click', () => onDeletePlan(plan));
  actions.appendChild(deleteButton);

  panel.appendChild(actions);
  return panel;
}

function renderPlans(plans) {
  planListBody.innerHTML = '';
  const plansByDate = groupPlansByDate(plans);
  const dates = enumerateDateRange(rangeFromField.value, rangeToField.value);
  for (const date of dates) {
    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = date;
    tr.appendChild(dateTd);

    const planTd = document.createElement('td');
    const dayPlans = plansByDate.get(date) || [];
    if (dayPlans.length > 0) {
      const container = document.createElement('div');
      container.className = 'day-plans';
      for (const plan of dayPlans) {
        container.appendChild(createPlanPanel(plan));
      }
      planTd.appendChild(container);
    }

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'plan-add-button';
    addButton.textContent = '追加';
    addButton.addEventListener('click', () => openPlanDialog(null, date));
    planTd.appendChild(addButton);

    tr.appendChild(planTd);

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

document.addEventListener('daterangechange', refresh);

planDialogCancelButton.addEventListener('click', closePlanDialog);

planDialog.addEventListener('click', (e) => {
  if (e.target === planDialog) closePlanDialog();
});

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
    planDialog.close();
    resetPlanForm();
    await refresh();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
});

async function init() {
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
