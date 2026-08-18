const listBody = document.getElementById('seasoning-list');
const form = document.getElementById('seasoning-form');
const idField = document.getElementById('seasoning-id');
const nameField = document.getElementById('seasoning-name');
const submitButton = document.getElementById('seasoning-submit');
const cancelButton = document.getElementById('seasoning-cancel');
const errorEl = document.getElementById('seasoning-error');

function resetForm() {
  form.reset();
  idField.value = '';
  submitButton.textContent = '追加';
  cancelButton.hidden = true;
}

function startEdit(seasoning) {
  idField.value = seasoning.id;
  nameField.value = seasoning.name;
  submitButton.textContent = '更新';
  cancelButton.hidden = false;
  nameField.focus();
}

function renderSeasonings(seasonings) {
  listBody.innerHTML = '';
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
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => startEdit(seasoning));
    actionTd.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', () => onDelete(seasoning));
    actionTd.appendChild(deleteButton);

    tr.appendChild(actionTd);
    listBody.appendChild(tr);
  }
}

async function loadSeasonings() {
  errorEl.textContent = '';
  try {
    const seasonings = await listSeasonings();
    renderSeasonings(seasonings);
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function onDelete(seasoning) {
  if (!confirm(`「${seasoning.name}」を削除しますか?`)) return;
  errorEl.textContent = '';
  try {
    await deleteSeasoning(seasoning.id);
    await loadSeasonings();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const name = nameField.value.trim();
  try {
    if (idField.value) {
      await updateSeasoning(idField.value, name);
    } else {
      await createSeasoning(name);
    }
    resetForm();
    await loadSeasonings();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

cancelButton.addEventListener('click', resetForm);

loadSeasonings();
