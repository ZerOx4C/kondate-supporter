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
const rangeFromDisplayButton = document.getElementById('range-from-display');
const rangeDaysField = document.getElementById('range-days');

// 隠しinput(range-from)の現在値「YYYY-MM-DD」から「M/D」形式のラベルを組み立てる(ゼロパディングなし)。
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
}

// 表示用ボタンのラベルを隠しinputの現在値に合わせて再計算する。
function updateRangeFromDisplay() {
  rangeFromDisplayButton.textContent = formatDateShort(rangeFromField.value);
}

const initialDateRange = loadDateRange();
rangeFromField.value = initialDateRange.start;
rangeDaysField.value = initialDateRange.days;
updateRangeFromDisplay();

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
  updateRangeFromDisplay();
  document.dispatchEvent(new CustomEvent('daterangechange'));
}

rangeFromField.addEventListener('change', onDateRangeFieldChange);
rangeDaysField.addEventListener('change', onDateRangeFieldChange);

// 表示用ボタンをクリックしたら、隠しinputのネイティブ日付ピッカーを開く
// (showPicker()はユーザー操作イベントハンドラ内からの呼び出しが必須)。
rangeFromDisplayButton.addEventListener('click', () => rangeFromField.showPicker());

const rangeShiftPrevButton = document.getElementById('range-shift-prev');
const rangeShiftNextButton = document.getElementById('range-shift-next');

// 現在設定中の検討期間の日数分だけ開始日を前後にずらす
function shiftDateRange(direction) {
  const days = sanitizeDays(rangeDaysField.value);
  const base = rangeFromField.value || toDateInputValue(new Date());
  rangeFromField.value = addDays(base, direction * days);
  updateRangeFromDisplay();
  onDateRangeFieldChange();
}

rangeShiftPrevButton.addEventListener('click', () => shiftDateRange(-1));
rangeShiftNextButton.addEventListener('click', () => shiftDateRange(1));
