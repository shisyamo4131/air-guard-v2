# OperationResult dependent sync / billing / site cleanup deep review

- 状態: 実装調査（deep review）
- 対象セグメント: SPEC-DEEP-002
- 最終確認日: 2026-08-11
- 対象: Cloud Functions 12 files（下表）
- 境界: runtime、Firebase実データ、外部環境は未確認

## ファイル別公開契約

| file | responsibility / public API | main branches / side effects | failure, retry, idempotency / reachability |
| --- | --- | --- | --- |
| `functions/modules/billings/addOperationResultToBilling.js` | `addOperationResultToBilling(operationResult)`。請求対象実績をBillingへ追加 | `isBillable` falseはskip。`customerId_siteId_billingDate`を取得し、同IDを除外後push。不存在時はCustomer live masterからDRAFT Billingを作成 | transactionなし。同一event再実行のID重複は抑えるが並行更新はlost update候補。OperationResult triggerから到達 |
| `functions/modules/billings/index.js` | add/remove/syncのre-export | 分岐・副作用なし | triggerのimport境界。単体testなし |
| `functions/modules/billings/removeOperationResultFromBilling.js` | `removeOperationResultFromBilling(operationResult)` | companyIdとdocIdを検証。Billing不存在はwarning、残件0はdelete、それ以外はupdate | transactionなし。非請求deleteでもkey必須で失敗し得る（FUT-0046） |
| `functions/modules/billings/syncOperationResultToBilling.js` | `syncOperationResultToBilling(before, after)` | 対象外継続はskip、対象解除はremove、対象化はadd。同一keyはreplace、key移動だけold/newを単一transactionで更新 | 同一key/add/removeはtransaction外。Billing status/lockを検査しない（FUT-0045/0047） |
| `functions/modules/billings/utils.js` | `getBillingKey`、`initBillingDoc` | key必須値をunderscore連結。初期化はCustomerをlive取得しDRAFT Billingを生成 | `billingDateAt`は実装上`toDate()`可能な値が必要だがJSDocはDateと記載し契約不一致 |
| `functions/modules/dependentSync.js` | Firestore update trigger `onUpdateCustomer` | customerId一致Site全件へCustomer snapshotを300件batchで更新 | batch群を`Promise.all`。一部commit後failureがあり得てerrorは再throw。version guardなしで旧event後勝ち候補。`functions/index.js`からexport |
| `functions/modules/operationCleanup.js` | `onSiteOperationScheduleDeleted`、`onOperationResultDeleted` | schedule削除時、operationResultIdなしならStorage reports prefix削除。Result削除時、Storage削除後にlinked schedule物理削除 | file deleteのnot-foundのみ吸収。他errorは部分削除後throw。projection triggerと順序保証・共通transactionなし。`functions/index.js`からexport |
| `functions/modules/siteEmployeeHistories/rebuildAllHistories.js` | `rebuildAllHistories(companyId)` | 全OperationResultからsite/employee pairを重複排除し逐次rebuild | 現存Resultにないstale historyは列挙・削除しない。Callable coreから到達 |
| `functions/modules/siteEmployeeHistories/rebuildHistories.js` | `rebuildHistories(siteId, employeeIds, companyId)` | employee IDをSetで重複排除し逐次rebuild | employee間で部分成功。OperationResult triggerから到達 |
| `functions/modules/siteEmployeeHistories/rebuildHistory.js` | `rebuildHistory(siteId, employeeId, companyId)` | date昇順/降順queryで境界Resultを求め、固定ID historyをupsert。0件はdelete | query/write非transaction、同日docId tie-breakなし。deleteの全errorを吸収（FUT-0042/0043） |
| `functions/modules/sites/autoTermination.js` | `sitesAutoTermination()` | JST日初から3か月前より古い工期終了日かつACTIVEの全tenant Siteを500件batchでTERMINATED化 | unbounded collectionGroup、batch並列、precondition/audit/paginationなし。部分成功候補（FUT-0161） |
| `functions/modules/sites/index.js` | `sitesAutoTermination`のre-export | 分岐・副作用なし | `runDailyTask`から到達。単体testなし |

## Event flowと実行境界

OperationResultのprojection処理は単一transactionではない。BillingとSiteEmployeeHistoryはOperationResult trigger内で順次呼ばれる一方、delete時のStorage・schedule cleanupは独立exportで発火する。独立trigger間の順序・成功統合はなく、source削除後に一部だけ成功する可能性がある。Billing key移動のみold/newを同一transactionで扱い、同一key更新・追加・削除はread-modify-writeである。

Customer updateは対象Siteへ埋込みCustomerを伝播するが、複数batchを一括awaitするためatomicではない。再実行は値としては収束し得る一方、event versionを比較しないため新しい変更後に古いeventが完了する競合を排除しない。

SiteEmployeeHistoryの全件再構築は現在存在するOperationResult由来pairだけを処理する。pair自体が消えたstale historyを全scanして除去する機能ではない。Site自動終了も保守task内の一処理で、対象queryとstatus updateの間の競合検査を持たない。

## 認証・tenant・入力境界

Firestore event handlerはevent pathのcompanyIdとsnapshotを信頼し、個別のcaller認証は持たない。Billing helperは一部必須値を検証するが、status/lock/tenant間参照の再検証は行わない。全履歴再構築のsuper-user/tenant認可は呼出元Callable coreの責務であり、この12ファイル内ではcompanyIdを受け取って処理する。

## 矛盾・未使用・テスト

- Billing初期化の`billingDateAt`はコメント上Date、実装上Firestore Timestamp相当であり公開契約が一致しない。
- Billing indexとSites indexは到達可能なre-exportで、dead codeではない。
- 対象12ファイル名・export名を直接検証する自動testはrepository内検索で確認できなかった。
- 発見事項は既存FUT-0030、0042、0043、0045、0046、0047、0061、0153、0161、0163に統合し、新規FUT/CONFは追加しない。

## 未確認範囲

- Cloud側のretry/runtime override、実件数、index、contention、監視・alert
- Emulatorでの並行event、部分failure、out-of-order再現
- adapter内部のupdate/create preconditionの有無（本segmentのdirect scope外）
