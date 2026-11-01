"use strict";
// 献立。期間選択UIと、候補・毎日・各日付のエリア。候補のパネルをドラッグして毎日・各日付へ置き、
// 置いたパネルをドラッグして並べ替え・移動し、候補の区画へ戻す。パネルの外すボタンでも候補・毎日・各日付から外す。各日付のエリアは朝・昼・夜の帯に分かれる。毎日と各日付は見出しのボタンで畳める(畳んだ区画は置き先にならない)。
// 期間の右の切り替えでオフにした時間帯の帯は、各日付で出さず、置き先にもしない
// 候補の見出しのボタンでメモを候補の先頭に足せる。メモのパネルもレシピのパネルと同じく動かせ、外せ、件数に数える

const PERIOD_KEY = "kondate.plans.period";
const MEALS_KEY = "kondate.plans.meals";
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 31;
const WEEKDAYS = "日月火水木金土";
const MEALS = [["breakfast", "朝"], ["lunch", "昼"], ["dinner", "夜"]];
const MEAL_ICONS = { breakfast: "ti-haze", lunch: "ti-sun-high", dinner: "ti-moon" };

let periodStart;
let periodDays;
let editingDays = false;
let shownMeals = new Set(MEALS.map(([meal]) => meal));

let recipesById = new Map();
let loadSeq = 0;
let loading = false;
let saving = false;
let planDrag = null;

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

function loadPeriod() {
  const today = new Date();
  periodStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  periodDays = DEFAULT_DAYS;
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY));
    const start = saved && typeof saved.start === "string" ? parseIsoDate(saved.start) : null;
    if (start && isValidDays(saved.days)) {
      periodStart = start;
      periodDays = saved.days;
    }
  } catch {
    // 読めないときは既定の期間のまま
  }
}

function savePeriod() {
  try {
    localStorage.setItem(PERIOD_KEY, JSON.stringify({ start: toIsoDate(periodStart), days: periodDays }));
  } catch {
    // 保存できなくても画面は使える
  }
}

// 保存値はオンの時間帯の配列。読めないとき・知らない時間帯や重なりがあるときは3つともオンのまま
function loadShownMeals() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEALS_KEY));
    const keys = MEALS.map(([meal]) => meal);
    if (Array.isArray(saved) && saved.every((m) => keys.includes(m)) && new Set(saved).size === saved.length) {
      shownMeals = new Set(saved);
    }
  } catch {
    // 読めないときは3つともオンのまま
  }
}

function saveShownMeals() {
  try {
    localStorage.setItem(MEALS_KEY, JSON.stringify(MEALS.map(([meal]) => meal).filter((meal) => shownMeals.has(meal))));
  } catch {
    // 保存できなくても画面は使える
  }
}

// 帯の出し分けはCSSが #day-areas の data-hidden-meals で行う(期間を変えて帯を作り直しても残る)
function applyShownMeals() {
  $("day-areas").dataset.hiddenMeals = MEALS.map(([meal]) => meal).filter((meal) => !shownMeals.has(meal)).join(" ");
  for (const button of document.querySelectorAll("#meal-toggle button")) {
    button.setAttribute("aria-pressed", String(shownMeals.has(button.dataset.meal)));
  }
}

// ドラッグ中は、掴んだときに測った置き先の位置がずれるので切り替えない
function setupMealToggle() {
  for (const button of document.querySelectorAll("#meal-toggle button")) {
    button.addEventListener("click", () => {
      if (planDrag) return;
      const meal = button.dataset.meal;
      if (shownMeals.has(meal)) shownMeals.delete(meal);
      else shownMeals.add(meal);
      saveShownMeals();
      applyShownMeals();
    });
  }
}

function renderPeriod() {
  const startButton = $("period-start");
  startButton.textContent = formatDay(periodStart);
  startButton.setAttribute("aria-label", "開始日: " + formatDay(periodStart));
  const daysButton = $("period-days");
  daysButton.textContent = String(periodDays);
  daysButton.setAttribute("aria-label", "日数: " + periodDays + "日間");

  const areas = [];
  for (let i = 0; i < periodDays; i++) {
    const section = document.createElement("section");
    section.className = "plan-area plan-target";
    section.setAttribute("aria-labelledby", "day-title-" + i);
    const h2 = document.createElement("h2");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "plan-area-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-controls", "day-body-" + i);
    const caret = document.createElement("i");
    caret.className = "ti ti-caret-down";
    caret.setAttribute("aria-hidden", "true");
    const date = document.createElement("span");
    date.className = "plan-day-date";
    date.id = "day-title-" + i;
    date.textContent = formatDay(addDays(periodStart, i));
    const counts = document.createElement("span");
    counts.className = "plan-day-counts";
    for (const [meal] of MEALS) {
      const count = document.createElement("span");
      count.className = "plan-day-count";
      count.dataset.meal = meal;
      const icon = document.createElement("i");
      icon.className = "ti " + MEAL_ICONS[meal];
      icon.setAttribute("aria-hidden", "true");
      count.append(icon, document.createElement("span"));
      counts.appendChild(count);
    }
    toggle.append(caret, date, counts);
    toggle.addEventListener("click", () => toggleArea(toggle));
    h2.appendChild(toggle);
    const error = document.createElement("p");
    error.className = "error";
    const day = document.createElement("div");
    day.className = "plan-day";
    day.id = "day-body-" + i;
    for (const [meal, label] of MEALS) {
      const list = document.createElement("ul");
      list.className = "plan-list plan-meal";
      list.dataset.date = toIsoDate(addDays(periodStart, i));
      list.dataset.meal = meal;
      list.setAttribute("aria-label", label);
      day.appendChild(list);
    }
    section.append(h2, error, day);
    areas.push(section);
  }
  $("day-areas").replaceChildren(...areas);
  updateDayCounts();
}

// 毎日と各日付の見出しのボタンで、パネルの枠(各日付は朝・昼・夜の帯)だけを畳む。エラー欄は畳まない。畳んだ状態は覚えない。
// ドラッグ中は、掴んだときに測った置き先の位置がずれるので開閉しない
function toggleArea(toggle) {
  if (planDrag) return;
  const expanded = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.querySelector(".ti").className = "ti " + (expanded ? "ti-caret-down" : "ti-caret-right");
  $(toggle.getAttribute("aria-controls")).hidden = !expanded;
}

// 各日付の見出しの件数と読み上げ名を、帯の中身から数え直す(畳んだ日付も数える)
function updateDayCounts() {
  for (const section of document.querySelectorAll("#day-areas .plan-area")) {
    const toggle = section.querySelector(".plan-area-toggle");
    let label = section.querySelector(".plan-day-date").textContent;
    for (const [meal, name] of MEALS) {
      const n = section.querySelector('.plan-meal[data-meal="' + meal + '"]').children.length;
      const count = toggle.querySelector('.plan-day-count[data-meal="' + meal + '"]');
      count.querySelector("span").textContent = String(n);
      count.classList.toggle("plan-day-count-zero", n === 0);
      label += " " + name + n + "件";
    }
    toggle.setAttribute("aria-label", label);
  }
}

function changePeriod() {
  savePeriod();
  renderPeriod();
  loadPlans();
}

function endDaysEdit(commit) {
  if (!editingDays) return;
  editingDays = false;
  const input = $("period-days-input");
  let changed = false;
  if (commit) {
    const n = Number(input.value);
    if (input.value.trim() !== "" && isValidDays(n) && n !== periodDays) {
      periodDays = n;
      savePeriod();
      changed = true;
    }
  }
  input.hidden = true;
  $("period-days").hidden = false;
  if (changed) {
    renderPeriod();
    loadPlans();
  }
}

function setupPeriod() {
  $("period-prev").addEventListener("click", () => {
    periodStart = addDays(periodStart, -periodDays);
    changePeriod();
  });
  $("period-next").addEventListener("click", () => {
    periodStart = addDays(periodStart, periodDays);
    changePeriod();
  });

  const startInput = $("period-start-input");
  $("period-start").addEventListener("click", () => {
    startInput.value = toIsoDate(periodStart);
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
    periodStart = date;
    changePeriod();
  });

  const daysInput = $("period-days-input");
  $("period-days").addEventListener("click", () => {
    editingDays = true;
    $("period-days").hidden = true;
    daysInput.hidden = false;
    daysInput.value = String(periodDays);
    daysInput.focus();
    daysInput.select();
  });
  daysInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      endDaysEdit(true);
      $("period-days").focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      endDaysEdit(false);
      $("period-days").focus();
    }
  });
  daysInput.addEventListener("blur", () => endDaysEdit(true));
}

// レシピのパネルとメモのパネルの共通部分。planIdは行のid。候補・毎日・各日付のすべてのパネルに付ける。
// nameは外すボタンの読み上げ名、contentは掴む部分と外すボタンの間に入れる要素
function createPanelBase(planId, name, content) {
  const li = document.createElement("li");
  li.className = "plan-panel";
  li.dataset.planId = planId;

  const grip = document.createElement("span");
  grip.className = "plan-grip";
  grip.setAttribute("aria-hidden", "true");
  const gripIcon = document.createElement("i");
  gripIcon.className = "ti ti-grip-vertical";
  grip.appendChild(gripIcon);
  grip.addEventListener("pointerdown", startPlanDrag);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "plan-remove icon-only";
  remove.title = "「" + name + "」を外す";
  remove.setAttribute("aria-label", remove.title);
  const removeIcon = document.createElement("i");
  removeIcon.className = "ti ti-x";
  removeIcon.setAttribute("aria-hidden", "true");
  remove.appendChild(removeIcon);
  remove.addEventListener("click", () => {
    if (loading || saving || planDrag) return;
    const next = li.nextElementSibling || li.previousElementSibling;
    removePlan(li);
    if (next) next.querySelector(".plan-remove").focus();
  });

  li.append(grip, content, remove);
  return li;
}

function createThumbPlaceholder(iconClass) {
  const placeholder = document.createElement("span");
  placeholder.className = "plan-thumb plan-thumb-placeholder";
  const icon = document.createElement("i");
  icon.className = "ti " + iconClass;
  icon.setAttribute("aria-hidden", "true");
  placeholder.appendChild(icon);
  return placeholder;
}

function createRecipePanel(recipe, planId) {
  const link = document.createElement("a");
  link.className = "plan-panel-link";
  link.href = "recipe.html?id=" + recipe.id;
  link.title = recipe.name;
  if (recipe.image_url) {
    const img = document.createElement("img");
    img.className = "plan-thumb";
    img.src = recipe.image_url;
    img.alt = "";
    img.loading = "lazy";
    link.appendChild(img);
  } else {
    link.appendChild(createThumbPlaceholder("ti-bowl-spoon"));
  }
  const name = document.createElement("span");
  name.className = "plan-name";
  name.textContent = recipe.name;
  link.appendChild(name);
  return createPanelBase(planId, recipe.name, link);
}

// メモのパネルは移る先が無いのでリンクにしない
function createMemoPanel(memo, planId) {
  const body = document.createElement("span");
  body.className = "plan-panel-body";
  body.title = memo;
  body.appendChild(createThumbPlaceholder("ti-note"));
  const name = document.createElement("span");
  name.className = "plan-name";
  name.textContent = memo;
  body.appendChild(name);
  return createPanelBase(planId, memo, body);
}

// 候補の見出しのボタンで開くダイアログ。保存の結果を待ってから閉じ、失敗したら理由を出して入力を残す。
// 送信中は閉じない
function setupMemoDialog() {
  const dialog = $("memo-dialog");
  const input = $("memo-input");
  const save = $("memo-save");
  const cancel = $("memo-cancel");
  const error = $("memo-error");

  const syncSave = () => {
    save.disabled = input.value.trim() === "";
  };
  const close = () => {
    if (saving) return;
    dialog.close();
    $("memo-add").focus();
  };

  $("memo-add").addEventListener("click", () => {
    if (loading || saving || planDrag) return;
    input.value = "";
    error.textContent = "";
    syncSave();
    dialog.showModal();
    input.focus();
  });
  input.addEventListener("input", syncSave);
  cancel.addEventListener("click", close);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  onOutsideTap(dialog, close);

  $("memo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (saving || input.value.trim() === "") return;
    saving = true;
    error.textContent = "";
    input.disabled = true;
    save.disabled = true;
    cancel.disabled = true;
    try {
      const res = await api("POST", "/api/plans", { date: null, meal: "candidate", memo: input.value, index: 0 });
      const candidates = $("candidates");
      candidates.insertBefore(createMemoPanel(res.memo, res.id), candidates.firstChild);
      $("candidates-error").textContent = "";
      saving = false;
      close();
    } catch (err) {
      error.textContent = "メモを追加できませんでした: " + err.message;
      input.disabled = false;
      cancel.disabled = false;
      syncSave();
      input.focus();
    } finally {
      saving = false;
    }
  });
}

async function loadPlans() {
  const seq = ++loadSeq;
  loading = true;
  $("candidates-error").textContent = "";
  $("plans-error").textContent = "";
  const from = toIsoDate(periodStart);
  const to = toIsoDate(addDays(periodStart, periodDays - 1));
  const [recipesRes, plansRes] = await Promise.allSettled([
    api("GET", "/api/recipes"),
    api("GET", "/api/plans?from=" + from + "&to=" + to),
  ]);
  if (seq !== loadSeq) return;
  loading = false;

  recipesById = recipesRes.status === "fulfilled" ? new Map(recipesRes.value.map((r) => [r.id, r])) : new Map();

  const lists = new Map();
  for (const list of document.querySelectorAll(".plan-list")) {
    list.replaceChildren();
    lists.set(list.dataset.date + "/" + (list.dataset.meal || ""), list);
  }
  if (plansRes.status === "rejected" || recipesRes.status === "rejected") {
    const reason = plansRes.status === "rejected" ? plansRes.reason : recipesRes.reason;
    $("plans-error").textContent = "献立を読み込めませんでした: " + reason.message;
    updateDayCounts();
    return;
  }
  for (const plan of plansRes.value) {
    const list = lists.get((plan.date ?? "") + "/" + (plan.meal ?? ""));
    if (!list) continue;
    if (plan.memo !== null) {
      list.appendChild(createMemoPanel(plan.memo, plan.id));
      continue;
    }
    const recipe = recipesById.get(plan.recipe_id);
    if (recipe) list.appendChild(createRecipePanel(recipe, plan.id));
  }
  updateDayCounts();
}

// パネルの掴む部分のドラッグ。候補のパネルは毎日・各日付へ動かし(候補からは消える)、置いたパネルは並べ替え・移動と、
// 候補の区画への移動ができる。Pointer Eventsで受ける(HTML5のドラッグ&ドロップはタッチ端末で動かないため)。
// 動かしている間はパネルの写しだけを動かし、エリアの中身は動かさない(入れ替えるとエリアの位置が変わり、
// 入る位置の計算も見た目も跳ぶため)。置き先と位置は、掴んだときに測った位置から決める。
function startPlanDrag(e) {
  if (loading || saving || planDrag || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  const handle = e.currentTarget;
  const panel = handle.closest(".plan-panel");
  const panelRect = panel.getBoundingClientRect();
  const placed = panel.parentElement !== $("candidates");
  // 置き先は毎日と、各日付の表示している朝・昼・夜の帯。後ろに区画ごとの予備を置き、日付の見出しやエラー欄の上で
  // 離したときは区画の表示している最初の帯の先頭に入れる
  const measure = (rect, list) => ({
    section: list.closest(".plan-area"),
    list,
    left: rect.left + window.scrollX,
    right: rect.right + window.scrollX,
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    centers: Array.from(list.children).map((li) => {
      const r = li.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2;
    }),
  });
  // 畳んだ毎日・日付は枠の大きさが0で入った先も見えないので、枠も区画も置き先にしない。オフの帯も同じ
  const folded = (el) => el.closest(".plan-area").querySelector(".plan-area-toggle")?.getAttribute("aria-expanded") === "false";
  const shown = (list) => !list.classList.contains("plan-meal") || shownMeals.has(list.dataset.meal);
  const targets = Array.from(document.querySelectorAll(".plan-target .plan-list"))
    .filter((list) => !folded(list) && shown(list))
    .map((list) => measure(list.getBoundingClientRect(), list));
  for (const section of document.querySelectorAll(".plan-target")) {
    if (folded(section)) continue;
    const first = Array.from(section.querySelectorAll(".plan-list")).find(shown);
    if (first) targets.push(measure(section.getBoundingClientRect(), first)); // 3つともオフの日付は区画も置き先にしない
  }
  if (placed) {
    // 置いたパネルのときだけ候補の区画も置き先に加える(候補の中での並べ替えは作らない)
    const candidates = $("candidates");
    targets.push(measure(candidates.getBoundingClientRect(), candidates));
    targets.push(measure($("candidates-area").getBoundingClientRect(), candidates));
  }

  const ghost = panel.cloneNode(true);
  ghost.classList.add("plan-ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = panelRect.width + "px";
  ghost.style.height = panelRect.height + "px";
  document.body.appendChild(ghost);
  panel.classList.add("plan-dragging");

  planDrag = {
    pointerId: e.pointerId,
    handle,
    panel,
    ghost,
    offsetX: e.clientX - panelRect.left,
    offsetY: e.clientY - panelRect.top,
    clientX: e.clientX,
    clientY: e.clientY,
    targets,
    drop: null,
    frame: 0,
  };
  handle.setPointerCapture(e.pointerId);
  handle.addEventListener("pointermove", onPlanDragMove);
  handle.addEventListener("pointerup", onPlanDragUp);
  handle.addEventListener("pointercancel", onPlanDragCancel);
  handle.addEventListener("lostpointercapture", onPlanDragCancel);
  window.addEventListener("scroll", updatePlanDrag);
  updatePlanDrag();
  planDrag.frame = requestAnimationFrame(autoScrollPlanDrag);
}

function onPlanDragMove(e) {
  if (e.pointerId !== planDrag.pointerId) return;
  planDrag.clientX = e.clientX;
  planDrag.clientY = e.clientY;
  updatePlanDrag();
}

function onPlanDragUp(e) {
  if (e.pointerId === planDrag.pointerId) endPlanDrag(true);
}

function onPlanDragCancel(e) {
  if (e.pointerId === planDrag.pointerId) endPlanDrag(false);
}

function clearDropMarks() {
  for (const el of document.querySelectorAll(".drop-target, .drop-before, .drop-end")) {
    el.classList.remove("drop-target", "drop-before", "drop-end");
  }
}

function updatePlanDrag() {
  const d = planDrag;
  d.ghost.style.left = d.clientX - d.offsetX + "px";
  d.ghost.style.top = d.clientY - d.offsetY + "px";

  const x = d.clientX + window.scrollX;
  const y = d.clientY + window.scrollY;
  const target = d.targets.find((t) => x >= t.left && x <= t.right && y >= t.top && y <= t.bottom);
  clearDropMarks();
  if (!target) {
    d.drop = null;
    return;
  }
  target.list.classList.add("drop-target");
  const index = target.centers.filter((c) => c < y).length;
  d.drop = { target, index };
  const before = target.list.children[index];
  if (before) before.classList.add("drop-before");
  else target.list.classList.add("drop-end");
}

// 表示領域の上端・下端に近づけている間、近いほど速くスクロールする
function autoScrollPlanDrag() {
  const speed = autoScrollSpeed(planDrag.clientY);
  if (speed !== 0) window.scrollBy(0, speed); // scrollイベントがupdatePlanDragを呼ぶ
  planDrag.frame = requestAnimationFrame(autoScrollPlanDrag);
}

function endPlanDrag(commit) {
  const d = planDrag;
  cancelAnimationFrame(d.frame);
  window.removeEventListener("scroll", updatePlanDrag);
  d.handle.removeEventListener("pointermove", onPlanDragMove);
  d.handle.removeEventListener("pointerup", onPlanDragUp);
  d.handle.removeEventListener("pointercancel", onPlanDragCancel);
  d.handle.removeEventListener("lostpointercapture", onPlanDragCancel);
  if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId);
  d.ghost.remove();
  d.panel.classList.remove("plan-dragging");
  clearDropMarks();
  planDrag = null;
  if (!commit || !d.drop) return;
  movePlan(d.panel, d.drop.target, d.drop.index);
}

function dateOf(list) {
  return list.dataset.date === "" ? null : list.dataset.date;
}

function mealOf(list) {
  return list.dataset.meal || null;
}

// 候補から毎日・帯へ、置いたパネルを毎日・帯・候補へすぐ動かして保存し、保存に失敗したら元の位置へ戻す。
// indexは掴んだパネルを含む並びでの位置なので、保存には動かすパネルを除いた並びでの位置を送る
async function movePlan(panel, target, index) {
  const fromList = panel.parentElement;
  const fromIndex = Array.prototype.indexOf.call(fromList.children, panel);
  const sameList = fromList === target.list;
  if (sameList && (index === fromIndex || index === fromIndex + 1)) return;
  const sendIndex = sameList && index > fromIndex ? index - 1 : index;
  const fromError = fromList.closest(".plan-area").querySelector(".error");
  const toError = target.section.querySelector(".error");
  fromError.textContent = "";
  toError.textContent = "";
  const origNext = panel.nextSibling;
  target.list.insertBefore(panel, target.list.children[index] || null);
  updateDayCounts();
  saving = true;
  try {
    await api("PUT", "/api/plans/" + panel.dataset.planId, {
      date: dateOf(target.list),
      meal: mealOf(target.list),
      index: sendIndex,
    });
  } catch (err) {
    fromList.insertBefore(panel, origNext);
    updateDayCounts();
    fromError.textContent = "動かせませんでした: " + err.message;
  } finally {
    saving = false;
  }
}

// パネルをすぐ取り除いて献立から外し、失敗したら元の位置へ戻す。候補には足さない。外すボタンから呼ぶ
async function removePlan(panel) {
  const fromList = panel.parentElement;
  const origNext = panel.nextSibling;
  const fromError = fromList.closest(".plan-area").querySelector(".error");
  fromError.textContent = "";
  panel.remove();
  updateDayCounts();
  saving = true;
  try {
    await api("DELETE", "/api/plans/" + panel.dataset.planId);
  } catch (err) {
    fromList.insertBefore(panel, origNext);
    updateDayCounts();
    fromError.textContent = "外せませんでした: " + err.message;
  } finally {
    saving = false;
  }
}

setupPageNav($("page-nav"));
setupMainMenu($("menu-button"), $("main-menu"));
setupPeriod();
setupMealToggle();
setupMemoDialog();
$("daily-toggle").addEventListener("click", () => toggleArea($("daily-toggle")));
loadShownMeals();
applyShownMeals();
loadPeriod();
renderPeriod();
loadPlans();
// 戻るでキャッシュから復元されたとき、詳細で変えた名前・画像や削除を反映する
window.addEventListener("pageshow", (e) => {
  if (e.persisted) loadPlans();
});
