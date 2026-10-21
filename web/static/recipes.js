"use strict";

const $ = (id) => document.getElementById(id);

const recipeDialog = $("recipe-dialog");
const confirmDialog = $("confirm-dialog");
const viewMode = $("view-mode");
const editMode = $("edit-mode");

let current = null; // 表示中のレシピ。新規作成中はnull
let mode = "view";
let snapshot = { name: "", body: "" };
let busy = false;
let cookedPressed = false; // 開いているダイアログで「作った」を押した状態。閉じるとリセット
let imageChange = null; // 編集中の画像の変更。null=変更なし / {blob,url}=新しい画像 / "remove"=外す

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

async function loadList() {
  const message = $("list-message");
  const list = $("recipe-list");
  list.textContent = "";
  message.textContent = "";
  let recipes;
  try {
    recipes = await api("GET", "/api/recipes");
  } catch (e) {
    message.textContent = "一覧を読み込めませんでした: " + e.message;
    return;
  }
  if (recipes.length === 0) {
    const icon = document.createElement("i");
    icon.className = "ti ti-plus";
    icon.setAttribute("aria-hidden", "true");
    message.append("レシピがまだありません。右上の ", icon, " ボタンから登録してください。");
    return;
  }
  for (const recipe of recipes) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.title = recipe.name;
    const visual = document.createElement("div");
    visual.className = "tile-visual";
    if (recipe.image_url) {
      const img = document.createElement("img");
      img.className = "tile-image";
      img.src = recipe.image_url;
      img.alt = "";
      img.loading = "lazy";
      visual.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "tile-placeholder";
      const text = document.createElement("span");
      text.className = "tile-placeholder-text";
      text.textContent = recipe.name;
      placeholder.appendChild(text);
      visual.appendChild(placeholder);
    }
    const cooked = cookedContent(recipe.cooked_count);
    cooked.classList.add("tile-cooked");
    visual.appendChild(cooked);
    button.appendChild(visual);
    if (recipe.image_url) {
      const name = document.createElement("span");
      name.className = "tile-name";
      name.textContent = recipe.name;
      button.appendChild(name);
    }
    button.addEventListener("click", () => openView(recipe));
    li.appendChild(button);
    list.appendChild(li);
  }
}

function clearErrors() {
  $("view-error").textContent = "";
  $("edit-error").textContent = "";
}

function setBusy(value) {
  busy = value;
  for (const button of recipeDialog.querySelectorAll("button")) {
    button.disabled = value;
  }
  if (!value) renderEditImage();
}

function clearImageChange() {
  if (imageChange && imageChange !== "remove") URL.revokeObjectURL(imageChange.url);
  imageChange = null;
}

// 編集フォームの画像欄(プレビュー or 「画像なし」枠、「画像を外す」の有効・無効)を状態に合わせる
function renderEditImage() {
  let src = "";
  if (imageChange && imageChange !== "remove") src = imageChange.url;
  else if (!imageChange && current && current.image_url) src = current.image_url;
  const img = $("edit-image");
  if (src) img.src = src;
  else img.removeAttribute("src");
  img.hidden = !src;
  $("edit-no-image").hidden = !!src;
  $("remove-image-button").disabled = busy || !src;
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

async function setPendingImage(file) {
  if (busy) return;
  clearErrors();
  setBusy(true);
  try {
    const blob = await toJpeg(file);
    clearImageChange();
    imageChange = { blob, url: URL.createObjectURL(blob) };
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(false);
  }
}

function removeImage() {
  clearImageChange();
  if (current && current.image_url) imageChange = "remove";
  renderEditImage();
}

const pasteArea = $("paste-area");
// 欄の本来の中身(アイコンと文言)。中身が変えられたときに戻すため控えておく
const pasteAreaContent = Array.from(pasteArea.childNodes, (n) => n.cloneNode(true));

function resetPasteArea() {
  pasteArea.replaceChildren(...pasteAreaContent.map((n) => n.cloneNode(true)));
}

// 貼り付けられたクリップボードから最初の画像ファイルを取り出し、「画像を選ぶ」と同じ処理に渡す
function onPaste(e) {
  e.preventDefault();
  if (busy) return;
  const item = Array.from(e.clipboardData ? e.clipboardData.items : [])
    .find((i) => i.kind === "file" && i.type.startsWith("image/"));
  const file = item ? item.getAsFile() : null;
  if (!file) {
    clearErrors();
    showError("画像が見つかりませんでした");
    return;
  }
  setPendingImage(file);
}

function showView(recipe) {
  current = recipe;
  mode = "view";
  clearErrors();
  $("view-name").textContent = recipe.name;
  const viewImage = $("view-image");
  if (recipe.image_url) viewImage.src = recipe.image_url;
  else viewImage.removeAttribute("src");
  viewImage.hidden = !recipe.image_url;
  $("view-body").textContent = recipe.body;
  $("cooked-button").replaceChildren(cookedContent(recipe.cooked_count));
  $("cooked-button").setAttribute("aria-pressed", String(cookedPressed));
  viewMode.hidden = false;
  editMode.hidden = true;
}

function showEdit(recipe) {
  current = recipe;
  mode = "edit";
  clearErrors();
  const name = recipe ? recipe.name : "";
  const body = recipe ? recipe.body : "";
  snapshot = { name, body };
  $("edit-name").value = name;
  $("edit-body").value = body;
  clearImageChange();
  renderEditImage();
  viewMode.hidden = true;
  editMode.hidden = false;
  $("edit-name").focus();
}

function openView(recipe) {
  cookedPressed = false;
  showView(recipe);
  recipeDialog.showModal();
}

function openNew() {
  cookedPressed = false;
  recipeDialog.showModal();
  showEdit(null);
}

function isDirty() {
  return (
    $("edit-name").value !== snapshot.name ||
    $("edit-body").value !== snapshot.body ||
    imageChange !== null
  );
}

// 閉じる要求(閉じるボタン・キャンセル・Esc・外側タップ)の共通処理
async function requestClose() {
  if (busy) return;
  if (mode === "view") {
    recipeDialog.close();
    return;
  }
  if (isDirty() && !(await confirmAction("変更を破棄しますか？", "破棄する"))) return;
  if (current) {
    showView(current);
  } else {
    recipeDialog.close();
  }
}

function confirmAction(message, okLabel) {
  $("confirm-message").textContent = message;
  $("confirm-ok").textContent = okLabel;
  return new Promise((resolve) => {
    const finish = (result) => {
      confirmDialog.removeEventListener("close", onClose);
      resolve(result);
    };
    const onClose = () => finish(confirmDialog.returnValue === "ok");
    confirmDialog.returnValue = "";
    confirmDialog.addEventListener("close", onClose);
    confirmDialog.showModal();
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

function showError(message) {
  (mode === "view" ? $("view-error") : $("edit-error")).textContent = message;
}

async function save(event) {
  event.preventDefault();
  if (busy) return;
  clearErrors();
  const body = { name: $("edit-name").value, body: $("edit-body").value };
  setBusy(true);
  let saved = null;
  try {
    saved = current
      ? await api("PUT", "/api/recipes/" + current.id, body)
      : await api("POST", "/api/recipes", body);
    let result = saved;
    if (imageChange === "remove") {
      result = await api("DELETE", "/api/recipes/" + saved.id + "/image");
    } else if (imageChange) {
      result = await api("PUT", "/api/recipes/" + saved.id + "/image", imageChange.blob);
    }
    clearImageChange();
    showView(result);
    await loadList();
  } catch (e) {
    if (saved) {
      // 名前と本文は保存済み。画像の変更を残したまま編集フォームにとどまる
      current = saved;
      snapshot = { name: saved.name, body: saved.body };
      $("edit-name").value = saved.name;
      $("edit-body").value = saved.body;
      await loadList();
    }
    showError(e.message);
  } finally {
    setBusy(false);
  }
}

async function remove() {
  if (busy) return;
  const ok = await confirmAction(
    "「" + current.name + "」を削除しますか？この操作は取り消せません。",
    "削除する",
  );
  if (!ok) return;
  clearErrors();
  setBusy(true);
  try {
    await api("DELETE", "/api/recipes/" + current.id);
    recipeDialog.close();
    await loadList();
  } catch (e) {
    showError(e.message);
    await loadList();
  } finally {
    setBusy(false);
  }
}

async function toggleCooked() {
  if (busy) return;
  clearErrors();
  setBusy(true);
  try {
    const updated = await api(cookedPressed ? "DELETE" : "POST", "/api/recipes/" + current.id + "/cooked");
    cookedPressed = !cookedPressed;
    showView(updated);
    await loadList();
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(false);
  }
}

$("new-button").addEventListener("click", openNew);
$("cooked-button").addEventListener("click", toggleCooked);
$("edit-button").addEventListener("click", () => showEdit(current));
$("delete-button").addEventListener("click", remove);
$("close-button").addEventListener("click", requestClose);
$("cancel-button").addEventListener("click", requestClose);
editMode.addEventListener("submit", save);
$("pick-image-button").addEventListener("click", () => $("image-input").click());
$("image-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) setPendingImage(file);
});
$("remove-image-button").addEventListener("click", removeImage);
pasteArea.addEventListener("paste", onPaste);
// キー入力・削除・ドロップなどで欄の中身を変えさせない
pasteArea.addEventListener("beforeinput", (e) => e.preventDefault());
// 止められない入力(IMEの変換など)で変わってしまったら元に戻す
pasteArea.addEventListener("input", resetPasteArea);
recipeDialog.addEventListener("close", clearImageChange);

recipeDialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  requestClose();
});
onOutsideTap(recipeDialog, requestClose);

$("confirm-ok").addEventListener("click", () => confirmDialog.close("ok"));
$("confirm-cancel").addEventListener("click", () => confirmDialog.close("cancel"));
onOutsideTap(confirmDialog, () => confirmDialog.close("cancel"));

loadList();
