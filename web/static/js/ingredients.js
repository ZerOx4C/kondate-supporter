const listBody = document.getElementById('ingredient-list');
const form = document.getElementById('ingredient-form');
const idField = document.getElementById('ingredient-id');
const nameField = document.getElementById('ingredient-name');
const unitField = document.getElementById('ingredient-unit');
const submitButton = document.getElementById('ingredient-submit');
const cancelButton = document.getElementById('ingredient-cancel');
const errorEl = document.getElementById('ingredient-error');

function resetForm() {
  form.reset();
  idField.value = '';
  submitButton.textContent = '追加';
  cancelButton.hidden = true;
}

function startEdit(ingredient) {
  idField.value = ingredient.id;
  nameField.value = ingredient.name;
  unitField.value = ingredient.unit;
  submitButton.textContent = '更新';
  cancelButton.hidden = false;
  nameField.focus();
}

function renderIngredients(ingredients) {
  listBody.innerHTML = '';
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
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => startEdit(ingredient));
    actionTd.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => onDelete(ingredient));
    actionTd.appendChild(deleteButton);

    tr.appendChild(actionTd);
    listBody.appendChild(tr);
  }
}

async function loadIngredients() {
  errorEl.textContent = '';
  try {
    const ingredients = await listIngredients();
    renderIngredients(ingredients);
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function onDelete(ingredient) {
  if (!confirm(`「${ingredient.name}」を削除しますか?`)) return;
  errorEl.textContent = '';
  try {
    await deleteIngredient(ingredient.id);
    await loadIngredients();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const name = nameField.value.trim();
  const unit = unitField.value.trim();
  try {
    if (idField.value) {
      await updateIngredient(idField.value, name, unit);
    } else {
      await createIngredient(name, unit);
    }
    resetForm();
    await loadIngredients();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

cancelButton.addEventListener('click', resetForm);

loadIngredients();
