// 調味料の数量(mL)を、さじ表記設定に応じて表示用文字列に変換する共通処理。
// admin.html / recipes.html / plans.html から読み込まれる。

// 調味料のmL数量を、isSpoonDisplayがtrueなら「大さじX杯」「小さじY杯」、
// falseなら従来通り「NmL」に変換する。
// 大さじ1杯=15mL、小さじ1杯=5mLとして換算し、0.5杯刻みで丸める。
function formatSeasoningQuantity(mL, isSpoonDisplay) {
  if (!isSpoonDisplay) {
    return `${mL}mL`;
  }

  const TABLESPOON_ML = 15; // 大さじ1杯あたりのmL
  const TEASPOON_ML = 5; // 小さじ1杯あたりのmL
  const ROUND_STEP = 0.5; // 0.5刻みで丸める
  const TOLERANCE_ML = 1; // 大さじ換算の丸め誤差がこの範囲内なら大さじ表記を採用する

  const roundToStep = (value) => Math.round(value / ROUND_STEP) * ROUND_STEP;

  const tablespoons = roundToStep(mL / TABLESPOON_ML);
  const tablespoonError = Math.abs(mL - tablespoons * TABLESPOON_ML);

  // 大さじ1杯以上に丸められ、かつ丸め誤差が十分小さい場合のみ大さじ表記を採用する。
  // (例: 10mLは大さじ0.5杯に丸まってしまうが、これは不自然なため小さじ表記にする)
  if (tablespoons >= 1 && tablespoonError <= TOLERANCE_ML) {
    return `大さじ${tablespoons}杯`;
  }

  const teaspoons = roundToStep(mL / TEASPOON_ML);
  return `小さじ${teaspoons}杯`;
}
