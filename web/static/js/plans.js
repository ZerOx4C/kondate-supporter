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
const planRecipeNameEl = document.getElementById('plan-recipe-name');
const planIngredientRequirementsListEl = document.getElementById('plan-ingredient-requirements-list');
const planSeasoningRequirementsListEl = document.getElementById('plan-seasoning-requirements-list');

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabels[d.getDay()]})`;
}

let plansById = new Map();
let dragState = null;
let planDialogMode = 'recipe';
let planRecipeDetail = null;
let planIngredientOverrides = new Map();
let planSeasoningOverrides = new Map();

function computeIngredientRequirement(ing) {
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

function renderPlanDateOptions() {
  const dates = enumerateDateRange(rangeFromField.value, rangeToField.value);
  planDateField.innerHTML = '';
  const unscheduledOption = document.createElement('option');
  unscheduledOption.value = '';
  unscheduledOption.textContent = '未定';
  planDateField.appendChild(unscheduledOption);
  for (const dateStr of dates) {
    const option = document.createElement('option');
    option.value = dateStr;
    option.textContent = formatDateLabel(dateStr);
    planDateField.appendChild(option);
  }
}

function openPlanDialog(plan, defaultDate, mode) {
  resetPlanForm();
  const effectiveMode = plan ? (plan.recipeId ? 'recipe' : 'note') : (mode || 'recipe');
  applyPlanDialogMode(effectiveMode);
  renderPlanDateOptions();

  if (plan) {
    planDialogTitle.textContent = '献立を編集';
    planIdField.value = plan.id;
    planDateField.value = plan.date || '';
    planMealTimeField.value = plan.mealTime;

    if (effectiveMode === 'recipe') {
      planServingsField.value = plan.servings;
      planRecipeField.value = plan.recipeId;
      planRecipeNameEl.textContent = plan.recipeName;
      planIngredientOverrides = new Map((plan.ingredientOverrides || []).map((o) => [o.ingredientId, o.quantity]));
      planSeasoningOverrides = new Map((plan.seasoningOverrides || []).map((o) => [o.seasoningId, o.quantity]));
      loadPlanIngredientRequirements(plan.recipeId);
    } else {
      planNoteField.value = plan.note;
    }
  } else {
    planDialogTitle.textContent = '献立を追加';
    planDateField.value = defaultDate ?? toDateInputValue(new Date());
  }
  planDialog.showModal();
  if (effectiveMode === 'recipe') {
    planServingsField.focus();
  } else {
    planNoteField.focus();
  }
}

async function onDeletePlan(plan) {
  if (!confirm(`${plan.date || '未定'}の「${plan.recipeName}」を削除しますか?`)) return;
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

async function onDropPlan(planId, newDate) {
  const plan = plansById.get(Number(planId));
  if (!plan || plan.date === newDate) return;
  planErrorEl.textContent = '';
  try {
    await updatePlan(plan.id, newDate, plan.recipeId, plan.servings, plan.mealTime, plan.note, plan.ingredientOverrides, plan.seasoningOverrides);
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
    onDropPlan(plan.id, null);
  } else if (dropCell && dropCell.dataset.date) {
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
  if (plan.mealTime !== 'other') {
    panel.classList.add(`plan-panel-${plan.mealTime}`);
  }

  const handle = document.createElement('span');
  handle.className = 'plan-panel-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.innerHTML = '<i class="ti ti-grip-vertical" aria-hidden="true"></i>';
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

  const text = document.createElement('span');
  text.className = 'plan-panel-text';
  text.textContent = plan.recipeId ? plan.recipeName : plan.note;
  panel.appendChild(text);

  if (plan.recipeId) {
    const servings = document.createElement('span');
    servings.className = 'plan-panel-servings';
    servings.innerHTML = `<i class="ti ti-users" aria-hidden="true"></i> ${plan.servings}`;
    panel.appendChild(servings);
  }

  const actions = document.createElement('span');
  actions.className = 'plan-panel-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'icon-button';
  editButton.setAttribute('aria-label', '編集');
  editButton.innerHTML = '<i class="ti ti-pencil" aria-hidden="true"></i>';
  editButton.addEventListener('click', () => openPlanDialog(plan));
  actions.appendChild(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'icon-button danger';
  deleteButton.setAttribute('aria-label', '削除');
  deleteButton.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
  deleteButton.addEventListener('click', () => onDeletePlan(plan));
  actions.appendChild(deleteButton);

  panel.appendChild(actions);
  return panel;
}

function createPlanAreaEl(label, plans, { unscheduled = false, date = null, onAddNote }) {
  const dayEl = document.createElement('div');
  dayEl.className = 'plan-day';
  if (unscheduled) dayEl.classList.add('plan-day-unscheduled');

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

function renderPlans(scheduledPlans, unscheduledPlans) {
  planListBody.innerHTML = '';
  plansById = new Map();
  for (const plan of unscheduledPlans) plansById.set(plan.id, plan);
  const plansByDate = groupPlansByDate(scheduledPlans);

  planListBody.appendChild(createPlanAreaEl('未定', unscheduledPlans, {
    unscheduled: true,
    onAddNote: () => openPlanDialog(null, '', 'note'),
  }));

  const dates = enumerateDateRange(rangeFromField.value, rangeToField.value);
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
    const [scheduledPlans, unscheduledPlans] = await Promise.all([
      listPlans(rangeFromField.value, rangeToField.value),
      listUnscheduledPlans(),
    ]);
    renderPlans(scheduledPlans, unscheduledPlans);
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

async function refresh() {
  await loadPlans();
}

document.addEventListener('daterangechange', refresh);

planDialogCancelButton.addEventListener('click', closePlanDialog);

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
  const date = planDateField.value || null;
  const mealTime = planMealTimeField.value;
  try {
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
        await updatePlan(planIdField.value, date, recipeId, servings, mealTime, '', ingredientOverrides, seasoningOverrides);
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
