# Operation CRUD簡素化の現行棚卸し

- 確認日: 2026-09-14
- checkpoint: FGA-06-TRANSACTION-DELETE-BOUNDARY-05
- 状態: FGA-06-RESULT-MANAGER-CLIENT-04のDev受入れ完了。transaction物理削除のclient化・Trigger連携をガバナンスへ確定し、製品実装前
- 対象: 現場稼働予定、稼働実績、稼働請求の画面、Manager、`saveOperation` Callable、Firestore Rules
- 正本: 要件は[現行仕様](../specification.md)、通常CRUD移行は[ADR 0071](../decisions/0071-normal-business-manager-and-callable-boundary.md)、archive・物理削除境界は[ADR 0072](../decisions/0072-transaction-delete-client-trigger-boundary.md)、進捗は[FGAロードマップ](../roadmaps/foundational-governance-alignment.md)

## 確認済み実装事実

1. `components/Operation/Manager.vue`と`components/Operation/ArrayManager.vue`は、`useOperationEditor`を介して予定・実績・請求の作成、編集、削除を`saveOperation` Callableへ送る専用Managerである。FGA-06-RESULT-MANAGER-CLIENT-04では実績詳細の基本情報と作業員明細だけをこの経路から外した。
2. `components/Operation/RowsManager.vue`は、予定・実績・請求の作業員または稼働外売上の行追加・編集・削除・並替えを同じCallableへ送る。実績詳細の作業員は`OperationResultWorkersManager`へ移行したが、稼働外売上は表示・操作・Callable経路を変更していない。
3. 実績詳細の基本情報は`OperationResultManager`／`AirItemManager`、作業員明細は`OperationResultWorkersManager`／`AirArrayManager`から、`OperationResult.update()`の標準client保存へ接続した。作業員追加時だけ同じclient transactionで新規Employee参照を確認する。
4. `functions/shared/operationWriteContract.js`が`create`、`duplicate`、`overview`、`workers`、`articles`、`order`、`delete`、`notify`、`convert`、`agreement`、`adjusted`、`lock`を一つのcommand契約へ集約する。
5. `functions/modules/operations/saveOperation.js`は全commandを一つのFirestore transactionで処理し、Auth identityとUser、現場、従業員参照、期待値を検査する。予定ではSite `scheduleRevision`と配置通知、実績化では予定・通知・実績、請求では取極め・調整・lockを同じ入口で扱う。
6. Firestore Rulesは`SiteOperationSchedules`のclient writeを全面拒否したまま、`OperationResults`では同一tenantの有効な本登録Userによる既存・非lock実績のupdateだけを許可する。create、delete、lock変更、稼働外売上、請求調整、billing version、lifecycle IDのclient変更は拒否する。transaction deleteのclient拒否はADR 0072採用後の既知実装差である。
7. `saveOperation`の実績`overview`・`workers`分岐は旧client互換とrollbackのため残している。実績詳細画面の正規経路からは呼ばれない。稼働外売上、実績作成・複製・物理削除、請求は従来経路を維持する。

## 操作別の予備分類

この表は実装checkpointを選ぶための予備分類であり、client化またはCallable維持を確定しない。特に「技術要件候補」は、現行server処理の存在だけでなく、client transaction・batch・trigger等で満たせない理由を次の設計で確認する。

| 対象 | 現行action | 現行の主な処理 | 予備分類 | 後続で確認する点 |
|---|---|---|---|---|
| 予定 | `create`・`duplicate` | 予定作成、現場参照、表示順、Site revision | 通常CRUD／Air Manager・client化候補 | 表示順競合、Site revisionの必要性、終了現場確認、Rules |
| 予定 | `overview`・`workers`・`order` | 予定document更新、派生値、配置通知取消し、Site revision | 通常CRUDと関連作用の分離候補 | 通常保存をManagerへ戻し、通知取消し等の最小server処理だけを分離できるか |
| 予定 | `delete` | 予定documentと関連通知の物理削除 | client物理削除・Trigger連携 | 予定原本をclient削除へ移し、実績化済み拒否をRules、関連通知の削除をTriggerへ接続する |
| 予定 | `notify` | 配置通知document作成と予定側状態更新 | 技術要件を持つ独立operation候補 | 外部通知との関係、冪等性、再送、複数document atomicity |
| 予定 | `convert` | 通知値を反映した実績作成、予定を実績化済みに更新 | 技術要件を持つ順序依存operation候補 | atomicity、再実行、通知snapshot、結果不明時の復旧 |
| 実績 | `create`・`duplicate` | 実績作成、Site取極めsnapshot | 通常CRUD／Air Manager・client化候補 | 作成を提供する画面、snapshot時点、重複・lock条件 |
| 実績 | `overview`・`workers` | 実績document内の基本情報・作業員更新 | 最初の通常CRUD簡素化候補 | 単数／複数Manager、document LWW、参照検査、downstream trigger、Rules |
| 実績 | `articles` | 実績document内の稼働外売上行更新 | 現状維持・権限仕様未決 | 現行操作を維持し、権限の追加・撤去をこのphaseから推論しない |
| 実績 | `delete` | 実績documentの物理削除 | client物理削除・Trigger連携 | 実績原本をclient削除へ移し、勤怠・請求・履歴・予定・日報等の削除event chainをTriggerに維持する |
| 請求 | `overview`・`articles`・`adjusted` | OperationResults内の請求情報・稼働外売上・手動調整更新 | 現状維持・業務境界確認待ち | 上流menu制御、提供操作、確定後編集、通常CRUDへ分類できる範囲 |
| 請求 | `agreement` | Site取極め選択と請求snapshot再計算 | 技術要件または通常CRUDの確認候補 | snapshot、再計算、最新Site参照をどこが所有するか |
| 請求 | `lock` | 請求対象実績のlock切替 | 状態遷移の確認候補 | lockの意味、解除、他編集との競合、actor仕様 |

## 現時点の不整合

- FGA-06の完了済み2 checkpointはrole依存を緩和したが、専用Operation Manager、Callable、期待値競合、client write全面拒否を維持した。認可緩和の完了記録は有効だが、CRUD簡素化の完了とは扱わない。
- ADR 0069と仕様は当初Air Managerを通常masterへ限定していた。ADR 0071と仕様訂正により通常業務data全般へ適用範囲を広げるが、製品codeは未移行である。
- `saveOperation`は通常CRUD、transaction物理削除、通知、実績化、請求状態遷移を同じAPIへ集約している。transaction物理削除はADR 0072に反してCallableとclient delete拒否Rulesへ残っており、後続では予定・実績のdelete callerをDomain Manager／FireModelへ移し、関連処理をTriggerへ維持する。

## FGA-06-RESULT-MANAGER-CLIENT-04 実装・Dev受入れ結果

lockされていない既存実績の`overview`・`workers`だけを対象に実装した。稼働外売上、実績作成・複製・物理削除、予定、通知、実績化、請求は対象外である。

- listener由来`OperationResult`を単数`OperationResultManager`／`AirItemManager`へ渡し、基本情報をdocument単位last-write-winsで保存する。
- 作業員配列は`OperationResultWorkersManager`／`AirArrayManager`を再利用し、編集後の親`OperationResult`全体を保存する。新たに追加されたEmployeeだけはclient transaction内で存在を確認する。
- Rulesはtenant、active registered User、actor UID、document ID、既存非lock状態、Site・Customer参照を境界とする。未決または専用操作のfieldは同時に開かない。
- 旧画面のカード枠、toolbar、ボタン文言、入力component、760px dialog、lock表示、稼働外売上一覧、物理削除dialogを維持する。固定製品commit `40316475`のsource contract、全domain、Local Emulator、専用UI buildに加え、release commit `138b3a29`のHosting Dev反映と会社管理者・統括によるブラウザ受入れを完了した。[Local検証記録](../verification/fga-06-result-manager-client-local.md)と[Dev受入れ記録](../verification/fga-06-result-manager-client-dev.md)を参照する。

checkpointはDev受入れまで完了した。旧Callableの`overview`・`workers` rollback分岐と、transaction `delete`分岐の撤去は後続の変更単位とする。

## 未確認事項

- Dev受入れ中、従業員・外注先行がある実績の物理削除は会社管理者sessionでも汎用errorとなり、両行を削除した後は成功した。原因は未特定であり、現行単体testが勤務者を持つ実績の削除成功を想定することと一致しない。transaction deleteのclient化では、同条件の再現、Rules、Trigger結果、error経路を対象検証へ含める。
- Prod、migration、既存data全件、Trigger logと派生document全件は確認していない。今回のガバナンス更新自体は製品code、Rules、Functions、data、Dev・Prodを変更しない。
