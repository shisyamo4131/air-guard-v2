# DailyAttendance components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-023、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/DailyAttendance/**` の7ファイル
- 根拠: 対象7ファイル、直接callerの `pages/attendances/index.vue`・`export.vue`、直接data/transform/composable、`DailyAttendance`・`DailyOperationByEmployee` schema、`utils/pageSettings.js`、`firestore.rules`
- 関連: [勤怠一覧・カレンダー](attendance-ui.md)、[勤怠CSV export](attendance-export.md)、[DailyAttendance同期](daily-attendance-sync.md)

## コンポーネント/API表

| ファイル | public contract / 責務 | 状態・副作用 |
| --- | --- | --- |
| `Calendar/index.vue` | `docs`（`DailyAttendance` または `DailyOperationByEmployee` 配列）と `attendanceManagementMode`（既定 `ACTUAL_DATE`）を受け、detail単位のcalendar eventへ変換する。emitsなし。 | `ACTUAL_DATE` は `detail.startAt`、`OPERATION_DATE` は `doc.date` と表示開始時刻からevent開始を作る。event endは設定しない。 |
| `Index/index.vue` | `attendanceManagementMode` を受け、従業員選択、calendar、summary/list/tableを構成する。 | 196pxの従業員listと300pxのsummaryを常設する。クリック詳細・編集・保存は持たない。 |
| `Index/useIndex.js` | `from/to` を月初/月末にし、modeごとのindex dataとstatisticsを選び、`ui` objectを返すFacade。 | 選択employee IDは初期`null`。取得完了後に候補外ならclearするが、自動選択しない。 |
| `Statistics/List/index.vue` | `statistics` objectを受け、日数・明細数・勤務分を表示する。 | emits、保存、副作用なし。 |
| `Statistics/Table/index.vue` | `byShiftType: Map` を受け、既知勤務区分を定義順、未知値を末尾に表示する。 | 0値で補完する。unknown shift typeはraw値を表示する。 |
| `Exporter/index.vue` | `useIndex()`が返す月選択、集計、preview/rejected table、export buttonを描画する。 | props/emitsなし。button clickはFacadeのdownload handlerへ渡す。 |
| `Exporter/useIndex.js` | 対象月のDailyAttendanceを取得し、Employeeを補完して打刻CSV row/rejectionを作る。 | browser downloadを同期呼出しする。ローカルのtry/catch、処理中latch、再試行UIはない。 |

## 入口、権限、データフロー

1. `/attendances` はpageで `useFetch("daily-attendance-index", true)` をprovideし、`Company.attendanceManagementMode` をkey付きで `DailyAttendanceIndex` に渡す。`ACTUAL_DATE` では `DailyAttendances`、`OPERATION_DATE` では `DailyOperationsByEmployee` を月のinclusive rangeでsnapshot取得する。
2. 両modeとも期間内Employeeを取得する。Facadeはcaller UIDによる自己限定をせず、選択用listに取得Employee全員を渡す。選択前はcalendarへ空配列を渡す。
3. `/attendances/export` は別のfetch contextをprovideし、月内DailyAttendanceをsnapshot取得してEmployee IDごとにEmployeeを取得する。CSV rowは `details[].startAt/endAt` とEmployee code/nameから作る。
4. pageSettingsの2 routeは現在 `developer` のみ。`DailyAttendances` 専用Rules matchはなく、Companies配下fallbackではsuper-userだけが直接read/writeできる。このUI表示条件、実際のRules read、承認済みの本人/勤怠管理者アクセス方針は一致していない。

## 時刻・日跨ぎ・集計

- CalendarとCSVは `DailyAttendance.startTime/endTime` を使用しない。calendarはdetailの実DateをJST `HH:mm` にformatし、CSVは有効な `startAt < endAt` detailを日時順に並べて最初/最後を打刻にするため、夜勤の翌日終了を保持する。
- Calendarはevent endを未指定にしており、日跨ぎ期間の帯表示は行わない。表示文字列は開始・終了の時刻だけである。
- `DailyAttendance` の公開aggregate `startTime/endTime` はHH:mmの辞書順min/maxである。混在日勤・夜勤で実日時の最終終了と異なり得る既知問題は [FUT-0037](future-actions.md#fut-0037-dailyattendance開始終了を実日時で集約する) の範囲である。今回確認したcalendar/CSVはそのgetterをconsumerにしない。
- `useDailyAttendanceStatistics` とOperation-date counterpartは、各detailの有限な `totalWorkMinutes` / `breakMinutes` を合算する。summaryの現行表示は勤務分だけで、休憩合計は表示しない。

## loading / error / empty / accessibility

- index dataはDailyAttendance/Employee（またはDailyOperationsByEmployee/Employee）の両snapshot取得をglobal loading queueへ連携し、scope disposeでkeyを除去する。一方、fetch errorはdata layerでloggerへ記録され、componentへ専用error stateとしては渡らない。
- 月を速く切替えると古いsnapshot responseが後から反映する可能性、失敗後に以前のdocsが残る可能性は既存 [FUT-0130](future-actions.md#fut-0130-勤怠月次snapshot取得の競合失敗stateを制御する) の根拠に一致する。
- emptyはindexの「従業員が未選択又は勤怠情報がない」表示、exporterのrow 0件disabledで扱う。exporter buttonのloading/disabledはEmployee補完のloadingとrow有無だけで、DailyAttendance取得中またはbrowser download中を表さない。
- 対象コンポーネントにdialog詳細、keyboard shortcut、calendar eventのfocus/aria説明は確認できない。responsive/詳細表示の要求未確定と合わせ [FUT-0131](future-actions.md#fut-0131-勤怠閲覧のresponsive詳細accessibility契約を整備する) で扱う。

## 確認済み整合・未使用候補

- `Index/useIndex.js` の`employeeSelect`設定は作られるが、そのAutocomplete templateはコメントアウトされている。現行選択入口はlistだけである。設定objectは未到達候補であり、機能差は静的確認のみである。
- `DailyAttendance.details` がworkers全体をIDだけでfilterする実装は、従業員と外注のID衝突時に外注明細を含め得る。calendar、統計、CSVが同じdetailsを使うため、これは既存 [FUT-0036](future-actions.md#fut-0036-dailyattendance詳細を従業員明細だけに限定する) の到達根拠を追加する。
- 対象7ファイル、直接caller、`createAttendancePunchRows` / CSV utilityに対応するテストはrepository検索で見つからなかった。runtime/実CSV/Rules評価は未実施である。

## 将来要対応・未確認

- 本人用projection/Callableと勤怠管理者read、Functions-only writeは承認済み方針だが、対象componentはその境界をまだ実装しない（FUT-0039）。
- freee勤怠管理Plusとの実取込、CSVのbrowser download失敗・多重click、format互換性は未検証（FUT-0040）。
- 勤怠の手動訂正・休暇入力・詳細表示の実装は対象外で、現UIには存在しない。
