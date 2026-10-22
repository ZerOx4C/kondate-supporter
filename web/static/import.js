"use strict";

// 一覧から来たときだけブラウザの戻るで一覧へ戻る(一覧の絞り込み条件などをURLごと残すため)
const cameFromList = (() => {
  try {
    const ref = new URL(document.referrer);
    return ref.origin === location.origin && ref.pathname === "/recipes.html";
  } catch {
    return false;
  }
})();

function backToList(e) {
  if (!cameFromList) return;
  e.preventDefault();
  history.back();
}

function showResult(count) {
  const link = document.createElement("a");
  link.className = "button";
  link.href = "recipes.html";
  const icon = document.createElement("i");
  icon.className = "ti ti-arrow-left";
  icon.setAttribute("aria-hidden", "true");
  link.append(icon, "一覧へ戻る");
  link.addEventListener("click", backToList);
  const result = $("import-result");
  result.replaceChildren(count + "件のレシピを取り込みました", link);
  result.hidden = false;
}

$("back-link").addEventListener("click", backToList);

$("import-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = $("import-button");
  button.disabled = true;
  $("import-error").textContent = "";
  $("import-result").hidden = true;
  try {
    const res = await api("POST", "/api/recipes/import", $("import-json").value);
    $("import-json").value = "";
    showResult(res.count);
  } catch (err) {
    $("import-error").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

setupScrollTop($("scroll-top-button"));
