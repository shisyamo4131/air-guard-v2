# FGA-06 稼働実績Manager・client保存 Local検証記録

## 対象

- checkpoint: `FGA-06-RESULT-MANAGER-CLIENT-04`
- 固定製品commit: `40316475d9a687bf14ac900bb6c9267625988298`
- branch: `codex/fga-06-transaction-simplification`
- 検証日: 2026-09-13
- change class: `ui-css-layout`、`application-logic`、`data-contract-schema-migration`、`project-guidance-metadata`

## 実装した境界

- 実績詳細の基本情報を`OperationResultManager`／`AirItemManager`、従業員・外注先明細を`OperationResultWorkersManager`／`AirArrayManager`へ接続し、`OperationResult.update()`によるclient document保存へ移した。
- 新規Employee参照だけは、親OperationResult保存と同じclient transactionで存在を確認する。
- Rulesは同一tenantの有効な本登録User、actor UID、document ID、既存の非lock状態、Site・Customer参照を要求する。create、delete、lock変更、`articles`、請求調整、billing version、lifecycle IDはclient更新へ含めない。
- 稼働外売上、実績作成・複製・物理削除、予定、通知、実績化、請求と、rollback用の旧`saveOperation`分岐は変更していない。

## UI非変更の扱い

- 旧画面のカード枠、作業員toolbar、従業員／外注先追加ボタン、編集／削除ボタン、既存`Operation/RowInput`、760px dialog、再読込／キャンセル／保存文言、lock表示をsource contractで固定した。
- 稼働外売上一覧と物理削除dialogは従来Managerを継続利用する。
- 固定commitの専用Nuxt UI buildは成功した。ただしブラウザでの目視比較と実操作はまだ行っていないため、見た目の最終受入れはDev反映後の確認事項とする。

## 実行結果

| command | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/firestore-rules-reservation-source-contract.test.mjs test/domain/operation-editor.test.mjs test/domain/site-archive-source-contract.test.mjs` | 47/47 pass | 0 |
| `node --test test/domain/*.test.mjs` | final製品sourceで1454/1454 pass | 0 |
| `npm run test:local` | 180/180 pass。Codex専用demo project、loopback、合成data。利用者保存data不変 | 0 |
| `git diff --check` | 製品commit前の差分にerrorなし | 0 |
| `npm run test:local:ui:build` | 固定製品commit `40316475`のclient／server build成功 | 0 |

## Security Rules監査

認証済みUserの正本、tenant分離、actor UID、create／update／delete別境界、lock、保護field、Site・Customer参照、fallback回避を確認した。Critical、High、Mediumの指摘は検出しなかった。通常業務fieldのshape・派生値検証をRulesへ重複実装しない点は、現行仕様とADR 0065のtenant信頼境界に従う。

## 未実施・残存risk

- Dev／Prod反映、remote／実data読取り、browser UI操作、見た目の目視比較は未実施。
- 旧`saveOperation`の`overview`・`workers`分岐はrollbackと旧client互換のため残る。正規実績詳細画面からは到達しないが、撤去判断はDev受入れ後の別変更とする。
- applicationを介さない同一tenantの悪意あるrequestに対し、保護field以外の通常業務field shapeまではRulesで再検証しない。これは確定済みtenant信頼境界であり、新しい保証として扱わない。

## Rollback

固定製品commit `40316475`をrevertし、Firestore RulesとHostingを直前の固定releaseへ戻す。旧Callable分岐を残しているため、schema変更やdata migrationなしで従来画面経路へ戻せる。rollback自体とDev操作は別承認を要する。
