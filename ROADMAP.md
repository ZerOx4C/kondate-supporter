# ROADMAP

未着手の改修項目。1項目=1コミットで完結する粒度のフラットな箇条書きで書き、完了したら削除する。

- architecture.md 3節の表で `POST /api/recipes` のリクエストが `{"name","body"}` のままで、表の上の説明やコードと食い違っているため、`{"name","body","tags"}` に直す(`tags` の扱いは表の上の説明にあるので、表には書き足さない)
- 一覧の好評のタイルだけ、回数バッジがブックマークの下地より1px下にずれているため、`recipes.html` の `.tile-visual.popular .tile-cooked { top: calc(0.3rem + 1px); }` を消す(好評のタイルも枠線は残っているので、ずらす必要が無い)
