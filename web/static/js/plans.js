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
const planRecipeFieldsEl = document.getElementById('plan-recipe-fields');
const planNoteFieldsEl = document.getElementById('plan-note-fields');
const planNoteField = document.getElementById('plan-note');
const summaryListBody = document.getElementById('summary-list');
const summaryEmptyEl = document.getElementById('summary-empty');
const planRecipeNameEl = document.getElementById('plan-recipe-name');

const mealTimeLabels = { morning: '朝', noon: '昼', night: '夜', other: 'その他' };
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabels[d.getDay()]})`;
}

let plansById = new Map();
let dragState = null;
let planDialogMode = 'recipe';

function resetPlanForm() {
  planForm.reset();
  planIdField.value = '';
  planRecipeField.value = '';
  planRecipeNameEl.textContent = '';
}

function closePlanDialog() {
  planDialog.close();
  resetPlanForm();
}

function applyPlanDialogMode(mode) {
  planDialogMode = mode;
  planRecipeFieldsEl.hidden = mode !== 'recipe';
  planNoteFieldsEl.hidden = mode !== 'note';
  // hidden な祖先を持っていてもネイティブのrequiredチェックはブロックされる
  // ブラウザがあるため、非表示のフィールドはrequiredを明示的に外す。
  planServingsField.required = mode === 'recipe';
  planNoteField.required = mode === 'note';
}

function openPlanDialog(plan, defaultDate, mode) {
  resetPlanForm();
  const effectiveMode = plan ? (plan.recipeId ? 'recipe' : 'note') : (mode || 'recipe');
  applyPlanDialogMode(effectiveMode);

  if (plan) {
    planDialogTitle.textContent = '献立を編集';
    planIdField.value = plan.id;
    planDateField.value = plan.date;
    planMealTimeField.value = plan.mealTime;

    if (effectiveMode === 'recipe') {
      planServingsField.value = plan.servings;
      planRecipeField.value = plan.recipeId;
      planRecipeNameEl.textContent = plan.recipeName;
    } else {
      planNoteField.value = plan.note;
    }
  } else {
    planDialogTitle.textContent = '献立を追加';
    planDateField.value = defaultDate || toDateInputValue(new Date());
  }
  planDialog.showModal();
  if (effectiveMode === 'recipe') {
    planServingsField.focus();
  } else {
    planNoteField.focus();
  }
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
  plansById = new Map();
  for (const plan of plans) {
    plansById.set(plan.id, plan);
    if (!map.has(plan.date)) map.set(plan.date, []);
    map.get(plan.date).push(plan);
  }
  return map;
}

async function onDropPlan(planId, newDate) {
  const plan = plansById.get(Number(planId));
  if (!plan || plan.date === newDate) return;
  planErrorEl.textContent = '';
  try {
    await updatePlan(plan.id, newDate, plan.recipeId, plan.servings, plan.mealTime, plan.note);
    await refresh();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

function onPlanPanelPointerDown(e, plan, panel) {
  if (e.target.closest('.plan-panel-actions')) return;
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
    ghost,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    dropCell: null,
  };
  panel.classList.add('dragging');
  panel.setPointerCapture(e.pointerId);
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
  const { plan, panel, ghost, dropCell } = dragState;
  panel.releasePointerCapture(e.pointerId);
  panel.classList.remove('dragging');
  ghost.remove();
  if (dropCell) dropCell.classList.remove('drag-over');
  dragState = null;

  if (dropCell && dropCell.dataset.date) {
    onDropPlan(plan.id, dropCell.dataset.date);
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
  panel.addEventListener('pointerdown', (e) => onPlanPanelPointerDown(e, plan, panel));
  panel.addEventListener('pointermove', onPlanPanelPointerMove);
  panel.addEventListener('pointerup', onPlanPanelPointerUp);
  panel.addEventListener('pointercancel', onPlanPanelPointerUp);

  const text = document.createElement('span');
  const mealTimeLabel = mealTimeLabels[plan.mealTime] || plan.mealTime;
  text.textContent = plan.recipeId
    ? `[${mealTimeLabel}] ${plan.recipeName} (${plan.servings}人分)`
    : `[${mealTimeLabel}] ${plan.note}`;
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
    dateTd.textContent = formatDateLabel(date);
    tr.appendChild(dateTd);

    const planTd = document.createElement('td');
    planTd.className = 'plan-cell';
    planTd.dataset.date = date;
    const dayPlans = plansByDate.get(date) || [];
    if (dayPlans.length > 0) {
      const container = document.createElement('div');
      container.className = 'day-plans';
      for (const plan of dayPlans) {
        container.appendChild(createPlanPanel(plan));
      }
      planTd.appendChild(container);
    }

    const addNoteButton = document.createElement('button');
    addNoteButton.type = 'button';
    addNoteButton.className = 'plan-add-button';
    addNoteButton.textContent = 'メモ追加';
    addNoteButton.addEventListener('click', () => openPlanDialog(null, date, 'note'));
    planTd.appendChild(addNoteButton);

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
  if (isDialogBackdropClick(planDialog, e)) closePlanDialog();
});

planForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  planErrorEl.textContent = '';
  const date = planDateField.value;
  const mealTime = planMealTimeField.value;
  try {
    if (planDialogMode === 'recipe') {
      if (!planRecipeField.value) {
        planErrorEl.textContent = 'レシピを選択してください';
        return;
      }
      const recipeId = Number(planRecipeField.value);
      const servings = Number(planServingsField.value);
      if (planIdField.value) {
        await updatePlan(planIdField.value, date, recipeId, servings, mealTime, '');
      } else {
        await createPlan(date, recipeId, servings, mealTime, '');
      }
    } else {
      const note = planNoteField.value.trim();
      if (!note) {
        planErrorEl.textContent = 'メモを入力してください';
        return;
      }
      if (planIdField.value) {
        await updatePlan(planIdField.value, date, null, 0, mealTime, note);
      } else {
        await createPlan(date, null, 0, mealTime, note);
      }
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
  await refresh();
}

init();
