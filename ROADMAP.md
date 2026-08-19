# ROADMAP

改修予定を簡潔な箇条書きで記載する。

- 共通ヘッダーのスクロール時に上部に空白が表示される不具合を修正する（bodyのmargin-top削除、他要素でpadding-topで余白を確保）。
- オーバーレイ(dialog)表示中に内部スクロール時に背景側(body)がスクロールされる不具合を修正する（全dialog共通でbodyのスクロール制御）。
- スマートフォンのダイアログ内input/selectフォーカス時のズームイン不具合を修正する（input/select/textareaに明示的にfont-size: 1rem(16px)以上を指定してlabelのfont-sizeの継承を回避）。
- レシピ編集オーバーレイ(#recipe-dialog)のhead/footスクロール不具合を修正する（.recipe-dialogにmax-height: 90vhとdisplay: flexを指定、bodyのみflex: 1でスクロール対応）。
- 献立画面(plans.html)の.plan-day-header内で、日付ラベルとメモ追加ボタンの配置を横並びから縦並びに変更し、スマートフォンでの表示崩れを修正する。
