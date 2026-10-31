"use strict";
// 画面によらない共通部品。画面ごとのJSより先に読み込む

const $ = (id) => document.getElementById(id);

const MAX_IMAGE_SIDE = 800;

// アイコンと回数(0回は数字なし)。一覧タイルと「作った」ボタンで共用
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

// 上部右のメニューボタンと、その下に開くメニュー。一覧と献立で共用
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
