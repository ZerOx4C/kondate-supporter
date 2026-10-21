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

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
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
    button.textContent = recipe.name;
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
}

function showView(recipe) {
  current = recipe;
  mode = "view";
  clearErrors();
  $("view-name").textContent = recipe.name;
  $("view-body").textContent = recipe.body;
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
  viewMode.hidden = true;
  editMode.hidden = false;
  $("edit-name").focus();
}

function openView(recipe) {
  showView(recipe);
  recipeDialog.showModal();
}

function openNew() {
  recipeDialog.showModal();
  showEdit(null);
}

function isDirty() {
  return $("edit-name").value !== snapshot.name || $("edit-body").value !== snapshot.body;
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
  try {
    const saved = current
      ? await api("PUT", "/api/recipes/" + current.id, body)
      : await api("POST", "/api/recipes", body);
    showView(saved);
    await loadList();
  } catch (e) {
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

$("new-button").addEventListener("click", openNew);
$("edit-button").addEventListener("click", () => showEdit(current));
$("delete-button").addEventListener("click", remove);
$("close-button").addEventListener("click", requestClose);
$("cancel-button").addEventListener("click", requestClose);
editMode.addEventListener("submit", save);

recipeDialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  requestClose();
});
onOutsideTap(recipeDialog, requestClose);

$("confirm-ok").addEventListener("click", () => confirmDialog.close("ok"));
$("confirm-cancel").addEventListener("click", () => confirmDialog.close("cancel"));
onOutsideTap(confirmDialog, () => confirmDialog.close("cancel"));

loadList();
