"use strict";
// 画面によらない共通部品。画面ごとのJSより先に読み込む

const $ = (id) => document.getElementById(id);

const MAX_IMAGE_SIDE = 800;

// アイコンと回数(0回は数字なし)。一覧タイルと「作った」ボタンで共用
// 全角の数字を半角にする
function toHalfWidthDigits(text) {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function cookedContent(count) {
  const span = document.createElement("span");
  span.className = "cooked";
  const icon = document.createElement("i");
  icon.className = "ti ti-chef-hat";
  icon.setAttribute("aria-hidden", "true");
  span.appendChild(icon);
  if (count > 0) span.append(String(count));
  return span;
}

// bodyはBlobならJPEG、文字列ならJSON文字列としてそのまま、それ以外はJSONにして送る
async function api(method, path, body) {
  let res;
  const isBlob = body instanceof Blob;
  const isRaw = typeof body === "string";
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": isBlob ? "image/jpeg" : "application/json" } : {},
      body: body ? (isBlob || isRaw ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error("サーバーに接続できません");
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    // 本文なし・JSONでない場合は下でステータスを使う
  }
  if (!res.ok) throw new Error((data && data.error) || "HTTP " + res.status);
  return data;
}

// 画像を長辺800px以下のJPEGにする。透過部分は白で塗る
async function toJpeg(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
  } catch {
    throw new Error("画像を読み込めませんでした");
  } finally {
    URL.revokeObjectURL(url);
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("画像を変換できませんでした");
  return blob;
}

// ページの先頭から下へスクロールしているときだけボタンを出し、押すと先頭へ戻す
function setupScrollTop(button) {
  const update = () => { button.hidden = window.scrollY <= 0; };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("pageshow", update);
  button.addEventListener("click", () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
}

// 画面の下端中央に文言を約3秒出す。続けて呼ぶと文言を差し替えて数え直す
const TOAST_MS = 3000;
let toastTimer = 0;
function showToast(element, message) {
  clearTimeout(toastTimer);
  element.textContent = message;
  toastTimer = setTimeout(() => { element.textContent = ""; }, TOAST_MS);
}

// 書式に数量を当てはめて量の文字列に戻す。数量がnullなら書式のまま
function formatAmount(format, quantity) {
  return quantity === null ? format : format.replace("{0}", () => String(quantity));
}

// ボタンの直下に右端をそろえて置く。文書の座標なのでページと一緒にスクロールする
function placeMenu(menu, anchor) {
  const rect = anchor.getBoundingClientRect();
  const margin = parseFloat(getComputedStyle(document.documentElement).fontSize);
  menu.style.top = rect.bottom + window.scrollY + "px";
  menu.style.left = Math.max(margin, rect.right + window.scrollX - menu.offsetWidth) + "px";
}

// 上部右のメニューボタンと、その下に開くメニュー。一覧・献立・集計で共用
function setupMainMenu(button, menu) {
  button.addEventListener("click", () => {
    menu.showModal();
    placeMenu(menu, button);
    menu.querySelector("a, button").focus();
  });
  onOutsideTap(menu, () => menu.close());
  // 移る前に閉じる。開いたままだと、戻るでキャッシュから復元したときにメニューが開いて出る
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) menu.close();
  });
  window.addEventListener("resize", () => {
    if (menu.open) placeMenu(menu, button);
  });
}

// 画面切り替えのリンク。今いる画面のリンクは押しても移らない(一覧の絞り込みを消さない)
function setupPageNav(nav) {
  nav.addEventListener("click", (e) => {
    if (e.target.closest('a[aria-current="page"]')) e.preventDefault();
  });
}

// 期間。献立と集計で共用し、端末のlocalStorageに覚える
const PERIOD_KEY = "kondate.plans.period";
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 31;
const WEEKDAYS = "日月火水木金土";

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function toIsoDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + mm + "-" + dd;
}

function parseIsoDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function formatDay(date) {
  return (date.getMonth() + 1) + "/" + date.getDate() + "(" + WEEKDAYS[date.getDay()] + ")";
}

function isValidDays(n) {
  return Number.isInteger(n) && n >= MIN_DAYS && n <= MAX_DAYS;
}

// 覚えた期間。読めないときは今日から既定の日数
function loadPeriod() {
  const today = new Date();
  let start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let days = DEFAULT_DAYS;
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY));
    const savedStart = saved && typeof saved.start === "string" ? parseIsoDate(saved.start) : null;
    if (savedStart && isValidDays(saved.days)) {
      start = savedStart;
      days = saved.days;
    }
  } catch {
    // 読めないときは既定の期間のまま
  }
  return { start, days };
}

function savePeriod(start, days) {
  try {
    localStorage.setItem(PERIOD_KEY, JSON.stringify({ start: toIsoDate(start), days }));
  } catch {
    // 保存できなくても画面は使える
  }
}

// 期間選択UI。groupは期間の枠で、中の部品はクラスで探す(common.jsは画面の要素IDを参照しない)。
// 利用者の操作で期間が変わったとき、保存と枠の表示の更新の後にonChangeを呼ぶ。
// period() は今の期間、reload() は覚えた期間の読み直し(変わったらtrue。onChangeは呼ばない)
function setupPeriodPicker(group, onChange) {
  const prev = group.querySelector(".period-prev");
  const next = group.querySelector(".period-next");
  const startButton = group.querySelector(".period-start");
  const startInput = group.querySelector(".period-start-input");
  const daysButton = group.querySelector(".period-days");
  const daysInput = group.querySelector(".period-days-input");
  let { start, days } = loadPeriod();
  let editingDays = false;

  function render() {
    startButton.textContent = formatDay(start);
    startButton.setAttribute("aria-label", "開始日: " + formatDay(start));
    daysButton.textContent = String(days);
    daysButton.setAttribute("aria-label", "日数: " + days + "日間");
  }

  function changed() {
    savePeriod(start, days);
    render();
    onChange();
  }

  function endDaysEdit(commit) {
    if (!editingDays) return;
    editingDays = false;
    let didChange = false;
    if (commit) {
      const n = Number(daysInput.value);
      if (daysInput.value.trim() !== "" && isValidDays(n) && n !== days) {
        days = n;
        didChange = true;
      }
    }
    daysInput.hidden = true;
    daysButton.hidden = false;
    if (didChange) changed();
  }

  prev.addEventListener("click", () => {
    start = addDays(start, -days);
    changed();
  });
  next.addEventListener("click", () => {
    start = addDays(start, days);
    changed();
  });

  startButton.addEventListener("click", () => {
    startInput.value = toIsoDate(start);
    if (typeof startInput.showPicker === "function") {
      try {
        startInput.showPicker();
        return;
      } catch {
        // 開けないときはフォーカスだけ
      }
    }
    startInput.focus();
  });
  startInput.addEventListener("change", () => {
    const date = startInput.value ? parseIsoDate(startInput.value) : null;
    if (!date) return;
    start = date;
    changed();
  });

  daysButton.addEventListener("click", () => {
    editingDays = true;
    daysButton.hidden = true;
    daysInput.hidden = false;
    daysInput.value = String(days);
    daysInput.focus();
    daysInput.select();
  });
  daysInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      endDaysEdit(true);
      daysButton.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      endDaysEdit(false);
      daysButton.focus();
    }
  });
  daysInput.addEventListener("blur", () => endDaysEdit(true));

  render();
  return {
    period: () => ({ start, days }),
    reload() {
      endDaysEdit(false);
      const saved = loadPeriod();
      if (toIsoDate(saved.start) === toIsoDate(start) && saved.days === days) return false;
      ({ start, days } = saved);
      render();
      return true;
    },
  };
}

// ダイアログ自身(外側)で pointerdown と click の両方が起きたときだけ外側タップとみなす
function onOutsideTap(dialog, handler) {
  let downOnDialog = false;
  dialog.addEventListener("pointerdown", (e) => {
    downOnDialog = e.target === dialog;
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && downOnDialog) handler();
    downOnDialog = false;
  });
}

// ドラッグ中に表示領域の上端・下端へ近づけたとき、近いほど速くスクロールさせるためのpx数(上は負)
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX = 12;

function autoScrollSpeed(clientY) {
  if (clientY < AUTO_SCROLL_EDGE) return -AUTO_SCROLL_MAX * Math.min(1, (AUTO_SCROLL_EDGE - clientY) / AUTO_SCROLL_EDGE);
  if (clientY > window.innerHeight - AUTO_SCROLL_EDGE) return AUTO_SCROLL_MAX * Math.min(1, (clientY - (window.innerHeight - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
  return 0;
}
