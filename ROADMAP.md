# ROADMAP

改修予定を簡潔な箇条書きで記載する。

- 献立画面の「未定」欄の次に「毎日」欄を追加するため、plansテーブルに毎日フラグ列(is_daily BOOLEAN NOT NULL DEFAULT 0)を追加するマイグレーションをinternal/db/migrations/に追加する(次は0013)。毎日献立はdate IS NULLかつis_daily = 1で表し、既存の未定(date IS NULLかつis_daily = 0)と区別する
- internal/repository/plan.goのListUnscheduledにis_daily = 0の条件を加えて未定献立のみに絞り込み、新たに毎日献立を取得するListDaily(is_daily = 1、範囲指定なしで常に全件取得)を追加する。PlanDetail・Create・UpdateにIsDailyフィールドを追加し、internal/handler/plan.go・internal/handler/router.goに対応するAPI(例: GET /api/plans/daily)を追加する
- internal/service/shoppinglist.goのaggregateで、毎日献立(ListDaily)も集計対象に含め、通常の献立と同じ計算式で必要量を算出したうえで、指定期間(from~to)の日数分を乗算する(毎日欄は検討期間の長さ分だけ消費されるため)。from/toが省略された場合の日数の扱いも決める
- web/static/plans.html・web/static/js/plans.jsの献立画面で、「未定」列の次に「毎日」列を追加する。未定列と同様に検討期間によらず常に表示し、追加・編集・削除・メモ行対応など同等の操作性を持たせる。献立編集ダイアログの日付選択(#plan-date)に「毎日」を選べるようにする(現在未定は空文字列valueのoptionで表現しているため、毎日を区別するための表現方法もあわせて検討する)
