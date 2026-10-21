# プレビュー用サーバーの起動スクリプト。
# go run は実行の度に一時ディレクトリへランダムなパスでバイナリを生成するため、
# 起動のたびにWindowsファイアウォールの許可プロンプトが発生し許可ルールも増え続けてしまう。
# 固定パスへ事前ビルドしてから実行することで、ファイアウォールの許可を一度きりで済ませる。
$ErrorActionPreference = "Stop"

$exe = "bin\kondate-supporter-preview.exe"
go build -o $exe .\cmd\server
& ".\$exe"
