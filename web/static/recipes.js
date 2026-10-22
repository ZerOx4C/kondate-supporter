"use strict";

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

async function loadList() {
  const error = $("list-error");
  const list = $("recipe-list");
  list.textContent = "";
  error.textContent = "";
  let recipes;
  try {
    recipes = await api("GET", "/api/recipes");
  } catch (e) {
    error.textContent = "一覧を読み込めませんでした: " + e.message;
    return;
  }
  list.appendChild(createAddPanel());
  for (const recipe of recipes) {
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
    const name = document.createElement("span");
    name.className = "tile-name";
    name.textContent = recipe.name;
    visual.appendChild(name);
    const cooked = cookedContent(recipe.cooked_count);
    cooked.classList.add("tile-cooked");
    visual.appendChild(cooked);
    link.appendChild(visual);
    li.appendChild(link);
    list.appendChild(li);
  }
}

// ブラウザの戻るでキャッシュから復元されたときは、詳細ページでの変更を反映するため読み直す
window.addEventListener("pageshow", (e) => {
  if (e.persisted) loadList();
});

loadList();
