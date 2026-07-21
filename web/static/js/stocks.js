const stockListBody = document.getElementById('stock-list');
const stockErrorEl = document.getElementById('stock-error');
const stockSearchField = document.getElementById('stock-search');
const newIngredientPanel = document.getElementById('new-ingredient-panel');
const newIngredientQueryEl = document.getElementById('new-ingredient-query');
const newIngredientForm = document.getElementById('new-ingredient-form');
const newIngredientUnitField = document.getElementById('new-ingredient-unit');

let currentStocks = [];

function getVisibleStocks() {
  const query = stockSearchField.value.trim();
  if (query.length < 2) {
    return { query: '', filtering: false, stocks: currentStocks.filter((s) => s.quantity !== 0) };
  }
  const lowerQuery = query.toLowerCase();
  const matched = currentStocks.filter((s) => s.name.toLowerCase().includes(lowerQuery));
  const nonZero = matched.filter((s) => s.quantity !== 0);
  const zero = matched.filter((s) => s.quantity === 0);
  return { query, filtering: true, stocks: [...nonZero, ...zero] };
}

function render() {
  const { query, filtering, stocks } = getVisibleStocks();

  newIngredientPanel.hidden = !filtering;
  if (filtering) {
    newIngredientQueryEl.textContent = query;
  }

  stockListBody.innerHTML = '';
  for (const stock of stocks) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = stock.name;
    tr.appendChild(nameTd);

    const unitTd = document.createElement('td');
    unitTd.textContent = stock.unit;
    tr.appendChild(unitTd);

    const quantityTd = document.createElement('td');
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.step = 'any';
    quantityInput.min = '0';
    quantityInput.value = stock.quantity;
    quantityTd.appendChild(quantityInput);
    tr.appendChild(quantityTd);

    const updatedAtTd = document.createElement('td');
    updatedAtTd.textContent = stock.updatedAt;
    tr.appendChild(updatedAtTd);

    const actionTd = document.createElement('td');
    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.textContent = '更新';
    updateButton.addEventListener('click', () => onUpdate(stock, quantityInput));
    actionTd.appendChild(updateButton);
    tr.appendChild(actionTd);

    stockListBody.appendChild(tr);
  }
}

async function loadStocks() {
  stockErrorEl.textContent = '';
  try {
    currentStocks = await listStocks();
    render();
  } catch (err) {
    stockErrorEl.textContent = err.message;
  }
}

stockSearchField.addEventListener('input', render);

newIngredientForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  stockErrorEl.textContent = '';
  const name = stockSearchField.value.trim();
  const unit = newIngredientUnitField.value.trim();
  try {
    await createIngredient(name, unit);
    newIngredientUnitField.value = '';
    await loadStocks();
  } catch (err) {
    stockErrorEl.textContent = err.message;
  }
});

async function onUpdate(stock, quantityInput) {
  const quantity = Number(quantityInput.value);
  if (Number.isNaN(quantity) || quantity < 0) {
    stockErrorEl.textContent = '数量は0以上の数値を入力してください';
    return;
  }
  stockErrorEl.textContent = '';
  try {
    await updateStockQuantity(stock.ingredientId, quantity);
    await loadStocks();
  } catch (err) {
    stockErrorEl.textContent = err.message;
  }
}

loadStocks();
