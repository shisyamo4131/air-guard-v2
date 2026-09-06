# Employee（従業員）マスター実装調査

## 現行経路の再照合

2026-09-06、EMP計画/EMP-01で現code、installed schema、Rules、test sourceを再照合した。以下は静的確認であり、runtime・実data・Devの現在状態は未検証。工程・進捗は[Employeeロードマップ](../roadmaps/employee.md)、未採用契約の判断は[確認事項台帳](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)を正とする。

| 操作/境界 | 現行事実と主な根拠 | 設計に必要な条件 |
|---|---|---|
| 通常作成・編集 | `pages/employees/index.vue`→`components/Employees/Manager/index.vue`、詳細→`components/Employee/Manager/index.vue`はmodel create/update。client adapterはupdate時に全文set。基本・国籍・警備員を同じlive Employeeから編集する | 専用draft/operation、最新candidate検証、所有fieldだけ保存。基本inputの`address`漏れを扱う |
| 保険・資格 | 詳細の3保険/資格はlive map/配列のv-model変更後、`submit:complete`でEmployee全体update。保存PromiseはManager成功判定の外 | 保存await、確定拒否時draft保持、応答不明の照合、history/配列の局所競合。local-only例外にしない |
| User/退職 | `Employee/UserManager.vue`は専用仮User作成・削除composable、`Employee/LifecycleActions.vue`は専用退職・訂正controllerを使う。旧schema methodや削除triggerの存在と通常UI到達は別 | [ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)/[0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)の予約・actor・Auth非復元を維持。User panelはshellだけ整理 |
| Rules | Employeesは同社の有効な本登録Userへ全文read、ACTIVE条件付きcreate、退職3field保持付きupdateを許可しdelete拒否。Employees_archiveは同社read/writeを許可し、汎用matchの除外にも含まれない（`firestore.rules`） | roleなし等の過剰read/writeを現存riskとする。archiveは個別/汎用/nested双方を閉じる設計が必要 |
| 名前・code | 名前setterはdisplayNameを再生成、displayNameKanaは別保存。tokenFieldsはcode/姓名/カナ/foreignName/displayName。`EmployeeSelect`は`DailyAttendance/Index`から到達し、任意codeへlocaleCompareする | 氏名同時変更の優先順位を決定。空code表示修正と新しい採番/一意性仕様を分離 |
| 一覧・検索 | 在職一覧は空検索で全件、フリガナ順。退職検索は空なら0件、非空で検索する。退職一覧にも共通Managerのplusが描画される。退職検索にlatest-wins/error/loading管理がない | 作成入口の採否、検索race/状態表示。manualの空検索最近10件記述は訂正対象 |
| 期間reader | `useEmployeesInRange`はACTIVEの入社日、RESIGNEDの入退社日で直接購読。配置・勤怠・従業員別稼働が使う | 入社日訂正は表示対象期間へ影響。reader切替で必要な更新反映を維持し、transaction dataは再集計しない |
| ID reader | Worker/Tag/履歴はcurrent displayName、通知文はdisplayName/title、勤怠exportはcode/fullName、worker autocompleteはID/候補表示を使用 | 空cache/既選択ID/退職者も許可fieldだけで解決。過去時点の名前snapshot機能とはしない |
| DTO/cache | `Employee/ListItem`は取得値をEmployee.initializeへ渡す。fullName/Kanaはclass accessorで姓名から再導出。`useFetchBase`はSchemaClassのinstanceofを要求し、既存IDのpushは更新しない | 最小DTOを全文classに偽装せず専用表示/cache adapterを設計。欠けたPIIを表示互換のために公開しない。partial DTOは旧全文writerへ渡さない |
| 背景処理 | 通知作成はEmployeeの現在名を読む。勤怠/日次/履歴/Billing同期はOperationResult起点。Employee通常updateがこれらを再構築する経路は確認していない | 通知既存本文/業務recordを遡及変更しない。reader互換とwriter改修を分離 |
| 地理情報 | EmployeeはGeocodableMixin、client plugin→geocoding Callable→外部providerの経路を持ち、utilityに座標/住所logがある | CONF-0120の用途・送信・閲覧判断が必要。今回外部接続・座標削除なし |

既存testではUWB policy/use-case、仮Userの専用controller接続、Employee lifecycle field/deleteのRules拒否を確認するsourceがある。これは通常CRUD・3保険・資格の完了証拠ではない。既存source testがshell名へ依存する場合は、移行時に保存/認可/feedbackの実契約へ対応づける。

`EmployeeAutocomplete`のcreatable枝、`ScheduleCalendar`は今回の静的検索で現在の到達callerを確認できない候補であり、runtime全経路で不使用と証明したものではない。

## EMP-01の保存・読取り契約案

以下は未採用の設計案。利用者判断の正本は[CONF-0061](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)、[CONF-0065](pending-confirmations.md#conf-0065-employee-code表示名退職者候補の規則)、[CONF-0120](pending-confirmations.md#conf-0120-employee個人住所geocodingの目的同意保持)であり、文書保存承認から製品仕様採用を導かない。

### EMP-02の入力と保存対象

| operation（仮称） | 直接入力field | 制御点 |
|---|---|---|
| 作成 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, title, gender, dateOfBirth, zipcode, prefCode, city, address, building, mobile, email, dateOfHire | 現作成入力18field。初期remarks、ACTIVE、国籍/警備/3保険/資格のdefault、actor/時刻はserver確定。保険/資格/User/lifecycle操作を混在させない |
| 基本 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, gender, dateOfBirth, dateOfHire, title, zipcode, prefCode, city, address, building, mobile, email, remarks | actorごとに許可subsetだけ入力。住所の編集漏れを補う。変更したfieldだけpatch |
| 国籍 | isForeigner, foreignName, nationality, residenceStatus, hasPeriodOfStayLimit, periodOfStay, hasWorkRestrictions | false化に伴う従属消去も同operation所有とする |

現在のClass共通必須・長さ・相関を維持し、unknown/dotted field、型偽装、非finite/不正Dateをoperation境界で拒否する。日付は現在のJST暦日という意味を維持し、新しい生年月日/入社日相関・番号制度を推測で追加しない。User/Auth/予約/退職3fieldは通常updateの入力にも派生closureにも含めない。

serverは最新raw documentを取得し、不存在とnullの区別を保持してcandidateを構築する。actorが全文を読めなくてもClassとoperationをserverで検証できる専用Callableを第一候補とする。Employee.update/beforeUpdateの全体hookをそのまま使わず、operationの変更だけを正規化し、実際に変更した所有field・派生field・uid/updatedAtだけを保存する。validation用default補完をpatchへ混ぜず、他section、unknown field、createdAt、誤訂正後の退職field不存在を保持する。

派生closureは、姓名→fullName/確定したdisplayName、姓名カナ→fullNameKana、code/姓名/カナ/displayName/foreignName→最新candidateからtokenMap、prefCode/city/address→prefecture/fullAddressとする。displayName明示値は姓名設定後に反映する案、displayNameKanaは独立値を維持する案である。国籍flag解除時の従属field消去は国籍operation内だけで行う。基本保存で警備/国籍/保険を正規化しない。座標はCONF-0120の回答に従い、外部作用をtransaction再試行callbackへ入れない。

### 作成・競合・段階移行

- 作成は同一dialogの試行中に生成したIDをmemory保持し、serverは未存在だけcreateする。既存IDへset/upsertしない。commit後の応答不明では現在の認可で同IDを照合し、存在だけで成功扱いせず、異なる内容や他actorの後続編集を上書きしない。不存在応答でも先行要求の遅いcommitがあり得るため、明示再送は同ID/create-onlyに限定する。reloadでIDを失った場合の自動再作成・PII draftの永続保存は行わず、回復保証の範囲を同dialogまでとする案。
- 前回計画の「すべての通常fieldでserver期待値比較を必須」と読める表現は、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md#更新と競合制御)の通常可逆更新との整合が必要である。推奨案は通常表示/連絡fieldをfield限定last-write-wins＋同field更新通知時の再読込とし、通知前の保存競合が残ることを明示する。入社日による在籍期間、国籍解除による他入力の消去、資格配列、保険historyのように具体的被害がある範囲だけ局所expectedを検討する。全基本fieldの比較を採る代替は必要性を示して利用者判断し、全document共通revision/lock/ledgerにはしない。
- local段階移行は、EMP-02で未移行の警備/資格/保険編集を一時read-onlyにし、EMP-03/04の安全なwriter完成後に各操作を再開する案を推奨する。無断のDev機能停止はしない。旧広域updateを残して移行済fieldを変更できる状態は認めず、複数operation混在payloadも拒否する。
- 代替は未移行editorの独立draft・await・部分保存だけEMP-02へ先行導入する方式。後続の業務仕様は変えないが、EMP-02のUI/保存test範囲が増える。どちらでも旧保存失敗を成功表示するまま工程受入れしない。暫定停止か先行adapterかの採用前にEMP-02へ進まない。

### 必要なreadの具体方式比較

field/actorが異なるDTOはEmployee全文class/汎用instanceof cacheから分ける。既存原簿氏名の用途、国籍/性別の見せ方、住所/座標非公開と原文書readの整合を回答時に決める。公開識別fieldだけでID/検索/期間を照合し、foreignName/raw tokenMap等の非公開情報が検索一致にも使われないようにする。

APIごとのexact入力、ID数・検索長・取得件数・期間幅の必要な上限とpaging方式を依存実装前に固定する。具体値は現callerの用途・取得量を根拠に決め、ここで一律値を推測しない。client指定companyId、公開field指定、任意query、上限を超えるID/期間による境界拡張を拒否する陰性条件を含める。

| 比較案（すべて未採用） | 更新反映の方法 | 利点と追加責務 |
|---|---|---|
| 最小API＋変更通知 | Employee変更を背景処理で観測し、PII/Employee IDを含まないtenant内の再取得signalを購読。API初回取得とsignal後に現在必要なID/検索/期間を再取得 | PII複製/backfillを避ける。新trigger/signal path/Rules、重複/遅延/失敗/再接続、取得中の再通知、複数画面再queryを検証する。元listenerとatomicに同時反映とは保証しない |
| 限定した業務projection | 許可された最小fieldを同IDの派生documentへ同期し、検索/期間を直接購読 | query membershipを維持しやすいが、全writer/UWB/importの同期、順序逆転、bootstrap/backfill、旧projection、復旧の責務が増える。新path初回write前denyと必要data操作の別承認が必要 |
| server stream | serverが原本を購読して認可済みDTOだけ送信 | 派生保存を避けられる可能性。ただし本repoの運用実績・接続寿命・切断/費用・権限変化の検証がなく、現時点の採用根拠は不足 |

単発API＋手動refreshだけを現live購読と同等とは扱わない。raw readを人事/管理者へ残す代替も、そのactorへ全field（既存座標等）を公開する判断が必要である。API/DTO名、新path名、更新許容時間はまだ確定していない。read方式とwriterが出す更新情報の前提をEMP-01で決め、次工程で一律通知fieldを先に追加しない。

最小API＋変更通知を採る場合は、全clientの原文書readを閉じ、許可用途ごとのDTOを返す方式を比較の第一候補とする。signalは閲覧scopeごとに必要な値・検索/期間membershipの変更だけで更新し、非公開fieldだけの変更を低権限actorへ通知しない。初回はsignal購読を確立して取得し、取得中の再通知をまとめて再取得する。tenant/権限変更ではcache・draftと旧応答を破棄し、再接続時にも再取得する。背景triggerの失敗による通知欠落を含む復旧・検出方法と許容される更新遅延は未決であり、この比較だけで現listenerとの互換を受け入れ済みとはしない。

### EMP-01から次工程へのreview結果

EMP-01-DESIGN-A/SEC-A/TEST-Aでは現入力field、派生closure、UWB維持、作成create-only、最小read方式の比較を整理した。次のEMP-02は、actor/field、氏名規則、住所送信/既存座標、競合範囲、暫定writer停止/先行改修、作成試行IDの回復範囲が未採用のため準備完了ではない。保存文書の独立reviewは[ロードマップの記録](../roadmaps/employee.md#emp-01判断資料の文書review)を参照し、最終文書検証は当該作業報告で結果を示す。製品code・runtimeは未変更/未検証である。

## 2026-08-11の調査記録（履歴）

以下は当時の調査本文である。旧User CRUD、退職method、1対1、super-user、delete、復職不存在、EmployeeSelect未使用の記述を現在の状態として使用しない。現状は上の再照合と現仕様/ADRを参照する。

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
