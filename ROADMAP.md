# ROADMAP

改修予定を簡潔な箇条書きで記載する。

- ヘッダーの検討期間フィールドを『開始日〜終了日』から『開始日＆日数』に変更: daterange.js・全8画面ヘッダー・localStorage・docs/architecture.md対応
- ページ共通ヘッダーの固定表示: 全8画面でスクロール時にヘッダー(h1・検討期間バー)を画面上部に固定
- マスタ管理画面の食材・調味料タブにインクリメンタルサーチを追加: recipes.htmlの.search-fieldパターンを踏襲し、新規追加ボタンを角丸デザインに変更
- マスタ管理・買い物リストの表デザインを刷新: web/static/css/style.cssの table/th/td 共通スタイルを罫線ありの表からボーダーレス＋ゼブラストライプ＋行ホバーハイライトに変更（案A）。masters.htmlの食材・調味料一覧、shoppinglist.htmlの不足食材一覧の両方に適用。あわせてweb/static/js/masters.jsの編集ボタンをテキスト「編集」からアイコンボタン（ti-pencil、aria-label="編集"）に変更する。
