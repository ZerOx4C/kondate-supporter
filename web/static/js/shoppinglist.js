const rangeForm = document.getElementById('range-form');
const rangeFromField = document.getElementById('range-from');
const rangeToField = document.getElementById('range-to');
const listBody = document.getElementById('shoppinglist-list');
const emptyEl = document.getElementById('shoppinglist-empty');
const errorEl = document.getElementById('shoppinglist-error');

function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function renderItems(items) {
  listBody.innerHTML = '';
  emptyEl.hidden = items.length > 0;
  for (const item of items) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = item.name;
    tr.appendChild(nameTd);

    const unitTd = document.createElement('td');
    unitTd.textContent = item.unit;
    tr.appendChild(unitTd);

    const requiredTd = document.createElement('td');
    requiredTd.textContent = item.required;
    tr.appendChild(requiredTd);

    const stockTd = document.createElement('td');
    stockTd.textContent = item.stock;
    tr.appendChild(stockTd);

    const shortageTd = document.createElement('td');
    shortageTd.textContent = item.shortage;
    tr.appendChild(shortageTd);

    listBody.appendChild(tr);
  }
}

async function loadShoppingList() {
  errorEl.textContent = '';
  try {
    const items = await getShoppingList(rangeFromField.value, rangeToField.value);
    renderItems(items);
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

rangeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loadShoppingList();
});

function init() {
  const today = new Date();
  const weekLater = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  rangeFromField.value = toDateInputValue(today);
  rangeToField.value = toDateInputValue(weekLater);
  loadShoppingList();
}

init();
