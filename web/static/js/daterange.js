// 全画面共通の献立検討期間(開始日・終了日)を管理するスクリプト。
// localStorageに保存し、ページ遷移をまたいで値を維持する。

const DATE_RANGE_STORAGE_KEY = 'kondate-supporter:date-range';

function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const today = new Date();
  const weekLater = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { from: toDateInputValue(today), to: toDateInputValue(weekLater) };
}

function loadDateRange() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DATE_RANGE_STORAGE_KEY));
    if (parsed && parsed.from && parsed.to) return parsed;
  } catch {
    // 壊れた保存値は無視してデフォルトにフォールバックする
  }
  return defaultDateRange();
}

const rangeFromField = document.getElementById('range-from');
const rangeToField = document.getElementById('range-to');

const initialDateRange = loadDateRange();
rangeFromField.value = initialDateRange.from;
rangeToField.value = initialDateRange.to;

function onDateRangeFieldChange() {
  localStorage.setItem(
    DATE_RANGE_STORAGE_KEY,
    JSON.stringify({ from: rangeFromField.value, to: rangeToField.value })
  );
  document.dispatchEvent(new CustomEvent('daterangechange'));
}

rangeFromField.addEventListener('change', onDateRangeFieldChange);
rangeToField.addEventListener('change', onDateRangeFieldChange);
