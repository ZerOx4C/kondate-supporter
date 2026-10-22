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

async function api(method, path, body) {
  let res;
  const isBlob = body instanceof Blob;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": isBlob ? "image/jpeg" : "application/json" } : {},
      body: body ? (isBlob ? body : JSON.stringify(body)) : undefined,
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
