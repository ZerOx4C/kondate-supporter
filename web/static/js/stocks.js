const stockListBody = document.getElementById('stock-list');
const stockErrorEl = document.getElementById('stock-error');
const showZeroToggle = document.getElementById('show-zero-toggle');

let currentStocks = [];

function renderStocks(stocks) {
  const visibleStocks = showZeroToggle.checked
    ? stocks
    : stocks.filter((stock) => stock.quantity !== 0);

  stockListBody.innerHTML = '';
  for (const stock of visibleStocks) {
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
    renderStocks(currentStocks);
  } catch (err) {
    stockErrorEl.textContent = err.message;
  }
}

showZeroToggle.addEventListener('change', () => renderStocks(currentStocks));

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
