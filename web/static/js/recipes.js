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

const materialPickerDialog = document.getElementById('material-picker-dialog');
const materialPickerSearchField = document.getElementById('material-picker-search-field');
const materialPickerSearchClearButton = document.getElementById('material-picker-search-clear');
const materialPickerListEl = document.getElementById('material-picker-list');

const recipeDialog = document.getElementById('recipe-dialog');
const recipeDialogTitle = document.getElementById('recipe-dialog-title');
const recipeErrorEl = document.getElementById('recipe-error');
const recipeViewServingsEl = document.getElementById('recipe-view-servings');
const recipeViewServingsValueEl = recipeViewServingsEl.querySelector('span');

const recipeViewFieldsEl = document.getElementById('recipe-view-fields');
const recipeViewImageEl = document.getElementById('recipe-view-image');
const recipeViewImagePlaceholderEl = document.getElementById('recipe-view-image-placeholder');
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

// 材料・調味料選択ピッカーが現在どの行(食材/調味料の別)に対して開かれているかを保持する
let materialPickerTarget = null;

function openMaterialPicker(type, row) {
  materialPickerTarget = { type, row };
  materialPickerSearchField.value = '';
  materialPickerDialog.showModal();
  renderMaterialPickerList('');
  materialPickerSearchField.focus();
}

function createMaterialPickerTag(item) {
  const { type, row } = materialPickerTarget;
  const button = row.querySelector(type === 'ingredient' ? '.ingredient-picker-button' : '.seasoning-picker-button');
  const currentId = button ? Number(button.dataset[type === 'ingredient' ? 'ingredientId' : 'seasoningId']) : NaN;
  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'ingredient-filter-tag';
  tag.textContent = item.name;
  tag.classList.toggle('selected', currentId === item.id);
  tag.addEventListener('click', () => selectMaterial(item.id));
  return tag;
}

function renderMaterialPickerList(query) {
  const master = materialPickerTarget.type === 'ingredient' ? ingredientMaster : seasoningMaster;
  const normalizedQuery = query.toLowerCase();
  const items = master
    .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  materialPickerListEl.innerHTML = '';
  const tagEls = [];
  for (const item of items) {
    const tag = createMaterialPickerTag(item);
    materialPickerListEl.appendChild(tag);
    tagEls.push(tag);
  }

  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.className = 'ingredient-filter-tag';
  createButton.textContent = materialPickerTarget.type === 'ingredient' ? '+ 新しい食材を追加...' : '+ 新しい調味料を追加...';
  createButton.addEventListener('click', onMaterialPickerCreateNew);
  materialPickerListEl.appendChild(createButton);

  // オーバーレイの高さを超える分は表示しない(既存の食材フィルタダイアログと同様、末尾の追加ボタンは残す)
  if (materialPickerDialog.open) {
    while (
      tagEls.length > 0 &&
      materialPickerListEl.scrollHeight > materialPickerListEl.clientHeight
    ) {
      tagEls.pop().remove();
    }
  }
}

function selectMaterial(id) {
  const { type, row } = materialPickerTarget;
  const master = type === 'ingredient' ? ingredientMaster : seasoningMaster;
  const item = master.find((i) => i.id === id);
  if (!item) return;
  const button = row.querySelector(type === 'ingredient' ? '.ingredient-picker-button' : '.seasoning-picker-button');
  button.textContent = type === 'ingredient' ? `${item.name} (${item.unit})` : `${item.name} (mL)`;
  if (type === 'ingredient') {
    button.dataset.ingredientId = id;
    updateIngredientRowUnit(row, id);
  } else {
    button.dataset.seasoningId = id;
    updateSeasoningRowUnit(row);
  }
  materialPickerDialog.close();
}

async function onMaterialPickerCreateNew() {
  const { type } = materialPickerTarget;
  const item = await openMaterialCreateDialog(type);
  if (!item) return;
  if (type === 'ingredient') {
    ingredientMaster.push(item);
  } else {
    seasoningMaster.push(item);
  }
  selectMaterial(item.id);
}

materialPickerSearchField.addEventListener('input', () => renderMaterialPickerList(materialPickerSearchField.value));
materialPickerSearchClearButton.addEventListener('click', () => {
  materialPickerSearchField.value = '';
  materialPickerSearchField.focus();
  renderMaterialPickerList('');
});
materialPickerDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(materialPickerDialog, e)) materialPickerDialog.close();
});

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

  // 未指定の場合は名前順で最初の食材を初期選択とする(既存のselectデフォルト選択挙動を踏襲)
  const resolvedId = ingredientId !== undefined
    ? ingredientId
    : (ingredientMaster.length > 0
        ? [...ingredientMaster].sort((a, b) => a.name.localeCompare(b.name, 'ja'))[0].id
        : undefined);
  const resolvedIngredient = ingredientMaster.find((i) => i.id === resolvedId);

  const pickerButton = document.createElement('button');
  pickerButton.type = 'button';
  pickerButton.className = 'ingredient-picker-button';
  if (resolvedId !== undefined) pickerButton.dataset.ingredientId = resolvedId;
  pickerButton.textContent = resolvedIngredient ? `${resolvedIngredient.name} (${resolvedIngredient.unit})` : '';
  pickerButton.addEventListener('click', () => openMaterialPicker('ingredient', row));

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

  const handle = createRowHandle(row, ingredientRowsEl, '.ingredient-row');

  row.appendChild(handle);
  row.appendChild(noteInput);
  row.appendChild(pickerButton);
  row.appendChild(qtyField);
  row.appendChild(pinButton);
  row.appendChild(removeButton);
  row.appendChild(fixedCheckbox);
  ingredientRowsEl.appendChild(row);

  updatePinToggleState(pinButton, fixedCheckbox.checked);
  updateIngredientRowUnit(row, resolvedId);
}

function collectIngredientRows() {
  const rows = ingredientRowsEl.querySelectorAll('.ingredient-row');
  return Array.from(rows).map(row => ({
    ingredientId: Number(row.querySelector('.ingredient-picker-button').dataset.ingredientId),
    quantity: Number(row.querySelector('.ingredient-quantity').value),
    fixedQuantity: row.querySelector('.ingredient-fixed').checked,
    note: row.querySelector('.ingredient-note').value.trim(),
  }));
}

// 調味料の数量は常にmL固定のため、選択内容によらず固定文字列を表示する
function updateSeasoningRowUnit(row) {
  row.querySelector('.qty-unit').textContent = 'mL';
}

function addSeasoningRow(seasoningId, quantity, fixedQuantity, note) {
  const row = document.createElement('div');
  row.className = 'seasoning-row';

  // 未指定の場合は名前順で最初の調味料を初期選択とする(既存のselectデフォルト選択挙動を踏襲)
  const resolvedId = seasoningId !== undefined
    ? seasoningId
    : (seasoningMaster.length > 0
        ? [...seasoningMaster].sort((a, b) => a.name.localeCompare(b.name, 'ja'))[0].id
        : undefined);
  const resolvedSeasoning = seasoningMaster.find((s) => s.id === resolvedId);

  const pickerButton = document.createElement('button');
  pickerButton.type = 'button';
  pickerButton.className = 'seasoning-picker-button';
  if (resolvedId !== undefined) pickerButton.dataset.seasoningId = resolvedId;
  pickerButton.textContent = resolvedSeasoning ? `${resolvedSeasoning.name} (mL)` : '';
  pickerButton.addEventListener('click', () => openMaterialPicker('seasoning', row));

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

  const handle = createRowHandle(row, seasoningRowsEl, '.seasoning-row');

  row.appendChild(handle);
  row.appendChild(noteInput);
  row.appendChild(pickerButton);
  row.appendChild(qtyField);
  row.appendChild(pinButton);
  row.appendChild(removeButton);
  row.appendChild(fixedCheckbox);
  seasoningRowsEl.appendChild(row);

  updatePinToggleState(pinButton, fixedCheckbox.checked);
  updateSeasoningRowUnit(row);
}

function collectSeasoningRows() {
  const rows = seasoningRowsEl.querySelectorAll('.seasoning-row');
  return Array.from(rows).map(row => ({
    seasoningId: Number(row.querySelector('.seasoning-picker-button').dataset.seasoningId),
    quantity: Number(row.querySelector('.seasoning-quantity').value),
    fixedQuantity: row.querySelector('.seasoning-fixed').checked,
    note: row.querySelector('.seasoning-note').value.trim(),
  }));
}

function renumberStepRows() {
  const rows = stepRowsEl.querySelectorAll('.step-row');
  rows.forEach((row, index) => {
    row.querySelector('.step-number').textContent = `${index + 1}.`;
  });
}

// 食材・調味料・手順いずれの行の並び替えにも使う汎用ドラッグ状態。
// container: 行の親要素、rowSelector: 対象行を絞り込むクラスセレクタ、onReorder: 入れ替え直後に呼ぶコールバック(省略可)
let rowDragState = null;

function onRowHandlePointerDown(e, row, handle, container, rowSelector, onReorder) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  rowDragState = { row, container, rowSelector, onReorder };
  row.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
}

function onRowHandlePointerMove(e) {
  if (!rowDragState) return;
  const { row, container, rowSelector, onReorder } = rowDragState;
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const targetRow = target ? target.closest(rowSelector) : null;
  if (!targetRow || targetRow === row || targetRow.parentElement !== container) return;

  const rect = targetRow.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  container.insertBefore(row, before ? targetRow : targetRow.nextSibling);
  if (onReorder) onReorder();
}

function onRowHandlePointerUp(e) {
  if (!rowDragState) return;
  rowDragState.row.classList.remove('dragging');
  rowDragState = null;
}

// 献立パネル(.plan-panel-handle)を踏襲したドラッグハンドルを生成する
function createRowHandle(row, container, rowSelector, onReorder) {
  const handle = document.createElement('span');
  handle.className = 'material-row-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.innerHTML = '<i class="ti ti-grip-vertical" aria-hidden="true"></i>';
  handle.addEventListener('pointerdown', (e) => onRowHandlePointerDown(e, row, handle, container, rowSelector, onReorder));
  handle.addEventListener('pointermove', onRowHandlePointerMove);
  handle.addEventListener('pointerup', onRowHandlePointerUp);
  handle.addEventListener('pointercancel', onRowHandlePointerUp);
  return handle;
}

function addStepRow(text) {
  const row = document.createElement('div');
  row.className = 'step-row';

  const handle = createRowHandle(row, stepRowsEl, '.step-row', renumberStepRows);
  row.appendChild(handle);

  const numberEl = document.createElement('span');
  numberEl.className = 'step-number';
  row.appendChild(numberEl);

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
  recipeViewServingsEl.hidden = mode !== 'view';
  recipeNameRowEl.hidden = mode !== 'edit';
}

function renderRecipeView(recipe) {
  recipeDialogTitle.textContent = recipe.name;
  recipeViewServingsValueEl.textContent = `${recipe.servings}人分`;
  recipeViewImageEl.hidden = !recipe.hasImage;
  recipeViewImagePlaceholderEl.hidden = recipe.hasImage;
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
    // 補足の有無に関わらずバッジを表示し、リストマーカー代わりの役割を持たせる
    const badge = document.createElement('span');
    badge.className = 'material-note-badge';
    badge.textContent = ing.note;
    li.appendChild(badge);
    li.appendChild(document.createTextNode(`${ing.name} ${ing.quantity}${ing.unit}`));
    recipeViewIngredientsEl.appendChild(li);
  }

  recipeViewSeasoningsEl.innerHTML = '';
  for (const s of recipe.seasonings) {
    const li = document.createElement('li');
    // 補足の有無に関わらずバッジを表示し、リストマーカー代わりの役割を持たせる
    const badge = document.createElement('span');
    badge.className = 'material-note-badge';
    badge.textContent = s.note;
    li.appendChild(badge);
    li.appendChild(document.createTextNode(`${s.name} ${s.quantity}${s.unit}`));
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
    await createPlan(null, 'unscheduled', recipe.id, recipe.servings, 'other', '');
    showToast(`「${recipe.name}」を未定に追加しました`);
  } catch (err) {
    recipeListErrorEl.textContent = err.message;
  }
}

async function onDeleteRecipe(recipe) {
  if (!(await confirmDialog(`「${recipe.name}」を削除しますか?`))) return;
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

// コンテナの表示幅を超えるチップを末尾から間引き、超過分を「+N」チップにまとめる。
// container・chipEls内の各要素は呼び出し時点でDOM接続済み(親要素にappend済み)である必要がある。
// 未接続の状態ではclientWidthが0になり、間引き判定が正しく機能しない。
function trimChipsToFit(container, chipEls, moreChipClassName) {
  let hiddenCount = 0;
  while (container.scrollWidth > container.clientWidth && chipEls.length > 0) {
    chipEls.pop().remove();
    hiddenCount++;
  }
  if (hiddenCount > 0) {
    const more = document.createElement('span');
    more.className = moreChipClassName;
    more.textContent = `+${hiddenCount}`;
    container.appendChild(more);
    while (container.scrollWidth > container.clientWidth && chipEls.length > 0) {
      chipEls.pop().remove();
      hiddenCount++;
      more.textContent = `+${hiddenCount}`;
    }
  }
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

  trimChipsToFit(container, chipEls, 'ingredient-chip ingredient-chip-more');
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
    const chipEls = [];
    for (const ing of recipe.ingredients) {
      const li = document.createElement('li');
      li.className = 'material-chip';
      li.textContent = ing.name;
      chips.appendChild(li);
      chipEls.push(li);
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
    // DOM接続後でないとclientWidthが正しく取れないため、appendしてから間引く
    trimChipsToFit(chips, chipEls, 'material-chip material-chip-more');
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
