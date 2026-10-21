# プレビュー用サーバーの起動スクリプト。
# go run は実行の度に一時ディレクトリへランダムなパスでバイナリを生成するため、
# 起動のたびにWindowsファイアウォールの許可プロンプトが発生し許可ルールも増え続けてしまう。
# 固定パスへ事前ビルドしてから実行することで、ファイアウォールの許可を一度きりで済ませる。
$ErrorActionPreference = "Stop"

$exe = "bin\kondate-supporter-preview.exe"

# 前回のプレビュー用サーバーが残っていると、exeの上書きビルドに失敗し、ポートも埋まったまま古い画面を配信し続ける。
# 開発サーバー(kondate-supporter)とは名前が違うので巻き込まない。
Get-Process kondate-supporter-preview -ErrorAction SilentlyContinue | Stop-Process -Force

go build -o $exe .\cmd\server
& ".\$exe"
