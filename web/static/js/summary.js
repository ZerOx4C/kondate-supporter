// 全画面共通の材料集計オーバーレイを管理するスクリプト。
// 検討期間(daterange.js)に対する献立の必要量・在庫からの残りを
// ダイアログで表示する。

const summaryToggleButton = document.getElementById('summary-toggle');
const summaryDialog = document.getElementById('summary-dialog');
const summaryDialogCloseButton = document.getElementById('summary-dialog-close');
const summaryListBody = document.getElementById('summary-list');
const summaryEmptyEl = document.getElementById('summary-empty');
const summaryErrorEl = document.getElementById('summary-error');

function renderSummary(items) {
  summaryListBody.innerHTML = '';
  summaryEmptyEl.hidden = items.length > 0;
  for (const item of items) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = item.name;
    tr.appendChild(nameTd);

    const requiredTd = document.createElement('td');
    requiredTd.textContent = `${item.required}${item.unit}`;
    tr.appendChild(requiredTd);

    const remainingTd = document.createElement('td');
    remainingTd.textContent = `${item.remaining}${item.unit}`;
    tr.appendChild(remainingTd);

    summaryListBody.appendChild(tr);
  }
}

async function loadSummary() {
  summaryErrorEl.textContent = '';
  try {
    const items = await getPlanSummary(rangeFromField.value, rangeToField.value);
    renderSummary(items);
  } catch (err) {
    summaryErrorEl.textContent = err.message;
  }
}

function openSummaryDialog() {
  summaryDialog.showModal();
  loadSummary();
}

function closeSummaryDialog() {
  summaryDialog.close();
}

summaryToggleButton.addEventListener('click', openSummaryDialog);
summaryDialogCloseButton.addEventListener('click', closeSummaryDialog);
summaryDialog.addEventListener('click', (e) => {
  if (isDialogBackdropClick(summaryDialog, e)) closeSummaryDialog();
});
