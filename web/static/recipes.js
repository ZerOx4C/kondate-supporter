"use strict";

let recipes = [];
let allTags = []; // id昇順
let selectedTags = []; // 常にallTagsと同じ並び
let nameKeyword = ""; // 名前検索のキーワード(前後の空白は除く)
let bookmarkOnly = false; // ブックマーク中のレシピだけを表示する
const bookmarkBusy = new Set(); // ブックマークの付け外しを送信中のレシピid

// 大文字小文字・全角半角・ひらがなカタカナを区別せずに比べるための正規化
function normalizeForSearch(s) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// キーワードを空白で区切り、すべての語を含むときに一致とする(語が無ければ常に一致)
function matchesKeyword(text, keyword) {
  const target = normalizeForSearch(text);
  return normalizeForSearch(keyword).split(/\s+/).filter(Boolean).every((w) => target.includes(w));
}

function readSelectedFromUrl() {
  const names = new URLSearchParams(location.search).getAll("tag");
  return allTags.filter((t) => names.includes(t));
}

function readKeywordFromUrl() {
  return new URLSearchParams(location.search).get("q") ?? "";
}

function readBookmarkFromUrl() {
  return new URLSearchParams(location.search).get("bookmark") === "1";
}

function writeUrl() {
  const params = new URLSearchParams();
  if (nameKeyword !== "") params.set("q", nameKeyword);
  if (bookmarkOnly) params.set("bookmark", "1");
  for (const t of selectedTags) params.append("tag", t);
  const qs = params.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

function filteredRecipes() {
  return recipes.filter((r) => (!bookmarkOnly || r.bookmarked) && selectedTags.every((t) => r.tags.includes(t)) && matchesKeyword(r.name, nameKeyword));
}

function setSelected(name, on) {
  const set = new Set(selectedTags);
  if (on) set.add(name);
  else set.delete(name);
  selectedTags = allTags.filter((t) => set.has(t));
  applyFilter();
}

function applyFilter() {
  writeUrl();
  renderBookmarkFilter();
  renderSelectedTags();
  renderList();
  if ($("tag-dialog").open) renderTagOptions();
}

function renderBookmarkFilter() {
  $("bookmark-filter-button").setAttribute("aria-pressed", String(bookmarkOnly));
}

function renderSelectedTags() {
  $("selected-tags").replaceChildren(...selectedTags.map((name) => {
    const li = document.createElement("li");
    li.className = "tag";
    li.append(name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-only";
    button.setAttribute("aria-label", "「" + name + "」を外す");
    button.title = "「" + name + "」を外す";
    button.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>';
    button.addEventListener("click", () => setSelected(name, false));
    li.appendChild(button);
    return li;
  }));
}

function createAddPanel() {
  const li = document.createElement("li");
  const link = document.createElement("a");
  link.className = "tile tile-add";
  link.href = "recipe.html";
  const visual = document.createElement("div");
  visual.className = "tile-visual";
  const icon = document.createElement("i");
  icon.className = "ti ti-plus";
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "tile-add-label";
  label.textContent = "追加";
  visual.append(icon, label);
  link.appendChild(visual);
  li.appendChild(link);
  return li;
}

function createTile(recipe) {
  const li = document.createElement("li");
  const link = document.createElement("a");
  link.className = "tile";
  link.href = "recipe.html?id=" + recipe.id;
  link.title = recipe.name;
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
    const icon = document.createElement("i");
    icon.className = "ti ti-photo-off";
    icon.setAttribute("aria-hidden", "true");
    placeholder.appendChild(icon);
    visual.appendChild(placeholder);
  }
  const footer = document.createElement("div");
  footer.className = "tile-footer";
  const tags = recipe.tags.filter((t) => !selectedTags.includes(t));
  if (tags.length > 0) {
    const ul = document.createElement("ul");
    ul.className = "tile-tags";
    for (const t of tags) {
      const tag = document.createElement("li");
      tag.className = "tag";
      tag.textContent = t;
      ul.appendChild(tag);
    }
    const more = document.createElement("li");
    more.className = "tag tile-tags-more";
    more.hidden = true;
    ul.appendChild(more);
    footer.appendChild(ul);
  }
  const name = document.createElement("span");
  name.className = "tile-name";
  name.textContent = recipe.name;
  footer.appendChild(name);
  visual.appendChild(footer);
  const cooked = cookedContent(recipe.cooked_count);
  cooked.classList.add("tile-cooked");
  visual.appendChild(cooked);
  link.appendChild(visual);
  const bookmark = document.createElement("button");
  bookmark.type = "button";
  bookmark.className = "icon-only tile-bookmark";
  bookmark.dataset.id = String(recipe.id);
  bookmark.setAttribute("aria-pressed", String(recipe.bookmarked));
  const label = "「" + recipe.name + "」をブックマーク";
  bookmark.setAttribute("aria-label", label);
  bookmark.title = label;
  bookmark.innerHTML = '<i class="ti ti-bookmark" aria-hidden="true"></i>';
  bookmark.disabled = bookmarkBusy.has(recipe.id);
  bookmark.addEventListener("click", () => toggleBookmark(recipe.id, bookmark));
  li.append(link, bookmark);
  return li;
}

function bookmarkButton(id) {
  return $("recipe-list").querySelector('.tile-bookmark[data-id="' + id + '"]');
}

// 表示中の bookmarked を見て付け外しを選び、成功したら返ってきたレシピで一覧を描き直す
async function toggleBookmark(id, button) {
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe || bookmarkBusy.has(id)) return;
  const hadFocus = document.activeElement === button;
  const index = filteredRecipes().findIndex((r) => r.id === id);
  $("list-error").textContent = "";
  bookmarkBusy.add(id);
  button.disabled = true;
  try {
    const updated = await api(recipe.bookmarked ? "DELETE" : "PUT", "/api/recipes/" + id + "/bookmark");
    recipes = recipes.map((r) => (r.id === id ? updated : r));
    bookmarkBusy.delete(id);
    renderList();
    if (hadFocus) {
      // 絞り込みでタイルが消えたときは、詰めてきた隣のタイルへフォーカスを移す
      const shown = filteredRecipes();
      const target = bookmarkButton(id)
        ?? (shown[index] && bookmarkButton(shown[index].id))
        ?? (shown[index - 1] && bookmarkButton(shown[index - 1].id))
        ?? $("bookmark-filter-button");
      target.focus();
    }
  } catch (e) {
    bookmarkBusy.delete(id);
    const current = bookmarkButton(id);
    if (current) current.disabled = false;
    $("list-error").textContent = e.message;
  }
}

// 1行に収まらないタグを末尾から隠し、隠した数を「+N」にまとめる
function fitTileTags(ul) {
  const tags = [...ul.querySelectorAll(".tag:not(.tile-tags-more)")];
  const more = ul.querySelector(".tile-tags-more");
  for (const t of tags) {
    t.hidden = false;
    t.classList.remove("shrink");
  }
  more.hidden = true;
  let visible = tags.length;
  while (ul.scrollWidth > ul.clientWidth && visible > 1) {
    visible--;
    tags[visible].hidden = true;
    more.textContent = "+" + (tags.length - visible);
    more.hidden = false;
  }
  if (ul.scrollWidth > ul.clientWidth) tags[0].classList.add("shrink");
}

function fitAllTileTags() {
  for (const ul of document.querySelectorAll(".tile-tags")) fitTileTags(ul);
}

let fitScheduled = false;
window.addEventListener("resize", () => {
  if (fitScheduled) return;
  fitScheduled = true;
  requestAnimationFrame(() => {
    fitScheduled = false;
    fitAllTileTags();
  });
});

function renderList() {
  const list = $("recipe-list");
  const shown = filteredRecipes();
  list.replaceChildren(createAddPanel(), ...shown.map(createTile));
  $("filter-empty").hidden = !((bookmarkOnly || selectedTags.length > 0 || nameKeyword !== "") && shown.length === 0);
  fitAllTileTags();
}

function renderTagOptions() {
  const keyword = $("tag-search").value.trim();
  const coTags = new Set(filteredRecipes().flatMap((r) => r.tags));
  const shown = allTags.filter((t) => selectedTags.includes(t) || (coTags.has(t) && matchesKeyword(t, keyword)));
  const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.tag : undefined;
  $("tag-options").replaceChildren(...shown.map((name) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tag = name;
    const pressed = selectedTags.includes(name);
    button.setAttribute("aria-pressed", String(pressed));
    if (pressed) {
      const icon = document.createElement("i");
      icon.className = "ti ti-check";
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(icon);
    }
    button.append(name);
    button.addEventListener("click", () => setSelected(name, !pressed));
    li.appendChild(button);
    return li;
  }));
  const empty = $("tag-options-empty");
  if (shown.every((t) => selectedTags.includes(t))) {
    empty.textContent = keyword
      ? "「" + keyword + "」を含む、一緒に選べるタグはありません"
      : "一緒に選べるタグはありません";
    empty.hidden = false;
  } else {
    empty.hidden = true;
  }
  if (focused !== undefined) {
    const same = [...$("tag-options").querySelectorAll("button")].find((b) => b.dataset.tag === focused);
    (same || $("tag-dialog-close")).focus();
  }
}

$("bookmark-filter-button").addEventListener("click", () => {
  bookmarkOnly = !bookmarkOnly;
  applyFilter();
});

const tagDialog = $("tag-dialog");
$("tag-filter-button").addEventListener("click", () => {
  $("tag-search").value = "";
  renderTagOptions();
  tagDialog.showModal();
});
$("tag-dialog-close").addEventListener("click", () => tagDialog.close());
onOutsideTap(tagDialog, () => tagDialog.close());
$("tag-search").addEventListener("input", renderTagOptions);

const nameSearch = $("name-search");
function updateClearButton() {
  $("name-search-clear").hidden = nameSearch.value === "";
}
nameSearch.addEventListener("input", () => {
  nameKeyword = nameSearch.value.trim();
  updateClearButton();
  applyFilter();
});
nameSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) nameSearch.blur();
});
$("name-search-clear").addEventListener("click", () => {
  nameSearch.value = "";
  nameKeyword = "";
  updateClearButton();
  applyFilter();
  nameSearch.focus();
});

async function loadList() {
  const error = $("list-error");
  error.textContent = "";
  try {
    [recipes, allTags] = await Promise.all([api("GET", "/api/recipes"), api("GET", "/api/tags")]);
  } catch (e) {
    recipes = [];
    allTags = [];
    selectedTags = [];
    bookmarkOnly = false;
    $("recipe-list").replaceChildren();
    $("selected-tags").replaceChildren();
    $("search-box").hidden = true;
    $("filter-bar").hidden = true;
    $("filter-empty").hidden = true;
    error.textContent = "一覧を読み込めませんでした: " + e.message;
    return;
  }
  $("search-box").hidden = false;
  $("filter-bar").hidden = false;
  nameSearch.value = readKeywordFromUrl();
  nameKeyword = nameSearch.value.trim();
  updateClearButton();
  selectedTags = readSelectedFromUrl();
  bookmarkOnly = readBookmarkFromUrl();
  applyFilter();
}

// ブラウザの戻るでキャッシュから復元されたときは、詳細ページでの変更を反映するため読み直す
window.addEventListener("pageshow", (e) => {
  if (e.persisted) loadList();
});

setupScrollTop($("scroll-top-button"));
loadList();
