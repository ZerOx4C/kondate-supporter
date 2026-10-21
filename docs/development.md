# 開発規約

## 技術スタック(変更不可)

- バックエンド: Go + 標準 `net/http` のみ(Gin/Echo等のWebフレームワークは導入しない)
- DB: SQLite、ドライバは `modernc.org/sqlite`(CGO不要。`mattn/go-sqlite3` はRaspberryPi Zero向けクロスコンパイルが煩雑になるため不採用)
- フロントエンド: 素のHTML/CSS/JavaScript(フレームワーク・ビルドツール・SPA化なし)

## 方針

- [ROADMAP.md](../ROADMAP.md)に無い機能・将来のための抽象化を先取りしない(旧実装が肥大化して完成しなかった反省)
- 個人利用専用。チーム開発・外部公開向けの仕組み(認証・HTTPS・CSRF対策等)は作らない
- RaspberryPi Zeroのメモリ制約を意識する。外部依存を追加する前に標準ライブラリで実現できないか検討する

## バックエンド

- 依存の方向は `handler → service → repository` の一方向
- SQLは repository 層に閉じ込め、ビジネスロジックは service 層に置く
- APIはJSON。エラー応答は `{"error": "メッセージ"}` 形式で統一する
- マイグレーションファイルは追加のみ(既存ファイルの変更は禁止)

## フロントエンド

- マウス操作とタッチ操作の両方で使えるようにする
- レスポンシブ対応は画面と遷移が固まるまで行わない

## コード全般

- コメント(docコメント・TODO含む)は日本語で書く。識別子は英語

## 動作確認用プレビュー

- プレビューは必ず `preview_start` 経由(`scripts/preview-server.ps1`)で起動し、手で `go build` して別名のexeを作らない。スクリプトが前回のプレビュー用サーバーを止めてから固定パスへビルドする
- プレビューは `DEV_MODE=1` で画面ファイルをディスクから直接配信するため、HTML/JSの変更は再起動なしで反映される。Goコードの変更は `preview_start` し直す
- `scripts/*.ps1` は日本語コメントを含むため、UTF-8 BOM付きで保存する(Windows PowerShell 5.1はBOMなしをANSIで読み、行末が壊れて直後の行までコメント扱いになる)
