"use strict";

const confirmDialog = $("confirm-dialog");
const viewMode = $("view-mode");
const editMode = $("edit-mode");

let current = null; // 表示中のレシピ。新規作成中はnull
let mode = "view";
let snapshot = { name: "", body: "", servings: 0, tags: [], ingredients: [] };
let editTags = []; // 編集中のタグ名
let tagOptions = []; // タグ入力欄の候補(GET /api/tags)
let busy = false;
let cookedPressed = false; // このページで「作った」を押した状態。ページを読み込み直すと戻る
let leaving = false; // 画面内で確認済みの遷移中。trueの間はbeforeunloadで確認しない
let imageChange = null; // 編集中の画像の変更。null=変更なし / {blob,url}=新しい画像 / "remove"=外す

// 献立の行から開いたときの、その行(?plan_id=)。それ以外はnull
const planId = new URLSearchParams(location.search).get("plan_id");
let plan = null;

// 一覧か献立から来たときだけブラウザの戻るで戻る(一覧の絞り込み条件などをURLごと残すため)
const cameFrom = (() => {
  try {
    const ref = new URL(document.referrer);
    if (ref.origin !== location.origin) return null;
    if (ref.pathname === "/recipes.html") return "list";
    if (ref.pathname === "/plans.html") return "plans";
  } catch {}
  return null;
})();

// 献立の行から開いたときは、ほかの画面から来ていても戻り先は献立にする(ブラウザの戻るは献立から来たときだけ)
const backHref = planId !== null || cameFrom === "plans" ? "plans.html" : "recipes.html";
const backViaHistory = planId !== null ? cameFrom === "plans" : cameFrom !== null;

if (backHref === "plans.html") {
  const link = $("back-link");
  link.href = backHref;
  link.setAttribute("aria-label", "献立へ戻る");
  link.title = "献立へ戻る";
}

function leaveBack(replace) {
  leaving = true;
  if (backViaHistory) history.back();
  else if (replace) location.replace(backHref);
  else location.href = backHref;
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

// 本文中のURL。http:// か https:// から、空白やASCII以外の文字の手前まで
const URL_PATTERN = /https?:\/\/[!-~]+/g;
// URLの末尾から外す句読点・閉じ括弧
const URL_TRAILING = /[.,:;!?'")\]}>]+$/;

// 本文をテキストノードとリンクに分けて入れる(書かれたHTMLを解釈させないためinnerHTMLは使わない)
function renderBody(el, text) {
  const nodes = [];
  let last = 0;
  for (const m of text.matchAll(URL_PATTERN)) {
    const url = m[0].replace(URL_TRAILING, "");
    if (url.length <= url.indexOf("://") + 3) continue; // 中身が残らないものはリンクにしない
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const a = document.createElement("a");
    a.href = url;
    a.textContent = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    nodes.push(a);
    last = m.index + url.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  el.replaceChildren(...nodes);
}

// 人数欄の値。全角の数字は半角に直し、空は0、数字だけなら数にする。
// それ以外は文字列のまま送り、正しいかどうかはサーバーが決める
function servingsValue() {
  const text = toHalfWidthDigits($("edit-servings").value.trim());
  if (text === "") return 0;
  return /^[0-9]+$/.test(text) ? Number(text) : text;
}

// 献立の行から開いたときの人数の換算。献立の行が無いか、レシピの人数が0(未設定)で倍率が決まらないときはnull。
// shownは出す人数、changedは献立の人数がレシピと違うか
function planScale(recipe) {
  if (plan === null || recipe.servings === 0) return null;
  const shown = plan.servings ?? recipe.servings;
  return { shown, changed: shown !== recipe.servings };
}

// 量の数量を「献立の人数 ÷ レシピの人数」倍にして小数第1位に丸める。倍率が1のときと数の無い量(null)はそのまま
function scaleQuantity(quantity, recipe, scale) {
  if (quantity === null || scale === null || !scale.changed) return quantity;
  return Math.round(quantity * scale.shown / recipe.servings * 10) / 10;
}

// 閲覧表示の人数。0は未設定なので出さない。献立の人数がレシピと違うときは献立のパネルと同じ印を付ける
function renderViewServings(recipe, scale) {
  const el = $("view-servings");
  el.hidden = recipe.servings === 0;
  if (recipe.servings === 0) return;
  const shown = scale ? scale.shown : recipe.servings;
  const changed = scale !== null && scale.changed;
  el.querySelector("span").textContent = String(shown);
  el.classList.toggle("changed", changed);
  el.setAttribute("aria-label", changed ? shown + "人分、" + recipe.servings + "人分から変更" : shown + "人分");
  el.title = changed ? recipe.servings + "人分から変更" : shown + "人分";
}

// 閲覧表示の札は、そのタグ1つだけで絞り込んだ一覧へのリンクにする
function renderViewTags(names) {
  $("view-tags").replaceChildren(...names.map((name) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "tag";
    a.href = "recipes.html?" + new URLSearchParams({ tag: name });
    a.textContent = name;
    li.append(a);
    return li;
  }));
}

// 閲覧表示の材料は名前と量(書式に数量を当てはめた文字列)の2列の表にする。参考量があれば量の後ろに括弧で添える
function renderViewIngredients(recipe, scale) {
  $("view-ingredients").tBodies[0].replaceChildren(...recipe.ingredients.map((i) => {
    const tr = document.createElement("tr");
    const reference = i.reference_format === "" ? "" : "(" + formatAmount(i.reference_format, scaleQuantity(i.reference_quantity, recipe, scale)) + ")";
    for (const text of [i.name, formatAmount(i.format, scaleQuantity(i.quantity, recipe, scale)) + reference]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    return tr;
  }));
}

// 編集中の札と、まだ付けていないタグだけの候補を描き直す。札ごとに「外す」ボタンを付ける
function renderEditTags() {
  $("edit-tags").replaceChildren(...editTags.map((name) => {
    const li = document.createElement("li");
    li.className = "tag";
    li.append(name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-only";
    button.setAttribute("aria-label", "「" + name + "」を外す");
    button.title = "「" + name + "」を外す";
    button.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>';
    button.addEventListener("click", () => {
      editTags = editTags.filter((t) => t !== name);
      renderEditTags();
    });
    li.append(button);
    return li;
  }));
  $("tag-options").replaceChildren(...tagOptions
    .filter((name) => !editTags.includes(name))
    .map((name) => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    }));
}

// 入力欄の文字をタグとして足す(サーバーの正規化と同じく、前後の空白を除き重複は足さない)
function commitTagInput() {
  const name = $("tag-input").value.trim();
  if (name === "") return;
  if (!editTags.includes(name)) editTags.push(name);
  $("tag-input").value = "";
  renderEditTags();
}

// 候補は入力の補助なので、取れなくても手で打てばよく、失敗は無視する
async function loadTagOptions() {
  try {
    tagOptions = await api("GET", "/api/tags");
    renderEditTags();
  } catch {}
}

// 材料名の候補も入力の補助なので、取れなくても手で打てばよく、失敗は無視する
async function loadIngredientNameOptions() {
  try {
    const names = await api("GET", "/api/ingredient-names");
    $("ingredient-name-options").replaceChildren(...names.map((name) => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    }));
  } catch {}
}

// 編集フォームの材料の行の値は入力欄を正とする(入力のたびに描き直すとフォーカスとIMEの変換が切れるため)
function createIngredientRow(name, amount, reference) {
  const li = document.createElement("li");
  li.className = "ingredient-row";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "ingredient-name";
  nameInput.placeholder = "材料";
  nameInput.setAttribute("aria-label", "材料の名前");
  nameInput.autocomplete = "off";
  nameInput.setAttribute("list", "ingredient-name-options");
  nameInput.enterKeyHint = "next";
  nameInput.value = name;
  nameInput.addEventListener("input", updateIngredientLabels);
  nameInput.addEventListener("keydown", onIngredientEnter);
  const amountInput = document.createElement("input");
  amountInput.type = "text";
  amountInput.className = "ingredient-amount";
  amountInput.placeholder = "量";
  amountInput.setAttribute("aria-label", "量");
  amountInput.autocomplete = "off";
  amountInput.enterKeyHint = "next";
  amountInput.value = amount;
  amountInput.addEventListener("keydown", onIngredientEnter);
  const referenceInput = document.createElement("input");
  referenceInput.type = "text";
  referenceInput.className = "ingredient-reference";
  referenceInput.placeholder = "参考量";
  referenceInput.setAttribute("aria-label", "参考量");
  referenceInput.autocomplete = "off";
  referenceInput.enterKeyHint = "next";
  referenceInput.value = reference;
  referenceInput.addEventListener("keydown", onIngredientEnter);
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "icon-only ingredient-handle";
  handle.innerHTML = '<i class="ti ti-grip-vertical" aria-hidden="true"></i>';
  handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
  handle.addEventListener("pointerdown", startIngredientDrag);
  handle.addEventListener("keydown", onIngredientHandleKey);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-only ingredient-remove";
  button.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>';
  button.addEventListener("click", () => removeIngredientRow(li));
  li.append(handle, nameInput, amountInput, referenceInput, button);
  return li;
}

function renderEditIngredients(ingredients) {
  const rows = ingredients.map((i) => createIngredientRow(
    i.name, formatAmount(i.format, i.quantity), formatAmount(i.reference_format, i.reference_quantity)));
  if (rows.length === 0) rows.push(createIngredientRow("", "", ""));
  $("edit-ingredients").replaceChildren(...rows);
  updateIngredientLabels();
}

// 外すボタンと掴む部分の名前は、名前のある行は「「名前」を外す/動かす」、名前の無い行は区別のため「N行目の材料を外す/動かす」にする
function updateIngredientLabels() {
  Array.from($("edit-ingredients").children).forEach((li, index) => {
    const name = li.querySelector(".ingredient-name").value.trim();
    for (const [selector, verb] of [[".ingredient-remove", "外す"], [".ingredient-handle", "動かす"]]) {
      const label = name === "" ? (index + 1) + "行目の材料を" + verb : "「" + name + "」を" + verb;
      const button = li.querySelector(selector);
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  });
}

function addIngredientRow() {
  const li = createIngredientRow("", "", "");
  $("edit-ingredients").append(li);
  updateIngredientLabels();
  li.querySelector(".ingredient-name").focus();
}

// 外した行のあとはフォーカスを落とさず、詰めてきた同じ位置の行(末尾なら1つ前、無ければ「材料を追加」)へ移す
function removeIngredientRow(li) {
  const list = $("edit-ingredients");
  const index = Array.from(list.children).indexOf(li);
  li.remove();
  updateIngredientLabels();
  const next = list.children[Math.min(index, list.children.length - 1)];
  (next ? next.querySelector(".ingredient-remove") : $("add-ingredient-button")).focus();
}

// 掴む部分のドラッグ。掴んだ行はtransformで指に付けて動かし、DOMの順は離したときに1回だけ入れ替える
// (動かしている間に入れ替えると行の位置が変わり、入る位置の計算も見た目も跳ぶため)
let ingredientDrag = null;

function startIngredientDrag(e) {
  if (busy || ingredientDrag || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  const handle = e.currentTarget;
  const list = $("edit-ingredients");
  const rows = Array.from(list.children);
  const row = handle.closest("li");
  const rects = rows.map((li) => {
    const rect = li.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
  const index = rows.indexOf(row);
  handle.focus();
  handle.setPointerCapture(e.pointerId);
  ingredientDrag = {
    handle, list, rows, row, index, rects, target: index,
    pointerId: e.pointerId,
    shift: rects[index].height + (parseFloat(getComputedStyle(list).rowGap) || 0),
    startPageY: e.clientY + window.scrollY,
    clientY: e.clientY,
    frame: 0,
  };
  list.classList.add("sorting");
  row.classList.add("dragging");
  handle.addEventListener("pointermove", onIngredientDragMove);
  handle.addEventListener("pointerup", onIngredientDragUp);
  handle.addEventListener("pointercancel", onIngredientDragCancel);
  handle.addEventListener("lostpointercapture", onIngredientDragCancel);
  window.addEventListener("scroll", updateIngredientDrag);
  ingredientDrag.frame = requestAnimationFrame(autoScrollIngredientDrag);
}

function onIngredientDragMove(e) {
  if (e.pointerId !== ingredientDrag.pointerId) return;
  ingredientDrag.clientY = e.clientY;
  updateIngredientDrag();
}

function onIngredientDragUp(e) {
  if (e.pointerId === ingredientDrag.pointerId) endIngredientDrag(true);
}

function onIngredientDragCancel(e) {
  if (e.pointerId === ingredientDrag.pointerId) endIngredientDrag(false);
}

function updateIngredientDrag() {
  const d = ingredientDrag;
  const offset = d.clientY + window.scrollY - d.startPageY;
  const center = d.rects[d.index].top + d.rects[d.index].height / 2 + offset;
  let target = 0;
  d.rows.forEach((li, j) => {
    if (j !== d.index && d.rects[j].top + d.rects[j].height / 2 < center) target++;
  });
  d.target = target;
  d.rows.forEach((li, j) => {
    if (j === d.index) {
      li.style.transform = "translateY(" + offset + "px)";
    } else if (j < d.index && j >= target) {
      li.style.transform = "translateY(" + d.shift + "px)";
    } else if (j > d.index && j <= target) {
      li.style.transform = "translateY(" + -d.shift + "px)";
    } else {
      li.style.transform = "";
    }
  });
}

// 表示領域の上端・下端に近づけている間、近いほど速くスクロールする
function autoScrollIngredientDrag() {
  const d = ingredientDrag;
  const speed = autoScrollSpeed(d.clientY);
  if (speed !== 0) window.scrollBy(0, speed); // scrollイベントがupdateIngredientDragを呼ぶ
  d.frame = requestAnimationFrame(autoScrollIngredientDrag);
}

// 動きのアニメーションを止めてからtransformを外す(順が逆だと、外す瞬間に行が元の位置へ戻って見える)
function endIngredientDrag(commit) {
  const d = ingredientDrag;
  cancelAnimationFrame(d.frame);
  window.removeEventListener("scroll", updateIngredientDrag);
  d.handle.removeEventListener("pointermove", onIngredientDragMove);
  d.handle.removeEventListener("pointerup", onIngredientDragUp);
  d.handle.removeEventListener("pointercancel", onIngredientDragCancel);
  d.handle.removeEventListener("lostpointercapture", onIngredientDragCancel);
  if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId);
  d.list.classList.remove("sorting");
  for (const li of d.rows) li.style.transform = "";
  d.row.classList.remove("dragging");
  if (commit && d.target !== d.index) {
    const others = d.rows.filter((li) => li !== d.row);
    d.list.insertBefore(d.row, others[d.target] || null);
    updateIngredientLabels();
  }
  ingredientDrag = null;
  d.handle.focus();
}

function onIngredientHandleKey(e) {
  if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || busy || ingredientDrag) return;
  e.preventDefault(); // ページのスクロールを止める
  const row = e.currentTarget.closest("li");
  if (e.key === "ArrowUp") {
    if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
    else return;
  } else {
    if (row.nextElementSibling) row.parentElement.insertBefore(row, row.nextElementSibling.nextElementSibling);
    else return;
  }
  updateIngredientLabels();
  e.currentTarget.focus(); // DOMの中で動かすとフォーカスが外れるブラウザがある
}

// 日本語入力の変換を確定するEnterでは移らない。名前→同じ行の量→参考量→次の行の名前へ移り、最後の行なら行を足す
function onIngredientEnter(e) {
  if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
  e.preventDefault(); // フォームの送信を止める
  const li = e.target.closest("li");
  if (e.target.classList.contains("ingredient-name")) {
    li.querySelector(".ingredient-amount").focus();
    return;
  }
  if (e.target.classList.contains("ingredient-amount")) {
    li.querySelector(".ingredient-reference").focus();
    return;
  }
  const next = li.nextElementSibling;
  if (next) next.querySelector(".ingredient-name").focus();
  else addIngredientRow();
}

// 画面の順の材料。名前・量・参考量がどれも空の行も含める(サーバーの「材料N行目」を画面の行と合わせるため)
function readIngredientRows() {
  return Array.from($("edit-ingredients").children, (li) => ({
    name: li.querySelector(".ingredient-name").value,
    amount: li.querySelector(".ingredient-amount").value,
    reference_amount: li.querySelector(".ingredient-reference").value,
  }));
}

// 名前・量・参考量がどれも空の行は保存で捨てられるので、未保存の変更の判定からは除く
function meaningfulIngredients(rows) {
  return rows.filter((r) => r.name.trim() !== "" || r.amount.trim() !== "" || r.reference_amount.trim() !== "");
}

// 本文から材料を集める判定。量の数は半角・全角の整数・小数・分数と、それらの範囲(〜・～・~)を1つの数とする
const AMOUNT_VALUE = "[0-9０-９]+(?:[/／][0-9０-９]+|[.．][0-9０-９]+)?";
const AMOUNT_NUMBER = new RegExp(AMOUNT_VALUE + "(?:[〜～~]" + AMOUNT_VALUE + ")?", "g");
const AMOUNT_PREFIX = /(大さじ|小さじ|大|小)\s*$/;
const AMOUNT_WORD = /(適量|少々|適宜|少量)$/;
const TRAILING_NOTE = /[（(][^（）()]*[）)]$/;
const MAX_CANDIDATE_NAME = 20;

// 量の中の分数を小数第2位までに四捨五入した小数に直す(分母が0のものはそのまま)
function fractionsToDecimals(amount) {
  return amount.replace(/([0-9０-９]+)[/／]([0-9０-９]+)/g, (whole, a, b) => {
    const half = (s) => Number(s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)));
    const d = half(b);
    return d === 0 ? whole : String(Math.round(half(a) / d * 100) / 100);
  });
}

// 本文の行から材料らしい行を探し、[{name, amount}] を行の順で返す
function collectIngredientCandidates(text) {
  const candidates = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(TRAILING_NOTE, "").trim();
    if (line === "" || !/^\p{L}/u.test(line) || /[、。：:]/.test(line)) continue;
    const numbers = Array.from(line.matchAll(AMOUNT_NUMBER));
    let start;
    if (numbers.length > 0) {
      start = numbers[numbers.length - 1].index;
      const prefix = AMOUNT_PREFIX.exec(line.slice(0, start));
      if (prefix) start = prefix.index;
    } else {
      // 数が無い行は、末尾が量を表す語のときだけ拾う
      const word = AMOUNT_WORD.exec(line);
      if (!word) continue;
      start = word.index;
    }
    const name = line.slice(0, start).trim();
    if (name === "" || Array.from(name).length > MAX_CANDIDATE_NAME) continue;
    candidates.push({ name, amount: fractionsToDecimals(line.slice(start)) });
  }
  return candidates;
}

// 名前も量も空の行を外してから、候補を材料の行の末尾に足す
function appendIngredientRows(rows) {
  const list = $("edit-ingredients");
  for (const li of Array.from(list.children)) {
    if (["name", "amount", "reference"].every((k) => li.querySelector(".ingredient-" + k).value.trim() === "")) li.remove();
  }
  list.append(...rows.map((r) => createIngredientRow(r.name, r.amount, "")));
  updateIngredientLabels();
}

// タイトルから人数を探す判定。数は半角・全角の整数で、範囲(〜・～・~)は大きい方の数にする
const SERVINGS_IN_TITLE = /([0-9０-９]+)(?:[〜～~]([0-9０-９]+))?(?:人分|人前|名分)/;

// 見つかれば { servings: 半角の数の文字列, name: 人数の部分を除いた名前 }、なければnull。最初の1件だけを使う
function extractServingsFromTitle(name) {
  const m = SERVINGS_IN_TITLE.exec(name);
  if (!m) return null;
  const half = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const first = Number(half(m[1]));
  const larger = m[2] === undefined ? first : Math.max(first, Number(half(m[2])));
  let before = name.slice(0, m.index);
  let after = name.slice(m.index + m[0].length);
  // 括弧は、中身が人数の部分だけのときに限り括弧ごと消す
  if (/[（(]\s*$/.test(before) && /^\s*[）)]/.test(after)) {
    before = before.replace(/[（(]\s*$/, "");
    after = after.replace(/^\s*[）)]/, "");
  }
  before = before.trimEnd();
  after = after.trimStart();
  // 両側に文字が残るときは空白1つでつなぐ。ただし開き括弧の直後は詰める
  const joined = before !== "" && after !== "" && !/[（(]$/.test(before) ? before + " " + after : before + after;
  return { servings: String(larger), name: joined };
}

function applyServingsFromTitle() {
  if (busy) return;
  const found = extractServingsFromTitle($("edit-name").value);
  if (found === null) {
    showToast($("toast"), "タイトルに人数が見つかりません");
  } else {
    $("edit-name").value = found.name;
    $("edit-servings").value = found.servings;
    showToast($("toast"), "人数を" + found.servings + "人分にしました");
  }
  $("extract-button").focus();
}

const collectDialog = $("collect-dialog");
let collectCandidates = [];

function openCollectDialog() {
  if (busy) return;
  collectCandidates = collectIngredientCandidates($("edit-body").value);
  const empty = collectCandidates.length === 0;
  $("collect-empty").hidden = !empty;
  $("collect-candidates").hidden = empty;
  $("collect-ok").hidden = empty;
  $("collect-cancel").textContent = empty ? "閉じる" : "キャンセル";
  $("collect-candidates").replaceChildren(...collectCandidates.map((c) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = true;
    const name = document.createElement("span");
    name.className = "collect-name";
    name.textContent = c.name;
    const amount = document.createElement("span");
    amount.className = "collect-amount";
    amount.textContent = c.amount;
    label.append(check, name, amount);
    li.append(label);
    return li;
  }));
  updateCollectOk();
  collectDialog.showModal();
}

// チェックが1つも無い間は「追加」を押せなくする
function updateCollectOk() {
  $("collect-ok").disabled = $("collect-candidates").querySelector("input:checked") === null;
}

function addCollectedIngredients() {
  const checks = Array.from($("collect-candidates").querySelectorAll("input"));
  appendIngredientRows(collectCandidates.filter((c, i) => checks[i].checked));
  collectDialog.close();
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
  const scale = planScale(recipe);
  renderViewServings(recipe, scale);
  renderViewTags(recipe.tags);
  $("view-tags").hidden = recipe.tags.length === 0;
  const viewImage = $("view-image");
  if (recipe.image_url) viewImage.src = recipe.image_url;
  else viewImage.removeAttribute("src");
  viewImage.hidden = !recipe.image_url;
  renderViewIngredients(recipe, scale);
  $("view-ingredients").hidden = recipe.ingredients.length === 0;
  renderBody($("view-body"), recipe.body);
  $("cooked-button").replaceChildren(cookedContent(recipe.cooked_count));
  $("cooked-button").setAttribute("aria-pressed", String(cookedPressed));
  const candidateLabel = "「" + recipe.name + "」を候補に追加";
  $("candidate-button").setAttribute("aria-label", candidateLabel);
  $("candidate-button").title = candidateLabel;
  $("back-link").hidden = false;
  $("cancel-button").hidden = true;
  $("view-actions").hidden = false;
  $("edit-actions").hidden = true;
  viewMode.hidden = false;
  editMode.hidden = true;
}

function showEdit(recipe) {
  current = recipe;
  mode = "edit";
  clearErrors();
  const name = recipe ? recipe.name : "";
  const body = recipe ? recipe.body : "";
  editTags = recipe ? recipe.tags.slice() : [];
  const servings = recipe ? recipe.servings : 0;
  $("edit-name").value = name;
  $("edit-servings").value = servings === 0 ? "" : String(servings);
  $("edit-body").value = body;
  $("tag-input").value = "";
  renderEditTags();
  renderEditIngredients(recipe ? recipe.ingredients : []);
  snapshot = { name, body, servings, tags: editTags.slice(), ingredients: meaningfulIngredients(readIngredientRows()) };
  loadTagOptions();
  loadIngredientNameOptions();
  clearImageChange();
  renderEditImage();
  $("back-link").hidden = true;
  $("cancel-button").hidden = false;
  $("view-actions").hidden = true;
  $("edit-actions").hidden = false;
  viewMode.hidden = true;
  editMode.hidden = false;
  $("edit-name").focus();
}

function isDirty() {
  return (
    $("edit-name").value !== snapshot.name ||
    $("edit-body").value !== snapshot.body ||
    servingsValue() !== snapshot.servings ||
    editTags.join("\n") !== snapshot.tags.join("\n") ||
    $("tag-input").value.trim() !== "" ||
    JSON.stringify(meaningfulIngredients(readIngredientRows())) !== JSON.stringify(snapshot.ingredients) ||
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
    leaveBack(false);
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
  commitTagInput();
  const body = { name: $("edit-name").value, body: $("edit-body").value, servings: servingsValue(), tags: editTags, ingredients: readIngredientRows() };
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
      editTags = saved.tags.slice();
      $("edit-name").value = saved.name;
      $("edit-body").value = saved.body;
      $("edit-servings").value = saved.servings === 0 ? "" : String(saved.servings);
      renderEditTags();
      renderEditIngredients(saved.ingredients);
      snapshot = { name: saved.name, body: saved.body, servings: saved.servings, tags: saved.tags.slice(), ingredients: meaningfulIngredients(readIngredientRows()) };
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
    leaveBack(true);
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

// 候補の先頭に1件足す。献立の行から開いたときも献立の人数は送らず、候補はレシピの人数に従う
async function addCandidate() {
  if (busy) return;
  const button = $("candidate-button");
  const hadFocus = document.activeElement === button;
  clearErrors();
  setBusy(true);
  try {
    await api("POST", "/api/plans", { date: null, meal: "candidate", recipe_id: current.id, index: 0 });
    showToast($("toast"), "「" + current.name + "」を候補に追加しました");
  } catch (e) {
    showError("候補に追加できませんでした: " + e.message);
  } finally {
    setBusy(false);
    if (hadFocus) button.focus();
  }
}

async function load() {
  if (planId !== null) {
    if (planId === "") {
      showLoadError("レシピを読み込めませんでした: IDが不正です");
      return;
    }
    try {
      const row = await api("GET", "/api/plans/" + encodeURIComponent(planId));
      // メモの行は開けるレシピが無いので、行が無いときと同じに扱う
      if (row.recipe_id === null) throw new Error("献立に置いたものが見つかりません");
      plan = row;
      showView(await api("GET", "/api/recipes/" + row.recipe_id));
    } catch (e) {
      showLoadError("レシピを読み込めませんでした: " + e.message);
    }
    return;
  }
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
  } else if (backViaHistory) {
    e.preventDefault();
    history.back();
  }
});
$("cooked-button").addEventListener("click", toggleCooked);
$("candidate-button").addEventListener("click", addCandidate);
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
$("add-tag-button").addEventListener("click", () => {
  commitTagInput();
  $("tag-input").focus();
});
$("add-ingredient-button").addEventListener("click", addIngredientRow);
setupMainMenu($("extract-button"), $("extract-menu"));
$("extract-servings-button").addEventListener("click", () => {
  $("extract-menu").close();
  applyServingsFromTitle();
});
$("extract-ingredients-button").addEventListener("click", () => {
  $("extract-menu").close();
  openCollectDialog();
});
$("collect-candidates").addEventListener("change", updateCollectOk);
$("collect-ok").addEventListener("click", addCollectedIngredients);
$("collect-cancel").addEventListener("click", () => collectDialog.close());
onOutsideTap(collectDialog, () => collectDialog.close());
// 閉じたあとは、足した行の入力欄へ移さず押したボタンに戻す(スマホで画面キーボードが出るのを避ける)
collectDialog.addEventListener("close", () => $("extract-button").focus());
$("tag-input").addEventListener("keydown", (e) => {
  // 日本語入力の変換を確定するEnterではタグを足さない(keyCode 229はSafari向け)
  if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
  e.preventDefault(); // フォームの送信を止める
  commitTagInput();
});
pasteArea.addEventListener("paste", onPaste);
// キー入力・削除・ドロップなどで欄の中身を変えさせない
pasteArea.addEventListener("beforeinput", (e) => e.preventDefault());
// 止められない入力(IMEの変換など)で変わってしまったら元に戻す
pasteArea.addEventListener("input", resetPasteArea);

$("confirm-ok").addEventListener("click", () => confirmDialog.close("ok"));
$("confirm-cancel").addEventListener("click", () => confirmDialog.close("cancel"));
onOutsideTap(confirmDialog, () => confirmDialog.close("cancel"));

// 編集中に未保存の変更があれば、戻る・再読み込み・タブを閉じるでの離脱を確認する
window.addEventListener("beforeunload", (e) => {
  if (leaving || mode !== "edit" || !isDirty()) return;
  e.preventDefault();
  e.returnValue = ""; // preventDefaultだけでは確認を出さない古いブラウザ向け
});
// bfcacheから戻ったときは、離れる前の遷移中の印を消す
window.addEventListener("pageshow", (e) => { if (e.persisted) leaving = false; });

setupScrollTop($("scroll-top-button"));

load();
