"use strict";
// 集計。見出しの下に、献立と同じ期間選択UI(端末に覚えた期間を献立と共用)と、その期間の献立の材料の合計を置く

const amountCollator = new Intl.Collator("ja");
const MEAL_LABELS = { breakfast: "朝", lunch: "昼", dinner: "夜" };
let loadSeq = 0;
let periodDays = 1;

function roundAmount(x) {
  return Math.round(x * 10) / 10;
}

function compareText(a, b) {
  return amountCollator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

// 期間内の献立の材料を、名前と書式の組ごとに合計する。数の無い量は足せないので入れない。
// 合計は丸めずに返す(行ごとに丸めると誤差が積み重なる)
function sumIngredients(plans, recipesById, days) {
  const sums = new Map();
  for (const plan of plans) {
    if (plan.recipe_id === null || plan.meal === "candidate") continue;
    const recipe = recipesById.get(plan.recipe_id);
    if (!recipe) continue;
    const times = plan.date === null ? days : 1;
    const ratio = plan.servings !== null && recipe.servings >= 1 ? plan.servings / recipe.servings : 1;
    for (const i of recipe.ingredients) {
      if (i.quantity === null) continue;
      const key = JSON.stringify([i.name, i.format]);
      const sum = sums.get(key) || { name: i.name, format: i.format, total: 0, entries: new Map() };
      const amount = i.quantity * ratio * times;
      sum.total += amount;
      // 内訳。同じ献立の行で名前と書式が同じ材料が複数あれば足して1つにする
      const entry = sum.entries.get(plan.id) || { plan, recipe, total: 0 };
      entry.total += amount;
      sum.entries.set(plan.id, entry);
      sums.set(key, sum);
    }
  }
  return [...sums.values()].sort((a, b) => compareText(a.name, b.name) || compareText(a.format, b.format));
}

async function loadSummary() {
  const seq = ++loadSeq;
  const { start, days } = periodPicker.period();
  periodDays = days;
  const from = toIsoDate(start);
  const to = toIsoDate(addDays(start, days - 1));
  const [recipesRes, plansRes] = await Promise.allSettled([
    api("GET", "/api/recipes"),
    api("GET", "/api/plans?from=" + from + "&to=" + to),
  ]);
  if (seq !== loadSeq) return;

  const table = $("summary-table");
  const body = table.querySelector("tbody");
  body.replaceChildren();
  table.hidden = true;
  $("summary-empty").hidden = true;
  if (plansRes.status === "rejected" || recipesRes.status === "rejected") {
    const reason = plansRes.status === "rejected" ? plansRes.reason : recipesRes.reason;
    $("summary-error").textContent = "集計を読み込めませんでした: " + reason.message;
    return;
  }
  $("summary-error").textContent = "";

  const recipesById = new Map(recipesRes.value.map((r) => [r.id, r]));
  const sums = sumIngredients(plansRes.value, recipesById, days);
  if (sums.length === 0) {
    $("summary-empty").hidden = false;
    return;
  }
  for (const s of sums) {
    const tr = document.createElement("tr");
    for (const text of [s.name, formatAmount(s.format, roundAmount(s.total))]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    const cell = document.createElement("td");
    cell.className = "breakdown-cell";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-only breakdown-button";
    button.setAttribute("aria-haspopup", "dialog");
    const label = "「" + s.name + "」の内訳";
    button.title = label;
    button.setAttribute("aria-label", label);
    const icon = document.createElement("i");
    icon.className = "ti ti-info-circle";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
    button.addEventListener("click", () => openBreakdown(s));
    cell.appendChild(button);
    tr.appendChild(cell);
    body.appendChild(tr);
  }
  table.hidden = false;
}

function createBreakdownItem(entry, amountText) {
  const { plan, recipe } = entry;
  const li = document.createElement("li");
  const link = document.createElement("a");
  link.className = "breakdown-link";
  link.href = "recipe.html?plan_id=" + plan.id;
  link.title = recipe.name;
  if (recipe.image_url) {
    const img = document.createElement("img");
    img.className = "breakdown-thumb";
    img.src = recipe.image_url;
    img.alt = "";
    img.loading = "lazy";
    link.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "breakdown-thumb breakdown-thumb-placeholder";
    const icon = document.createElement("i");
    icon.className = "ti ti-bowl-spoon";
    icon.setAttribute("aria-hidden", "true");
    placeholder.appendChild(icon);
    link.appendChild(placeholder);
  }
  const text = document.createElement("span");
  text.className = "breakdown-text";
  const name = document.createElement("span");
  name.className = "breakdown-name";
  name.textContent = recipe.name;
  const when = document.createElement("span");
  when.className = "breakdown-when";
  when.textContent = plan.date === null ? "毎日 ×" + periodDays + "日" : formatDay(parseIsoDate(plan.date)) + " " + MEAL_LABELS[plan.meal];
  text.append(name, when);
  const amount = document.createElement("span");
  amount.className = "breakdown-amount";
  amount.textContent = amountText;
  link.append(text, amount);
  li.appendChild(link);
  return li;
}

function openBreakdown(sum) {
  $("breakdown-dialog-title").textContent = "「" + sum.name + "」の内訳";
  const items = [];
  for (const entry of sum.entries.values()) {
    items.push(createBreakdownItem(entry, formatAmount(sum.format, roundAmount(entry.total))));
  }
  $("breakdown-list").replaceChildren(...items);
  $("breakdown-dialog").showModal();
}

setupPageNav($("page-nav"));
setupMainMenu($("menu-button"), $("main-menu"));
const breakdownDialog = $("breakdown-dialog");
$("breakdown-dialog-close").addEventListener("click", () => breakdownDialog.close());
onOutsideTap(breakdownDialog, () => breakdownDialog.close());
// 詳細へ移る前に閉じる(戻るで復元されたとき、古い内訳が開いたまま出ないようにする)
breakdownDialog.addEventListener("click", (e) => {
  if (e.target.closest("a")) breakdownDialog.close();
});
const periodPicker = setupPeriodPicker($("period-range"), loadSummary);
loadSummary();
// 戻るでキャッシュから復元されたとき、献立で変えた期間と、献立・詳細で変えた中身を反映する
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    periodPicker.reload();
    loadSummary();
  }
});
