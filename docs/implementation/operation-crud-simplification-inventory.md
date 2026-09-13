# Operation CRUD簡素化の現行棚卸し

- 確認日: 2026-09-13
- checkpoint: FGA-06-TRANSACTION-SIMPLIFICATION-SCOPE-03
- 状態: 現行実装の確認と後続checkpoint候補。製品変更・権限確定ではない
- 対象: 現場稼働予定、稼働実績、稼働請求の画面、Manager、`saveOperation` Callable、Firestore Rules
- 正本: 要件は[現行仕様](../specification.md)、移行方針は[ADR 0071](../decisions/0071-normal-business-manager-and-callable-boundary.md)、進捗は[FGAロードマップ](../roadmaps/foundational-governance-alignment.md)

## 確認済み実装事実

1. `components/Operation/Manager.vue`と`components/Operation/ArrayManager.vue`は、`useOperationEditor`を介して予定・実績・請求の作成、編集、削除を`saveOperation` Callableへ送る専用Managerであり、`AirItemManager`／`AirArrayManager`を使用していない。
2. `components/Operation/RowsManager.vue`は、予定・実績・請求の作業員または稼働外売上の行追加・編集・削除・並替えを同じCallableへ送る。稼働実績詳細では稼働外売上の追加・編集・削除を表示している。
3. `components/OperationResult/Workers/Manager/index.vue`は`AirArrayManager`、`components/SiteOperationScheduleDetail/Manager/index.vue`は`AirItemManager`を既に使用する。前者は現行の請求詳細画面から利用され、後者は今回確認した静的caller検索では参照を確認できなかった。再利用可否は後続checkpointでbase契約とcallerを再確認する。
4. `functions/shared/operationWriteContract.js`が`create`、`duplicate`、`overview`、`workers`、`articles`、`order`、`delete`、`notify`、`convert`、`agreement`、`adjusted`、`lock`を一つのcommand契約へ集約する。
5. `functions/modules/operations/saveOperation.js`は全commandを一つのFirestore transactionで処理し、Auth identityとUser、現場、従業員参照、期待値を検査する。予定ではSite `scheduleRevision`と配置通知、実績化では予定・通知・実績、請求では取極め・調整・lockを同じ入口で扱う。
6. 現行Firestore Rulesは`OperationResults`と`SiteOperationSchedules`のclient writeを全面拒否している。このRulesは現行Callable経路と整合するが、Callableを維持すべき設計理由そのものではない。
7. 稼働実績の`overview`・`workers`は同一tenantの有効な本登録Userへserver認可を緩和済みだが、client保存、Air Manager、Rules簡素化へは未移行である。稼働外売上と請求は現在のrole判定を維持している。

## 操作別の予備分類

この表は実装checkpointを選ぶための予備分類であり、client化またはCallable維持を確定しない。特に「技術要件候補」は、現行server処理の存在だけでなく、client transaction・batch・trigger等で満たせない理由を次の設計で確認する。

| 対象 | 現行action | 現行の主な処理 | 予備分類 | 後続で確認する点 |
|---|---|---|---|---|
| 予定 | `create`・`duplicate` | 予定作成、現場参照、表示順、Site revision | 通常CRUD／Air Manager・client化候補 | 表示順競合、Site revisionの必要性、終了現場確認、Rules |
| 予定 | `overview`・`workers`・`order` | 予定document更新、派生値、配置通知取消し、Site revision | 通常CRUDと関連作用の分離候補 | 通常保存をManagerへ戻し、通知取消し等の最小server処理だけを分離できるか |
| 予定 | `delete` | 予定documentと関連通知の物理削除 | 確認済み例外候補 | 物理削除、参照・実績化済み拒否、監査・復旧 |
| 予定 | `notify` | 配置通知document作成と予定側状態更新 | 技術要件を持つ独立operation候補 | 外部通知との関係、冪等性、再送、複数document atomicity |
| 予定 | `convert` | 通知値を反映した実績作成、予定を実績化済みに更新 | 技術要件を持つ順序依存operation候補 | atomicity、再実行、通知snapshot、結果不明時の復旧 |
| 実績 | `create`・`duplicate` | 実績作成、Site取極めsnapshot | 通常CRUD／Air Manager・client化候補 | 作成を提供する画面、snapshot時点、重複・lock条件 |
| 実績 | `overview`・`workers` | 実績document内の基本情報・作業員更新 | 最初の通常CRUD簡素化候補 | 単数／複数Manager、document LWW、参照検査、downstream trigger、Rules |
| 実績 | `articles` | 実績document内の稼働外売上行更新 | 現状維持・権限仕様未決 | 現行操作を維持し、権限の追加・撤去をこのphaseから推論しない |
| 実績 | `delete` | 実績documentの物理削除 | 確認済み例外候補 | 勤怠・請求等の削除event chain、復旧、監査 |
| 請求 | `overview`・`articles`・`adjusted` | OperationResults内の請求情報・稼働外売上・手動調整更新 | 現状維持・業務境界確認待ち | 上流menu制御、提供操作、確定後編集、通常CRUDへ分類できる範囲 |
| 請求 | `agreement` | Site取極め選択と請求snapshot再計算 | 技術要件または通常CRUDの確認候補 | snapshot、再計算、最新Site参照をどこが所有するか |
| 請求 | `lock` | 請求対象実績のlock切替 | 状態遷移の確認候補 | lockの意味、解除、他編集との競合、actor仕様 |

## 現時点の不整合

- FGA-06の完了済み2 checkpointはrole依存を緩和したが、専用Operation Manager、Callable、期待値競合、client write全面拒否を維持した。認可緩和の完了記録は有効だが、CRUD簡素化の完了とは扱わない。
- ADR 0069と仕様は当初Air Managerを通常masterへ限定していた。ADR 0071と仕様訂正により通常業務data全般へ適用範囲を広げるが、製品codeは未移行である。
- `saveOperation`は通常CRUD、物理削除、通知、実績化、請求状態遷移を同じAPIへ集約している。後続ではAPI単位でなくoperation単位に必要性を判定する。

## 次の実装checkpoint候補

`FGA-06-RESULT-MANAGER-CLIENT-04`として、lockされていない既存実績の`overview`・`workers`だけを対象に設計する。稼働外売上、実績作成・複製・物理削除、予定、通知、実績化、請求は対象外とする。

実装前に次を確定する。

- listener由来`OperationResult`を単数Domain Manager／`AirItemManager`へ渡す基本情報編集契約。
- 作業員配列に既存`OperationResultWorkersManager`／`AirArrayManager`を再利用できるか、親document保存とbase Managerのevent契約。
- `OperationResult.update()`によるdocument単位last-write-wins、既存downstream trigger、lock、追加Employee参照の責務。
- `OperationResults` Rulesをtenant共通の通常updateへ開く際に残すactor UID、tenant、client物理delete拒否と、create・未決`articles`を同時に開かない方法。
- 旧Callable clientとの互換、Functions撤去単位、rollback、対象自動test、Local Emulator、固定commitのDev反映・受入れ。

本候補は製品実装の承認ではない。上記segment contractと影響を提示し、利用者承認後に実装する。

## 未確認事項

- Air Managerの現行公開契約が、親document内の作業員・稼働外売上配列をdocument全体として保存する構成をそのまま満たすかは未確認。
- `saveOperation`以外のCloud Functions triggerが各action後に更新する全documentと、client化時の同等性はこの棚卸しでは再検証していない。
- Dev／Prodのactual Firestore edition、deploy状態、実dataは確認していない。今回の文書変更は実環境を対象にしない。
