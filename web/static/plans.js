"use strict";
// 献立。期間選択UIと、候補・毎日・各日付のエリア。候補のパネルをドラッグして毎日・各日付へ置き、
// 置いたパネルをドラッグして並べ替え・移動し、候補へ戻して外す

const PERIOD_KEY = "kondate.plans.period";
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 31;
const WEEKDAYS = "日月火水木金土";

const nameCollator = new Intl.Collator("ja");

let periodStart;
let periodDays;
let editingDays = false;

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
    h2.id = "day-title-" + i;
    h2.textContent = formatDay(addDays(periodStart, i));
    const error = document.createElement("p");
    error.className = "error";
    const list = document.createElement("ul");
    list.className = "plan-list";
    list.dataset.date = toIsoDate(addDays(periodStart, i));
    section.append(h2, error, list);
    areas.push(section);
  }
  $("day-areas").replaceChildren(...areas);
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

// planIdは献立に置いた行のid。候補のパネルには付けない
function createPanel(recipe, planId) {
  const li = document.createElement("li");
  li.className = "plan-panel";
  li.dataset.recipeId = recipe.id;
  if (planId !== undefined) li.dataset.planId = planId;

  const grip = document.createElement("span");
  grip.className = "plan-grip";
  grip.setAttribute("aria-hidden", "true");
  const gripIcon = document.createElement("i");
  gripIcon.className = "ti ti-grip-vertical";
  grip.appendChild(gripIcon);
  grip.addEventListener("pointerdown", startPlanDrag);

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
    const placeholder = document.createElement("span");
    placeholder.className = "plan-thumb plan-thumb-placeholder";
    const icon = document.createElement("i");
    icon.className = "ti ti-bowl-spoon";
    icon.setAttribute("aria-hidden", "true");
    placeholder.appendChild(icon);
    link.appendChild(placeholder);
  }
  const name = document.createElement("span");
  name.className = "plan-name";
  name.textContent = recipe.name;
  link.appendChild(name);

  li.append(grip, link);
  return li;
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

  if (recipesRes.status === "fulfilled") {
    const recipes = recipesRes.value;
    recipesById = new Map(recipes.map((r) => [r.id, r]));
    const list = recipes
      .filter((r) => r.bookmarked)
      .sort((a, b) => nameCollator.compare(a.name, b.name) || b.id - a.id);
    $("candidates").replaceChildren(...list.map((r) => createPanel(r)));
    $("candidates-empty").hidden = list.length > 0;
  } else {
    recipesById = new Map();
    $("candidates").replaceChildren();
    $("candidates-empty").hidden = true;
    $("candidates-error").textContent = "候補を読み込めませんでした: " + recipesRes.reason.message;
  }

  const lists = new Map();
  for (const list of document.querySelectorAll(".plan-target .plan-list")) {
    list.replaceChildren();
    lists.set(list.dataset.date, list);
  }
  if (plansRes.status === "rejected" || recipesRes.status === "rejected") {
    const reason = plansRes.status === "rejected" ? plansRes.reason : recipesRes.reason;
    $("plans-error").textContent = "献立を読み込めませんでした: " + reason.message;
    return;
  }
  for (const plan of plansRes.value) {
    const list = lists.get(plan.date === null ? "" : plan.date);
    const recipe = recipesById.get(plan.recipe_id);
    if (list && recipe) list.appendChild(createPanel(recipe, plan.id));
  }
}

// パネルの掴む部分のドラッグ。候補のパネルは毎日・各日付へ置き、置いたパネルは並べ替え・移動と、
// 候補の区画への取り外しができる。Pointer Eventsで受ける(HTML5のドラッグ&ドロップはタッチ端末で動かないため)。
// 動かしている間はパネルの写しだけを動かし、エリアの中身は動かさない(入れ替えるとエリアの位置が変わり、
// 入る位置の計算も見た目も跳ぶため)。置き先と位置は、掴んだときに測った位置から決める。
function startPlanDrag(e) {
  if (loading || saving || planDrag || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  const handle = e.currentTarget;
  const panel = handle.closest(".plan-panel");
  const panelRect = panel.getBoundingClientRect();
  const placed = panel.dataset.planId !== undefined;
  const targets = Array.from(document.querySelectorAll(".plan-target")).map((section) => {
    const rect = section.getBoundingClientRect();
    const list = section.querySelector(".plan-list");
    return {
      section,
      list,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      centers: Array.from(list.children).map((li) => {
        const r = li.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
      }),
    };
  });
  if (placed) {
    // 候補の区画は置いたパネルを外す先で、離す位置に意味が無いので区画全体だけを測る
    const section = $("candidates-area");
    const rect = section.getBoundingClientRect();
    targets.push({
      section,
      remove: true,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    });
  }

  const ghost = panel.cloneNode(true);
  ghost.classList.add("plan-ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = panelRect.width + "px";
  ghost.style.height = panelRect.height + "px";
  document.body.appendChild(ghost);
  if (placed) panel.classList.add("plan-dragging");

  planDrag = {
    pointerId: e.pointerId,
    handle,
    panel,
    placed,
    recipeId: Number(panel.dataset.recipeId),
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
  target.section.classList.add("drop-target");
  if (target.remove) {
    d.drop = { target };
    return;
  }
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
  if (!d.placed) placePlan(d.drop.target, d.drop.index, d.recipeId);
  else if (d.drop.target.remove) removePlan(d.panel);
  else movePlan(d.panel, d.drop.target, d.drop.index);
}

function dateOf(list) {
  return list.dataset.date === "" ? null : list.dataset.date;
}

// 置いたパネルをすぐ動かして保存し、保存に失敗したら元の位置へ戻す。
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
  saving = true;
  try {
    await api("PUT", "/api/plans/" + panel.dataset.planId, {
      date: dateOf(target.list),
      index: sendIndex,
    });
  } catch (err) {
    fromList.insertBefore(panel, origNext);
    fromError.textContent = "動かせませんでした: " + err.message;
  } finally {
    saving = false;
  }
}

// 置いたパネルをすぐ取り除いて献立から外し、失敗したら元の位置へ戻す。ブックマークは変えない
async function removePlan(panel) {
  const fromList = panel.parentElement;
  const origNext = panel.nextSibling;
  const fromError = fromList.closest(".plan-area").querySelector(".error");
  fromError.textContent = "";
  panel.remove();
  saving = true;
  try {
    await api("DELETE", "/api/plans/" + panel.dataset.planId);
  } catch (err) {
    fromList.insertBefore(panel, origNext);
    fromError.textContent = "外せませんでした: " + err.message;
  } finally {
    saving = false;
  }
}

// 置いたパネルをすぐ並べて保存し、保存に失敗したら取り除く
async function placePlan(target, index, recipeId) {
  const recipe = recipesById.get(recipeId);
  if (!recipe) return;
  const errorEl = target.section.querySelector(".error");
  errorEl.textContent = "";
  const panel = createPanel(recipe);
  target.list.insertBefore(panel, target.list.children[index] || null);
  saving = true;
  try {
    const created = await api("POST", "/api/plans", {
      date: dateOf(target.list),
      recipe_id: recipeId,
      index,
    });
    panel.dataset.planId = created.id;
  } catch (err) {
    panel.remove();
    errorEl.textContent = "置けませんでした: " + err.message;
  } finally {
    saving = false;
  }
}

setupPageNav($("page-nav"));
setupMainMenu($("menu-button"), $("main-menu"));
setupPeriod();
loadPeriod();
renderPeriod();
loadPlans();
// 戻るでキャッシュから復元されたとき、詳細で変えたブックマークを反映する
window.addEventListener("pageshow", (e) => {
  if (e.persisted) loadPlans();
});
