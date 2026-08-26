# DailyAttendance集約値の勤怠CSV出力利用の実装調査

## Attendance/CSV utility最終確認（SPEC-DEEP-045a/045b）

- `createAttendancePunchRows`はbrowser local timeのDate getterで出力値を作り、JSTを明示しない。breakMinutesが勤務時間を超える場合もclamp/rejectせず、勤務区間外へ休憩開始・終了がはみ出し得る。
- 非有限break値はInvalid Dateを作り、後段の区間mergeで落ちると休憩なしの行へ縮退し得る。明細間gapは全体を休憩として出力し、overlapの拒否はこのutility自身にはない。
- `exportAttendancePunchesCsv`はcomma/quote/改行をescapeするが、先頭`=,+,-,@`をneutralizeしない。従業員code/nameがspreadsheet式として解釈される可能性があり、OperationResult CSVと同じformula対策境界を持つ。
- Blob/download処理は同期例外のuser feedbackを持たず、filenameの日付はbrowser local timeである。

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-014 — DailyAttendance集約値のfreee/勤怠出力利用、SPEC-DEEP-011、SPEC-DEEP-023
- 最終確認日: 2026-08-11
- Exporter component/Facadeのbutton disable、snapshot、download/error境界のfile単位精査は [DailyAttendance components deep review](daily-attendance-components-deep-review.md) を参照する。
- 根拠ファイル: `pages/attendances/export.vue`、`utils/pageSettings.js`、`components/DailyAttendance/Exporter/index.vue`・`useIndex.js`、`composables/dataLayers/dailyAttendance/useDailyAttendancesInRange.js`、`utils/attendance/createAttendancePunchRows.js`、`utils/csv/exportAttendancePunchesCsv.js`

## 出力入口・権限

Export pageのroute、PII preview、loading・download境界のfile単位確認は[Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)を参照する。

- 入口は `/attendances/export` で、pageはfetch contextを初期化して `DailyAttendanceExporter` を表示する。
- pageSettingsは`DEVELOPER` access policyを参照する。これは現在の実装事実であり、確定した勤怠出力権限とは扱わない。
- 出力はbrowser内でCSV Blobを生成してdownloadする。外部freee APIを呼ぶ処理は、調査対象の直接経路にはない。
- 2026-08-11のユーザー回答では、この4列CSVはfreee勤怠管理Plusへ引き渡す想定である。ただし仮実装で取込テスト未実施のため、形式互換性と正式運用は保留であり、確定仕様とは扱わない。
- 2026-08-11の追加回答により、公式の取込対象・templateを確認し、代表matrixとDEV test employeeによる取込検証を完了するまでは実験的機能として非表示またはtrial表示にする。exporterの対象・format version、対応version・確認日を記録する方針である。

## 抽出条件

- 初期期間はbrowserの現在月初から月末で、UIは月単位で変更する。
- DailyAttendanceは `dateAt >= from` かつ `dateAt <= to` のinclusive range queryで一度取得する。snapshot購読ではない。
- 取得したDailyAttendanceのemployeeIdごとにEmployeeを取得し、行生成時の従業員コード・氏名へ使う。
- `isExportable` がfalse、Employeeが見つからない、または有効な勤務区間がないDailyAttendanceは全体を除外し、理由を画面へ表示する。出力可能な行が1件以上あれば、他の除外対象があってもCSVを出力できる。
- 休日、休暇、振替休日等を表す専用行や列はない。detailsを持つDailyAttendanceの打刻行だけを生成する。

## 列マッピング

| CSV列 | 値の決定 |
|---|---|
| `employeeCode` | Employee.code。Employee自体が存在すれば空文字も許容される |
| `employeeName` | Employee.fullName、次にdisplayName、どちらもなければ空文字 |
| `punchTypeCode` | 1=出勤、2=退勤、3=休憩開始、4=休憩終了 |
| `punchDateTime` | 対象Dateをbrowser local timeで `YYYYMMDDHHmm` に整形 |

- previewも同じ生成済みrowsを使い、打刻種別だけ日本語labelへ変換する。
- rowsは従業員コード（日本語locale、numeric sort）、次に打刻日時で並べる。

## 時間集約・日跨ぎ・複数実績

- 現行出力は `DailyAttendance.startTime` / `endTime` 集約ゲッターを使わない。`DailyAttendance.details` の各 `startAt` / `endAt` Dateを使って再構成する。
- `startTime`/`endTime` public contractを維持して内部Date比較へ修正する方針は、detail日時を直接使う現在のCSV値決定を変更しない。
- validなdetailsをstartAt順に並べ、最初のstartAtを出勤、最後のdetailのendAtを退勤にする。重複区間は `isExportable` で事前に除外される。
- 各detailのbreakMinutesは勤務区間中央へ仮置きする。仮休憩開始だけ分単位へ切り捨て、開始からbreakMinutes後を終了とする。
- details間に空きがある場合、その空き全体を休憩として出力する。重複または連続する休憩区間は結合する。同日複数実績間の空き時間を休憩打刻にする挙動は、2026-08-11に承認済み仕様として確認された。
- D 08:00–17:00とD 22:00–翌05:00の混在例では、出勤はD 08:00、区間間の休憩はD 17:00–22:00、退勤はD+1 05:00となる。FUT-0037のHH:mm集約結果 `08:00/17:00` は参照されないため、このCSV経路には誤値が到達しない。
- 単一夜勤D 22:00–翌05:00もdetailの実日時を保持して出力する。日跨ぎ専用flagや日付加算をCSV側で再計算はしない。

## ファイル契約

- 先頭にUTF-8 BOMを付け、行末はCRLF、MIME typeは `text/csv;charset=utf-8;` である。
- headerは4列固定で、値にcomma、double quote、CR、LFがあればdouble quoteで囲み、内部quoteを二重化する。
- file名は `attendance_punches_YYYYMMDD_YYYYMMDD.csv`。期間Dateがinvalidなら該当部分は `unknown` となる。
- Object URLを作成し、非表示anchorのclick後にURLをrevokeする。
- 調査範囲にfreee固有のAPI接続、format名、version、取込結果確認はなく、freee側との互換性は実装だけから確定できない。

## エラー・空値

- DailyAttendance取得失敗はconsoleへ記録し、exporterへ例外を再throwしない。画面には専用の取得失敗messageがない。
- Employee読込み中または生成行0件ではexport buttonをdisabledにする。
- CSV生成・Blob作成・download clickにはtry/catch、処理中flag、失敗messageがない。
- Employee未取得は除外するが、存在するEmployeeのcode/name空値は空欄のまま出力する。
- invalid Date、startAt >= endAt、重複勤務区間は出力不能理由になる。実ファイル生成は実施していない。

## 仕様との一致

- detailの実Dateを使用するため、OperationResultから保持された日跨ぎを失わず出力する。
- ユーザー回答で未確定とされたDailyAttendanceの将来権限・休暇用途について、現行developer-only page設定や打刻4列を確定仕様とは扱わない。
- 現行経路はFUT-0037の集約ゲッターを使用せず、同項目の既知混在ケースは勤怠CSVへ影響しない。
- 同日複数実績間の空きを休憩として出力する現在挙動は承認済み仕様と一致する。

## 矛盾・未使用候補

- 調査対象はfreee/勤怠出力とされているが、実装上は汎用的な打刻CSVで、freee固有の識別子・API・取込format宣言は確認できない。
- `DailyAttendance.startTime` / `endTime` はこの出力でも未使用である。
- details間の空きと各detail内のbreakMinutesを、ともに休憩打刻へ変換する。前者は承認済み仕様だが、後者の中央配置・丸めとfreee勤怠管理Plusの形式互換性は未確認である。

## 仮説

- browserのtimezoneが業務timezoneと異なる端末では、local Date getterによる `punchDateTime` が期待時刻とずれる可能性がある。
- breakMinutesが勤務区間より長い、または小数の場合、中央配置された休憩が勤務区間外または秒を含む内部Dateになる可能性がある。

## 将来要対応

- FUT-0037は集約ゲッター自体の混在ケースとして残すが、現行勤怠CSVは非到達である。将来consumer追加時にdetail実日時または日時ベース集約を選ぶ。
- freee勤怠管理Plusの公式取込対象・templateを確定し、exporterの対象・format versionを明示する。同日・夜勤・複数実績・休憩・空値等のrepresentative matrix、error・丸め・timezone・encoding、DEV test employee取込を検証し、対応versionと確認日を文書化する（FUT-0040）。
- 取得失敗とdownload失敗のuser-facing error、空の従業員コード・氏名を許容するかを決定する。

## 質問

- なし。検証完了までは実験扱いとする方針まで確認済みで、公式取込対象・templateと検証結果は未確認範囲として残す。

## 未確認範囲

- 実CSV生成、Excel/freeeへの取込、文字化け・改行・timezoneの実機確認。
- freee API、freee公式format、給与計算、Attendanceの他画面、休暇等の将来model。
- 実データ、Firebase、外部サービスへの接続。
