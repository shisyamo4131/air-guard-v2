# Worker / drag components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-024、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/Draggable/**`、`components/Worker/**`、`components/Workers/**` の14ファイル
- 根拠: 対象14ファイル、直接callerの `components/Arrangements/Manager/**`、`components/SiteOperationSchedule/{Table,Worker/Tag}/**`、`components/OperationResult/Workers/Manager/**`、`components/SiteShiftTypeOrder/ReorderForm/**`、直接schemaの `SiteOperationSchedule`・`ArrangementNotification`
- 関連: [稼働予定](site-operation-schedule.md)、[配置通知](arrangement-notifications.md)、[配置通知UI](arrangement-notification-ui.md)、[表示順](site-ordering.md)

## コンポーネント/API表

| ファイル | public contract / 責務 | 保存・失敗境界 |
| --- | --- | --- |
| `Worker/Chip.vue` | required `worker: Object`を受け、`worker.isEmployee`でEmployee/Outsourcer cacheを選び表示名をchipへ渡す。 | `useFetch("WorkerChip")`をinjectするだけでfetchを開始しない。見つからないnameは`N/A`、error/loading表示・競合防止は持たない。 |
| `Worker/Tag/{props,useIndex,index}.vue` | required `isEmployee`・`id`、任意start/end/highlightと`click:remove`を公開するWorker表示wrapper。 | `id`を`docId`へ、Date時刻をglobal timezoneの`HH:mm`へ変換してEmployeeTag/OutsourcerTagへ渡す。identity整合性・保存・role判定は持たない。 |
| `Workers/Table/{index,Tr}.vue` | `OperationDetail[]`と`ArrangementNotification[]`をworker ID/schedule IDで結び、勤務表の行を描画する。 | 実時刻/休憩/残業はnotificationが`isLeaved`のときだけ採用し、それ以前は予定値を表示する。資格はstatusを問わずnotification値を優先する。 |
| `Workers/DataTable/{useIndex,index,OjtIcon}.vue` | `$attrs`のitemsを`air-data-table`へ透過し、worker名、時刻、休憩、勤務時間、資格/OJT iconを表示する。 | fetch/saveなし。raw `item.id`をcache keyに使い、name未取得は`N/A`。OJT iconはtext/accessible nameを追加しない。 |
| `Draggable/Workers/{useIndex,index}.vue` | `SiteOperationSchedule` instanceのworkersを`vuedraggable`で追加・移動・削除し、`update:modelValue`をemitする。 | `schedule.isEditable`または`disabled`なら無効。内部mutation後の保存は親へ委ね、catchした例外はloggerのみで元modelへrollback/rejectしない。 |
| `Draggable/OperationSchedules/{useIndex,index}.vue` | schedule配列をdisplayOrder順に並べ、drag後の配列を`update:schedules`で親へemitする。 | 永続化、loading latch、例外処理、rollback、displayOrder再採番は持たない。 |
| `Draggable/SiteShiftTypeOrder/index.vue` | `itemKey`（既定`key`）とattrs/slotをそのまま`vuedraggable`へ渡す薄いwrapper。 | emitsやpermissionを定義せず、ReorderFormの`v-model` draftと親submit処理に委ねる。 |

## identity・資格/OJT・予定/実績の表示契約

- Schedule workerの同一性は従業員なら`workerId=id`、外注なら`workerId=id:index`である。ArrangementNotificationのdoc IDも`{scheduleId}_{workerId}`で、同一外注会社の複数要員をindexで区別する。
- WorkerTag/Chip/DataTableは表示名取得をraw `id`と`isEmployee`で分岐する。TableのVue keyだけは`worker.id`であり、EmployeeとOutsourcerに同じraw IDがある場合、同一table内でkeyが衝突し得る。`workerId`は行結合とschedule mutationに用いる。
- WorkersTableは通知を`workerId`と`siteOperationScheduleId`で選び、LEAVEDならactual start/end/break/overtimeを、未LEAVEDならschedule値を表示する。qualificationは通知が存在するだけでnotification値を表示する。この時間と資格の採用条件の違いは実装事実であり、業務上の表示意図は未確認である。
- `SiteOperationSchedule/Worker/Tag` callerはnotificationがあればstatusを確認せずactual start/endを渡す。そのため、同じ未LEAVED notificationでもCard tagとWorkersTableで時刻が異なり得る。actual datetime自体の計算欠陥は既存 [FUT-0022](future-actions.md#fut-0022-arrangementnotificationの実勤務日時休憩計算を修正する) の範囲である。
- DataTableのOJTは`isOjt`だけをicon化し、資格/OJTの編集、期限、人数充足、課金計算を行わない。これらは親model/schemaの責務である。

## drag・更新・失敗時のフロー

1. Arrangements Managerはschedule cardのslot propsをDraggableWorkersへ渡す。dropの追加は`element.id/isEmployee`、移動・削除は`workerId/isEmployee`でinternal `SiteOperationSchedule` instanceを変更する。
2. external employee dropは`workerId`重複をpre-checkし、外注dropはpre-checkせずmodel `addWorker`へ渡す。model側は同一workerIdを拒否する。roleを跨ぐmoveはemployeesが先、outsourcersが後という配列規則でrejectする。
3. 成功時だけcomponentがclone済みscheduleを`update:modelValue`へemitし、親actionが`updateSchedule(s)`へ渡す。component自身はFirestore write、transaction、permission check、再fetchをしない。
4. model mutation例外はloggerへ記録して吸収する。emit error、error banner、元propsへの明示rollback、親へのretry指示はない。外部drag libraryのDOM復元と、次のprops/subscription更新だけに依存する。
5. schedule配列dragは並び替えた配列を直ちにemitするだけで、保存中のdisable、single-flight、rollback、version/preconditionを持たない。SiteShiftTypeOrderも同じくdraft配列をemitする薄いwrapperである。

`SiteOperationSchedule.isEditable`は`operationResultId`がないことだけを表す。componentのdisableはこのclient modelに依存し、Rules上のfield/tenant/role強制を代替しない。親UIのdraggable/removable可否もslot propsから来るため、対象14ファイル単独では具体的permissionを決めない。

## caller・loading/error・accessibility

- 直接callerは配置管理のschedule card、稼働予定table、OperationResult worker manager、SiteShiftTypeOrder ReorderForm、ArrangementNotification managerのworker表示である。Worker DataTableのOperationResult managerはworker defaultを組み立てるが、保存permissionやloadingは外側managerに委譲する。
- `WorkersTable`は`<table>`のcaptionやrow操作を持たず、WorkerTagのremove、OjtIcon、drag handleに固有のaria label/keyboard drag代替は対象ファイルでは確認できない。共通accessibility課題は [FUT-0115](future-actions.md#fut-0115-共通icon操作とdrag-uiのaccessibilityを整備する) に統合する。
- `Worker/Chip`の全worker object watchと各表示componentのcache参照にはfetch失敗state、subscription cleanup、遅い応答の世代管理がない。runtimeでのstale表示・leakは未確認である。
- target14ファイルと直接callerの対応テストはrepository静的検索で見つからなかった。drag libraryのkeyboard behavior、DOM rollback、Rules評価、実データを使う検証は未実施である。

## 確認済み整合・将来要対応

- schedule dragとSiteShiftTypeOrderの競合、保存失敗時に画面だけが更新済みになり得る点は [FUT-0071](future-actions.md#fut-0071-schedule-displayordersiteshifttypeorder同時編集を競合安全にする) へ証拠を追加する。
- notification/schedule mutationのerror吸収、subscription後の再fetch/rollback欠如は [FUT-0073](future-actions.md#fut-0073-schedule通知flagcascade失敗復旧を保証する) のUI到達根拠に追加する。
- raw ID key衝突は現行のemployee-only集約問題とは別の表示上の候補であり、外注個人の不安定な`id:index` identityを含め [FUT-0086](future-actions.md#fut-0086-外注会社と外注警備員個人のデータモデルを決定する) の影響範囲に留める。全ID namespace変更を再提案するものではない。
