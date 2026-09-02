# Company legacy Stripe情報削除ロードマップ

- 状態: Active
- 開始日: 2026-08-30
- 現在の進捗: 50%
- 部分加点: なし
- 完了条件: legacy Stripe関連field・code・schemaを現行Company境界から除去し、local migration・動作確認、bounded Dev migration・反映・利用者受入れ、post-check、rollback確認まで完了する
- 正本: [現行仕様](../specification.md#company設定とtenant-lifecycle)、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)、[ADR 0038](../decisions/0038-legacy-stripe-scaffold-removal.md)

## 境界

このroadmapはStripe Checkout、Webhook、subscription、entitlement、employeeLimitを実装しない。現段階で不要なlegacy Stripe情報をCompany構造と利用経路から削除することだけを対象とする。将来のサブスクリプション機能は、当時の要件、provider、権限、外部作用に基づく別設計・別roadmapとする。

利用者確認により、現存するStripe関連物はscaffoldであり、Stripe側とCompany契約情報を同期した実績はない。Stripe Customer・Subscription・Price・Webhook・Secret等の外部inventory、変更、削除、rollbackは本roadmapの対象外とする。

旧CCB全体のrollbackはこのroadmapへ混在させない。2026-08-30にexact inventoryと4つのcorrective implementation commitを完了し、UWB、Company create/delete拒否、Schemas `.167` artifact/pin、Admin SDK guardを保持した。STRIPE-01は、[Company部分更新ロードマップ](company-partial-updates.md)でwhole-document replacementを除去したreview済みbaselineから開始する。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| STRIPE-01 exact inventory・削除契約 | 10 | 10 | Completed | ADR 0038でactive/dormant surface、schema/package境界、migration対象4 Company、保持対象、backup、rollback、停止条件、外部Stripe対象外を確定した |
| STRIPE-02 code・schema・testからの削除 | 25 | 25 | Completed | commit `509fabbe77124b7bfe03b8b50c39ab9b6b488426`でSchemas `3.0.0-dev.1`導入と旧scaffold削除を固定し、全domain 731件、隔離Emulator 107件、local UI build、包括確認、独立review・security reviewを成功させた |
| STRIPE-03 local migration準備 | 15 | 15 | Completed | commit `d5afe96927bf74809b9c3632f968905eff809975`で隔離Codex local専用のplanner、backup、dry-run、apply、post-check、clean rerun、rollback rehearsalを固定し、対象16件、全domain 747件、隔離Emulator 108件、独立review・security reviewを成功させた |
| STRIPE-04 local migration・画面受入れ | 20 | 0 | Not started | Codex専用または利用者承認済みlocal環境でmigrationと主要Company画面の読込・編集・再読込を確認する |
| STRIPE-05 bounded Dev migration・反映 | 20 | 0 | Not started | 承認済みmaintenanceで4 Companyをbackup・変換し、対象releaseをDevへ反映してremote post-checkを完了する |
| STRIPE-06 Dev利用者受入れ・closeout | 10 | 0 | Not started | 利用者がDevの主要Company操作を受け入れ、旧field 0、error 0、rollback可否、仕様・運用・変更履歴を確定する |

重みは合計100。各マイルストーンは記載した証拠が全部揃ったときだけ加点する。Dev操作、migration、deploy、remote/data writeは、対象commit、件数、backup、rollback、停止条件、検証を固定したbounded checkpointごとに明示承認を得る。

## 現在の次工程

1. STRIPE-04として、承認済みlocal環境と対象dataを固定し、保存済みbackup・digest・停止条件に従ってlocal migrationと主要Company画面の受入れを行う。
2. STRIPE-03の実装は隔離Codex localの合成dataだけで検証済みである。利用者local data、Dev・Prod、remote data、外部Stripeへの適用実績として扱わない。
3. STRIPE-04は自動開始せず、対象、backup、rollback、画面確認範囲について別の利用者承認を得る。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-08-30 | 0% | 0 | ADR 0031により旧巨大CCB roadmapを終了し、legacy Stripe情報削除をDev受入れまで独立してFIXするroadmapとして開始した。実装・migration・Dev反映は未着手。 |
| 2026-08-30 | 0% | 0 | 旧CCBを4つのcorrective implementation commitでrollbackし、保持対象を分離した。Stripe削除自体は未着手であり、先に新CCBのwhole-document replacement除去を行うため進捗は据え置いた。 |
| 2026-09-01 | 10% | +10 | 利用者がStripe側との契約情報同期実績なしを確認した。active/dormant code、Rules、schema/package、4 Company migration、backup・rollback・停止条件をADR 0038へ固定し、外部Stripe操作を対象外とした。STRIPE-01を完了した。 |
| 2026-09-01 | 10% | 0 | Schemas `3.0.0-dev.1`の公開・内容検証は完了したが、AirGuardV2 consumer未導入のためSTRIPE-02は未加点。package identity誤報を受け、common governance 1.4.1と変更前後preflightを先に導入し、task交代後に再開する。 |
| 2026-09-01 | 10% | 0 | STRIPE-02の実装、全domain 731/731、隔離Emulator 107/107、PostAdoption、一般review、security reviewは成功した。local UI buildはdirty worktree guardにより製品build開始前にexit 1となり、clean candidate commitが必要なため、完了・加点は保留する。外部Stripe、data migration、Dev/Prod、deployは未実施である。 |
| 2026-09-02 | 35% | +25 | review済み23項目をcommit `509fabbe77124b7bfe03b8b50c39ab9b6b488426`へ固定し、cleanな同一HEADで`npm run test:local:ui:build`をexit 0で完了した。実装、全domain 731/731、隔離Emulator 107/107、PostAdoption、包括確認、一般review、security reviewを合わせてSTRIPE-02を完了した。外部Stripe、data migration、Dev/Prod、deploy、pushは未実施である。 |
| 2026-09-02 | 50% | +15 | commit `d5afe96927bf74809b9c3632f968905eff809975`で、既存Company rootのlegacy 2 fieldと既知形状の直接`StripeData`だけを扱う隔離Codex local専用migration rehearsalを固定した。値を出さないdry-run、exact target、backup、digest、事前状態再確認、all-or-zero apply、post-check、clean rerun、rollbackと競合停止を合成dataで検証し、対象16/16、全domain 747/747、隔離Emulator 108/108、独立review・security reviewを成功させた。利用者local data、Dev/Prod、remote data、外部Stripe、deploy、pushは未実施である。 |
