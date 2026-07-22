// dialog要素の背景(::backdrop)クリックかどうかを判定する。
// e.target === dialog だけでは、dialog自身のpadding/margin部分をクリックした場合も
// 真になってしまうため、クリック座標がdialogの矩形外にあるかどうかで判定する。
function isDialogBackdropClick(dialog, e) {
  if (e.target !== dialog) return false;
  const rect = dialog.getBoundingClientRect();
  return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
}
