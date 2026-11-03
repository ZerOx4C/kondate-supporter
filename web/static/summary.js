"use strict";
// 集計。見出しの下に、献立と同じ期間選択UI(端末に覚えた期間を献立と共用)と、その期間の献立の材料の合計を置く

const amountCollator = new Intl.Collator("ja");
let loadSeq = 0;

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
      const sum = sums.get(key) || { name: i.name, format: i.format, total: 0 };
      sum.total += i.quantity * ratio * times;
      sums.set(key, sum);
    }
  }
  return [...sums.values()].sort((a, b) => compareText(a.name, b.name) || compareText(a.format, b.format));
}

async function loadSummary() {
  const seq = ++loadSeq;
  const { start, days } = periodPicker.period();
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
    for (const text of [s.name, formatAmount(s.format, Math.round(s.total * 10) / 10)]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.hidden = false;
}

setupPageNav($("page-nav"));
setupMainMenu($("menu-button"), $("main-menu"));
const periodPicker = setupPeriodPicker($("period-range"), loadSummary);
loadSummary();
// 戻るでキャッシュから復元されたとき、献立で変えた期間と、献立・詳細で変えた中身を反映する
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    periodPicker.reload();
    loadSummary();
  }
});
