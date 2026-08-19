// DOM要素参照
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const ingredientTab = document.getElementById('ingredient-tab');
const seasoningTab = document.getElementById('seasoning-tab');
const ingredientList = document.getElementById('ingredient-list');
const seasoningList = document.getElementById('seasoning-list');
const ingredientSearchField = document.getElementById('ingredient-search-field');
const ingredientSearchClearButton = document.getElementById('ingredient-search-clear');
const seasoningSearchField = document.getElementById('seasoning-search-field');
const seasoningSearchClearButton = document.getElementById('seasoning-search-clear');
const ingredientAddButton = document.getElementById('ingredient-add-button');
const seasoningAddButton = document.getElementById('seasoning-add-button');
const ingredientError = document.getElementById('ingredient-error');
const seasoningError = document.getElementById('seasoning-error');
const masterDialog = document.getElementById('master-dialog');
const masterDialogTitle = document.getElementById('master-dialog-title');
const masterForm = document.getElementById('master-form');
const masterIdField = document.getElementById('master-id');
const masterTypeField = document.getElementById('master-type');
const masterNameField = document.getElementById('master-name');
const masterUnitField = document.getElementById('master-unit');
const masterUnitLabel = document.getElementById('master-unit-label');
const masterError = document.getElementById('master-error');
const masterDeleteButton = document.getElementById('master-delete-button');
const masterCancelButton = document.getElementById('master-cancel-button');
const masterSubmitButton = document.getElementById('master-submit-button');

// 状態管理
let currentTab = 'ingredient';
let currentMode = 'add'; // 'add' or 'edit'
let currentMasterType = 'ingredient'; // 'ingredient' or 'seasoning'
let currentIngredients = [];
let currentSeasonings = [];

// タブ切り替え
function switchTab(tab) {
  currentTab = tab;
  tabContents.forEach(el => el.classList.remove('active'));
  tabButtons.forEach(el => el.classList.remove('active'));

  if (tab === 'ingredient') {
    ingredientTab.classList.add('active');
  } else {
    seasoningTab.classList.add('active');
  }

  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

// ダイアログオープン（新規追加）
function openAddDialog(type) {
  currentMode = 'add';
  currentMasterType = type;
  switchTab(type);

  masterTypeField.value = type;
  masterIdField.value = '';
  masterForm.reset();
  masterError.textContent = '';
  masterDeleteButton.hidden = true;
  masterSubmitButton.textContent = '追加';

  if (type === 'ingredient') {
    masterDialogTitle.textContent = '新しい食材を追加';
    masterUnitLabel.hidden = false;
    masterUnitField.required = true;
  } else {
    masterDialogTitle.textContent = '新しい調味料を追加';
    masterUnitLabel.hidden = true;
    masterUnitField.required = false;
  }

  masterDialog.showModal();
  masterNameField.focus();
}

// ダイアログオープン（編集）
function openEditDialog(item, type) {
  currentMode = 'edit';
  currentMasterType = type;

  masterTypeField.value = type;
  masterIdField.value = item.id;
  masterNameField.value = item.name;
  masterError.textContent = '';
  masterDeleteButton.hidden = false;
  masterSubmitButton.textContent = '更新';

  if (type === 'ingredient') {
    masterDialogTitle.textContent = '食材を編集';
    masterUnitLabel.hidden = false;
    masterUnitField.value = item.unit || '';
    masterUnitField.required = true;
  } else {
    masterDialogTitle.textContent = '調味料を編集';
    masterUnitLabel.hidden = true;
    masterUnitField.required = false;
  }

  masterDialog.showModal();
  masterNameField.focus();
}

// ダイアログクローズ
function closeDialog() {
  masterDialog.close();
}

// テーブル描画（食材）
function renderIngredients(ingredients) {
  ingredientList.innerHTML = '';
  for (const ingredient of ingredients) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = ingredient.name;
    tr.appendChild(nameTd);

    const unitTd = document.createElement('td');
    unitTd.textContent = ingredient.unit;
    tr.appendChild(unitTd);

    const actionTd = document.createElement('td');

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'icon-button';
    editButton.setAttribute('aria-label', '編集');
    editButton.innerHTML = '<i class="ti ti-pencil" aria-hidden="true"></i>';
    editButton.addEventListener('click', () => openEditDialog(ingredient, 'ingredient'));
    actionTd.appendChild(editButton);

    tr.appendChild(actionTd);
    ingredientList.appendChild(tr);
  }
}

// テーブル描画（調味料）
function renderSeasonings(seasonings) {
  seasoningList.innerHTML = '';
  for (const seasoning of seasonings) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = seasoning.name;
    tr.appendChild(nameTd);

    const unitTd = document.createElement('td');
    unitTd.textContent = 'mL';
    tr.appendChild(unitTd);

    const actionTd = document.createElement('td');

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'icon-button';
    editButton.setAttribute('aria-label', '編集');
    editButton.innerHTML = '<i class="ti ti-pencil" aria-hidden="true"></i>';
    editButton.addEventListener('click', () => openEditDialog(seasoning, 'seasoning'));
    actionTd.appendChild(editButton);

    tr.appendChild(actionTd);
    seasoningList.appendChild(tr);
  }
}

// 検索語による絞り込み
function getFilteredIngredients() {
  const query = ingredientSearchField.value.trim().toLowerCase();
  if (!query) return currentIngredients;
  return currentIngredients.filter((ingredient) => ingredient.name.toLowerCase().includes(query));
}

function getFilteredSeasonings() {
  const query = seasoningSearchField.value.trim().toLowerCase();
  if (!query) return currentSeasonings;
  return currentSeasonings.filter((seasoning) => seasoning.name.toLowerCase().includes(query));
}

function onIngredientSearchInput() {
  renderIngredients(getFilteredIngredients());
}

function onSeasoningSearchInput() {
  renderSeasonings(getFilteredSeasonings());
}

// データ取得・再表示
async function loadIngredients() {
  ingredientError.textContent = '';
  try {
    currentIngredients = await listIngredients();
    renderIngredients(getFilteredIngredients());
  } catch (err) {
    ingredientError.textContent = err.message;
  }
}

async function loadSeasonings() {
  seasoningError.textContent = '';
  try {
    currentSeasonings = await listSeasonings();
    renderSeasonings(getFilteredSeasonings());
  } catch (err) {
    seasoningError.textContent = err.message;
  }
}

async function loadAll() {
  await loadIngredients();
  await loadSeasonings();
}

// フォーム送信
masterForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  masterError.textContent = '';

  const id = masterIdField.value;
  const type = masterTypeField.value;
  const name = masterNameField.value.trim();
  const unit = masterUnitField.value.trim();

  try {
    if (id) {
      // 編集
      if (type === 'ingredient') {
        await updateIngredient(id, name, unit);
      } else {
        await updateSeasoning(id, name);
      }
    } else {
      // 新規追加
      if (type === 'ingredient') {
        await createIngredient(name, unit);
      } else {
        await createSeasoning(name);
      }
    }
    closeDialog();
    await loadAll();
  } catch (err) {
    masterError.textContent = err.message;
  }
});

// 削除ボタン
masterDeleteButton.addEventListener('click', async (e) => {
  e.preventDefault();

  const id = masterIdField.value;
  const type = masterTypeField.value;
  const name = masterNameField.value;

  const typeLabel = type === 'ingredient' ? '食材' : '調味料';
  if (!confirm(`「${name}」という${typeLabel}を削除しますか?`)) {
    return;
  }

  masterError.textContent = '';
  try {
    if (type === 'ingredient') {
      await deleteIngredient(id);
    } else {
      await deleteSeasoning(id);
    }
    closeDialog();
    await loadAll();
  } catch (err) {
    masterError.textContent = err.message;
  }
});

// キャンセルボタン
masterCancelButton.addEventListener('click', closeDialog);

// ダイアログ背景クリックで閉じる
masterDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(masterDialog, e)) {
    closeDialog();
  }
});

// タブ切り替えボタン
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.getAttribute('data-tab');
    switchTab(tab);
  });
});

// 新規追加ボタン
ingredientAddButton.addEventListener('click', () => openAddDialog('ingredient'));
seasoningAddButton.addEventListener('click', () => openAddDialog('seasoning'));

// 検索フィールド
ingredientSearchField.addEventListener('input', onIngredientSearchInput);
ingredientSearchClearButton.addEventListener('click', () => {
  ingredientSearchField.value = '';
  ingredientSearchField.focus();
  onIngredientSearchInput();
});

seasoningSearchField.addEventListener('input', onSeasoningSearchInput);
seasoningSearchClearButton.addEventListener('click', () => {
  seasoningSearchField.value = '';
  seasoningSearchField.focus();
  onSeasoningSearchInput();
});

// 初期ロード
loadAll();
