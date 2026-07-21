const recipeListBody = document.getElementById('recipe-list');
const recipeForm = document.getElementById('recipe-form');
const recipeIdField = document.getElementById('recipe-id');
const recipeNameField = document.getElementById('recipe-name');
const recipeServingsField = document.getElementById('recipe-servings');
const recipeDescriptionField = document.getElementById('recipe-description');
const ingredientRowsEl = document.getElementById('ingredient-rows');
const addIngredientRowButton = document.getElementById('add-ingredient-row');
const recipeSubmitButton = document.getElementById('recipe-submit');
const recipeCancelButton = document.getElementById('recipe-cancel');
const recipeErrorEl = document.getElementById('recipe-error');

let ingredientMaster = [];

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

function resetRecipeForm() {
  recipeForm.reset();
  recipeIdField.value = '';
  ingredientRowsEl.innerHTML = '';
  recipeSubmitButton.textContent = '追加';
  recipeCancelButton.hidden = true;
}

function collectIngredientRows() {
  const rows = ingredientRowsEl.querySelectorAll('.ingredient-row');
  return Array.from(rows).map(row => ({
    ingredientId: Number(row.querySelector('.ingredient-select').value),
    quantity: Number(row.querySelector('.ingredient-quantity').value),
  }));
}

async function startEditRecipe(id) {
  recipeErrorEl.textContent = '';
  try {
    const recipe = await getRecipe(id);
    recipeIdField.value = recipe.id;
    recipeNameField.value = recipe.name;
    recipeServingsField.value = recipe.servings;
    recipeDescriptionField.value = recipe.description;
    ingredientRowsEl.innerHTML = '';
    for (const ing of recipe.ingredients) {
      addIngredientRow(ing.ingredientId, ing.quantity);
    }
    recipeSubmitButton.textContent = '更新';
    recipeCancelButton.hidden = false;
    recipeNameField.focus();
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
}

async function onDeleteRecipe(recipe) {
  if (!confirm(`「${recipe.name}」を削除しますか?`)) return;
  recipeErrorEl.textContent = '';
  try {
    await deleteRecipe(recipe.id);
    await loadRecipes();
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
}

function renderRecipes(recipes) {
  recipeListBody.innerHTML = '';
  for (const recipe of recipes) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = recipe.name;
    tr.appendChild(nameTd);

    const descTd = document.createElement('td');
    descTd.textContent = recipe.description;
    tr.appendChild(descTd);

    const servingsTd = document.createElement('td');
    servingsTd.textContent = recipe.servings;
    tr.appendChild(servingsTd);

    const actionTd = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => startEditRecipe(recipe.id));
    actionTd.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => onDeleteRecipe(recipe));
    actionTd.appendChild(deleteButton);

    tr.appendChild(actionTd);
    recipeListBody.appendChild(tr);
  }
}

async function loadRecipes() {
  recipeErrorEl.textContent = '';
  try {
    const recipes = await listRecipes();
    renderRecipes(recipes);
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
}

addIngredientRowButton.addEventListener('click', () => addIngredientRow());
recipeCancelButton.addEventListener('click', resetRecipeForm);

recipeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  recipeErrorEl.textContent = '';
  const name = recipeNameField.value.trim();
  const description = recipeDescriptionField.value.trim();
  const servings = Number(recipeServingsField.value);
  const ingredients = collectIngredientRows();
  try {
    if (recipeIdField.value) {
      await updateRecipe(recipeIdField.value, name, description, servings, ingredients);
    } else {
      await createRecipe(name, description, servings, ingredients);
    }
    resetRecipeForm();
    await loadRecipes();
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
});

async function init() {
  recipeErrorEl.textContent = '';
  try {
    ingredientMaster = await listIngredients();
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
  await loadRecipes();
}

init();
