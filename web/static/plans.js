"use strict";
// 献立。期間選択UIと、候補・毎日・各日付のエリア(毎日と各日付は枠だけ)

const PERIOD_KEY = "kondate.plans.period";
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 31;
const WEEKDAYS = "日月火水木金土";

const nameCollator = new Intl.Collator("ja");

let periodStart;
let periodDays;
let editingDays = false;

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
    section.className = "plan-area";
    section.setAttribute("aria-labelledby", "day-title-" + i);
    const h2 = document.createElement("h2");
    h2.id = "day-title-" + i;
    h2.textContent = formatDay(addDays(periodStart, i));
    const list = document.createElement("ul");
    list.className = "plan-list";
    section.append(h2, list);
    areas.push(section);
  }
  $("day-areas").replaceChildren(...areas);
}

function changePeriod() {
  savePeriod();
  renderPeriod();
}

function endDaysEdit(commit) {
  if (!editingDays) return;
  editingDays = false;
  const input = $("period-days-input");
  if (commit) {
    const n = Number(input.value);
    if (input.value.trim() !== "" && isValidDays(n)) {
      periodDays = n;
      savePeriod();
    }
  }
  input.hidden = true;
  $("period-days").hidden = false;
  renderPeriod();
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

function createPanel(recipe) {
  const li = document.createElement("li");
  li.className = "plan-panel";

  const grip = document.createElement("span");
  grip.className = "plan-grip";
  grip.setAttribute("aria-hidden", "true");
  const gripIcon = document.createElement("i");
  gripIcon.className = "ti ti-grip-vertical";
  grip.appendChild(gripIcon);

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

async function loadCandidates() {
  $("candidates-error").textContent = "";
  try {
    const recipes = await api("GET", "/api/recipes");
    const list = recipes
      .filter((r) => r.bookmarked)
      .sort((a, b) => nameCollator.compare(a.name, b.name) || b.id - a.id);
    $("candidates").replaceChildren(...list.map(createPanel));
    $("candidates-empty").hidden = list.length > 0;
  } catch (err) {
    $("candidates").replaceChildren();
    $("candidates-empty").hidden = true;
    $("candidates-error").textContent = "候補を読み込めませんでした: " + err.message;
  }
}

setupPageNav($("page-nav"));
setupMainMenu($("menu-button"), $("main-menu"));
setupPeriod();
loadPeriod();
renderPeriod();
loadCandidates();
// 戻るでキャッシュから復元されたとき、詳細で変えたブックマークを反映する
window.addEventListener("pageshow", (e) => {
  if (e.persisted) loadCandidates();
});
