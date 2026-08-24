# 勤怠一覧・カレンダー表示の実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-038、SPEC-DEEP-011、SPEC-DEEP-023、SPEC-DEEP-040、SPEC-DEEP-041、SPEC-DEEP-043
- 最終確認日: 2026-08-12
- 2026-08-11のSPEC-DEEP-023で対象7 componentsをfile単位で再精査した。component API、detail実日時表示、mode別snapshot取得、選択・empty/loading、CSV入口との境界は [DailyAttendance components deep review](daily-attendance-components-deep-review.md) を参照する。
- 根拠ファイル: `pages/attendances/index.vue`、`components/DailyAttendance/Index/index.vue`、`components/DailyAttendance/Index/useIndex.js`、`components/DailyAttendance/Calendar/index.vue`、`components/DailyAttendance/Statistics/List/index.vue`、`components/DailyAttendance/Statistics/Table/index.vue`、`composables/application/dailyAttendance/useDailyAttendanceIndexData.js`、`composables/dataLayers/dailyAttendance/useDailyAttendancesInRange.js`、`composables/dataLayers/employee/useEmployeesInRange.js`、`composables/transforms/useDailyAttendanceStatistics.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/DailyAttendance.js`
- 関連調査: `daily-attendance-sync.md`、`attendance-export.md`、`page-access.md`

## 確認済み方針

- DailyAttendanceは従業員の日次勤怠であり、将来は振替休日、代休、休暇等を扱う可能性がある。
- 将来、認証Userへ読書きを許可する可能性はあるが、現時点のアクセス制御は仮実装・未確定仕様である。Admin専用、super-user修復可のいずれも確定していない。
- 本書は現在の表示実装を記録するもので、将来の権限・勤怠訂正workflowを確定しない。
- `startTime`/`endTime`のpublic contractは維持し、getter内部だけdetail.startAt/endAtのDate比較へ修正して最早開始・最終終了をHH:mmで返す。画面が直接使うdetail日時契約は変更しない。
- 集約由来の勤務明細・時刻はFunctions-only writeとする。本人は自己勤怠、勤怠管理者は同一会社の勤怠をreadする。休暇・振替休日・代休は別application/eventで本人create/cancel、管理者approve/rejectとし、承認結果を勤怠表示・集約へ反映する。訂正とsuper-user修復は監査付きserver processに限定する。

## 入口・権限

Attendance 2pageのroute、mode、self/manager、表示・export境界のfile単位確認は[Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)を参照する。

| 項目 | 現在の実装事実 |
| --- | --- |
| route | `/attendances`。`pages/attendances/index.vue`だけが対象。`/attendances/export`は本調査対象外。 |
| pageSettings | `/attendances`は`DEVELOPER` access policyを参照し、pathなしの`attendances` groupはアクセス可能な子から表示を導出する。暫定実装である。 |
| data取得 | pageで`useFetch("daily-attendance-index", true)`を起点としてprovideする。 |
| 表示mode | `Company.attendanceManagementMode`を子へ渡し、値をcomponent keyにも使うためmode変更時は一覧componentが再生成される。 |
| Rules | `DailyAttendances`専用matchはない。通常の同社認証Userにはfallbackでread/writeが許可されず、super-user fallbackとAdmin SDKは別境界である。 |

UIの`developer` role判定とFirestore Rulesのsuper-user判定は同じ条件であると確認できない。したがって、route表示可能なdeveloperがDailyAttendancesを実際に取得できることは静的調査だけでは保証されない。

## 抽出・データフロー

1. `useIndex`が当月の開始日・終了日を作る。
2. `attendanceManagementMode`が`ACTUAL_DATE`なら`useDailyAttendanceIndexData`、`OPERATION_DATE`ならDailyOperationByEmployee系data layerを選ぶ。
3. ACTUAL_DATEではDailyAttendancesと期間内Employeesをparallel取得する。現在の画面はsnapshot取得を使い、realtime subscriptionは使わない。
4. 従業員一覧から1人を選び、`employeeId`一致で対象documentをfilterする。初期選択はnullで、従業員を選ぶまでcalendarは空である。
5. 月変更でdate rangeが変わり、DailyAttendanceとEmployeeを再取得する。取得完了後、選択中employeeが候補外なら選択をclearする。
6. filter済みdocumentsをCalendarと集計composableへ渡す。

抽出期間は`dateAt`のfrom/to inclusive queryである。employeeの候補取得契約は期間内Employee data layerへ委譲されている。

## 表示mapping

| 表示 | 値源・計算 |
| --- | --- |
| 従業員list | Employee `fullName`、subtitleに`code`。 |
| calendar event | 各DailyAttendance `details`をflattenし、`detail.startAt`/`detail.endAt`をAsia/Tokyoの`HH:mm`へformatして`開始 - 終了`と表示する。 |
| event日付 | ACTUAL_DATEは`detail.startAt`。OPERATION_DATEは`doc.date + startTime`をAsia/Tokyo日時へ再構築する。 |
| attendance日数 | `DailyAttendance.isAttended`がtrueのdocument数。 |
| 稼働件数 | detail数。 |
| 実勤務時間 | 各`detail.totalWorkMinutes`の合計。 |
| 勤務区分別 | shiftTypeごとに日数、件数、実勤務時間を集計。同一日・同一shiftTypeの日数はSetで1日と数える。未知shiftTypeも追加表示する。 |
| export不可警告 | ACTUAL_DATEで`unexportableAttendanceCount > 0`のとき件数を表示する。 |

集計composableは`detail.totalBreakMinutes`も内部集計するが、現在の一覧summaryは休憩合計を表示しない。DailyAttendanceのaggregate `startTime`、`endTime`、`breakMinutes`も現在のcalendar・summary表示には使われない。

## 手動操作

- 実在する操作は月変更、従業員選択、表示modeに応じた閲覧だけである。
- calendar event click、詳細dialog、DailyAttendanceのcreate/edit/delete、時刻・休憩の訂正、振替休日・代休・休暇・holiday・adjustmentの登録操作は存在しない。
- 保存処理はなく、現在のDailyAttendanceはOperationResult同期で生成されたread-only表示として扱われる。同期契約は`daily-attendance-sync.md`を参照する。
- 従業員selectの一部markupはcomment outされているが、一覧selection自体はlist component経由で機能する。

## 日跨ぎ・複数実績

- calendarはaggregate `startTime`/`endTime`ではなく、各detailの実日時`startAt`/`endAt`から表示時刻を決める。このため、同日08:00-17:00、夜勤22:00-翌05:00、同日複数実績のいずれも各detailの開始・終了時刻は実日時に基づく。
- eventの`end`を意図的に渡していないため、日跨ぎeventを翌日まで連続block表示せず、開始日の`22:00 - 05:00`のようなlabelとして表示する。
- 同日複数実績はdetailごとに複数eventとなり、実勤務時間は各detailの合計である。複数実績間の空き時間は本画面では休憩として可視化しない。
- FUT-0037のaggregate HH:mm辞書順問題は、確認済みのcalendar経路には到達しない。

## state・error・responsive

- DailyAttendance/Employeeのcombined loadingをglobal loading queueへ連携する。
- 未選択時・対象なしは空表示文言を出す。一方、permission/network等の取得error専用表示やinline retryはなく、data layerがloggerへ記録する。
- snapshot取得失敗時に既存docsをclearしないため、月変更失敗時は旧月dataを新しい選択月のまま表示し得る。
- date range変更ごとのrequestをabortまたはgeneration IDで無効化しないため、短時間の月変更では先に開始した遅いresponseが後の月を上書きし得る。
- 画面は左の従業員領域、中央calendar、右のsummaryという3 pane構成で、左右に固定幅を持ち、全体は`overflow-hidden`である。mobile専用分岐やpane切替はないため、狭いviewportでの操作性は未検証である。
- eventはlabel表示のみでclick/keyboard/focus操作を持たない。

## Rules・security

- 従業員氏名・code、勤務日・勤務時刻・勤務区分・実勤務時間は個人・勤怠情報である。
- route側の暫定roleとRules側の実accessが分離しており、上記の承認済みaccess/write方針は現行Rulesへ未実装である。勤怠管理者の具体的role/permissionも未確定である。
- 専用Rulesがないため通常Userは閲覧不能である一方、super-user clientは集約documentを直接変更できる境界が残る。詳細はFUT-0039、CONF-0026を参照する。
- snapshot queryにはcompanyId条件を明示せず、collection pathのtenant prefixとRulesへtenant separationを依存する。

## 矛盾・未使用候補

- pageSettingsはdeveloperへ画面を見せるが、DailyAttendances専用Rules不存在のため、そのroleだけでは取得可能と確認できない。
- 集計済み`totalBreakMinutes`は現在のsummary UIで未使用である。
- DailyAttendance aggregate `startTime`/`endTime`/`breakMinutes`は現在の一覧・calendar表示で未使用である。将来用途はCONF-0024参照。
- comment outされたemployee select blockは未到達code候補であるが、削除意図は未確認。

## 将来要対応

- FUT-0039: access主体とFunctions/client field ownershipを正式化する。
- FUT-0130: 月変更fetchの競合と失敗時の旧data表示を防ぎ、error/retry stateを設ける。
- FUT-0131: 狭いviewport、event詳細、keyboard/focusを含む勤怠閲覧UXを設計・検証する。
- FUT-0132: 手動訂正・休暇等を導入する場合の保存model、actor、承認、監査、同期との所有権を決める。

## 要確認事項

- CONF-0024: aggregate start/endの将来用途。
- CONF-0026: 回答済み。DailyAttendanceのaccess主体とfield所有権方針。
- CONF-0109: 手動訂正、振替休日、代休、休暇のworkflowと保存先。
- CONF-0110: 勤怠閲覧画面のresponsive・詳細表示要件。

## 未確認範囲

- 認証済みbrowserでの表示、実claimsとRulesの到達性、mobile実機、screen reader、keyboard操作。
- 実Firestore data、offline挙動、同時月変更のruntime再現。
- `/attendances/export`、OperationResult同期Functions、給与、freee/API、将来の休暇model。

## Index application data追加確認（SPEC-DEEP-040）

- actual-date modeとoperation-date modeはいずれも勤怠projectionと在職Employeeを別々のsnapshot queryで取得し、ORした単一loadingだけを返す。二つのqueryに共通read time/revisionやall-or-nothing error契約はない。
- loading transitionごとにglobal loading keyを追加/削除しscope disposeでもcleanupする点は安全側だが、下位data layerのerror/stale/emptyを公開せず、片方失敗時にもう片方の新dataと旧dataが混在しても画面で識別できない。

## 勤怠統計transform追加確認（SPEC-DEEP-041）

- ACTUAL_DATE側は`DailyAttendance.isAttended/isExportable/details`、OPERATION_DATE側は`details.length/details`を使う別transformである。同じ表示項目でもattendanceCountとexportabilityの意味がmodeにより異なる。
- 両transformは`employeeId`・`shiftType`の存在/enumを検査せず、欠損値を`undefined` Map keyへ集約する。時間値は`Number()`後の非有限値だけ0へ畳み込むため、空文字/nullも0として扱い、invalid rowをerrorやuncalculable countへ残さない。
- transformは純粋なlive computedで、snapshot revision、loading/error、監査情報を持たない。表示側はsource projectionのvalidation・整合性へ依存する。

## mode別range data layer追加確認（SPEC-DEEP-043）

- OPERATION_DATE側snapshot layerはACTUAL_DATE側と同じくrange変更のgeneration/cancelを持たず、失敗時に旧docsを保持する。Employee snapshotはACTIVE/RESIGNEDを直列に別queryし、projectionとの共通revisionもない。
- Employee cache pushは両query成功後だけで、片方失敗時は前回cache/docsを残す。画面の単一loadingでは「旧値保持」「片方失敗」「0件」を区別できない。
