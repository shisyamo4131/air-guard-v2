# SuperUser兼会社管理者の表示順対応ロードマップ

- 状態: Active
- 開始日: 2026-08-31
- 現在の進捗: 70%
- 部分加点: なし
- 完了条件: SuperUser兼会社管理者が自社の稼働予定・配置管理の表示順を安全に変更でき、単独SuperUser・他tenant等の拒否を維持し、local検証、bounded Dev反映、利用者最終UI acceptanceまで完了する
- 正本: [現行仕様](../specification.md#company設定とtenant-lifecycle)、[ADR 0037](../decisions/0037-superuser-company-admin-display-order.md)

## 境界

このroadmapは`siteOrder`と`scheduleOrder`のactor判定だけを変更する。SuperUser兼会社管理者は自社の両表示順を更新できるが、会社管理者でないSuperUser、他tenant、temporary、disabled、不正なidentityは拒否する。Company基本情報、振込先、通常設定、User管理、会社横断support access、claim変更、data migration、Rules変更へ範囲を広げない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| DRA-01 Dev診断・変更契約 | 15 | 15 | Completed | ChromeでSuperUser表示と両画面の表示順入口不在、Functions logで保存POST 0件、client/serverの明示拒否条件を確認し、利用者が変更契約を承認した |
| DRA-02 client・Callable・対象test実装 | 35 | 35 | Completed | fail-closedなdual-role許可とstandalone SuperUser拒否をclient/serverへ揃え、両fieldの許可・拒否testを追加した |
| DRA-03 local回帰・security review | 20 | 20 | Completed | 対象16件、全domain 727件、隔離Emulator 107件、project validator、独立security review GO、差分確認を完了した |
| DRA-04 bounded Dev反映・remote確認 | 20 | 0 | Not started | 承認済みreleaseでFunctionsを先、Hostingを後に反映し、Function状態・CORS・artifact・error logを確認する |
| DRA-05 Dev利用者最終UI acceptance | 10 | 0 | Not started | 利用者のSuperUser兼会社管理者accountで両画面の編集入口、保存、再読込を確認し、単独SuperUser境界とrollback先を確定する |

重みは合計100。各マイルストーンは記載した証拠が全部揃ったときだけ加点する。Dev、remote、deployは対象commit、service、data影響、rollback、停止条件、検証を固定した別のbounded release checkpointとして承認を得る。

## 現在の次工程

1. Functions先行・Hosting後行のbounded Dev release checkpointを提示する。
2. DevのSuperUser兼会社管理者accountで利用者が最終UI acceptanceを行う。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-08-31 | 15% | +15 | DevのChromeとFunctions log、source・testを照合して、SuperUser判定が会社管理者兼任accountの表示順入口を止めている原因を確定した。利用者が限定的な仕様変更を承認した。 |
| 2026-08-31 | 50% | +35 | clientとCallableへdual-role会社管理者の許可、standalone SuperUserと不正identityの拒否を実装し、両fieldの対象testを追加した。全体回帰と独立reviewはDRA-03へ残す。 |
| 2026-08-31 | 70% | +20 | 生SuperUser claimのboolean妥当性を表示順だけで追加確認し、preset保有の非管理者SuperUser拒否を固定した。対象16件、全domain 727件、隔離Emulator 107件、project validator、独立security review GO、review済みlocal commitを完了した。 |
