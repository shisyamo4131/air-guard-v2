# SiteOperationSchedule（現場稼働予定）実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-023、SPEC-DEEP-036、SPEC-DEEP-037、SPEC-DEEP-038、SPEC-DEEP-039b、SPEC-DEEP-041
- 最終確認日: 2026-09-12（FGA-06-SCHEDULE-NORMAL-AUTH-01で正式保存境界とactor条件を再確認）
- 根拠ファイル: `functions/apis/saveOperation.js`、`functions/modules/operations/saveOperation.js`、`functions/shared/operationWriteContract.js`、`utils/auth/policies/operationActorPolicy.js`、`composables/application/operation/**`、`composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js`、`firestore.rules`、関連domain／Local Emulator test

## 入口・権限

Schedule/Arrangement 2pageの公開契約とresponsive・manager委譲境界のfile単位確認は[Operation・Schedule・Billing pages deep review](operation-schedule-billing-pages-deep-review.md)を、`components/OperationSchedules/**` 11 filesのtable/row action、range、order dialog、accessibilityの公開契約は[OperationSchedules components deep review](operation-schedules-components-deep-review.md)を参照する。

- `/operation-schedules`は`site-operation-schedules:read`で表示し、予定管理managerを提供する。`/arrangements-manager`と上下番確定も同じread権限を使う。画面・route・buttonのrole差はUXとして維持する。
- calendar／配置管理から作成・編集・削除・worker並べ替え・通知・複製へ到達する。正式保存は`saveOperation` Callableへ集約され、Firestore Rulesは`SiteOperationSchedules`のclient writeを拒否する。
- FGA-06-SCHEDULE-NORMAL-AUTH-01では、現場稼働予定の`create`、`duplicate`、`overview`、`workers`、`order`、`delete`だけを、同一tenantの有効な本登録Userへrole非依存で許可する。`notify`、`convert`、OperationResult、billingは現行actor条件を維持する。複数commandの一件でも許可されなければtransaction開始時に全体を拒否する。

## データ契約

- pathは会社prefix配下の`SiteOperationSchedules/{docId}`。自動採番を使わない通常Firestore生成IDで、logical deleteは設定されていない。
- Operation由来: `siteId`、`securityType`、`dateAt/date`、`shiftType`、開始/終了時刻、翌日開始、休憩、必要人数、資格要否、作業内容、備考、employees、outsourcers。
- 固有field: `operationResultId`、`displayOrder`（default 0）、`dayType`、`regulationWorkMinutes`。後3つの一部はhidden。
- worker detailはid、index、isEmployee、amount=1、siteId、勤務日時・休憩・規定時間、isQualified、isOjt、siteOperationScheduleId、hasNotificationを持つ。
- 外注workerIdは`${id}:${index}`、従業員workerIdはid。notificationKeyは`${scheduleId}_${workerId}`。
- 読み取り専用プロパティ/ゲッター: startAt/endAt、日跨ぎ、勤務日、実働/残業、employeeIds/outsourcerIds、人数、OJT除外assignedPersonnelCount、不足/超過、workers、groupKey=`siteId_shiftType_date`、agreementKey、orderKey、isEditable、isNotifiedAllWorkers等。
- docId、siteId、shiftType、時間・休憩・規定時間等の親変更はworker detailへ同期する。

## CRUD・validation

- createとduplicateは`saveOperation` transaction内で同一siteId/shiftType/dateの最大displayOrderをqueryし、+1して作成する。同groupの複数予定は許容され、displayOrderで順序を表す。
- 基本入力はSite、日付、勤務区分、開始/終了、翌日開始、休憩、規定実働、必要人数、資格要否、作業内容、備考。
- create、duplicate、Siteまたは日付を変えるupdateはlive Siteの存在・状態と`Site.scheduleRevision`を同じtransactionで確認・更新する。実績化済み予定のupdate/deleteはserverで拒否する。
- worker配列は従業員/外注を分け、同じ配列内のworkerId重複を追加methodで拒否する。OJTはassignedPersonnelCountから除外し、資格要否は表示/flagだが、資格者人数の充足をschemaで強制する処理は直接確認できない。
- operationResultIdが更新前dataにあればschemaのupdate/deleteを拒否し、managerもbuttonをdisableする。
- 複数予定のdrag/order更新は`saveOperation`へ複数`order` commandを渡し、1 transaction内で保存する。

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

- Callableは受理されたAuth token、確認済みemail、現在のAuth account、同一tenantの有効な本登録Userを確認する。現場稼働予定C/U/Dではroleをallow条件にせず、通知作成・実績化・OperationResult・billingでは現行role条件を維持する。
- `SiteOperationSchedules`と`OperationResults`のclient writeはRulesで拒否し、Admin SDKを使う`saveOperation`が正式保存境界となる。対象Site・追加Employee・通知・実績等の参照と整合性はtransaction内で確認する。

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

## effective worker・Card・CustomInput追加確認（SPEC-DEEP-036）

- `effectiveWorker`は通知側の`false`をnullish fallbackで保持し、実効OJTは0人、従業員は1人、外注amountは有限非負値だけを採用する。null/空白/不正値は1、数値・文字列の0は0として扱う。通知側のoverride対象は`isOjt`等で、外注amountはschedule worker値だけを読む。
- Cardの不足/超過iconはcallerが渡す実効配置人数を使えるが、必要人数avatarの色は常に`schedule.isPersonnelShortage/isPersonnelSurplus`を使う。同じcard内で通知反映後のiconとschedule元値のavatar色が食い違い得る。時間labelは開始・終了だけで翌日表示を持たない。
- Cardは親scheduleを内部instanceへdeep watchで再初期化し、slot更新値をそのまま`update:schedule`へemitする。保存失敗はapplication actionが吸収し、version/dirty conflict/rollbackはこのcomponentにない。実績作成済みでも複製と警備日報actionは有効で、通知・編集だけが`isEditable`に従う。
- CustomInputのSite変更watchは変更時点の`cachedSites`だけを同期参照し、未cacheならfetch完了を待たず、旧securityTypeをclearしない。後からcacheが埋まってもwatchは再実行されないため、別SiteのsecurityTypeを保持し得る。`useDefaults`のcomponent名は`OperationResultCustomInput`で、Schedule用default namespaceと一致しない。

## Duplicator・ListItem・Manager・Selector・Table追加確認（SPEC-DEEP-037）

- DuplicatorはAirItemManagerのcreate/update/delete入口をそのまま公開し、複製日配列をVDatePickerからemitするだけで、件数・重複・元日・権限・lockはcomponent内で検査しない。制約はcaller/schemaへ委譲される。
- ListItemの「配置人数」は`workers.length`で、OJT除外や外注amountを反映する実効配置人数と一致しない。必要人数判定と同じ予定を別componentで異なる人数として表示し得る。
- Managerは`operationResultId`付き予定をdisableUpdate/deleteへ渡すが、Air managerはdisable error後もcallbackを続けるため操作guardにならない。親docのdeep更新はinternalDocを再初期化し、開いているdraftとのversion/conflict契約を持たない。
- Selectorはnullを含む`siteId`変更ごとにfetchを呼び、missing/失敗時はIDまたはloading表示へ畳み込む。編集・複製・新規作成buttonにpermission、`isEditable`、loading、single-flightがなく、row keyはindexである。`prepend-list-item`、`list-item-title`、`list-item-subtitle` slotを子へ渡そうとするが、ListItem側はappendしか公開しないため3 slotは到達しない。
- TableのcommentはcacheにSiteがなければ仮登録扱いとするが、実装はoptional accessの`undefined`をfalse扱いし、通常branchの`loading...`へ進む。missing、permission failure、fetch中、実際の仮登録を明示的な状態として分離しない。

## Worker Tag・Detail Manager・Calendar追加確認（SPEC-DEEP-038）

- Worker Tagは資格・OJTについて通知側の`false`も保持するnullish resolverを使い、OJT iconと連勤警告にaccessible nameを付ける。一方、表示時刻は`actualStartTime || worker.startTime`、`actualEndTime || worker.endTime`で解決し、空文字を明示値ではなく予定値fallbackとして扱うため、共有propertyのnullish優先契約と一致しない。
- Tagの編集・削除・drag・通知操作は`schedule.isEditable`へ従うが、これはclient instance上の表示guardである。`schedule`と`worker` propにはschema instance validatorがなく、公開eventもactor・tenantを検証しない。
- WorkerDetailManagerは公開`toCreate/toUpdate/toDelete`からschedule lockを再検査せず、先に`internalSchedule`へworkerを追加・変更・削除してからfull updateする。update失敗時の明示rollback/refetchがなく、loading解除だけを保証する。下位Air managerのdisable/single-flight問題も継承する。
- Detail CustomInputは時刻、翌日開始、休憩、資格、OJTを編集するが、`disabled`を独立propとして強制せず生成attrsへ依存する。AirTimePickerInputのattr routing問題によりreadonly/disabledが実入力へ届かない可能性がある。
- SiteOperationSchedules Calendarは親値をlocal refへ同期し、month rangeとevent itemをemitする。Managerは各docの`toEvent()`を無条件実行し、operationResultId付き予定のupdate/deleteをAir managerのdisableへ委譲するため、公開method経路ではlock guardにならない。現場詳細pageは`sites:read`だけで同ManagerのCRUDへ到達する。

## root schedule composables追加確認（SPEC-DEEP-039b）

- `useSetRegularTime`は選択siteIdがあっても`useFetch` cache未準備・取得失敗なら「現場を指定してください」と表示し、fetchをawaitしない。valid Agreementのcallbackもawaitしないため、将来async callbackへ変わると完了・error契約がずれる。
- `useSiteOperationScheduleDuplicator._duplicate`はschema duplicate errorをcatchしてrethrowしない。Air managerのhandleUpdateはfulfilledと認識し、失敗でもsuccess emit/quitへ進み得る。default disableSubmitは0/21件をUI抑止するが、manager公開submitはdisableを内部強制しない。
- current OperationSchedules Managerのtable/selector wrappersは値をattrsへ写すだけでactor/permission/versionを追加しない。selectorはgroupKey/date/site/shiftを無検証で受け、missing groupをempty dialogとして開く。

## schedule index transform追加確認（SPEC-DEEP-041）

- groupKey indexは同一keyの全scheduleを保持し、件数・複数判定・必要人数合計を返す。`requiredPersonnel`の型/有限性を検査しないため、undefinedで`NaN`、stringで連結値になり得る。missing groupKeyも同じ`undefined` entryへ集約される。
- orderKey indexは`requiredPersonnel: 0`をentryへ定義するが加算しない。現callerはorderの存在判定だけに使うため直接表示影響はないが、公開shape/commentの不一致であり未使用field候補である。
- `returnEmptyEntry=true`のmissing getは毎回新しい空objectを返す。callerがこれを編集してもMapへ保存されない。indexはread-only viewとして扱う必要がある。
