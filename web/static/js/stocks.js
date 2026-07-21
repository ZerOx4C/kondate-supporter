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

// SQLiteのdatetime('now')はUTCの "YYYY-MM-DD HH:MM:SS" 形式で返るため、
// UTCとして明示的にパースしたうえで相対時間の文字列に変換する
function formatUpdatedAt(value) {
  const updatedAt = new Date(value.replace(' ', 'T') + 'Z');
  const diffHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return 'さっき';
  if (diffHours < 24) return `${Math.floor(diffHours)}時間前`;
  const diffDays = diffHours / 24;
  if (diffDays < 14) return `${Math.floor(diffDays)}日前`;
  return 'かなり前';
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

    const quantityTd = document.createElement('td');
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.step = 'any';
    quantityInput.min = '0';
    quantityInput.className = 'quantity-input';
    quantityInput.value = stock.quantity;
    quantityTd.appendChild(quantityInput);
    const quantityUnitSpan = document.createElement('span');
    quantityUnitSpan.className = 'quantity-unit';
    quantityUnitSpan.textContent = stock.unit;
    quantityTd.appendChild(quantityUnitSpan);
    tr.appendChild(quantityTd);

    const updatedAtTd = document.createElement('td');
    updatedAtTd.textContent = formatUpdatedAt(stock.updatedAt);
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
