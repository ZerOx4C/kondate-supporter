"use strict";

const confirmDialog = $("confirm-dialog");
const viewMode = $("view-mode");
const editMode = $("edit-mode");

let current = null; // 表示中のレシピ。新規作成中はnull
let mode = "view";
let snapshot = { name: "", body: "" };
let busy = false;
let cookedPressed = false; // このページで「作った」を押した状態。ページを読み込み直すと戻る
let imageChange = null; // 編集中の画像の変更。null=変更なし / {blob,url}=新しい画像 / "remove"=外す

// 一覧から来たときだけブラウザの戻るで一覧へ戻る(一覧の絞り込み条件などをURLごと残すため)
const cameFromList = (() => {
  try {
    const ref = new URL(document.referrer);
    return ref.origin === location.origin && ref.pathname === "/recipes.html";
  } catch {
    return false;
  }
})();

function leaveToList(replace) {
  if (cameFromList) history.back();
  else if (replace) location.replace("recipes.html");
  else location.href = "recipes.html";
}

function clearErrors() {
  $("view-error").textContent = "";
  $("edit-error").textContent = "";
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll("header button, main button")) {
    button.disabled = value;
  }
  if (!value) renderEditImage();
}

function clearImageChange() {
  if (imageChange && imageChange !== "remove") URL.revokeObjectURL(imageChange.url);
  imageChange = null;
}

// 編集フォームの画像欄を状態に合わせる(プレビューと「画像を外す」、または「画像なし」枠と貼り付け・「画像を選ぶ」)
function renderEditImage() {
  let src = "";
  if (imageChange && imageChange !== "remove") src = imageChange.url;
  else if (!imageChange && current && current.image_url) src = current.image_url;
  const img = $("edit-image");
  if (src) img.src = src;
  else img.removeAttribute("src");
  $("edit-preview").hidden = !src;
  $("edit-no-image").hidden = !!src;
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
// 欄の本来の中身(文言と案内)。中身が変えられたときに戻すため控えておく
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

function showLoadError(message) {
  $("load-error").textContent = message;
}

function showView(recipe) {
  current = recipe;
  mode = "view";
  clearErrors();
  document.title = recipe.name + " - kondate-supporter";
  $("view-name").textContent = recipe.name;
  const viewImage = $("view-image");
  if (recipe.image_url) viewImage.src = recipe.image_url;
  else viewImage.removeAttribute("src");
  viewImage.hidden = !recipe.image_url;
  $("view-body").textContent = recipe.body;
  $("cooked-button").replaceChildren(cookedContent(recipe.cooked_count));
  $("cooked-button").setAttribute("aria-pressed", String(cookedPressed));
  $("view-actions").hidden = false;
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
  $("view-actions").hidden = true;
  viewMode.hidden = true;
  editMode.hidden = false;
  $("edit-name").focus();
}

function isDirty() {
  return (
    $("edit-name").value !== snapshot.name ||
    $("edit-body").value !== snapshot.body ||
    imageChange !== null
  );
}

// 編集のキャンセル。未保存の変更があれば確認し、既存なら閲覧表示へ、新規なら一覧へ戻る
async function requestCancel() {
  if (busy) return;
  if (isDirty() && !(await confirmAction("変更を破棄しますか？", "破棄する"))) return;
  clearImageChange();
  if (current) {
    showView(current);
  } else {
    leaveToList(false);
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
    if (current) {
      saved = await api("PUT", "/api/recipes/" + current.id, body);
    } else {
      saved = await api("POST", "/api/recipes", body);
      // 画像の保存で失敗しても、再読み込みで同じレシピを開けるようにする
      history.replaceState(null, "", "recipe.html?id=" + saved.id);
    }
    let result = saved;
    if (imageChange === "remove") {
      result = await api("DELETE", "/api/recipes/" + saved.id + "/image");
    } else if (imageChange) {
      result = await api("PUT", "/api/recipes/" + saved.id + "/image", imageChange.blob);
    }
    clearImageChange();
    showView(result);
  } catch (e) {
    if (saved) {
      // 名前と本文は保存済み。画像の変更を残したまま編集フォームにとどまる
      current = saved;
      snapshot = { name: saved.name, body: saved.body };
      $("edit-name").value = saved.name;
      $("edit-body").value = saved.body;
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
    leaveToList(true);
  } catch (e) {
    showError(e.message);
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
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(false);
  }
}

async function load() {
  const id = new URLSearchParams(location.search).get("id");
  if (id === null) {
    document.title = "新規作成 - kondate-supporter";
    showEdit(null);
    return;
  }
  if (id === "") {
    showLoadError("レシピを読み込めませんでした: IDが不正です");
    return;
  }
  try {
    showView(await api("GET", "/api/recipes/" + encodeURIComponent(id)));
  } catch (e) {
    showLoadError("レシピを読み込めませんでした: " + e.message);
  }
}

$("back-link").addEventListener("click", (e) => {
  if (busy) {
    e.preventDefault();
  } else if (cameFromList) {
    e.preventDefault();
    history.back();
  }
});
$("cooked-button").addEventListener("click", toggleCooked);
$("edit-button").addEventListener("click", () => showEdit(current));
$("delete-button").addEventListener("click", remove);
$("cancel-button").addEventListener("click", requestCancel);
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

$("confirm-ok").addEventListener("click", () => confirmDialog.close("ok"));
$("confirm-cancel").addEventListener("click", () => confirmDialog.close("cancel"));
onOutsideTap(confirmDialog, () => confirmDialog.close("cancel"));

load();
