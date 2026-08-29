const stockListBody = document.getElementById('stock-list');
const stockErrorEl = document.getElementById('stock-error');
const stockSearchField = document.getElementById('stock-search');
const stockSearchClearButton = document.getElementById('stock-search-clear');
const newIngredientButton = document.getElementById('new-ingredient-button');

let currentStocks = [];
// 食材ID -> { stock, quantityInput, updatedAtTd } のMap。render()のたびに作り直す。
// 保存成功時にDOM(dataset.savedValue・更新日時表示)を書き換えるために、表示中の行だけ保持する。
const pendingRows = new Map();
// 食材ID -> 未保存の入力値(文字列) のMap。render()で作り直されず、
// 検索フィルタの切り替えなどで行が非表示になっても未保存の入力内容を保持し続ける。
const dirtyValues = new Map();
// デバウンス保存用のタイマーID。入力があるたびにクリアして張り直す。
let saveTimer = null;

// SQLiteのdatetime('now')と同じ "YYYY-MM-DD HH:MM:SS" (UTC) 形式の現在時刻文字列を生成する
function nowAsSqliteTimestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// 入力から2秒後にまとめて保存するデバウンス処理。2秒以内に再度呼ばれるとカウントダウンをやり直す。
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDirtyRows();
  }, 2000);
}

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
    // 未保存の入力値が残っていればそれを復元し、なければサーバー側の最新値を表示する。
    quantityInput.value = dirtyValues.has(stock.ingredientId) ? dirtyValues.get(stock.ingredientId) : stock.quantity;
    // 未保存の変更判定に使う基準値。保存に成功するたびに更新する。
    quantityInput.dataset.savedValue = String(stock.quantity);
    quantityInput.addEventListener('input', () => {
      dirtyValues.set(stock.ingredientId, quantityInput.value);
      scheduleSave();
    });
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

// 未保存の値(dirtyValues)を全件保存する。表示状態によらず全件が対象。
// 不正な値(NaN・負数)はdirtyValuesに残したままにし、次回のデバウンス保存で再試行する
// (その場でのエラー表示は行わない)。
async function saveDirtyRows({ keepalive } = {}) {
  for (const [ingredientId, rawValue] of dirtyValues) {
    const quantity = Number(rawValue);
    if (Number.isNaN(quantity) || quantity < 0) continue;
    try {
      await updateStockQuantity(ingredientId, quantity, { keepalive });
      dirtyValues.delete(ingredientId);

      const stock = currentStocks.find((s) => s.ingredientId === ingredientId);
      const updatedAt = nowAsSqliteTimestamp();
      if (stock) {
        stock.quantity = quantity;
        stock.updatedAt = updatedAt;
      }

      // 現在表示中の行であればDOMも書き換える。非表示中の行はrender()時に反映されるためスキップする。
      const row = pendingRows.get(ingredientId);
      if (row) {
        row.quantityInput.dataset.savedValue = rawValue;
        row.updatedAtTd.textContent = 'さっき';
      }

      showToast('保存しました');
    } catch (err) {
      stockErrorEl.textContent = err.message;
    }
  }
}

window.addEventListener('beforeunload', () => {
  // 離脱時はタイマー待ちせず即座に保存する。
  clearTimeout(saveTimer);
  saveDirtyRows({ keepalive: true });
});

loadStocks();
