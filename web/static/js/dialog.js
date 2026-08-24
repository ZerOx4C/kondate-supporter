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
let openDialogCount = 0;
let dialogScrollLockObserver = null;

function applyBodyScrollLock() {
  document.body.classList.toggle('body-scroll-locked', openDialogCount > 0);
}

// 個々のdialog要素をスクロールロック対象として登録する。
// setupDialogScrollLockの初期化ループだけでなく、confirmDialogのように実行時に
// 動的生成したdialogからも呼べるよう独立した関数として切り出している。
function registerDialogScrollLock(dialog) {
  if (dialog.hasAttribute('open')) {
    openDialogCount++;
    applyBodyScrollLock();
  }
  dialogScrollLockObserver.observe(dialog, { attributes: true, attributeFilter: ['open'], attributeOldValue: true });
}

function setupDialogScrollLock() {
  dialogScrollLockObserver = new MutationObserver((mutations) => {
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
    registerDialogScrollLock(dialog);
  }
}

document.addEventListener('DOMContentLoaded', setupDialogScrollLock);

// 既存の<dialog>ベースUIと見た目を揃えた確認ダイアログ。
// 各HTMLに静的マークアップを追加すると summary-dialog のようなHTML重複を画面数分
// 生んでしまうため、JSで動的生成してbodyに追加し、close後は破棄する使い捨て方式にする。
// Promiseで結果を返すことで、呼び出し側は `await confirmDialog(...)` と
// 従来のconfirm()に近い書き方のまま置き換えられる。
function confirmDialog(message) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'app-dialog confirm-dialog';

    const messageEl = document.createElement('p');
    messageEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'primary';
    cancelButton.textContent = 'キャンセル';

    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.className = 'danger btn-danger-outline';
    okButton.textContent = '削除';

    // 既存ダイアログ(master-dialog等)の慣例に合わせ、危険操作ボタンを左側、キャンセルを右側に配置する。
    actions.append(okButton, cancelButton);
    dialog.append(messageEl, actions);
    document.body.appendChild(dialog);

    // 動的生成したdialogもスクロールロックの監視対象に含める。
    registerDialogScrollLock(dialog);

    let result = false;

    function finish(value) {
      result = value;
      dialog.close();
    }

    cancelButton.addEventListener('click', () => finish(false));
    okButton.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', () => { result = false; });
    dialog.addEventListener('click', (e) => {
      if (isDialogBackdropClick(dialog, e)) finish(false);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });

    dialog.showModal();
    okButton.focus();
  });
}
