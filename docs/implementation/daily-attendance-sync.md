# OperationResultからDailyAttendanceへの同期契約の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-012 — OperationResultからDailyAttendanceへの同期契約、SPEC-DEEP-023
- 最終確認日: 2026-08-11
- DailyAttendance UI component全7ファイルの表示・集計consumer精査は [DailyAttendance components deep review](daily-attendance-components-deep-review.md) を参照する。
- 根拠ファイル: `functions/triggers/operationResult.js` のDailyAttendance呼出し、`functions/modules/dailyAttendances/` のfetch/add/remove/save/sync、schemas `DailyAttendance.js`・`WorkTimeBase.js` と直接使用するOperationResult/OperationResultDetailの勤怠日時契約、`components/DailyAttendance/Calendar/index.vue` の直接表示、`firestore.rules` のCompanies配下fallback、`AGENTS.md` の後続ToDo、`operationResultIds` の限定検索結果

## ユーザー回答と再検証結論

- DailyAttendanceは従業員の日次勤怠で、将来は振替休日・代休・休暇等を扱う可能性がある。認証Userのread/write、Admin専用、super-user修復可のいずれも未確定であり、現在のRulesを確定仕様としない。
- 日跨ぎはOperationResultDetailが継承するWorkTimeBaseの `startAt` / `endAt` で考慮されている。endAtはendTimeがstartAt以下なら1日加算する。
- 確認したCalendarはDailyAttendance.startTime/endTimeを使わず、各detail.startAt/endAtを直接formatする。この表示経路では日跨ぎ日時が保持される。
- 先の「日跨ぎが考慮されない」という一般化は不正確だったため訂正する。ただしDailyAttendance自身の集約startTime/endTimeはHH:mm文字列min/maxのままで、日跨ぎ明細と同日明細が同じ勤怠日に複数ある場合は、実日時上の最遅endを選べない再現条件が残る。
- 2026-08-11: DEVでfull DailyAttendance rebuild/diffを行い、本適用時にone-time full rebuildする。移行後は`operationResultIds`の`array-contains` reverse lookupを使い、idempotent dry-run/count/create-update-delete候補、periodic consistency check、repair auditを設ける。
- 2026-08-11: `details`はemployee-only domainとして`operationResult.employees`からemployeeId/id一致で抽出する。isEmployee複合namespaceへの全面変更は行わず、同種のworkers/id-only filterをmechanical checkする。
- 2026-08-11: 現在の`startTime`/`endTime` public contractを維持し、getter内部だけdetail.startAt/endAtのDate比較へ修正して最早開始・最終終了をHH:mmで返す。new getter/deprecationは設けない。
- 2026-08-11: full embedded OperationResultは`customClass`によるinstance復元と既存consumer互換性のため当面維持する。DEVで件数・平均・最大bytesを測定してwarning/monitoringとsize failure可視化を行い、明示的whitelistのpartial plain objectを同じOperationResultへhydrateするprototypeを検証する。`instanceof`、全使用field/getter、欠落field、再serializationを含む完全互換性確認後だけmigrationし、非互換ならfull snapshotを維持してdate partition/subcollectionを将来検討する。derived subclassは用いない。
- 2026-08-11: 集約由来の勤務明細・時刻はFunctions-only writeとする。本人は自己勤怠、勤怠管理者は同一会社の勤怠をreadする。休暇・振替休日・代休は別application/eventで本人create/cancel、管理者approve/rejectとし、承認結果を表示・集約へ反映する。訂正とsuper-user修復は監査付きserver processに限定する。

## データ契約

### 保存path・識別子

- 保存先は `Companies/{companyId}/DailyAttendances/{employeeId}_{attendanceDate}` である。
- companyIdはOperationResult triggerのpath parameterからprefixへ使い、DailyAttendance document内のfieldではない。
- employeeIdはOperationResult.employeesのemployee.id、日付は各employee detailの `attendanceDateAt` / `attendanceDate` を使う。予定日そのものではなく、isStartNextDayを反映した勤務開始日である。
- uid fieldはない。Authentication UIDとの対応はこのmodel・同期moduleでは検査しない。
- useAutonumber=false、logicalDelete=falseで、0件時は物理deleteする。

### 保存fieldと導出値

| 値 | 契約 |
|---|---|
| `dateAt` | 勤怠日。必須 |
| `date` | dateAtのYYYY-MM-DD。列挙可能な読み取り専用プロパティ |
| `employeeId` | 従業員ID。必須 |
| `operationResults` | 関連OperationResult全体のembedded配列 |
| `operationResultIds` | operationResultsからdocIdを列挙する読み取り専用プロパティ |
| `details` | 全embedded resultのworkersをflat化し、idがemployeeIdと一致する明細を抽出 |
| `startTime` | details内のHH:MM文字列で辞書順最小 |
| `endTime` | details内のHH:MM文字列で辞書順最大 |
| `breakMinutes` | detailsのbreakMinutes合計 |
| `isAttended` | detailsが1件以上ならtrue |

- startAt/endAt、isStartNextDay等はembedded worker detail内に保持され、各明細のendAtは日跨ぎ時に翌日へ加算される。DailyAttendanceのstartTime/endTime集約だけは日付を比較せずHH:MM文字列を使う。
- exportInvalidReasonsはdetailのstartAt/endAtを使って半開区間の重複を検出する。Calendarに加え、勤怠CSV出力も集約startTime/endTimeではなくdetail.startAt/endAtを直接使用することをSPEC-SEG-014で確認した。

### コード契約による手計算

基準日をDとする。

| 入力 | detail startAt/endAt | DailyAttendance startTime/endTime | 判定 |
|---|---|---|---|
| D 08:00-17:00 | D 08:00 / D 17:00 | 08:00 / 17:00 | 正しい |
| D 22:00-翌05:00 | D 22:00 / D+1 05:00。endAtがstartAt以下なので+1日 | 22:00 / 05:00 | 単一区間の表示値として日跨ぎ時刻を保持。Calendarはdetail日時を使用 |
| D 08:00-12:00 と D 13:00-17:00 | D 08:00/D 12:00、D 13:00/D 17:00 | min=08:00 / max=17:00 | 正しい |
| D 08:00-17:00 と D 22:00-翌05:00 | D 08:00/D 17:00、D 22:00/D+1 05:00 | min(08,22)=08:00 / max(17,05)=17:00 | 誤り。実日時上の最遅終了はD+1 05:00 |

isStartNextDay=trueならstartAtとattendanceDateAtはD+1になり、同じattendanceDateのDailyAttendanceへ格納される。endAtはそのstartAtを基準にさらに必要な翌日加算を行う。

## イベント別同期表

| OperationResult event | 取得対象 | 差分処理 | 保存 |
|---|---|---|---|
| create | after employeesそれぞれのemployeeId＋attendanceDate doc | 同じresult IDを除外後、after resultを追加 | 既存ならupdate、未作成かつisAttendedならcreate |
| update | before employeesとafter employeesの両方 | docIdでMap重複排除し、before result IDを全対象から除去後、afterのemployee/dateに一致する対象へ追加 | 残件ありupdate、0件delete、移動先未作成ならcreate |
| delete | before employeesそれぞれのdoc | before result IDを除去 | 残件ありupdate、0件delete |

OperationResult onDocumentWritten triggerはBilling同期後、DailyAttendance同期をawaitする。元OperationResult writeとは別のFunctions実行・別transactionである。

## 検索・集約アルゴリズム

1. OperationResult.employeesを走査する。
2. 各employeeについて `${employee.id}_${employee.attendanceDate}` を組み立て、transaction内でDailyAttendanceをpoint fetchする。
3. documentがなければ同じdocId、employeeId、attendanceDateAt、空operationResultsでinstanceを初期化する。
4. addはDailyAttendance.employeeId/dateとOperationResult.employeesのid/attendanceDate一致を確認する。
5. 追加前に同じOperationResult.docIdをfilterし、1件pushするため、同一event再実行でresult ID重複を抑える。
6. DailyAttendanceの集約値は保存したoperationResultsからgetterで再計算される。

現行fetchは `operationResultIds array-contains` queryを使わない。repository全体の検索でDailyAttendance.operationResultIdsをqueryする箇所はなく、直接参照はschemaとAGENTS.md ToDoだけである。

## 日付・勤務区分・従業員変更

- updateはbefore/after双方から対象docを取得するため、employee削除、employee追加、employee ID変更、attendanceDate変更では旧docから除去し新docへ追加する。
- shiftType自体を検索keyにしない。shift変更によりworkerのisStartNextDayやattendanceDateが変わった場合にのみdoc移動が起きる。
- 同じemployee/dateのまま時刻・休憩・資格等が変わる場合、同じdoc内のembedded OperationResultを置換してgetterを再計算する。
- OperationResult詳細のworker managerは実時間・日跨ぎ・休憩・資格・OJTをResultへまとめて`doc.update()`する。client成功後にこのupdate triggerがDailyAttendanceへembedded Resultを置換するため、画面保存と勤怠反映は同一transactionではない。
- before/afterから再構成できない既存配置先、壊れたembedded ID、過去の不整合documentは検索できず残る。

## transaction・再実行・並行性

- 1回のDailyAttendance同期はFirestore transactionで、対象DailyAttendanceのfetchとcreate/update/deleteをまとめる。複数employee/dateも同じtransactionに含む。
- 元OperationResult write、DailyAttendance transaction、同じtrigger内の前後moduleは共通transactionではない。DailyAttendance失敗時はtriggerがthrowされ、元OperationResultと先行Billing作用は残り得る。
- retry時は同じresult IDを除去して追加するため、通常のcreate/update再実行はidempotentを意図する。
- concurrent OperationResult eventsが同じDailyAttendanceを更新した場合、transaction競合によるretryが期待されるが、Emulatorで未検証である。
- create/deleteでは取得配列をdocId Mapで重複排除しない。同一OperationResult.employees内に同じemployeeId＋attendanceDateが重複すると、同じdocumentを複数instanceとして同一transactionで保存しようとする。
- operationResultsへfull OperationResultを埋め込むため、同日result数・worker数・記事等が増えるほどDailyAttendance document sizeとtransaction payloadが増える。

## Rules境界

- DailyAttendances専用matchは存在しない。
- Companies配下の未定義collection fallbackはsuper-userだけにread/writeを許すため、通常の同社認証UserはclientからDailyAttendancesをread/writeできない。
- Cloud Functions Admin SDKはRulesを迂回して同期する。したがって通常clientに対してはFunctions専用に近いが、super-user clientはcreate/update/deleteを含む全writeが可能である。
- Rulesはdocument ID、employeeId/date、operationResultIds、company整合をfield単位で検査しない。

## 仕様・AGENTS.md ToDoとの一致と差分

- 残件があればupdate、operationResults除去後にisAttended=falseならdeleteする処理は現行に実装済みである。
- create/update/deleteをtransaction内で扱い、updateでbefore/after対象を統合する点も整合性を意図している。
- 一方、AGENTS.mdが求める `operationResultIds array-contains` による既存配置先の逆引きは未実装である。現行はbefore/after employeesから決定的doc IDを再構成する。
- この差により、event dataから再構成できない過去配置先・不整合を除去するというToDoの目的は満たさない。

## 矛盾・未使用候補

- operationResultIdsはFirestore保存される列挙可能プロパティだが、DailyAttendance同期ではqueryに使われない。
- Rules comment上のFunctions専用契約はDailyAttendancesに明記されず、super-user client writeが可能である。
- detailsはworkers全体をidだけでfilterし、isEmployeeを確認しない。outsourcer.idがemployeeIdと一致すると外注明細も勤怠へ混入する。
- detail日時とCalendarは日跨ぎを考慮する。一方DailyAttendance集約startTime/endTimeはHH:MM辞書順であり、日跨ぎ明細と同日明細が複数ある再現条件では実日時上の最遅終了と一致しない。

## 仮説

- Firestore transactionが同一documentへの複数create/updateを許容しない場合、重複employee detailで同期全体が失敗する可能性がある。
- embedded OperationResultが大きい、または同日稼働が多い従業員ではFirestore document size上限に達する可能性がある。
- array-contains逆引きを導入すれば、before dataに現れないstale配置先も除去できるが、queryとwriteを同じtransactionで行うadapter契約の確認が必要である。

## 将来要対応

- AGENTS.mdどおりoperationResultIds逆引きへ移行し、旧配置先の残件更新・0件削除を保証する（FUT-0035）。
- employee/outsourcer ID衝突を区別し、必要なconsumerがある場合は複数明細の開始終了集約を日時ベースにする（FUT-0036、FUT-0037）。
- 重複employee、document size、同時更新、retryを境界testする（FUT-0038）。
- DailyAttendancesの本人・同社勤怠管理者read、Functions-only集約write、別申請model、監査付き訂正・修復を実装する（FUT-0039）。

## 質問

- なし。集約startTime/endTimeのconsumer要件と、勤怠管理者の具体的role/permission等の実装詳細は未確定事項として残す。

## 未確認範囲

- Attendanceの他画面、給与計算。勤怠CSV出力はSPEC-SEG-014で確認し、detail.startAt/endAtを使うためFUT-0037の混在ケースは到達しない。
- Firestore Rules/Functions Emulator、trigger retry設定、transaction競合の実挙動。
- adapterのtransaction query対応とFirestore document size実測。
- 既存実データのstale参照・重複employee・ID衝突。
