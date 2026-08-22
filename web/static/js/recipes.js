const recipeListBody = document.getElementById('recipe-list');
const recipeListErrorEl = document.getElementById('recipe-list-error');
const recipeSearchField = document.getElementById('recipe-search-field');
const recipeSearchClearButton = document.getElementById('recipe-search-clear');
const recipeIngredientFilterOpenButton = document.getElementById('recipe-ingredient-filter-open');
const recipeIngredientFilterClearButton = document.getElementById('recipe-ingredient-filter-clear');
const recipeIngredientFilterDialog = document.getElementById('recipe-ingredient-filter-dialog');
const recipeIngredientFilterCloseButton = document.getElementById('recipe-ingredient-filter-close');
const recipeIngredientSearchField = document.getElementById('recipe-ingredient-search-field');
const recipeIngredientSearchClearButton = document.getElementById('recipe-ingredient-search-clear');
const recipeIngredientFilterListEl = document.getElementById('recipe-ingredient-filter-list');
const recipeSelectedIngredientsEl = document.getElementById('recipe-selected-ingredients');

const recipeDialog = document.getElementById('recipe-dialog');
const recipeDialogTitle = document.getElementById('recipe-dialog-title');
const recipeErrorEl = document.getElementById('recipe-error');

const recipeViewFieldsEl = document.getElementById('recipe-view-fields');
const recipeViewImageEl = document.getElementById('recipe-view-image');
const recipeViewUrlEl = document.getElementById('recipe-view-url');
const recipeViewIngredientsEl = document.getElementById('recipe-view-ingredients');
const recipeViewSeasoningsEl = document.getElementById('recipe-view-seasonings');
const recipeViewStepsEl = document.getElementById('recipe-view-steps');
const recipeViewStepsEmptyEl = document.getElementById('recipe-view-steps-empty');
const recipeViewEditButton = document.getElementById('recipe-view-edit');
const recipeViewDeleteButton = document.getElementById('recipe-view-delete');
const recipeViewCloseButton = document.getElementById('recipe-view-close');
const recipeViewActionsEl = document.getElementById('recipe-view-actions');
const recipeEditActionsEl = document.getElementById('recipe-edit-actions');

const recipeForm = document.getElementById('recipe-form');
const recipeDialogCancelButton = document.getElementById('recipe-dialog-cancel');
const recipeIdField = document.getElementById('recipe-id');
const recipeNameRowEl = document.getElementById('recipe-name-row');
const recipeNameField = document.getElementById('recipe-name');
const recipeServingsField = document.getElementById('recipe-servings');
const recipeUrlField = document.getElementById('recipe-url');
const recipeImageDropzone = document.getElementById('recipe-image-dropzone');
const recipeImageInput = document.getElementById('recipe-image-input');
const recipeImagePreview = document.getElementById('recipe-image-preview');
const recipeImagePlaceholder = document.getElementById('recipe-image-placeholder');
const recipeImageRemoveButton = document.getElementById('recipe-image-remove');
const ingredientRowsEl = document.getElementById('ingredient-rows');
const addIngredientRowButton = document.getElementById('add-ingredient-row');
const seasoningRowsEl = document.getElementById('seasoning-rows');
const addSeasoningRowButton = document.getElementById('add-seasoning-row');
const stepRowsEl = document.getElementById('step-rows');
const addStepRowButton = document.getElementById('add-step-row');
const recipeSubmitButton = document.getElementById('recipe-submit');

let recipeDialogTarget = null;
let recipeImageFile = null;
let recipeImageRemoveRequested = false;

let ingredientMaster = [];
let seasoningMaster = [];
let currentRecipes = [];
let filterableIngredients = [];
let selectedIngredientFilterIds = new Set();
let ingredientRemainingById = new Map();

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

// ピン留めトグルの見た目(色・アイコン・aria-pressed)を状態に合わせて更新する
function updatePinToggleState(button, active) {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  button.innerHTML = active
    ? '<i class="ti ti-pinned" aria-hidden="true"></i>'
    : '<i class="ti ti-pin" aria-hidden="true"></i>';
}

// 食材選択に応じて数量入力の隣に単位を表示する
function updateIngredientRowUnit(row, ingredientId) {
  const unitEl = row.querySelector('.qty-unit');
  const ingredient = ingredientMaster.find((i) => i.id === Number(ingredientId));
  unitEl.textContent = ingredient ? ingredient.unit : '';
}

function addIngredientRow(ingredientId, quantity, fixedQuantity, note) {
  const row = document.createElement('div');
  row.className = 'ingredient-row';

  const select = document.createElement('select');
  select.className = 'ingredient-select';
  fillIngredientOptions(select, ingredientId);
  select.addEventListener('change', async () => {
    await onIngredientSelectChange(select);
    updateIngredientRowUnit(row, select.value);
  });

  const qtyField = document.createElement('span');
  qtyField.className = 'qty-field';
  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.className = 'ingredient-quantity';
  quantityInput.step = 'any';
  quantityInput.min = '0.01';
  quantityInput.placeholder = '数量';
  if (quantity !== undefined) quantityInput.value = quantity;
  const unitEl = document.createElement('span');
  unitEl.className = 'qty-unit';
  qtyField.appendChild(quantityInput);
  qtyField.appendChild(unitEl);

  const fixedCheckbox = document.createElement('input');
  fixedCheckbox.type = 'checkbox';
  fixedCheckbox.className = 'ingredient-fixed';
  fixedCheckbox.hidden = true;
  fixedCheckbox.checked = !!fixedQuantity;

  const pinButton = document.createElement('button');
  pinButton.type = 'button';
  pinButton.className = 'pin-toggle';
  pinButton.setAttribute('aria-label', '人数に比例させない');
  pinButton.addEventListener('click', () => {
    fixedCheckbox.checked = !fixedCheckbox.checked;
    updatePinToggleState(pinButton, fixedCheckbox.checked);
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'icon-button danger';
  removeButton.setAttribute('aria-label', '削除');
  removeButton.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
  removeButton.addEventListener('click', () => row.remove());

  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.className = 'ingredient-note';
  noteInput.placeholder = '補足(任意)';
  if (note !== undefined) noteInput.value = note;

  row.appendChild(select);
  row.appendChild(qtyField);
  row.appendChild(pinButton);
  row.appendChild(removeButton);
  row.appendChild(noteInput);
  row.appendChild(fixedCheckbox);
  ingredientRowsEl.appendChild(row);

  updatePinToggleState(pinButton, fixedCheckbox.checked);
  updateIngredientRowUnit(row, select.value);
}

function collectIngredientRows() {
  const rows = ingredientRowsEl.querySelectorAll('.ingredient-row');
  return Array.from(rows).map(row => ({
    ingredientId: Number(row.querySelector('.ingredient-select').value),
    quantity: Number(row.querySelector('.ingredient-quantity').value),
    fixedQuantity: row.querySelector('.ingredient-fixed').checked,
    note: row.querySelector('.ingredient-note').value.trim(),
  }));
}

const NEW_SEASONING_OPTION_VALUE = '__new__';

function fillSeasoningOptions(select, selectedId) {
  select.innerHTML = '';
  for (const seasoning of seasoningMaster) {
    const option = document.createElement('option');
    option.value = seasoning.id;
    option.textContent = `${seasoning.name} (mL)`;
    select.appendChild(option);
  }
  const newOption = document.createElement('option');
  newOption.value = NEW_SEASONING_OPTION_VALUE;
  newOption.textContent = '+ 新しい調味料を追加...';
  select.appendChild(newOption);
  if (selectedId !== undefined) select.value = selectedId;
  select.dataset.prevValue = select.value;
}

async function onSeasoningSelectChange(select) {
  if (select.value !== NEW_SEASONING_OPTION_VALUE) {
    select.dataset.prevValue = select.value;
    return;
  }
  const name = (window.prompt('新しい調味料の名前を入力してください') || '').trim();
  if (!name) {
    select.value = select.dataset.prevValue;
    return;
  }
  recipeErrorEl.textContent = '';
  try {
    const seasoning = await createSeasoning(name);
    seasoningMaster.push(seasoning);
    for (const s of seasoningRowsEl.querySelectorAll('.seasoning-select')) {
      const selectedId = s === select ? seasoning.id : Number(s.dataset.prevValue);
      fillSeasoningOptions(s, selectedId);
    }
  } catch (err) {
    recipeErrorEl.textContent = err.message;
    select.value = select.dataset.prevValue;
  }
}

// 調味料の数量は常にmL固定のため、選択内容によらず固定文字列を表示する
function updateSeasoningRowUnit(row) {
  row.querySelector('.qty-unit').textContent = 'mL';
}

function addSeasoningRow(seasoningId, quantity, fixedQuantity, note) {
  const row = document.createElement('div');
  row.className = 'seasoning-row';

  const select = document.createElement('select');
  select.className = 'seasoning-select';
  fillSeasoningOptions(select, seasoningId);
  select.addEventListener('change', async () => {
    await onSeasoningSelectChange(select);
    updateSeasoningRowUnit(row);
  });

  const qtyField = document.createElement('span');
  qtyField.className = 'qty-field';
  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.className = 'seasoning-quantity';
  quantityInput.step = 'any';
  quantityInput.min = '0.01';
  quantityInput.placeholder = '数量';
  if (quantity !== undefined) quantityInput.value = quantity;
  const unitEl = document.createElement('span');
  unitEl.className = 'qty-unit';
  qtyField.appendChild(quantityInput);
  qtyField.appendChild(unitEl);

  const fixedCheckbox = document.createElement('input');
  fixedCheckbox.type = 'checkbox';
  fixedCheckbox.className = 'seasoning-fixed';
  fixedCheckbox.hidden = true;
  fixedCheckbox.checked = !!fixedQuantity;

  const pinButton = document.createElement('button');
  pinButton.type = 'button';
  pinButton.className = 'pin-toggle';
  pinButton.setAttribute('aria-label', '人数に比例させない');
  pinButton.addEventListener('click', () => {
    fixedCheckbox.checked = !fixedCheckbox.checked;
    updatePinToggleState(pinButton, fixedCheckbox.checked);
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'icon-button danger';
  removeButton.setAttribute('aria-label', '削除');
  removeButton.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
  removeButton.addEventListener('click', () => row.remove());

  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.className = 'seasoning-note';
  noteInput.placeholder = '補足(任意)';
  if (note !== undefined) noteInput.value = note;

  row.appendChild(select);
  row.appendChild(qtyField);
  row.appendChild(pinButton);
  row.appendChild(removeButton);
  row.appendChild(noteInput);
  row.appendChild(fixedCheckbox);
  seasoningRowsEl.appendChild(row);

  updatePinToggleState(pinButton, fixedCheckbox.checked);
  updateSeasoningRowUnit(row);
}

function collectSeasoningRows() {
  const rows = seasoningRowsEl.querySelectorAll('.seasoning-row');
  return Array.from(rows).map(row => ({
    seasoningId: Number(row.querySelector('.seasoning-select').value),
    quantity: Number(row.querySelector('.seasoning-quantity').value),
    fixedQuantity: row.querySelector('.seasoning-fixed').checked,
    note: row.querySelector('.seasoning-note').value.trim(),
  }));
}

let stepDragState = null;

function renumberStepRows() {
  const rows = stepRowsEl.querySelectorAll('.step-row');
  rows.forEach((row, index) => {
    row.querySelector('.step-number').textContent = `${index + 1}.`;
  });
}

function onStepHandlePointerDown(e, row, handle) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  stepDragState = { row };
  row.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
}

function onStepHandlePointerMove(e) {
  if (!stepDragState) return;
  const { row } = stepDragState;
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const targetRow = target ? target.closest('.step-row') : null;
  if (!targetRow || targetRow === row || targetRow.parentElement !== stepRowsEl) return;

  const rect = targetRow.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  stepRowsEl.insertBefore(row, before ? targetRow : targetRow.nextSibling);
  renumberStepRows();
}

function onStepHandlePointerUp(e) {
  if (!stepDragState) return;
  stepDragState.row.classList.remove('dragging');
  stepDragState = null;
}

function addStepRow(text) {
  const row = document.createElement('div');
  row.className = 'step-row';

  const handle = document.createElement('span');
  handle.className = 'step-number';
  handle.addEventListener('pointerdown', (e) => onStepHandlePointerDown(e, row, handle));
  handle.addEventListener('pointermove', onStepHandlePointerMove);
  handle.addEventListener('pointerup', onStepHandlePointerUp);
  handle.addEventListener('pointercancel', onStepHandlePointerUp);
  row.appendChild(handle);

  const textarea = document.createElement('textarea');
  textarea.className = 'step-text';
  textarea.rows = 2;
  if (text !== undefined) textarea.value = text;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'icon-button danger';
  removeButton.setAttribute('aria-label', '削除');
  removeButton.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
  removeButton.addEventListener('click', () => {
    row.remove();
    renumberStepRows();
  });

  row.appendChild(textarea);
  row.appendChild(removeButton);
  stepRowsEl.appendChild(row);
  renumberStepRows();
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
  recipeViewActionsEl.hidden = mode !== 'view';
  recipeEditActionsEl.hidden = mode !== 'edit';
  recipeDialogTitle.hidden = mode !== 'view';
  recipeNameRowEl.hidden = mode !== 'edit';
}

function renderRecipeView(recipe) {
  recipeDialogTitle.textContent = `${recipe.name}(${recipe.servings}人分)`;
  recipeViewImageEl.hidden = !recipe.hasImage;
  if (recipe.hasImage) {
    recipeViewImageEl.src = `/api/recipes/${recipe.id}/image?t=${Date.now()}`;
  }

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

  recipeViewIngredientsEl.innerHTML = '';
  for (const ing of recipe.ingredients) {
    const li = document.createElement('li');
    li.textContent = ing.note
      ? `${ing.name} ${ing.quantity}${ing.unit}(${ing.note})`
      : `${ing.name} ${ing.quantity}${ing.unit}`;
    recipeViewIngredientsEl.appendChild(li);
  }

  recipeViewSeasoningsEl.innerHTML = '';
  for (const s of recipe.seasonings) {
    const li = document.createElement('li');
    li.textContent = s.note
      ? `${s.name} ${s.quantity}${s.unit}(${s.note})`
      : `${s.name} ${s.quantity}${s.unit}`;
    recipeViewSeasoningsEl.appendChild(li);
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

// 画像プレビューの表示/非表示に合わせてドロップゾーンの案内テキストと削除ボタンを連動させる
function setRecipeImagePreviewVisible(visible) {
  recipeImagePreview.hidden = !visible;
  recipeImagePlaceholder.hidden = visible;
  recipeImageRemoveButton.hidden = !visible;
}

function resetRecipeFormFields() {
  recipeForm.reset();
  recipeIdField.value = '';
  ingredientRowsEl.innerHTML = '';
  seasoningRowsEl.innerHTML = '';
  stepRowsEl.innerHTML = '';
  recipeImageFile = null;
  recipeImageRemoveRequested = false;
  recipeImageInput.value = '';
  setRecipeImagePreviewVisible(false);
}

function showRecipeEdit(recipe) {
  recipeErrorEl.textContent = '';
  resetRecipeFormFields();
  if (recipe) {
    recipeIdField.value = recipe.id;
    recipeNameField.value = recipe.name;
    recipeServingsField.value = recipe.servings;
    recipeUrlField.value = recipe.url;
    for (const ing of recipe.ingredients) {
      addIngredientRow(ing.ingredientId, ing.quantity, ing.fixedQuantity, ing.note);
    }
    for (const s of recipe.seasonings) {
      addSeasoningRow(s.seasoningId, s.quantity, s.fixedQuantity, s.note);
    }
    for (const step of recipe.steps) {
      addStepRow(step);
    }
    if (recipe.hasImage) {
      recipeImagePreview.src = `/api/recipes/${recipe.id}/image`;
      setRecipeImagePreviewVisible(true);
    }
  } else {
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

async function onUseRecipe(recipe) {
  try {
    await createPlan(null, recipe.id, recipe.servings, 'other', '');
    showToast(`「${recipe.name}」を未定に追加しました`);
  } catch (err) {
    recipeListErrorEl.textContent = err.message;
  }
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
        map.set(ing.ingredientId, { id: ing.ingredientId, name: ing.name, unit: ing.unit });
      }
    }
  }
  return Array.from(map.values());
}

async function loadIngredientRemaining() {
  try {
    const dateRange = getDateRange();
    const items = await getPlanSummary(dateRange.from, dateRange.to);
    ingredientRemainingById = new Map(items.map((item) => [item.ingredientId, item.remaining]));
  } catch {
    ingredientRemainingById = new Map();
  }
  renderIngredientFilterList();
}

function sortFilterableIngredients(items) {
  return [...items].sort((a, b) => {
    const aSelected = selectedIngredientFilterIds.has(a.id);
    const bSelected = selectedIngredientFilterIds.has(b.id);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    const aSurplus = (ingredientRemainingById.get(a.id) || 0) > 0;
    const bSurplus = (ingredientRemainingById.get(b.id) || 0) > 0;
    if (aSurplus !== bSurplus) return aSurplus ? -1 : 1;
    return a.name.localeCompare(b.name, 'ja');
  });
}

function createIngredientFilterTag(ingredient) {
  const remaining = ingredientRemainingById.get(ingredient.id);
  const surplus = typeof remaining === 'number' && remaining > 0;
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'ingredient-filter-tag';
  tag.dataset.ingredientId = ingredient.id;
  tag.classList.toggle('surplus', surplus);
  tag.classList.toggle('selected', selectedIngredientFilterIds.has(ingredient.id));
  tag.appendChild(document.createTextNode(ingredient.name));
  if (surplus) {
    const remainingEl = document.createElement('span');
    remainingEl.className = 'ingredient-filter-tag-remaining';
    remainingEl.textContent = `${remaining}${ingredient.unit}`;
    tag.appendChild(remainingEl);
  }
  tag.addEventListener('click', () => onToggleIngredientFilter(ingredient.id));
  return tag;
}

// タグの並び順は変えず、選択中の見た目だけを更新する
function updateIngredientFilterTagSelection() {
  for (const tag of recipeIngredientFilterListEl.children) {
    const id = Number(tag.dataset.ingredientId);
    tag.classList.toggle('selected', selectedIngredientFilterIds.has(id));
  }
}

function renderIngredientFilterList() {
  const query = recipeIngredientSearchField.value.trim().toLowerCase();
  const items = query
    ? filterableIngredients.filter((i) => i.name.toLowerCase().includes(query))
    : filterableIngredients;
  const sorted = sortFilterableIngredients(items);

  recipeIngredientFilterListEl.innerHTML = '';
  const tagEls = [];
  for (const ingredient of sorted) {
    const tag = createIngredientFilterTag(ingredient);
    recipeIngredientFilterListEl.appendChild(tag);
    tagEls.push(tag);
  }

  // オーバーレイの高さを超える分は表示しない(検索で絞り込む想定のためスクロールはしない)
  if (recipeIngredientFilterDialog.open) {
    while (
      tagEls.length > 0 &&
      recipeIngredientFilterListEl.scrollHeight > recipeIngredientFilterListEl.clientHeight
    ) {
      tagEls.pop().remove();
    }
  }
}

function onToggleIngredientFilter(ingredientId) {
  if (selectedIngredientFilterIds.has(ingredientId)) {
    selectedIngredientFilterIds.delete(ingredientId);
  } else {
    selectedIngredientFilterIds.add(ingredientId);
  }
  updateIngredientFilterTagSelection();
  renderSelectedIngredientChips();
  renderRecipeList();
}

function renderSelectedIngredientChips() {
  const container = recipeSelectedIngredientsEl;
  container.innerHTML = '';

  if (selectedIngredientFilterIds.size === 0) {
    const placeholder = document.createElement('span');
    placeholder.className = 'filter-field-placeholder';
    placeholder.textContent = '食材で検索';
    container.appendChild(placeholder);
    return;
  }

  const chipEls = [];
  for (const id of selectedIngredientFilterIds) {
    const ingredient = filterableIngredients.find((i) => i.id === id);
    if (!ingredient) continue;
    const chip = document.createElement('span');
    chip.className = 'ingredient-chip';
    chip.textContent = ingredient.name;
    container.appendChild(chip);
    chipEls.push(chip);
  }

  let hiddenCount = 0;
  while (container.scrollWidth > container.clientWidth && chipEls.length > 0) {
    chipEls.pop().remove();
    hiddenCount++;
  }
  if (hiddenCount > 0) {
    const more = document.createElement('span');
    more.className = 'ingredient-chip ingredient-chip-more';
    more.textContent = `+${hiddenCount}`;
    container.appendChild(more);
    while (container.scrollWidth > container.clientWidth && chipEls.length > 0) {
      chipEls.pop().remove();
      hiddenCount++;
      more.textContent = `+${hiddenCount}`;
    }
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

function createRecipeAddCard() {
  const card = document.createElement('div');
  card.className = 'recipe-card recipe-card-add';
  card.innerHTML = '<i class="ti ti-plus" aria-hidden="true"></i><span>新規追加</span>';
  card.addEventListener('click', () => openRecipeDialog());
  return card;
}

function renderRecipeList() {
  const recipes = getFilteredRecipes();
  recipeListBody.innerHTML = '';
  recipeListBody.appendChild(createRecipeAddCard());
  for (const recipe of recipes) {
    const card = document.createElement('div');
    card.className = 'recipe-card';

    const media = document.createElement('div');
    media.className = 'recipe-card-media';
    if (recipe.hasImage) {
      const img = document.createElement('img');
      img.src = `/api/recipes/${recipe.id}/image`;
      img.alt = '';
      img.className = 'recipe-card-image';
      media.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'recipe-card-image-placeholder';
      placeholder.textContent = '🍽️';
      placeholder.setAttribute('aria-hidden', 'true');
      media.appendChild(placeholder);
    }
    card.appendChild(media);

    const body = document.createElement('div');
    body.className = 'recipe-card-body';

    const title = document.createElement('h3');
    title.className = 'recipe-card-title';
    title.textContent = recipe.name;
    body.appendChild(title);

    const chips = document.createElement('ul');
    chips.className = 'recipe-card-ingredients';
    const shownIngredients = recipe.ingredients.slice(0, 3);
    for (const ing of shownIngredients) {
      const li = document.createElement('li');
      li.className = 'material-chip';
      li.textContent = `${ing.name} ${ing.quantity}${ing.unit}`;
      chips.appendChild(li);
    }
    if (recipe.ingredients.length > shownIngredients.length) {
      const li = document.createElement('li');
      li.className = 'material-chip material-chip-more';
      li.textContent = `+${recipe.ingredients.length - shownIngredients.length}`;
      chips.appendChild(li);
    }
    body.appendChild(chips);
    card.appendChild(body);

    const useButton = document.createElement('button');
    useButton.type = 'button';
    useButton.className = 'icon-button recipe-card-use-button';
    useButton.setAttribute('aria-label', '使用');
    useButton.innerHTML = '<i class="ti ti-calendar-plus" aria-hidden="true"></i>';
    useButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onUseRecipe(recipe);
    });
    card.appendChild(useButton);

    card.addEventListener('click', () => openRecipeDialog(recipe));
    recipeListBody.appendChild(card);
  }
}

function onRecipeSearchInput() {
  renderRecipeList();
}

async function loadRecipes() {
  recipeListErrorEl.textContent = '';
  try {
    currentRecipes = await listRecipes();
    filterableIngredients = buildFilterableIngredients(currentRecipes);
    renderIngredientFilterList();
    renderSelectedIngredientChips();
    renderRecipeList();
  } catch (err) {
    recipeListErrorEl.textContent = err.message;
  }
}

recipeSearchField.addEventListener('input', onRecipeSearchInput);
recipeSearchClearButton.addEventListener('click', () => {
  recipeSearchField.value = '';
  recipeSearchField.focus();
  onRecipeSearchInput();
});

recipeIngredientSearchField.addEventListener('input', renderIngredientFilterList);
recipeIngredientSearchClearButton.addEventListener('click', () => {
  recipeIngredientSearchField.value = '';
  recipeIngredientSearchField.focus();
  renderIngredientFilterList();
});

function openIngredientFilterDialog() {
  recipeIngredientSearchField.value = '';
  recipeIngredientFilterDialog.showModal();
  renderIngredientFilterList();
  recipeIngredientSearchField.focus();
}

recipeIngredientFilterOpenButton.addEventListener('click', (e) => {
  if (e.target.closest('#recipe-ingredient-filter-clear')) return;
  openIngredientFilterDialog();
});

recipeIngredientFilterClearButton.addEventListener('click', (e) => {
  e.stopPropagation();
  selectedIngredientFilterIds.clear();
  renderIngredientFilterList();
  renderSelectedIngredientChips();
  renderRecipeList();
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

function setRecipeImageFile(file) {
  recipeImageFile = file;
  recipeImageRemoveRequested = false;
  recipeImagePreview.src = URL.createObjectURL(file);
  setRecipeImagePreviewVisible(true);
}

recipeImageInput.addEventListener('change', () => {
  const file = recipeImageInput.files[0];
  if (file) setRecipeImageFile(file);
});

recipeImageRemoveButton.addEventListener('click', () => {
  recipeImageFile = null;
  recipeImageRemoveRequested = true;
  recipeImageInput.value = '';
  setRecipeImagePreviewVisible(false);
});

recipeImageDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  recipeImageDropzone.classList.add('drag-over');
});

recipeImageDropzone.addEventListener('dragleave', () => {
  recipeImageDropzone.classList.remove('drag-over');
});

recipeImageDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  recipeImageDropzone.classList.remove('drag-over');
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) setRecipeImageFile(file);
});

document.addEventListener('paste', (e) => {
  if (!recipeDialog.open || recipeForm.hidden) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        setRecipeImageFile(file);
        e.preventDefault();
      }
      break;
    }
  }
});

addIngredientRowButton.addEventListener('click', () => addIngredientRow());
addSeasoningRowButton.addEventListener('click', () => addSeasoningRow());
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
  const seasonings = collectSeasoningRows();
  const steps = collectStepRows();
  try {
    const saved = recipeIdField.value
      ? await updateRecipe(recipeIdField.value, name, url, servings, ingredients, seasonings, steps)
      : await createRecipe(name, url, servings, ingredients, seasonings, steps);
    if (recipeImageFile) {
      await uploadRecipeImage(saved.id, recipeImageFile);
      saved.hasImage = true;
    } else if (recipeImageRemoveRequested) {
      await deleteRecipeImage(saved.id);
      saved.hasImage = false;
    }
    await loadRecipes();
    showRecipeView(saved);
  } catch (err) {
    recipeErrorEl.textContent = err.message;
  }
});

document.addEventListener('daterangechange', loadIngredientRemaining);

async function init() {
  recipeListErrorEl.textContent = '';
  try {
    [ingredientMaster, seasoningMaster] = await Promise.all([listIngredients(), listSeasonings()]);
  } catch (err) {
    recipeListErrorEl.textContent = err.message;
  }
  await Promise.all([loadRecipes(), loadIngredientRemaining()]);
}

init();
