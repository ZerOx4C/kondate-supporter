const planListBody = document.getElementById('plan-list');
const planForm = document.getElementById('plan-form');
const planIdField = document.getElementById('plan-id');
const planDateField = document.getElementById('plan-date');
const planMealTimeField = document.getElementById('plan-meal-time');
const planRecipeField = document.getElementById('plan-recipe');
const planServingsField = document.getElementById('plan-servings');
const planEditMetaRowEl = document.getElementById('plan-edit-meta-row');
const planServingsFieldEl = document.getElementById('plan-servings-field');
const planErrorEl = document.getElementById('plan-error');
const planDialog = document.getElementById('plan-dialog');
const planDialogTitle = document.getElementById('plan-dialog-title');
const planDialogCancelButton = document.getElementById('plan-dialog-cancel');
const planRecipeFieldsEl = document.getElementById('plan-recipe-fields');
const planNoteFieldsEl = document.getElementById('plan-note-fields');
const planNoteField = document.getElementById('plan-note');
const planRecipeNameEl = document.getElementById('plan-recipe-name');
const planIngredientRequirementsListEl = document.getElementById('plan-ingredient-requirements-list');
const planSeasoningRequirementsListEl = document.getElementById('plan-seasoning-requirements-list');

const planViewMetaRowEl = document.getElementById('plan-view-meta-row');
const planViewMetaEl = document.getElementById('plan-view-meta');
const planViewServingsEl = document.getElementById('plan-view-servings');
const planViewServingsValueEl = planViewServingsEl.querySelector('span');
const planViewFieldsEl = document.getElementById('plan-view-fields');
const planViewRecipeFieldsEl = document.getElementById('plan-view-recipe-fields');
const planViewNoteFieldsEl = document.getElementById('plan-view-note-fields');
const planViewImageEl = document.getElementById('plan-view-image');
const planViewUrlEl = document.getElementById('plan-view-url');
const planViewIngredientsEl = document.getElementById('plan-view-ingredients');
const planViewSeasoningsEl = document.getElementById('plan-view-seasonings');
const planViewStepsEl = document.getElementById('plan-view-steps');
const planViewStepsEmptyEl = document.getElementById('plan-view-steps-empty');
const planViewNoteEl = document.getElementById('plan-view-note');
const planViewActionsEl = document.getElementById('plan-view-actions');
const planEditActionsEl = document.getElementById('plan-edit-actions');
const planViewEditButton = document.getElementById('plan-view-edit');
const planViewDeleteButton = document.getElementById('plan-view-delete');
const planViewCloseButton = document.getElementById('plan-view-close');
const planViewPrevButton = document.getElementById('plan-view-prev');
const planViewNextButton = document.getElementById('plan-view-next');

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
const mealTimeLabels = { morning: '朝', noon: '昼', night: '夜', other: 'その他' };

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabels[d.getDay()]})`;
}

let plansById = new Map();
let dragState = null;
let planDialogMode = 'recipe';
let planDialogTarget = null;
let planRecipeDetail = null;
let planIngredientOverrides = new Map();
let planSeasoningOverrides = new Map();

// 献立表示ダイアログの「戻る/進む」ナビゲーション対象(同日・同区分・レシピ紐づけの献立のみ)。
let planDialogNavList = [];
let planDialogNavIndex = -1;

function computeIngredientRequirement(ing) {
  if (ing.fixedQuantity) return ing.quantity;
  const servings = Number(planServingsField.value) || 0;
  return ing.quantity * (servings / planRecipeDetail.servings);
}

function renderPlanIngredientRequirements() {
  planIngredientRequirementsListEl.innerHTML = '';
  if (!planRecipeDetail) return;
  for (const ing of planRecipeDetail.ingredients) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = ing.name;
    tr.appendChild(nameTd);

    const valueTd = document.createElement('td');
    const overridden = planIngredientOverrides.has(ing.ingredientId);
    if (overridden) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.min = '0';
      input.className = 'plan-ingredient-requirement-input';
      input.value = planIngredientOverrides.get(ing.ingredientId);
      input.addEventListener('input', () => {
        planIngredientOverrides.set(ing.ingredientId, Number(input.value) || 0);
      });
      valueTd.appendChild(input);
      valueTd.appendChild(document.createTextNode(ing.unit));
    } else {
      valueTd.textContent = `${computeIngredientRequirement(ing)}${ing.unit}`;
    }
    tr.appendChild(valueTd);

    const adjustTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = overridden;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        planIngredientOverrides.set(ing.ingredientId, computeIngredientRequirement(ing));
      } else {
        planIngredientOverrides.delete(ing.ingredientId);
      }
      renderPlanIngredientRequirements();
    });
    adjustTd.appendChild(checkbox);
    tr.appendChild(adjustTd);

    planIngredientRequirementsListEl.appendChild(tr);
  }
}

function computeSeasoningRequirement(s) {
  if (s.fixedQuantity) return s.quantity;
  const servings = Number(planServingsField.value) || 0;
  return s.quantity * (servings / planRecipeDetail.servings);
}

function renderPlanSeasoningRequirements() {
  planSeasoningRequirementsListEl.innerHTML = '';
  if (!planRecipeDetail) return;
  for (const s of planRecipeDetail.seasonings) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = s.name;
    tr.appendChild(nameTd);

    const valueTd = document.createElement('td');
    const overridden = planSeasoningOverrides.has(s.seasoningId);
    if (overridden) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.min = '0';
      input.className = 'plan-ingredient-requirement-input';
      input.value = planSeasoningOverrides.get(s.seasoningId);
      input.addEventListener('input', () => {
        planSeasoningOverrides.set(s.seasoningId, Number(input.value) || 0);
      });
      valueTd.appendChild(input);
      valueTd.appendChild(document.createTextNode(s.unit));
    } else {
      valueTd.textContent = `${computeSeasoningRequirement(s)}${s.unit}`;
    }
    tr.appendChild(valueTd);

    const adjustTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = overridden;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        planSeasoningOverrides.set(s.seasoningId, computeSeasoningRequirement(s));
      } else {
        planSeasoningOverrides.delete(s.seasoningId);
      }
      renderPlanSeasoningRequirements();
    });
    adjustTd.appendChild(checkbox);
    tr.appendChild(adjustTd);

    planSeasoningRequirementsListEl.appendChild(tr);
  }
}

async function loadPlanIngredientRequirements(recipeId) {
  planErrorEl.textContent = '';
  try {
    planRecipeDetail = await getRecipe(recipeId);
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
  renderPlanIngredientRequirements();
  renderPlanSeasoningRequirements();
}

function resetPlanForm() {
  planForm.reset();
  planIdField.value = '';
  planRecipeField.value = '';
  planRecipeNameEl.textContent = '';
  planRecipeDetail = null;
  planIngredientOverrides = new Map();
  planSeasoningOverrides = new Map();
  renderPlanIngredientRequirements();
  renderPlanSeasoningRequirements();
}

function closePlanDialog() {
  planDialog.close();
  resetPlanForm();
  planDialogTarget = null;
  resetPlanDialogNav();
}

// フォーム内の「レシピ紐づけ」「メモ」の内容切り替え(表示モード用の対応要素も含む)
function applyPlanContentMode(mode) {
  planDialogMode = mode;
  planRecipeFieldsEl.hidden = mode !== 'recipe';
  planNoteFieldsEl.hidden = mode !== 'note';
  planViewRecipeFieldsEl.hidden = mode !== 'recipe';
  planViewNoteFieldsEl.hidden = mode !== 'note';
  planServingsFieldEl.hidden = mode !== 'recipe';
  // hidden な祖先を持っていてもネイティブのrequiredチェックはブロックされる
  // ブラウザがあるため、非表示のフィールドはrequiredを明示的に外す。
  planServingsField.required = mode === 'recipe';
  planNoteField.required = mode === 'note';
  // レシピ紐づけの献立のみ全画面化・戻る/進むナビゲーションを有効にする(メモ行は中央ダイアログのまま)
  planDialog.classList.toggle('fullscreen-dialog', mode === 'recipe');
}

// ダイアログ全体の表示モード/編集モード切り替え
function applyPlanInteractionMode(mode) {
  planViewMetaRowEl.hidden = mode !== 'view';
  planViewFieldsEl.hidden = mode !== 'view';
  planForm.hidden = mode !== 'edit';
  planEditMetaRowEl.hidden = mode !== 'edit';
  planViewActionsEl.hidden = mode !== 'view';
  planEditActionsEl.hidden = mode !== 'edit';
  planViewEditButton.hidden = mode !== 'view';
}

// 表示・編集どちらのモードでも共通に行う状態投入処理。実際に採用したcontentモード('recipe'|'note')を返す
function populatePlanFields(plan, defaultDate, mode) {
  const effectiveMode = plan ? (plan.recipeId ? 'recipe' : 'note') : (mode || 'recipe');
  applyPlanContentMode(effectiveMode);
  renderPlanDateOptions();

  if (plan) {
    planIdField.value = plan.id;
    planDateField.value = plan.type === 'daily' ? 'daily' : (plan.date || '');
    planMealTimeField.value = plan.mealTime;

    if (effectiveMode === 'recipe') {
      planServingsField.value = plan.servings;
      planRecipeField.value = plan.recipeId;
      planRecipeNameEl.textContent = plan.recipeName;
      planIngredientOverrides = new Map((plan.ingredientOverrides || []).map((o) => [o.ingredientId, o.quantity]));
      planSeasoningOverrides = new Map((plan.seasoningOverrides || []).map((o) => [o.seasoningId, o.quantity]));
    } else {
      planNoteField.value = plan.note;
    }
  } else {
    planDateField.value = defaultDate ?? toDateInputValue(new Date());
  }
  return effectiveMode;
}

// 献立日付フィールド(<select>)の値と献立の日付/種別との対応:
// value === '' -> {date: null, type: 'unscheduled'}(未定)
// value === 'daily' -> {date: null, type: 'daily'}(毎日)
// それ以外(実際の日付文字列) -> {date: value, type: 'scheduled'}
function resolvePlanDateSelection() {
  const value = planDateField.value;
  if (value === 'daily') return { date: null, type: 'daily' };
  if (value === '') return { date: null, type: 'unscheduled' };
  return { date: value, type: 'scheduled' };
}

function renderPlanDateOptions() {
  const dateRange = getDateRange();
  const dates = enumerateDateRange(dateRange.from, dateRange.to);
  planDateField.innerHTML = '';
  const unscheduledOption = document.createElement('option');
  unscheduledOption.value = '';
  unscheduledOption.textContent = '未定';
  planDateField.appendChild(unscheduledOption);
  const dailyOption = document.createElement('option');
  dailyOption.value = 'daily';
  dailyOption.textContent = '毎日';
  planDateField.appendChild(dailyOption);
  for (const dateStr of dates) {
    const option = document.createElement('option');
    option.value = dateStr;
    option.textContent = formatDateLabel(dateStr);
    planDateField.appendChild(option);
  }
}

// 表示モードのfoot/head部分へ、その献立の内容を描画する。
// 材料・調味料の必要量はオーバーライドがあればそれを、無ければplanRecipeDetailを元に
// computeIngredientRequirement/computeSeasoningRequirementで算出する(編集モードと同じロジック)。
function renderPlanView(plan, effectiveMode) {
  const mealLabel = mealTimeLabels[plan.mealTime] || plan.mealTime;
  const dateLabel = plan.date ? formatDateLabel(plan.date) : (plan.type === 'daily' ? '毎日' : '未定');
  planViewMetaEl.textContent = `${dateLabel} ${mealLabel}`;

  if (effectiveMode === 'recipe') {
    planDialogTitle.textContent = plan.recipeName;
    planViewServingsEl.hidden = false;
    planViewServingsValueEl.textContent = `${plan.servings}`;
    if (!planRecipeDetail) return;

    planViewImageEl.hidden = !plan.hasImage;
    if (plan.hasImage) {
      planViewImageEl.src = `/api/recipes/${plan.recipeId}/image?t=${Date.now()}`;
    }

    planViewUrlEl.innerHTML = '';
    planViewUrlEl.hidden = !planRecipeDetail.url;
    if (planRecipeDetail.url) {
      const link = document.createElement('a');
      link.href = planRecipeDetail.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = planRecipeDetail.url;
      planViewUrlEl.appendChild(link);
    }

    planViewIngredientsEl.innerHTML = '';
    for (const ing of planRecipeDetail.ingredients) {
      const quantity = planIngredientOverrides.has(ing.ingredientId)
        ? planIngredientOverrides.get(ing.ingredientId)
        : computeIngredientRequirement(ing);
      const li = document.createElement('li');
      // 補足の有無に関わらずバッジを表示し、リストマーカー代わりの役割を持たせる
      const badge = document.createElement('span');
      badge.className = 'material-note-badge';
      badge.dataset.note = ing.note;
      badge.textContent = ing.note;
      li.appendChild(badge);
      li.appendChild(document.createTextNode(`${ing.name} ${quantity}${ing.unit}`));
      planViewIngredientsEl.appendChild(li);
    }

    planViewSeasoningsEl.innerHTML = '';
    for (const s of planRecipeDetail.seasonings) {
      const quantity = planSeasoningOverrides.has(s.seasoningId)
        ? planSeasoningOverrides.get(s.seasoningId)
        : computeSeasoningRequirement(s);
      const li = document.createElement('li');
      // 補足の有無に関わらずバッジを表示し、リストマーカー代わりの役割を持たせる
      const badge = document.createElement('span');
      badge.className = 'material-note-badge';
      badge.dataset.note = s.note;
      badge.textContent = s.note;
      li.appendChild(badge);
      li.appendChild(document.createTextNode(`${s.name} ${quantity}${s.unit}`));
      planViewSeasoningsEl.appendChild(li);
    }

    planViewStepsEl.innerHTML = '';
    planViewStepsEmptyEl.hidden = planRecipeDetail.steps.length > 0;
    for (const step of planRecipeDetail.steps) {
      const li = document.createElement('li');
      li.textContent = step;
      planViewStepsEl.appendChild(li);
    }
  } else {
    planDialogTitle.textContent = 'メモ';
    planViewServingsEl.hidden = true;
    planViewNoteEl.textContent = plan.note;
  }
}

// 同日・同区分(date+mealTime+type)のレシピ紐づけ献立を全件抽出する。
// unscheduled/dailyはdateが両方nullのため、typeも条件に含めないと未定と毎日が混ざってしまう。
function getSameSlotRecipePlans(plan) {
  return Array.from(plansById.values()).filter((p) =>
    p.recipeId && p.type === plan.type && p.date === plan.date && p.mealTime === plan.mealTime
  );
}

// 献立表示ダイアログを開いた時点の同日・同区分の献立一覧をスナップショットとして保持し、
// 戻る/進むボタンの範囲をその時点の一覧に固定する。
function buildPlanDialogNav(plan) {
  planDialogNavList = getSameSlotRecipePlans(plan);
  planDialogNavIndex = planDialogNavList.findIndex((p) => p.id === plan.id);
}

function resetPlanDialogNav() {
  planDialogNavList = [];
  planDialogNavIndex = -1;
}

function updatePlanDialogNavButtons() {
  // 一覧が空、または対象献立が一覧に存在しない場合のみ両ボタンを無効化する。
  // それ以外は先頭・末尾でもループ移動できるため常に有効のままにする。
  const disabled = planDialogNavList.length === 0 || planDialogNavIndex === -1;
  planViewPrevButton.disabled = disabled;
  planViewNextButton.disabled = disabled;
}

async function showPlanDialogNavPlan(delta) {
  if (planDialogNavList.length === 0) return;
  // 先頭から戻ると末尾、末尾から進むと先頭に移動するようループさせる。
  const nextIndex = (planDialogNavIndex + delta + planDialogNavList.length) % planDialogNavList.length;
  planDialogNavIndex = nextIndex;
  await showPlanView(planDialogNavList[nextIndex]);
}

async function showPlanView(plan) {
  planDialogTarget = plan;
  planErrorEl.textContent = '';
  resetPlanForm();
  const effectiveMode = populatePlanFields(plan, null, null);
  if (effectiveMode === 'recipe') {
    await loadPlanIngredientRequirements(plan.recipeId);
  }
  renderPlanView(plan, effectiveMode);
  applyPlanInteractionMode('view');
  updatePlanDialogNavButtons();
}

async function showPlanEdit(plan, defaultDate, mode) {
  planErrorEl.textContent = '';
  resetPlanForm();
  const effectiveMode = populatePlanFields(plan, defaultDate, mode);
  planDialogTitle.textContent = plan ? '献立を編集' : '献立を追加';
  if (effectiveMode === 'recipe' && plan) {
    await loadPlanIngredientRequirements(plan.recipeId);
  }
  applyPlanInteractionMode('edit');
  if (effectiveMode === 'recipe') {
    planServingsField.focus();
  } else {
    planNoteField.focus();
  }
}

async function openPlanDialog(plan, defaultDate, mode) {
  if (plan) {
    if (plan.recipeId) {
      buildPlanDialogNav(plan);
    } else {
      resetPlanDialogNav();
    }
    await showPlanView(plan);
  } else {
    resetPlanDialogNav();
    planDialogTarget = null;
    await showPlanEdit(null, defaultDate, mode);
  }
  planDialog.showModal();
}

// .plan-panel-actions内の編集ボタン専用。既存の献立を直接編集モードで開く。
async function openPlanEditDialog(plan) {
  planDialogTarget = plan;
  if (plan.recipeId) {
    buildPlanDialogNav(plan);
  } else {
    resetPlanDialogNav();
  }
  await showPlanEdit(plan);
  planDialog.showModal();
}

async function onDeletePlan(plan) {
  const planLabel = plan.recipeId ? plan.recipeName : plan.note;
  const deleteDateLabel = plan.date || (plan.type === 'daily' ? '毎日' : '未定');
  if (!(await confirmDialog(`${deleteDateLabel}の「${planLabel}」を削除しますか?`))) return;
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
    plansById.set(plan.id, plan);
    if (!map.has(plan.date)) map.set(plan.date, []);
    map.get(plan.date).push(plan);
  }
  return map;
}

async function onDropPlan(planId, newDate, newType) {
  const plan = plansById.get(Number(planId));
  if (!plan || (plan.date === newDate && plan.type === newType)) return;
  planErrorEl.textContent = '';
  try {
    await updatePlan(plan.id, newDate, newType, plan.recipeId, plan.servings, plan.mealTime, plan.note, plan.ingredientOverrides, plan.seasoningOverrides);
    await refresh();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

function onPlanPanelPointerDown(e, plan, panel, handle) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();

  const rect = panel.getBoundingClientRect();
  const ghost = panel.cloneNode(true);
  ghost.classList.add('plan-panel-ghost');
  ghost.style.width = `${rect.width}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.appendChild(ghost);

  dragState = {
    plan,
    panel,
    handle,
    ghost,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    dropCell: null,
  };
  panel.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
}

function onPlanPanelPointerMove(e) {
  if (!dragState) return;
  const { ghost, offsetX, offsetY } = dragState;
  ghost.style.left = `${e.clientX - offsetX}px`;
  ghost.style.top = `${e.clientY - offsetY}px`;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  const cell = target ? target.closest('.plan-cell') : null;
  if (dragState.dropCell !== cell) {
    if (dragState.dropCell) dragState.dropCell.classList.remove('drag-over');
    if (cell) cell.classList.add('drag-over');
    dragState.dropCell = cell;
  }
}

function onPlanPanelPointerUp(e) {
  if (!dragState) return;
  const { plan, panel, handle, ghost, dropCell } = dragState;
  handle.releasePointerCapture(e.pointerId);
  panel.classList.remove('dragging');
  ghost.remove();
  if (dropCell) dropCell.classList.remove('drag-over');
  dragState = null;

  if (dropCell && dropCell.dataset.unscheduled === 'true') {
    onDropPlan(plan.id, null, 'unscheduled');
  } else if (dropCell && dropCell.dataset.daily === 'true') {
    onDropPlan(plan.id, null, 'daily');
  } else if (dropCell && dropCell.dataset.date) {
    onDropPlan(plan.id, dropCell.dataset.date, 'scheduled');
  }
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
  if (plan.mealTime !== 'other') {
    panel.classList.add(`plan-panel-${plan.mealTime}`);
  }
  panel.addEventListener('click', () => openPlanDialog(plan));

  const handle = document.createElement('span');
  handle.className = 'plan-panel-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.innerHTML = '<i class="ti ti-grip-vertical" aria-hidden="true"></i>';
  handle.addEventListener('click', (event) => event.stopPropagation());
  handle.addEventListener('pointerdown', (e) => onPlanPanelPointerDown(e, plan, panel, handle));
  handle.addEventListener('pointermove', onPlanPanelPointerMove);
  handle.addEventListener('pointerup', onPlanPanelPointerUp);
  handle.addEventListener('pointercancel', onPlanPanelPointerUp);
  panel.appendChild(handle);

  const media = document.createElement('div');
  media.className = 'plan-panel-media';
  if (plan.recipeId && plan.hasImage) {
    const img = document.createElement('img');
    img.src = `/api/recipes/${plan.recipeId}/image`;
    img.alt = '';
    img.className = 'plan-panel-image';
    media.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'plan-panel-image-placeholder';
    placeholder.textContent = plan.recipeId ? '🍽️' : '📝';
    placeholder.setAttribute('aria-hidden', 'true');
    media.appendChild(placeholder);
  }
  panel.appendChild(media);

  const main = document.createElement('div');
  main.className = 'plan-panel-main';

  const text = document.createElement('span');
  text.className = 'plan-panel-text';
  text.textContent = plan.recipeId ? plan.recipeName : plan.note;
  main.appendChild(text);

  if (plan.recipeId) {
    const meta = document.createElement('div');
    meta.className = 'plan-panel-meta';
    const servings = document.createElement('span');
    servings.className = 'plan-panel-servings';
    servings.innerHTML = `<i class="ti ti-users" aria-hidden="true"></i> ${plan.servings}`;
    meta.appendChild(servings);
    main.appendChild(meta);
  }

  const actions = document.createElement('span');
  actions.className = 'plan-panel-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'icon-button';
  editButton.setAttribute('aria-label', '編集');
  editButton.innerHTML = '<i class="ti ti-pencil" aria-hidden="true"></i>';
  editButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openPlanEditDialog(plan);
  });
  actions.appendChild(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'icon-button danger';
  deleteButton.setAttribute('aria-label', '削除');
  deleteButton.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
  deleteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    onDeletePlan(plan);
  });
  actions.appendChild(deleteButton);

  panel.appendChild(main);
  panel.appendChild(actions);
  return panel;
}

function createPlanAreaEl(label, plans, { unscheduled = false, daily = false, date = null, onAddNote }) {
  const dayEl = document.createElement('div');
  dayEl.className = 'plan-day';
  if (unscheduled) dayEl.classList.add('plan-day-unscheduled');
  if (daily) dayEl.classList.add('plan-day-daily');

  const header = document.createElement('div');
  header.className = 'plan-day-header';

  const dateLabel = document.createElement('span');
  dateLabel.className = 'plan-day-date';
  dateLabel.textContent = label;
  header.appendChild(dateLabel);

  const addNoteButton = document.createElement('button');
  addNoteButton.type = 'button';
  addNoteButton.className = 'plan-add-button';
  addNoteButton.setAttribute('aria-label', 'メモを追加');
  addNoteButton.innerHTML = '<i class="ti ti-message-plus" aria-hidden="true"></i>';
  addNoteButton.addEventListener('click', onAddNote);
  header.appendChild(addNoteButton);

  dayEl.appendChild(header);

  const cell = document.createElement('div');
  cell.className = 'plan-cell';
  if (unscheduled) {
    cell.dataset.unscheduled = 'true';
  } else if (daily) {
    cell.dataset.daily = 'true';
  } else {
    cell.dataset.date = date;
  }
  if (plans.length > 0) {
    const container = document.createElement('div');
    container.className = 'day-plans';
    for (const plan of plans) {
      container.appendChild(createPlanPanel(plan));
    }
    cell.appendChild(container);
  }
  dayEl.appendChild(cell);

  return dayEl;
}

function renderPlans(scheduledPlans, unscheduledPlans, dailyPlans) {
  planListBody.innerHTML = '';
  plansById = new Map();
  for (const plan of unscheduledPlans) plansById.set(plan.id, plan);
  for (const plan of dailyPlans) plansById.set(plan.id, plan);
  const plansByDate = groupPlansByDate(scheduledPlans);

  planListBody.appendChild(createPlanAreaEl('未定', unscheduledPlans, {
    unscheduled: true,
    onAddNote: () => openPlanDialog(null, '', 'note'),
  }));

  planListBody.appendChild(createPlanAreaEl('毎日', dailyPlans, {
    daily: true,
    onAddNote: () => openPlanDialog(null, 'daily', 'note'),
  }));

  const dateRange = getDateRange();
  const dates = enumerateDateRange(dateRange.from, dateRange.to);
  for (const date of dates) {
    planListBody.appendChild(createPlanAreaEl(formatDateLabel(date), plansByDate.get(date) || [], {
      date,
      onAddNote: () => openPlanDialog(null, date, 'note'),
    }));
  }
}

async function loadPlans() {
  planErrorEl.textContent = '';
  try {
    const dateRange = getDateRange();
    const [scheduledPlans, unscheduledPlans, dailyPlans] = await Promise.all([
      listPlans(dateRange.from, dateRange.to),
      listUnscheduledPlans(),
      listDailyPlans(),
    ]);
    renderPlans(scheduledPlans, unscheduledPlans, dailyPlans);
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

async function refresh() {
  await loadPlans();
}

document.addEventListener('daterangechange', refresh);

planDialogCancelButton.addEventListener('click', () => {
  if (planDialogTarget) {
    showPlanView(planDialogTarget);
  } else {
    closePlanDialog();
  }
});

planViewEditButton.addEventListener('click', () => showPlanEdit(planDialogTarget));
planViewDeleteButton.addEventListener('click', () => onDeletePlan(planDialogTarget));
planViewCloseButton.addEventListener('click', closePlanDialog);
planViewPrevButton.addEventListener('click', () => showPlanDialogNavPlan(-1));
planViewNextButton.addEventListener('click', () => showPlanDialogNavPlan(1));

planServingsField.addEventListener('input', () => {
  renderPlanIngredientRequirements();
  renderPlanSeasoningRequirements();
});

planDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(planDialog, e)) closePlanDialog();
});

planForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  planErrorEl.textContent = '';
  const { date, type } = resolvePlanDateSelection();
  const mealTime = planMealTimeField.value;
  try {
    let saved;
    if (planDialogMode === 'recipe') {
      if (!planRecipeField.value) {
        planErrorEl.textContent = 'レシピを選択してください';
        return;
      }
      const recipeId = Number(planRecipeField.value);
      const servings = Number(planServingsField.value);
      const ingredientOverrides = Array.from(planIngredientOverrides.entries()).map(([ingredientId, quantity]) => ({ ingredientId, quantity }));
      const seasoningOverrides = Array.from(planSeasoningOverrides.entries()).map(([seasoningId, quantity]) => ({ seasoningId, quantity }));
      if (planIdField.value) {
        saved = await updatePlan(planIdField.value, date, type, recipeId, servings, mealTime, '', ingredientOverrides, seasoningOverrides);
      } else {
        saved = await createPlan(date, type, recipeId, servings, mealTime, '');
      }
    } else {
      const note = planNoteField.value.trim();
      if (!note) {
        planErrorEl.textContent = 'メモを入力してください';
        return;
      }
      if (planIdField.value) {
        saved = await updatePlan(planIdField.value, date, type, null, 0, mealTime, note);
      } else {
        saved = await createPlan(date, type, null, 0, mealTime, note);
      }
    }
    await refresh();
    if (saved.recipeId) {
      buildPlanDialogNav(saved);
    } else {
      resetPlanDialogNav();
    }
    await showPlanView(saved);
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
});

async function init() {
  planErrorEl.textContent = '';
  await refresh();
}

init();
