# Company legacy Stripe情報削除ロードマップ

- 状態: Active
- 開始日: 2026-08-30
- 現在の進捗: 0%
- 部分加点: なし
- 完了条件: legacy Stripe関連field・code・schemaを現行Company境界から除去し、local migration・動作確認、bounded Dev migration・反映・利用者受入れ、post-check、rollback確認まで完了する
- 正本: [現行仕様](../specification.md#company設定とtenant-lifecycle)、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)

## 境界

このroadmapはStripe Checkout、Webhook、subscription、entitlement、employeeLimitを実装しない。現段階で不要なlegacy Stripe情報をCompany構造と利用経路から削除することだけを対象とする。将来のサブスクリプション機能は、当時の要件、provider、権限、外部作用に基づく別設計・別roadmapとする。

旧CCB全体のrollbackはこのroadmapへ混在させない。まずexact commits/filesと独立して保持すべきsecurity改善・公開artifactを棚卸しし、安全なcorrective commitで新baselineを作る。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| STRIPE-01 exact inventory・削除契約 | 10 | 0 | Not started | legacy field、全reader/writer、schema、fixture、migration対象4 Company、保持対象、backup、rollback、停止条件を確定する |
| STRIPE-02 code・schema・testからの削除 | 25 | 0 | Not started | 対象code/schemaを削除し、unknown field・再混入・既存Company CRUDの回帰をlocalで通す |
| STRIPE-03 local migration準備 | 15 | 0 | Not started | backup、dry-run、exact target、idempotent plan、failure時write 0、post-checkを検証する |
| STRIPE-04 local migration・画面受入れ | 20 | 0 | Not started | Codex専用または利用者承認済みlocal環境でmigrationと主要Company画面の読込・編集・再読込を確認する |
| STRIPE-05 bounded Dev migration・反映 | 20 | 0 | Not started | 承認済みmaintenanceで4 Companyをbackup・変換し、対象releaseをDevへ反映してremote post-checkを完了する |
| STRIPE-06 Dev利用者受入れ・closeout | 10 | 0 | Not started | 利用者がDevの主要Company操作を受け入れ、旧field 0、error 0、rollback可否、仕様・運用・変更履歴を確定する |

重みは合計100。各マイルストーンは記載した証拠が全部揃ったときだけ加点する。Dev操作、migration、deploy、remote/data writeは、対象commit、件数、backup、rollback、停止条件、検証を固定したbounded checkpointごとに明示承認を得る。

## 現在の次工程

1. 旧CCBのapplication、Rules、script、test、package consumer、関連Admin SDK guardをread-only inventoryする。
2. Stripe削除へ不要な旧CCB成果物と、UWB・Company create/delete拒否・公開済みSchemas artifact等の保持対象を分離する。
3. rollback planをreviewしてからcorrective commitを作り、そのbaseline上でSTRIPE-01を開始する。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-08-30 | 0% | 0 | ADR 0031により旧巨大CCB roadmapを終了し、legacy Stripe情報削除をDev受入れまで独立してFIXするroadmapとして開始した。実装・migration・Dev反映は未着手。 |
