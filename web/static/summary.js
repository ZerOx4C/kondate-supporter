"use strict";
// 集計。見出しの下に、献立と同じ期間選択UI(端末に覚えた期間を献立と共用)を置く

setupPageNav($("page-nav"));
setupMainMenu($("menu-button"), $("main-menu"));
const periodPicker = setupPeriodPicker($("period-range"), () => {});
// 戻るでキャッシュから復元されたとき、献立で変えた期間を反映する
window.addEventListener("pageshow", (e) => {
  if (e.persisted) periodPicker.reload();
});
