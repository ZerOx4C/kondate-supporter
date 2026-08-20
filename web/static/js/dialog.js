// dialog要素の背景(::backdrop)クリックかどうかを判定する。
// e.target === dialog だけでは、dialog自身のpadding/margin部分をクリックした場合も
// 真になってしまうため、クリック座標がdialogの矩形外にあるかどうかで判定する。
function isDialogBackdropClick(dialog, e) {
  if (e.target !== dialog) return false;
  const rect = dialog.getBoundingClientRect();
  return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
}

// いずれかのdialogが開いている間は背景(body)のスクロールを止める。
// 各画面JSがdialog.showModal()/close()を個別に呼んでいるため、呼び出し箇所を書き換えずに済むよう
// MutationObserverでdialog要素のopen属性の変化を監視し、開いているdialog数をカウントする共通処理として実装する。
function setupDialogScrollLock() {
  let openDialogCount = 0;

  function applyBodyScrollLock() {
    document.body.classList.toggle('body-scroll-locked', openDialogCount > 0);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'open') continue;
      const isOpenNow = mutation.target.hasAttribute('open');
      const wasOpenBefore = mutation.oldValue !== null;
      if (isOpenNow === wasOpenBefore) continue;
      openDialogCount += isOpenNow ? 1 : -1;
    }
    applyBodyScrollLock();
  });

  for (const dialog of document.querySelectorAll('dialog')) {
    if (dialog.hasAttribute('open')) openDialogCount++;
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'], attributeOldValue: true });
  }

  applyBodyScrollLock();
}

document.addEventListener('DOMContentLoaded', setupDialogScrollLock);
