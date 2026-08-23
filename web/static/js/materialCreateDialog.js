// 食材/調味料の新規作成専用ダイアログ。
// recipes.js(材料選択パネル)とstocks.js(在庫画面)の両方から呼び出される共通部品。

const materialCreateDialog = document.getElementById('material-create-dialog');
const materialCreateDialogTitle = document.getElementById('material-create-dialog-title');
const materialCreateForm = document.getElementById('material-create-form');
const materialCreateNameField = document.getElementById('material-create-name');
const materialCreateNameIcon = document.getElementById('material-create-name-icon');
const materialCreateUnitLabel = document.getElementById('material-create-unit-label');
const materialCreateUnitField = document.getElementById('material-create-unit');
const materialCreateError = document.getElementById('material-create-error');
const materialCreateCancelButton = document.getElementById('material-create-cancel-button');

let materialCreateType = 'ingredient';
let pendingResolve = null;

// 食材/調味料を新規作成するダイアログを開く。
// type: 'ingredient' | 'seasoning', initialName: 名前欄の初期値(省略可)
// 返り値: 作成成功時は作成されたitem、キャンセル時はnullで解決するPromise
function openMaterialCreateDialog(type, initialName = '') {
  materialCreateType = type;
  materialCreateForm.reset();
  materialCreateNameField.value = initialName;
  materialCreateError.textContent = '';

  if (type === 'ingredient') {
    materialCreateDialogTitle.textContent = '新しい食材を追加';
    materialCreateNameIcon.className = 'ti ti-carrot';
    materialCreateUnitLabel.hidden = false;
    materialCreateUnitField.required = true;
  } else {
    materialCreateDialogTitle.textContent = '新しい調味料を追加';
    materialCreateNameIcon.className = 'ti ti-salt';
    materialCreateUnitLabel.hidden = true;
    materialCreateUnitField.required = false;
  }

  materialCreateDialog.showModal();
  materialCreateNameField.focus();

  return new Promise((resolve) => {
    pendingResolve = resolve;
  });
}

materialCreateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  materialCreateError.textContent = '';

  const name = materialCreateNameField.value.trim();
  const unit = materialCreateUnitField.value.trim();

  try {
    const item = materialCreateType === 'ingredient'
      ? await createIngredient(name, unit)
      : await createSeasoning(name);
    if (pendingResolve) {
      pendingResolve(item);
      pendingResolve = null;
    }
    materialCreateDialog.close();
    const label = materialCreateType === 'ingredient' ? '食材' : '調味料';
    showToast(`${label}「${name}」を追加しました`);
  } catch (err) {
    materialCreateError.textContent = err.message;
  }
});

materialCreateCancelButton.addEventListener('click', () => {
  materialCreateDialog.close();
});

materialCreateDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(materialCreateDialog, e)) {
    materialCreateDialog.close();
  }
});

// backdropクリック・Escape・キャンセルボタンのいずれで閉じた場合も、
// フォーム送信によるresolve済みでなければキャンセル扱い(null解決)としてまとめて処理する。
materialCreateDialog.addEventListener('close', () => {
  if (pendingResolve) {
    pendingResolve(null);
    pendingResolve = null;
  }
});
