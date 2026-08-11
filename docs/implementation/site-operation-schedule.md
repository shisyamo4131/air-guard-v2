# SiteOperationSchedule（現場稼働予定）実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-023
- 最終確認日: 2026-08-11（SPEC-DEEP-015で配置管理component本文、SPEC-DEEP-031でOperationSchedules component本文を再確認）
- 根拠ファイル: `pages/operation-schedules/index.vue`、`components/SiteOperationSchedule/**`、`components/SiteOperationSchedules/**`、`components/Arrangements/Manager/useIndex.js`、`composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js`、`useSiteOperationScheduleDuplicator.js`、range data layer、`firestore.rules`、schemas `SiteOperationSchedule.js`、`SiteOperationScheduleDetail.js`、直接のArrangementNotification/OperationResult境界

## 入口・権限

Schedule/Arrangement 2pageの公開契約とresponsive・manager委譲境界のfile単位確認は[Operation・Schedule・Billing pages deep review](operation-schedule-billing-pages-deep-review.md)を、`components/OperationSchedules/**` 11 filesのtable/row action、range、order dialog、accessibilityの公開契約は[OperationSchedules components deep review](operation-schedules-components-deep-review.md)を参照する。

- `/operation-schedules`は`site-operation-schedules:read`で表示し、予定管理managerを提供する。`/arrangements-manager`と上下番確定も同じread権限を使う。
- calendar/配置管理から作成・編集・削除・worker並べ替え・通知・複製へ到達する。write/delete/notify別のUI権限はない。
- Rulesは`Companies/{companyId}/SiteOperationSchedules/{docId}`について同一会社認証Userまたはsuper-userへ全read/writeを許す。field、操作、status、参照先の検証はない。

## データ契約

- pathは会社prefix配下の`SiteOperationSchedules/{docId}`。自動採番を使わない通常Firestore生成IDで、logical deleteは設定されていない。
- Operation由来: `siteId`、`securityType`、`dateAt/date`、`shiftType`、開始/終了時刻、翌日開始、休憩、必要人数、資格要否、作業内容、備考、employees、outsourcers。
- 固有field: `operationResultId`、`displayOrder`（default 0）、`dayType`、`regulationWorkMinutes`。後3つの一部はhidden。
- worker detailはid、index、isEmployee、amount=1、siteId、勤務日時・休憩・規定時間、isQualified、isOjt、siteOperationScheduleId、hasNotificationを持つ。
- 外注workerIdは`${id}:${index}`、従業員workerIdはid。notificationKeyは`${scheduleId}_${workerId}`。
- 読み取り専用プロパティ/ゲッター: startAt/endAt、日跨ぎ、勤務日、実働/残業、employeeIds/outsourcerIds、人数、OJT除外assignedPersonnelCount、不足/超過、workers、groupKey=`siteId_shiftType_date`、agreementKey、orderKey、isEditable、isNotifiedAllWorkers等。
- docId、siteId、shiftType、時間・休憩・規定時間等の親変更はworker detailへ同期する。

## CRUD・validation

- createは同一siteId/shiftType/dateの最大displayOrderをqueryし、+1して作成する。同groupの複数予定は許容され、displayOrderで順序を表す。
- 基本入力はSite、日付、勤務区分、開始/終了、翌日開始、休憩、規定実働、必要人数、資格要否、作業内容、備考。
- Site存在、status、仮登録の検証は通常create/updateの直接経路では確認できず、仮登録拒否はOperationResult同期時に行う。
- worker配列は従業員/外注を分け、同じ配列内のworkerId重複を追加methodで拒否する。OJTはassignedPersonnelCountから除外し、資格要否は表示/flagだが、資格者人数の充足をschemaで強制する処理は直接確認できない。
- operationResultIdが更新前dataにあればschemaのupdate/deleteを拒否し、managerもbuttonをdisableする。
- 複数予定のdrag/order更新はsiteId/shiftType/date/displayOrderを正規化し、1 transaction内で各schedule.updateを呼ぶ。

## worker・outsourcer

- employeesとoutsourcersはいずれも個別の勤務時刻、休憩、資格、OJTを保持する。親scheduleの共通値変更時に各detailへ同期される。
- requiredPersonnelとの過不足判定はOJTを除くemployees+outsourcersの人数で行う。各detailのamountは1固定。
- worker追加・削除・順序/属性変更はcardの楽観的modelを更新後、application composableがschedule.updateする。
- application composableはupdate errorをloggerへ記録して吸収し、呼出し元へthrowしない。subscription再取得まで画面内instanceとの一致が保証されるかは未確認。

## 通知・実績連携

- `notify(shouldNotify=true)`はhasNotification=falseのworkerだけからArrangementNotificationを作成し、全worker flagをtrueにして、通知作成とschedule更新を同一transactionで行う。workerなしでは`every([])=true`となりUI通知buttonはdisabled。
- `shouldNotify=false`でもArrangementNotification documentは作るが外部pushを抑止する。通常画面actionは引数なしでtrue。
- scheduleのsite/date/shift/time/休憩/規定時間変更は関連通知を全削除し全flagをfalseへ戻す。worker削除・時間/資格/OJT変更は対象worker notificationを削除しflagを戻す。これらはschedule更新と同一transaction。
- schedule削除は関連ArrangementNotification全削除とschedule削除を同一transactionで行う。
- `syncToOperationResult`は通知のactual time/break/翌日開始/資格/OJTをworkerへ反映し、scheduleと同じdocIdでOperationResultをcreateし、schedule.operationResultId設定を同一transactionで保存する。
- OperationResult存在後はscheduleを編集・削除不可とする。OperationResult削除側がoperationResultIdをnullへ戻す境界は既調査事項で、本節では内部を再調査していない。

## 検索・表示

- range data layerはdateAtのfrom/toでlive購読し、Site、Employee、OutsourcerをIDから取得する。docId Mapで購読結果を重複排除する。
- calendar eventは必要人数・作業内容を名称にし、日勤orange、夜勤indigo、実績作成済みgrey。日跨ぎ多重描画回避のためstart/endともdateAtを渡し、正確な時間幅はcalendar上に表現しない。
- 配置管理ではsiteId/shiftType/dateのgroupとdisplayOrderを使い、cardで不足/超過、worker、通知・複製・編集操作を表示する。

## 削除・変更

- logical archive/status/終了fieldはない。OperationResult未作成なら過去・当日・未来を区別せず更新・削除できる。
- 更新による通知削除は、基本条件変更なら全worker、worker固有変更なら該当workerを対象にする。追加workerは未通知のまま残り、次のnotify対象となる。
- 複製は元日を除外し、入力日重複を除去し、最大20日まで同一transactionで新規作成する。新docId、operationResultId=null、全worker hasNotification=falseとする。
- 複製先に同一site/date/shiftの予定があっても拒否せず別displayOrderとして追加する。
- `/operation-schedules`のTableはrow add/remove eventを公開するが、通常Managerは両eventをlistenしないためiconは無作用である。Selector/toolbarのcreateは別経路である（FUT-0176）。

## Rules・tenant境界

- path companyIdだけが通常Userのtenant境界。document内siteId、employee/outsourcer ID、通知・実績IDが同一会社に属することはRulesで検証しない。
- operationResultId lock、通知flag、worker field、displayOrder、日付・時間validation、cascade deleteはclient schema/method依存で、直接writeから迂回できる。
- ArrangementNotification/OperationResultは別Rules境界を持つが、schedule methodのtransactionはclient権限で各documentを書き込む。

## 失敗・並行性

- update/delete/notify/syncToOperationResult/duplicateの複数document作用はtransaction化され、Firestore commit単位の部分成功は避ける設計。
- createの最大displayOrder queryはcreate transactionの外側で実行されるため、同一group同時作成で同じdisplayOrderを採番し得る。
- updateは失敗時にcloneからinstanceを戻すが、transaction中のsnapshot再購読で_beforeDataが変化し、notifyのコメントはrollbackできない場合を明記する。
- application actionのnotify/update/updateSchedulesはerrorをloggerへ記録して吸収するため、上位が成功/失敗を戻り値で判定できない。
- direct Rule write、別clientの同時編集、同じworkerへの同時notify、drag更新と個別更新の競合検出/version checkはない。

## 矛盾・未使用候補

- read権限だけでwrite/delete/notifyへ到達し、Rulesも全writeを許す。
- operationResultIdによるlockはclient document値依存で、Rulesから解除・迂回可能。
- displayOrder採番は同時作成に非atomicで重複し得る。
- scheduleOrderのreorder actionはlocal Company配列を先に置換し、errorを吸収する。dialogはresolved returnで閉じるため、Company update失敗時のrollback/refetchがない。
- calendar eventは勤務時刻ではなくdateAtの点表示で、日跨ぎ・時間帯を正確に表さない（意図的workaround）。
- notify/update失敗時のinstance rollback不能がschema commentで既知。
- 複製buttonはisEditableに関係なく有効で、実績作成済みscheduleも複製可能。複製先はoperationResultIdをclearするため実装上は到達可能。
- deprecated `isNotificatedAllWorkers`が互換用に残る。

## 将来要対応

- FUT-0070: Schedule操作権限とRules整合を正式化する。
- FUT-0071: displayOrder・同時編集を競合安全にする。
- FUT-0072: OperationResult lockをRules/serverで強制する。
- FUT-0073: 通知flag・cascade・失敗復旧を保証する。
- FUT-0074: 複製・過去予定・worker充足の業務validationを確定する。
- Worker表示・drag componentのfile単位契約、identity、parent persistence境界は[Worker / drag components deep review](worker-drag-components-deep-review.md)を参照する。
- 配置管理componentの期間集計、drag transaction境界、SpeedDial到達性は[ArrangementsManager components deep review](arrangements-manager-components-deep-review.md)を参照する。

## 要確認事項

- CONF-0056〜CONF-0060を`pending-confirmations.md`へ登録した。

## 未確認範囲

- ArrangementNotification/OperationResult内部、OperationResult削除からschedule unlockの詳細。
- worker選択UIの全候補制約、従業員の重複勤務検知、calendar library挙動、security report。
- Rules/Emulator/ブラウザ/実データ、transaction retry時の実測、必要index。
