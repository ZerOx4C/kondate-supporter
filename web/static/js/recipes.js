const recipeListBody = document.getElementById('recipe-list');
const recipeListErrorEl = document.getElementById('recipe-list-error');
const recipeSearchField = document.getElementById('recipe-search-field');
const recipeCreateButton = document.getElementById('recipe-create-button');
const recipeIngredientFilterOpenButton = document.getElementById('recipe-ingredient-filter-open');
const recipeIngredientFilterDialog = document.getElementById('recipe-ingredient-filter-dialog');
const recipeIngredientFilterCloseButton = document.getElementById('recipe-ingredient-filter-close');
const recipeIngredientSearchField = document.getElementById('recipe-ingredient-search-field');
const recipeIngredientFilterListEl = document.getElementById('recipe-ingredient-filter-list');
const recipeSelectedIngredientsEl = document.getElementById('recipe-selected-ingredients');

const useRecipeDialog = document.getElementById('use-recipe-dialog');
const useRecipeDialogTitle = document.getElementById('use-recipe-dialog-title');
const useRecipeForm = document.getElementById('use-recipe-form');
const useRecipeDateField = document.getElementById('use-recipe-date');
const useRecipeMealTimeField = document.getElementById('use-recipe-meal-time');
const useRecipeServingsField = document.getElementById('use-recipe-servings');
const useRecipeErrorEl = document.getElementById('use-recipe-error');
const useRecipeCancelButton = document.getElementById('use-recipe-cancel');

const recipeDialog = document.getElementById('recipe-dialog');
const recipeDialogTitle = document.getElementById('recipe-dialog-title');
const recipeErrorEl = document.getElementById('recipe-error');

const recipeViewFieldsEl = document.getElementById('recipe-view-fields');
const recipeViewUrlEl = document.getElementById('recipe-view-url');
const recipeViewStepsEl = document.getElementById('recipe-view-steps');
const recipeViewStepsEmptyEl = document.getElementById('recipe-view-steps-empty');
const recipeViewEditButton = document.getElementById('recipe-view-edit');
const recipeViewDeleteButton = document.getElementById('recipe-view-delete');
const recipeViewCloseButton = document.getElementById('recipe-view-close');

const recipeForm = document.getElementById('recipe-form');
const recipeDialogCancelButton = document.getElementById('recipe-dialog-cancel');
const recipeIdField = document.getElementById('recipe-id');
const recipeNameField = document.getElementById('recipe-name');
const recipeServingsField = document.getElementById('recipe-servings');
const recipeUrlField = document.getElementById('recipe-url');
const ingredientRowsEl = document.getElementById('ingredient-rows');
const addIngredientRowButton = document.getElementById('add-ingredient-row');
const stepRowsEl = document.getElementById('step-rows');
const addStepRowButton = document.getElementById('add-step-row');
const recipeSubmitButton = document.getElementById('recipe-submit');

let recipeDialogTarget = null;

let ingredientMaster = [];
let currentRecipes = [];
let filterableIngredients = [];
let selectedIngredientFilterIds = new Set();
let useRecipeTarget = null;

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabels[d.getDay()]})`;
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

const NEW_INGREDIENT_OPTION_VALUE = '__new__';

function fillIngredientOptions(select, selectedId) {
  select.innerHTML = '';
  for (const ingredient of ingredientMaster) {
    const option = document.createElement('option');
    option.value = ingredient.id;
    option.textContent = `${ingredient.name} (${ingredient.unit})`;
    select.appendChild(option);
  }
  const newOption = document.createElement('option');
  newOption.value = NEW_INGREDIENT_OPTION_VALUE;
  newOption.textContent = '+ 新しい食材を追加...';
  select.appendChild(newOption);
  if (selectedId !== undefined) select.value = selectedId;
  select.dataset.prevValue = select.value;
}

async function onIngredientSelectChange(select) {
  if (select.value !== NEW_INGREDIENT_OPTION_VALUE) {
    select.dataset.prevValue = select.value;
    return;
  }
  const name = (window.prompt('新しい食材の名前を入力してください') || '').trim();
  if (!name) {
    select.value = select.dataset.prevValue;
    return;
  }
  const unit = (window.prompt('単位を入力してください(例: g, 本, 個)') || '').trim();
  if (!unit) {
    select.value = select.dataset.prevValue;
    return;
  }
  recipeErrorEl.textContent = '';
  try {
    const ingredient = await createIngredient(name, unit);
    ingredientMaster.push(ingredient);
    for (const s of ingredientRowsEl.querySelectorAll('.ingredient-select')) {
      const selectedId = s === select ? ingredient.id : Number(s.dataset.prevValue);
      fillIngredientOptions(s, selectedId);
    }
  } catch (err) {
    recipeErrorEl.textContent = err.message;
    select.value = select.dataset.prevValue;
  }
}

function addIngredientRow(ingredientId, quantity) {
  const row = document.createElement('div');
  row.className = 'ingredient-row';

  const select = document.createElement('select');
  select.className = 'ingredient-select';
  fillIngredientOptions(select, ingredientId);
  select.addEventListener('change', () => onIngredientSelectChange(select));

  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.className = 'ingredient-quantity';
  quantityInput.step = 'any';
  quantityInput.min = '0.01';
  quantityInput.placeholder = '数量';
  if (quantity !== undefined) quantityInput.value = quantity;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = '削除';
  removeButton.addEventListener('click', () => row.remove());

  row.appendChild(select);
  row.appendChild(quantityInput);
  row.appendChild(removeButton);
  ingredientRowsEl.appendChild(row);
}

function collectIngredientRows() {
  const rows = ingredientRowsEl.querySelectorAll('.ingredient-row');
  return Array.from(rows).map(row => ({
    ingredientId: Number(row.querySelector('.ingredient-select').value),
    quantity: Number(row.querySelector('.ingredient-quantity').value),
  }));
}

function addStepRow(text) {
  const row = document.createElement('div');
  row.className = 'step-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'step-text';
  textarea.rows = 2;
  if (text !== undefined) textarea.value = text;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = '削除';
  removeButton.addEventListener('click', () => row.remove());

  row.appendChild(textarea);
  row.appendChild(removeButton);
  stepRowsEl.appendChild(row);
}

function collectStepRows() {
  const rows = stepRowsEl.querySelectorAll('.step-row');
  return Array.from(rows)
    .map((row) => row.querySelector('.step-text').value.trim())
    .filter((text) => text !== '');
}

function applyRecipeDialogMode(mode) {
  recipeViewFieldsEl.hidden = mode !== 'view';
  recipeForm.hidden = mode !== 'edit';
}

function renderRecipeView(recipe) {
  recipeDialogTitle.textContent = recipe.name;
  recipeViewUrlEl.innerHTML = '';
  recipeViewUrlEl.hidden = !recipe.url;
  if (recipe.url) {
    const link = document.createElement('a');
    link.href = recipe.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = recipe.url;
    recipeViewUrlEl.appendChild(link);
  }

  recipeViewStepsEl.innerHTML = '';
  recipeViewStepsEmptyEl.hidden = recipe.steps.length > 0;
  for (const step of recipe.steps) {
    const li = document.createElement('li');
    li.textContent = step;
    recipeViewStepsEl.appendChild(li);
  }
}

function showRecipeView(recipe) {
  recipeDialogTarget = recipe;
  recipeErrorEl.textContent = '';
  renderRecipeView(recipe);
  applyRecipeDialogMode('view');
}

function resetRecipeFormFields() {
  recipeForm.reset();
  recipeIdField.value = '';
  ingredientRowsEl.innerHTML = '';
  stepRowsEl.innerHTML = '';
}

function showRecipeEdit(recipe) {
  recipeErrorEl.textContent = '';
  resetRecipeFormFields();
  if (recipe) {
    recipeDialogTitle.textContent = 'レシピを編集';
    recipeIdField.value = recipe.id;
    recipeNameField.value = recipe.name;
    recipeServingsField.value = recipe.servings;
    recipeUrlField.value = recipe.url;
    for (const ing of recipe.ingredients) {
      addIngredientRow(ing.ingredientId, ing.quantity);
    }
    for (const step of recipe.steps) {
      addStepRow(step);
    }
  } else {
    recipeDialogTitle.textContent = 'レシピを作成';
    recipeNameField.value = recipeSearchField.value.trim();
  }
  applyRecipeDialogMode('edit');
  recipeNameField.focus();
}

function openRecipeDialog(recipe) {
  if (recipe) {
    showRecipeView(recipe);
  } else {
    recipeDialogTarget = null;
    showRecipeEdit(null);
  }
  recipeDialog.showModal();
}

function closeRecipeDialog() {
  recipeDialog.close();
  resetRecipeFormFields();
  recipeErrorEl.textContent = '';
  recipeDialogTarget = null;
}

function renderUseRecipeDateOptions() {
  const dates = enumerateDateRange(rangeFromField.value, rangeToField.value);
  useRecipeDateField.innerHTML = '';
  for (const dateStr of dates) {
    const option = document.createElement('option');
    option.value = dateStr;
    option.textContent = formatDateLabel(dateStr);
    useRecipeDateField.appendChild(option);
  }
}

function openUseRecipeDialog(recipe) {
  useRecipeTarget = recipe;
  useRecipeErrorEl.textContent = '';
  useRecipeDialogTitle.textContent = `「${recipe.name}」を献立に追加`;
  renderUseRecipeDateOptions();
  useRecipeServingsField.value = recipe.servings;
  useRecipeDialog.showModal();
}

function closeUseRecipeDialog() {
  useRecipeDialog.close();
  useRecipeForm.reset();
  useRecipeTarget = null;
}

async function onDeleteRecipe(recipe) {
  if (!confirm(`「${recipe.name}」を削除しますか?`)) return;
  recipeErrorEl.textContent = '';
  try {
    await deleteRecipe(recipe.id);
    closeRecipeDialog();
    await loadRecipes();
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
}

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
  renderRecipeList();
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
      renderRecipeList();
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

function renderRecipeList() {
  const recipes = getFilteredRecipes();
  recipeListBody.innerHTML = '';
  for (const recipe of recipes) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = recipe.name;
    if (recipe.url) {
      const link = document.createElement('a');
      link.href = recipe.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '🔗';
      link.className = 'recipe-url-link';
      link.title = recipe.url;
      nameTd.appendChild(link);
    }
    tr.appendChild(nameTd);

    const materialsTd = document.createElement('td');
    materialsTd.className = 'recipe-materials';
    materialsTd.textContent = recipe.ingredients.map((ing) => `${ing.name} ${ing.quantity}${ing.unit}`).join('\n');
    tr.appendChild(materialsTd);

    const actionTd = document.createElement('td');
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.textContent = '表示';
    viewButton.addEventListener('click', () => openRecipeDialog(recipe));
    actionTd.appendChild(viewButton);

    const useButton = document.createElement('button');
    useButton.type = 'button';
    useButton.textContent = '使用';
    useButton.addEventListener('click', () => openUseRecipeDialog(recipe));
    actionTd.appendChild(useButton);

    tr.appendChild(actionTd);
    recipeListBody.appendChild(tr);
  }
}

function updateCreateButton() {
  const query = recipeSearchField.value.trim();
  if (query) {
    recipeCreateButton.textContent = `「${query}」を新規作成`;
    recipeCreateButton.hidden = false;
  } else {
    recipeCreateButton.hidden = true;
  }
}

function onRecipeSearchInput() {
  renderRecipeList();
  updateCreateButton();
}

async function loadRecipes() {
  recipeListErrorEl.textContent = '';
  try {
    currentRecipes = await listRecipes();
    filterableIngredients = buildFilterableIngredients(currentRecipes);
    renderIngredientFilterList();
    renderRecipeList();
    updateCreateButton();
  } catch (err) {
    recipeListErrorEl.textContent = err.message;
  }
}

recipeSearchField.addEventListener('input', onRecipeSearchInput);
recipeCreateButton.addEventListener('click', () => openRecipeDialog());

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
  if (isDialogBackdropClick(recipeIngredientFilterDialog, e)) recipeIngredientFilterDialog.close();
});

recipeViewEditButton.addEventListener('click', () => showRecipeEdit(recipeDialogTarget));
recipeViewDeleteButton.addEventListener('click', () => onDeleteRecipe(recipeDialogTarget));
recipeViewCloseButton.addEventListener('click', closeRecipeDialog);

useRecipeCancelButton.addEventListener('click', closeUseRecipeDialog);

useRecipeDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(useRecipeDialog, e)) closeUseRecipeDialog();
});

useRecipeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  useRecipeErrorEl.textContent = '';
  const date = useRecipeDateField.value;
  const mealTime = useRecipeMealTimeField.value;
  const servings = Number(useRecipeServingsField.value);
  try {
    await createPlan(date, useRecipeTarget.id, servings, mealTime);
    closeUseRecipeDialog();
  } catch (err) {
    useRecipeErrorEl.textContent = err.message;
  }
});

addIngredientRowButton.addEventListener('click', () => addIngredientRow());
addStepRowButton.addEventListener('click', () => addStepRow());
recipeDialogCancelButton.addEventListener('click', () => {
  if (recipeDialogTarget) {
    showRecipeView(recipeDialogTarget);
  } else {
    closeRecipeDialog();
  }
});

recipeDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(recipeDialog, e)) closeRecipeDialog();
});

recipeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  recipeErrorEl.textContent = '';
  const name = recipeNameField.value.trim();
  const url = recipeUrlField.value.trim();
  const servings = Number(recipeServingsField.value);
  const ingredients = collectIngredientRows();
  const steps = collectStepRows();
  try {
    if (recipeIdField.value) {
      await updateRecipe(recipeIdField.value, name, url, servings, ingredients, steps);
    } else {
      await createRecipe(name, url, servings, ingredients, steps);
    }
    closeRecipeDialog();
    await loadRecipes();
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
});

async function init() {
  recipeListErrorEl.textContent = '';
  try {
    ingredientMaster = await listIngredients();
  } catch (err) {
    recipeListErrorEl.textContent = err.message;
  }
  await loadRecipes();
}

init();
