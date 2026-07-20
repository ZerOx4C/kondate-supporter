const rangeForm = document.getElementById('range-form');
const rangeFromField = document.getElementById('range-from');
const rangeToField = document.getElementById('range-to');
const planListBody = document.getElementById('plan-list');
const planForm = document.getElementById('plan-form');
const planIdField = document.getElementById('plan-id');
const planDateField = document.getElementById('plan-date');
const planRecipeField = document.getElementById('plan-recipe');
const planServingsField = document.getElementById('plan-servings');
const planSubmitButton = document.getElementById('plan-submit');
const planCancelButton = document.getElementById('plan-cancel');
const planErrorEl = document.getElementById('plan-error');

function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function resetPlanForm() {
  planForm.reset();
  planIdField.value = '';
  planSubmitButton.textContent = '追加';
  planCancelButton.hidden = true;
}

function startEditPlan(plan) {
  planIdField.value = plan.id;
  planDateField.value = plan.date;
  planRecipeField.value = plan.recipeId;
  planServingsField.value = plan.servings;
  planSubmitButton.textContent = '更新';
  planCancelButton.hidden = false;
}

async function onDeletePlan(plan) {
  if (!confirm(`${plan.date}の「${plan.recipeName}」を削除しますか?`)) return;
  planErrorEl.textContent = '';
  try {
    await deletePlan(plan.id);
    await loadPlans();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
}

function renderPlans(plans) {
  planListBody.innerHTML = '';
  for (const plan of plans) {
    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = plan.date;
    tr.appendChild(dateTd);

    const recipeTd = document.createElement('td');
    recipeTd.textContent = plan.recipeName;
    tr.appendChild(recipeTd);

    const servingsTd = document.createElement('td');
    servingsTd.textContent = plan.servings;
    tr.appendChild(servingsTd);

    const actionTd = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => startEditPlan(plan));
    actionTd.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => onDeletePlan(plan));
    actionTd.appendChild(deleteButton);

    tr.appendChild(actionTd);
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

rangeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loadPlans();
});

planCancelButton.addEventListener('click', resetPlanForm);

planForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  planErrorEl.textContent = '';
  const date = planDateField.value;
  const recipeId = Number(planRecipeField.value);
  const servings = Number(planServingsField.value);
  try {
    if (planIdField.value) {
      await updatePlan(planIdField.value, date, recipeId, servings);
    } else {
      await createPlan(date, recipeId, servings);
    }
    resetPlanForm();
    await loadPlans();
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
});

async function init() {
  const today = new Date();
  const weekLater = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  rangeFromField.value = toDateInputValue(today);
  rangeToField.value = toDateInputValue(weekLater);
  planDateField.value = toDateInputValue(today);

  planErrorEl.textContent = '';
  try {
    const recipes = await listRecipes();
    for (const recipe of recipes) {
      const option = document.createElement('option');
      option.value = recipe.id;
      option.textContent = recipe.name;
      planRecipeField.appendChild(option);
    }
  } catch (err) {
    planErrorEl.textContent = err.message;
  }
  await loadPlans();
}

init();
