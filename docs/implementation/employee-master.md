# Employee（従業員）マスター実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-024、SPEC-DEEP-011
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/employees/**`、`components/Employees/**`、`components/Employee/**`、employee data/fetch composables、`functions/modules/Employees.js`、`firestore.rules`、schemas `Employee.js`、直接の`User.js`およびSchedule/Attendance/OperationResult参照

## 入口・権限

Page 3ファイルのroute、PII、query、退職・削除到達性のfile単位確認は[Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)、Employee表示・編集・User・予定component 10ファイルの公開契約は[Employee components deep review](employee-components-deep-review.md)、資格/custom input/Tag 7ファイルは[Employee certification / custom-input components deep review](employee-certification-components-deep-review.md)、Employees一覧とInsurance 11ファイルは[Employees / Insurance components deep review](employees-insurance-components-deep-review.md)を参照する。

- `/employees`、`/employees/[id]`、`/employees/resigned`はいずれも`employees:read`がpage条件。
- 同じ画面条件で従業員作成、全個人情報・保険・資格更新、User作成/削除、退職、Employee archive削除へ到達する。
- Rulesは同一会社認証Userまたはsuper-userにEmployees/Employees_archiveの全read/writeを許可する。個人情報field別、本人、管理者、雇用担当等の区別はない。

## データ契約

- pathは会社prefix配下の`Employees/{docId}`。`useAutonumber=false`で通常はFirestore生成ID、`logicalDelete=true`。
- 基本必須: 姓名・カナ、表示名・表示名カナ、性別、生年月日、郵便番号、都道府県、市区町村、住所、入社日、employmentStatus。
- 任意: code、建物、携帯、email、肩書、備考。locationはhidden。
- 外国籍関連: isForeigner、foreignName、nationality、residenceStatus、在留期限有無/満了日、就労制限。外国籍時は氏名・国籍・在留資格、期限あり時は満了日を必須とする。
- 警備員登録関連: 登録有無/登録日、血液型、緊急連絡先一式、本籍地。登録あり時は関連fieldを条件付き必須とする。
- 資格は`securityCertifications`配列、保険はhealth/pension/employment各Insurance埋込み。
- 退職時はdateOfTerminationとreasonOfTerminationが必須で、退職日は入社日以降。
- 読み取り専用プロパティ: fullName、fullNameKana、fullAddress、prefecture。ゲッター: age、yearsOfService（退職済みは退職日まで）。
- tokenFieldsはcode、姓名・カナ、外国名、displayName。email、電話、住所等は検索token外。

## CRUD・validation

- EmployeesManagerの標準create/update/deleteはEmployee model methodを直接呼ぶ。作成後は詳細へ遷移する。
- EmployeesManagerのtoolbar plusは`showCreate=false`でも表示され、Iteratorの`hideDefaultFooter`は宣言済みpropをrootへbindしない。JSDocのcustom item/footer slotも実装ではforwardしない。
- codeは任意で自動採番されず、一意性validationもない。docIdとcodeは別物。
- 姓・名変更時はdisplayNameを自動再生成するが、displayNameKanaはカナfield変更に連動して再生成するtriggerが見つからないため、独立入力/保存値である。
- falseとなった外国籍・警備員登録の従属fieldはbeforeCreate/beforeUpdateで初期化される。警備員登録false時のbloodTypeはnullではなくAへ初期化される。
- 住所geocodingはCustomer/Siteと同じmixinで、失敗時location=nullのまま保存継続する。
- delete前のhasManyはSiteOperationSchedules.employeeIds、OperationResults.employeeIds、ArrangementNotifications.employeeIdを確認する。参照queryはclient adapter上transaction外。

## 採番・検索

- 在職一覧はemploymentStatus=ACTIVE、空検索時全件取得、fullNameKana昇順。
- 退職者画面は検索文字列がある時だけN-gram+RESIGNED条件で取得し、空検索は0件。
- Employee Autocompleteはstatus constraintを渡さないためACTIVE/RESIGNEDの両方が候補になり得る。
- 期間内従業員取得はACTIVEかつdateOfHire<=to、またはRESIGNEDかつdateOfHire<=toかつdateOfTermination>=fromを結合する。

## 雇用状態

- statusはACTIVE/RESIGNED。通常updateでACTIVE→RESIGNEDを直接行うと拒否し、`toTerminated`専用methodを要求する。再在職化methodはない。
- `toTerminated`は退職日・理由を検証し、employeeId一致のUserをtransaction外検索する。最初のUserがadminなら拒否する。
- adminでなければEmployee退職更新と該当User document削除を同一Firestore transactionで実行する。Auth accountへの最終作用はUser側連携境界に依存し、本調査では内部未確認。
- RESIGNED詳細でも基本・国籍・保険・警備員/資格編集とEmployee削除は可能。退職処理とUser cardだけ非表示になる。
- 退職日が将来でも即座にemploymentStatus=RESIGNEDとなり、在職一覧・通常候補から外れる実装である。

## User連携

- Employee docIdは従業員ID。Userは別document IDを持ち、`User.employeeId`でEmployeeへ紐付く。Employee IDとAuth UIDの同一性は前提ではない。
- 詳細はUsersをemployeeIdでlive検索し、先頭documentをUser cardへ渡す。User作成時はEmployee情報からdisplayName/email等を初期化し、employeeIdとcompanyIdを設定する。
- User.employeeIdはoptionalで、Employee側/Rulesに1従業員1Userの一意制約はない。
- User作成前にemailのglobal availabilityをFunctions経由で確認する。User更新はこのcardでは不可、非admin User削除は可能。
- 退職methodは検索結果先頭Userだけを削除する。Employee物理削除triggerもemployeeId検索の先頭Userだけを削除する。
- detail pageの退職/Employee削除buttonは購読結果ではなく初期空User instanceの`isAdmin`を参照する。退職methodは内部queryでadminを再検査するが、archive/delete UIの事前disableとしては機能しない。

## 下流参照・削除

- Schedule/OperationResultはworker detailのid/employeeIdsでEmployeeを参照する。ArrangementNotificationはemployeeId、DailyAttendance/DailyOperations/SiteEmployeeHistoryもemployeeIdをkeyとする。
- 予定worker候補の期間data layerは入退社期間を考慮できるが、汎用Autocompleteは退職statusを限定しない。
- OperationResultと日次集約はEmployee masterの姓名等を全面snapshotする契約ではなく、表示時にEmployeeを取得する箇所があるためmaster変更・archiveで表示が変化/欠損し得る。
- logical deleteはEmployeeをEmployees_archiveへ移す。hasMany guardはschedule/result/arrangement notificationだけで、DailyAttendance等の派生/履歴collectionは対象外。
- Employee document物理削除を検知するFunctions triggerはUserを後続削除する。trigger失敗時はEmployee削除をrollbackできず、User残存の部分状態になり得る。

## Rules・tenant・個人情報

- path companyIdがtenant境界。Rulesはdocument fieldやemployee/User ID整合、employment transition、参照guardを検証しない。
- Employees documentには生年月日、住所、連絡先、国籍・在留資格、血液型、緊急連絡先、本籍、保険、資格、退職理由等の高感度情報が集約される。
- 現行Rulesでは同一会社の任意認証Userがこれらを全読取・全書込できる。archiveも同じ境界。
- 直接writeはschema validation、toTerminated、admin guard、dependent field初期化を迂回できる。

## 失敗・並行性

- 退職時のUser検索はtransaction外のため、検索後にUser作成/role変更が起きる競合余地がある。複数Userがあれば先頭だけを処理する。
- toTerminated失敗時はEmployee instanceをrollbackするが、subscription介在時の画面状態収束は未確認。
- deleteのchild参照確認もtransaction外で、確認後の予定/実績追加と競合し得る。
- Employee archiveとonDeleted User cleanupは別event境界。User cleanup失敗時にEmployeeは既に通常collectionから消えている。
- 一意なcode、employeeId↔User、email変更同期、楽観的並行更新versionは強制されない。

## 矛盾・未使用候補

- `employees:read`で高感度個人情報の全編集・退職・削除・User操作へ到達する。
- 汎用Employee AutocompleteはRESIGNEDを除外しない。
- Userの1対1制約がなく、UI/退職/delete triggerはいずれも検索先頭だけを扱う。
- 将来退職日でも即RESIGNEDとなり、期間到来を待たない。
- logical archive/restore APIがある一方、Employee UIにrestore経路は見つからず、削除dialogは復元不能と説明する。
- displayNameKanaは姓名カナと別保存され、自動同期triggerが見つからない。
- hasMany guardにDailyAttendance/DailyOperations/SiteEmployeeHistory等は含まれない。
- Base editorのincludedKeysにrequired `address`がなく、EmployeeSelectは任意codeへ`localeCompare`を直接呼ぶ。ScheduleCalendar/EmployeeSelectは静的callerがなく未使用候補である。

## 将来要対応

- FUT-0075: Employee個人情報の閲覧・編集権限を最小化する。
- FUT-0076: Employee/User 1対1と退職cleanupを保証する。
- FUT-0077: 雇用状態・将来退職・復職workflowを確定する。
- FUT-0078: Employee archiveと全参照保持を設計する。
- FUT-0079: code・氏名派生field・候補検索の整合を保証する。
- FUT-0059: geocoding境界の対象にEmployeeを追記した。

## 要確認事項

- CONF-0061〜CONF-0065を`pending-confirmations.md`へ登録した。

## 未確認範囲

- User/Auth作成削除の内部、Authentication account最終状態、admin SDK callable、email変更。
- Attendance/Schedule/OperationResultの内部、worker候補全UI、資格有効期限判定。
- 実データ、Rules/Emulator/ブラウザ、個人情報保持・法令要件、archive restore運用。
