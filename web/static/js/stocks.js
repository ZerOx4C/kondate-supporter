const stockListBody = document.getElementById('stock-list');
const stockErrorEl = document.getElementById('stock-error');
const stockSearchField = document.getElementById('stock-search');
const stockSearchClearButton = document.getElementById('stock-search-clear');
const newIngredientButton = document.getElementById('new-ingredient-button');

let currentStocks = [];
// 食材ID -> { stock, quantityInput, updatedAtTd } のMap。render()のたびに作り直す。
// 定期的な自動保存(saveDirtyRows)が入力中の行を参照するために保持する。
const pendingRows = new Map();

function getVisibleStocks() {
  const query = stockSearchField.value.trim();
  if (query.length < 1) {
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
  const { filtering, stocks } = getVisibleStocks();

  newIngredientButton.hidden = !filtering;

  pendingRows.clear();
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
    // 未保存の変更判定に使う基準値。保存に成功するたびに更新する。
    quantityInput.dataset.savedValue = String(stock.quantity);
    quantityTd.appendChild(quantityInput);
    const quantityUnitSpan = document.createElement('span');
    quantityUnitSpan.className = 'quantity-unit';
    quantityUnitSpan.textContent = stock.unit;
    quantityTd.appendChild(quantityUnitSpan);
    tr.appendChild(quantityTd);

    const updatedAtTd = document.createElement('td');
    updatedAtTd.textContent = formatUpdatedAt(stock.updatedAt);
    tr.appendChild(updatedAtTd);

    stockListBody.appendChild(tr);
    pendingRows.set(stock.ingredientId, { stock, quantityInput, updatedAtTd });
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
stockSearchClearButton.addEventListener('click', () => {
  stockSearchField.value = '';
  stockSearchField.focus();
  render();
});

newIngredientButton.addEventListener('click', async () => {
  const name = stockSearchField.value.trim();
  const item = await openMaterialCreateDialog('ingredient', name);
  if (!item) return;
  stockErrorEl.textContent = '';
  await loadStocks();
});

// 変更のあった行だけを保存する。不正な値(NaN・負数)の行は保存せず、
// 次回の自動保存に委ねる(その場でのエラー表示は行わない)。
async function saveDirtyRows({ keepalive } = {}) {
  for (const [ingredientId, { quantityInput, updatedAtTd }] of pendingRows) {
    const rawValue = quantityInput.value;
    if (rawValue === quantityInput.dataset.savedValue) continue;
    const quantity = Number(rawValue);
    if (Number.isNaN(quantity) || quantity < 0) continue;
    try {
      await updateStockQuantity(ingredientId, quantity, { keepalive });
      quantityInput.dataset.savedValue = rawValue;
      updatedAtTd.textContent = 'さっき';
      showToast('保存しました');
    } catch (err) {
      stockErrorEl.textContent = err.message;
    }
  }
}

setInterval(() => saveDirtyRows(), 2000);
window.addEventListener('beforeunload', () => saveDirtyRows({ keepalive: true }));

loadStocks();
