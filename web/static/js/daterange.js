// 全画面共通の献立検討期間(開始日・日数)を管理するスクリプト。
// localStorageに保存し、ページ遷移をまたいで値を維持する。

const DATE_RANGE_STORAGE_KEY = 'kondate-supporter:date-range';

function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// 日付文字列(YYYY-MM-DD)にdays日を加算した日付文字列を返す。
function addDays(dateStr, days) {
  const base = new Date(`${dateStr}T00:00:00`);
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return toDateInputValue(shifted);
}

function defaultDateRange() {
  const today = new Date();
  return { start: toDateInputValue(today), days: 7 };
}

function loadDateRange() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DATE_RANGE_STORAGE_KEY));
    if (parsed && parsed.start && Number.isInteger(parsed.days) && parsed.days >= 1) return parsed;
  } catch {
    // 壊れた保存値は無視してデフォルトにフォールバックする
  }
  return defaultDateRange();
}

const rangeFromField = document.getElementById('range-from');
const rangeDaysField = document.getElementById('range-days');

const initialDateRange = loadDateRange();
rangeFromField.value = initialDateRange.start;
rangeDaysField.value = initialDateRange.days;

// 不正な日数入力(空値・1未満・NaN等)を1以上の整数にガードする。
function sanitizeDays(value) {
  const parsed = parseInt(value, 10);
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed);
}

// 開始日・日数から{from, to}形式の検討期間を返す(API・画面表示用)。
function getDateRange() {
  const days = sanitizeDays(rangeDaysField.value);
  return { from: rangeFromField.value, to: addDays(rangeFromField.value, days - 1) };
}

function onDateRangeFieldChange() {
  localStorage.setItem(
    DATE_RANGE_STORAGE_KEY,
    JSON.stringify({ start: rangeFromField.value, days: sanitizeDays(rangeDaysField.value) })
  );
  document.dispatchEvent(new CustomEvent('daterangechange'));
}

rangeFromField.addEventListener('change', onDateRangeFieldChange);
rangeDaysField.addEventListener('change', onDateRangeFieldChange);
