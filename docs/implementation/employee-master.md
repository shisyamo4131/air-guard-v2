# Employee（従業員）マスター実装調査

2026-09-06のactor、誤登録物理削除・archive延期、全項目read・自宅座標利用は[現行仕様](../specification.md#employeeの操作権限と保持)、[ADR 0056](../decisions/0056-employee-role-and-archive-boundary.md)、[ADR 0057](../decisions/0057-employee-hard-delete-and-archive-deferral.md)、[ADR 0058](../decisions/0058-employee-full-read-and-geocoding-scope.md)を参照する。静的実装観測は未変更で、統括退職・専用物理削除・新しいread/write認可の実装済みを示さない。

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
| Class/cache | `Employee/ListItem`は取得値をEmployee.initializeへ渡す。fullName/Kanaはclass accessorで姓名から再導出。`useFetchBase`はSchemaClassのinstanceofを要求し、既存IDのpushは更新しない | 全項目readを維持しDTO化しない。Employee Classの表示互換を保ち、cache更新・削除・権限喪失を確認する。全文readと全文writeを混同しない |
| 背景処理 | 通知作成はEmployeeの現在名を読む。勤怠/日次/履歴/Billing同期はOperationResult起点。Employee通常updateがこれらを再構築する経路は確認していない | 通知既存本文/業務recordを遡及変更しない。reader互換とwriter改修を分離 |
| 地理情報 | EmployeeはGeocodableMixin、client plugin→geocoding Callable→外部providerの経路を持ち、utilityに座標/住所logがある | 将来の現場・自宅経路図のため取得保存を継続。失敗時の扱い・log・専用保存境界をCONF-0120で確定。今回外部接続・座標削除なし |

既存testではUWB policy/use-case、仮Userの専用controller接続、Employee lifecycle field/deleteのRules拒否を確認するsourceがある。これは通常CRUD・3保険・資格の完了証拠ではない。既存source testがshell名へ依存する場合は、移行時に保存/認可/feedbackの実契約へ対応づける。

`EmployeeAutocomplete`のcreatable枝、`ScheduleCalendar`は今回の静的検索で現在の到達callerを確認できない候補であり、runtime全経路で不使用と証明したものではない。

## EMP-01の保存・読取り契約案

通常編集・退職・誤登録物理削除のactor、既知業務roleへの全項目read、自宅座標取得の必要性は採用済みである。以下の保存operation・競合・段階移行の詳細は未採用案として区別する。残る判断は[CONF-0061](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)、[CONF-0065](pending-confirmations.md#conf-0065-employee-code表示名退職者候補の規則)、[CONF-0120](pending-confirmations.md#conf-0120-employee個人住所geocodingの目的同意保持)で扱う。

### EMP-02の入力と保存対象

| operation（仮称） | 直接入力field | 制御点 |
|---|---|---|
| 作成 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, title, gender, dateOfBirth, zipcode, prefCode, city, address, building, mobile, email, dateOfHire | 現作成入力18field。初期remarks、ACTIVE、国籍/警備/3保険/資格のdefault、actor/時刻はserver確定。保険/資格/User/lifecycle操作を混在させない |
| 基本 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, gender, dateOfBirth, dateOfHire, title, zipcode, prefCode, city, address, building, mobile, email, remarks | 会社管理者・統括・人事へ同じ入力範囲を許可し、他roleの更新を拒否。住所の編集漏れを補う。変更したfieldだけpatch |
| 国籍 | isForeigner, foreignName, nationality, residenceStatus, hasPeriodOfStayLimit, periodOfStay, hasWorkRestrictions | false化に伴う従属消去も同operation所有とする |

現在のClass共通必須・長さ・相関を維持し、unknown/dotted field、型偽装、非finite/不正Dateをoperation境界で拒否する。日付は現在のJST暦日という意味を維持し、新しい生年月日/入社日相関・番号制度を推測で追加しない。User/Auth/予約/退職3fieldは通常updateの入力にも派生closureにも含めない。

serverは最新raw documentを取得し、不存在とnullの区別を保持してcandidateを構築する。Classとoperationをserverで検証できる専用Callableを第一候補とする。Employee.update/beforeUpdateの全体hookをそのまま使わず、operationの変更だけを正規化し、実際に変更した所有field・派生field・uid/updatedAtだけを保存する。validation用default補完をpatchへ混ぜず、他section、unknown field、createdAt、誤訂正後の退職field不存在を保持する。

派生closureは、姓名→fullName/確定したdisplayName、姓名カナ→fullNameKana、code/姓名/カナ/displayName/foreignName→最新candidateからtokenMap、prefCode/city/address→prefecture/fullAddressとする。displayName明示値は姓名設定後に反映する案、displayNameKanaは独立値を維持する案である。国籍flag解除時の従属field消去は国籍operation内だけで行う。基本保存で警備/国籍/保険を正規化しない。座標はCONF-0120の回答に従い、外部作用をtransaction再試行callbackへ入れない。

### 作成・競合・段階移行

EMP-01再開時の判断案は、通常CRUDの安全化に必要な変更と業務仕様の変更を分ける。下表は未採用案であり、actor採用から氏名・保険・住所の個別仕様まで確定したとは扱わない。

| 判断 | 具体案 | 維持する条件・受入れ |
|---|---|---|
| 基本/国籍の保存 | 専用Callableで最新原本にpatchを重ね、Classとoperation契約を検証。通常可逆fieldはfield限定last-write-wins、同じ編集中sectionの変更通知を受けたら再読込 | User/Auth・退職field・他section・unknown fieldを保持。保存先が不存在ならupdateを拒否し、全文setで再作成しない。国籍解除等で他fieldを消す操作と入社日の相関は局所expectedの対象案 |
| 作成/編集の氏名 | 姓名変更による表示名生成の後に、その保存で明示変更した表示名を適用。表示カナは独立入力のまま | 姓名だけの変更、表示名だけの変更、両方変更を別々に確認。原簿氏名を表示名へ置き換えて帳票の意味を変えない |
| 退職後の通常編集 | 基本・国籍・警備員・資格・保険の訂正を通常編集actorへ認める案。退職日/状態は専用操作だけ | 入社日訂正で退職日との既存相関を壊さない。訂正によるUser/Auth復元・業務履歴再生成を起動しない |
| 保険 | 現6操作を専用保存へ移す。履歴復元のactorと手続中の喪失/適用除外の扱いはCONF-0061の個別判断 | 操作前の対象保険mapと最新値を照合し、historyの二重push/popを拒否。他の保険や基本fieldは保持。行政手続・保険料計算・監査制度を追加しない |
| 段階移行 | EMP-02では未移行の警備員・資格・保険editorをlocalで一時read-onlyにし、EMP-03/04で順次再開する案 | 旧全文writerを残して安全化済みfieldへ迂回できる構成にしない。Devへ中間停止状態を無断反映せず、保存拒否を成功表示しない |

氏名setterと従属初期化はinstalled Employeeの現実装、保険の操作可否はInsuranceと`components/Insurance/Transition/Menu/index.vue`を静的照合した。表の受入れは予定であり、今回runtime/Emulator/UI testは実行していない。表示用getterを新しい保存fieldとして追加する指示でもない。

- 作成は同一dialogの試行中に生成したIDをmemory保持し、serverは未存在だけcreateする。既存IDへset/upsertしない。commit後の応答不明では現在の認可で同IDを照合し、存在だけで成功扱いせず、異なる内容や他actorの後続編集を上書きしない。不存在応答でも先行要求の遅いcommitがあり得るため、明示再送は同ID/create-onlyに限定する。reloadでIDを失った場合の自動再作成・PII draftの永続保存は行わず、回復保証の範囲を同dialogまでとする案。
- 前回計画の「すべての通常fieldでserver期待値比較を必須」と読める表現は、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md#更新と競合制御)の通常可逆更新との整合が必要である。推奨案は通常表示/連絡fieldをfield限定last-write-wins＋同field更新通知時の再読込とし、通知前の保存競合が残ることを明示する。入社日による在籍期間、国籍解除による他入力の消去、資格配列、保険historyのように具体的被害がある範囲だけ局所expectedを検討する。全基本fieldの比較を採る代替は必要性を示して利用者判断し、全document共通revision/lock/ledgerにはしない。
- local段階移行は、EMP-02で未移行の警備/資格/保険編集を一時read-onlyにし、EMP-03/04の安全なwriter完成後に各操作を再開する案を推奨する。無断のDev機能停止はしない。旧広域updateを残して移行済fieldを変更できる状態は認めず、複数operation混在payloadも拒否する。
- 代替は未移行editorの独立draft・await・部分保存だけEMP-02へ先行導入する方式。後続の業務仕様は変えないが、EMP-02のUI/保存test範囲が増える。どちらでも旧保存失敗を成功表示するまま工程受入れしない。暫定停止か先行adapterかの採用前にEMP-02へ進まない。

### 必要なreadの具体方式比較

2026-09-06の利用者回答により、会社管理者と既知6業務roleには現時点でEmployee全項目readを許可する。[ADR 0058](../decisions/0058-employee-full-read-and-geocoding-scope.md)に従い、単一原本と既存リアルタイム購読を維持する。項目限定API・DTO/projection・通知signal・定期再取得の比較案は今回採用せず、将来項目制限が必要になった時に再検討する。

- 原本get/listの許可actorとtenantを保存境界へ揃える。roleなし、未知role、直接permission、仮/無効User、他tenant、developer/super-userだけの許可を閉じる。本人Self Accessと既存archiveは別境界であり、原本全項目回答を根拠に広げない。
- 既存のEmployee Class、姓名/表示名、性別・外国籍表示、検索token、在籍期間queryを項目maskのために置き換えない。全文取得を続けても、保存はoperation所有fieldの部分更新に限定する。
- 既存ID cacheの更新・削除反映、初期選択ID、期間内退職者、tenant/権限変更時の購読停止・cache破棄・古い応答無視を直接互換として確認する。既取得PIIの回収を保証しない。
- 勤怠Selectは原簿氏名を表示し、打刻CSVもfullNameを優先する。現page設定はDEVELOPERである（`utils/pageSettings.js`、`components/Employee/Select.vue`、`utils/attendance/createAttendancePunchRows.js`）。そのpageを業務roleへ新公開せず、page条件とEmployee原本readの両方を満たすactorだけを対象とする。

全項目readへの変更で、閲覧field一覧・DTOの入力上限・新しい通知方式をEMP-02開始条件にする必要はなくなった。既存購読への認可接続とwriterの保存応答・再取得の整合は必要である。読取の新方式や新collectionの導入を先行させない。

### EMP-01から次工程へのreview結果

EMP-01-DESIGN-A/SEC-A/TEST-Aのread比較は、全項目read採用により今回不要となった。通常保存/氏名、保険特別操作、住所から座標取得する際の失敗/整合、段階writer移行、削除の成立条件/工程配分は未決であり、EMP-02準備完了ではない。reviewと現在の次作業は[ロードマップ](../roadmaps/employee.md)を参照する。製品code・runtimeは未変更/未検証である。

### 誤登録物理削除への切替で残る実装条件

2026-09-06、EMP-01-DELETE-IMPACTの静的調査。actor・従属なし削除・archive延期は採用済みだが、以下は実装前に確定・検証する条件であり、安全な削除の完成を示さない。

- 従属候補は既存hasManyの3種類に加え、DailyAttendances、DailyOperationsByEmployee、SiteEmployeeHistories、User/予約、lifecycleのlock/head/operation等。除外する対象は生成経路・用途の根拠を要し、全catalogの網羅確認は未完了。
- installed client adapterのhasChildはtransaction外のgetDocsを使う。現ArrangementNotifications/OperationResults Rulesの参照guardはSite/Customer向けで、Employee存在確認にはなっていない。削除直前の検査だけで同時参照作成を防いだとは扱わない。他collection writerの変更が必要なら現承認範囲外として判断し、安全条件が揃うまで削除を有効化しない。
- 原本削除triggerはfunctions/index.jsからexportされ、関連Userへdeleteを呼ぶ。誤登録Employee削除からUser/Authを連鎖削除しないための対処を、単なるarchive copyの省略とは別に扱う。遅延した旧削除eventが同ID再作成後のUserへ作用する条件も、triggerと再送の検証対象に含める。
- 旧全文setによる削除後の再生成、削除後の同ID再作成に対する古い作成/削除要求の再送を検証する。対象識別・結果不明の照合・再送条件を決め、無条件の「不存在なら成功」や汎用deleteへの切替だけで解消したとしない。
- Employee-only退職でも保持すべきlifecycle記録がある場合は依存の扱いを確認する。User連携を自動解除したり履歴を消したりして誤登録削除の条件を満たさない。

現在のreader/queryへarchive除外fieldを追加する作業は不要になった。一方、既存Employee archiveの過剰アクセス是正と、物理削除で新しく生じるnot-found・古いdraft/cacheの扱いはCRUD工程で確認する。exact契約と工程の残判断はCONF-0064とロードマップへ集約する。

### 参照保存境界の追加候補（EMP-01未採用案）

EMP-01-DELETE-PLANでは、参照を作る側の最小存在確認を比較した。その後、利用者は他collectionの保存処理・Rulesも変更しないと回答したため、下表の追加変更は今回のscopeとして採用しない。Employee側の削除前検査だけで通常運用中の競合を防げる方法は未確認であり、安全条件が未解決の間は削除を開放しない。表は範囲判断の根拠として保持する。

| 対象 | 確認された保存経路 | 最小変更候補と注意点 |
|---|---|---|
| SiteOperationSchedules | `utils/siteOperationSchedule/siteScheduleGuard.js`のcreate/createMany/update/updateMany | Site確認と別に、新規/変更後のEmployee IDの存在を保存境界で確認。client補助処理だけでなく、直接writeの迂回防止が必要 |
| OperationResults | `handlers/operationResultHandlers.js`等のmodel保存・複製・予定の実績化 | Employee追加/変更時の存在確認と明細ID・employeeIdsの一致確認。複数IDのRules検査方法・実行上限を検証し、未確認の件数制限や全writerのserver化を先に決めない |
| ArrangementNotifications | 予定からの通知生成と専用Rules match | Employee明細のemployeeIdだけを検査し、外注明細をEmployeeとして扱わない |
| DailyAttendances | `functions/modules/dailyAttendances/syncOperationResultToDailyAttendances.js` | 新規/再生成をするtransactionの読取り段階で確認する候補。既存dataの削除・清掃を妨げない |
| DailyOperationsByEmployee | `functions/modules/dailyOperationsByEmployee/syncOperationResultToDailyOperationsByEmployee.js` | 保存前の読取り段階へ確認を追加する候補。集計・移動・削除計算は維持する |
| SiteEmployeeHistories | `functions/modules/siteEmployeeHistories/rebuildHistory.js` | 履歴作成時にEmployee存在を確認。参照元がなくなった履歴の削除は維持する |
| User/予約/lifecycle | 既存のEmployee連携・退職/訂正専用経路 | 既存のtransaction内Employee読取りを再利用。削除側で残るUser・予約・lock/head/operation等を検査して拒否し、自動修復・削除しない |
| Billing等の埋込み/間接参照 | `functions/modules/billings/addOperationResultToBilling.js`はOperationResultを配列保存 | 単純なroot employeeId queryの対象にできない。遅延同期・残存snapshotを含むため、原本実績の不存在だけでは依存なしと判定できない。埋込みIDを削除拒否の従属として扱う範囲は未決。無断の全件scanや索引用field追加は前提にしない |

削除案の順序は、catalogと参照保存境界の確認→必要なRules/server保護→Employeeの旧全文writer/削除trigger対処→専用削除→UI開放。必要な保存境界が揃う前に削除を開放しない。他masterの状態・金額・集計・archive方式を変更する案ではないが、参照保存への追加変更自体は利用者回答により今回対象外である。この順序をそのまま実装する計画は採用しない。

同ID再作成と削除再送の対策として、原本削除と同時に最小の削除記録を保存する案を比較する。Employee全文・住所・保険等のarchiveは作らず、結果照合と古い要求の拒否に必要な情報だけを候補とする。新しい記録の有無・保存項目・保持・アクセス・消去条件は未決であり、削除採用から自動導入しない。記録を持たない代替では、対象の世代識別と再試行の保証範囲を別に確定する。新collection名や共通ledgerを先に作らない。

予定する検証は、削除と参照作成の両順序、従業員変更・複製・実績化・通知、明細/ID不一致、複数ID、遅延eventによる再生成、User/予約/lifecycle競合、旧保存、応答不明/再送、他Employee・Outsourcer・既存集計値の不変である。現時点では静的調査のみで、全writer網羅・実data・競合再現は未確認。

### archiveの追加影響調査

以下はarchive延期前の調査記録である。従属検査と原本削除triggerの問題は誤登録物理削除にも適用され、延期で解消したとは扱わない。

現Employee.hasManyは`SiteOperationSchedules.employeeIds`、`OperationResults.employeeIds`、`ArrangementNotifications.employeeId`の3種類を対象にする。一方、`DailyAttendances`、`DailyOperationsByEmployee`、`SiteEmployeeHistories`にもemployeeId参照がある。これらとUser/予約・lifecycle・間接参照を調べ、archive拒否対象の一覧を確定する必要があり、既存3種類を全従属の証明にはしない。

`functions/modules/Employees.js`の原本削除triggerはemployeeId検索の先頭Userへdeleteする経路を持つ。新archiveがUser/Authを連鎖削除しないこと、検査後に参照が追加されても参照切れを作らないことを設計する。今回の調査は候補整理であり、全writer網羅・競合再現・実data確認は未実施。具体的な追加実装scopeと工程配分が決まるまで既存deleteを再開しない。

### archive保存方式の比較（未採用）

ADR 0057採用後は将来工程の比較資料として保持する。今回のEmployee実装の前提にせず、同document状態更新も別collection移動も追加しない。

利用者の追加質問を受け、同じEmployee documentへ独立したarchive状態を保存する方式を第一候補として比較する。これは保存方式の提案であり、「従属documentがあれば不可」という採用済み条件を緩和しない。

| 観点 | 別collectionへ移動 | 同documentの状態更新 |
|---|---|---|
| 保存 | 複製と原本削除、衝突・復旧の整合が必要 | 原本の保存場所・IDを保持し、状態の部分更新で表現可能 |
| 既存の削除trigger | 原本削除からUser削除経路へ作用し得る | 原本を削除しないため、その削除triggerを起動しない |
| 読取り | 移動後の旧pathでのID解決を設計する | ID解決は維持しやすいが、一覧・検索・候補・期間取得へ除外条件が必要 |
| 参照条件 | 存在検査と移動を新規参照作成に対して整合させる | 存在に加え未archiveを保存境界で確認する。状態flagだけでは新規参照作成を防げない |
| 互換性 | 保存shape、別pathの認可、移動/復旧が必要 | 新fieldの不存在、旧全文writerによる消去/巻戻し、cache更新、query互換を扱う |

状態更新方式を採るなら、archive状態は雇用状態のACTIVE/RESIGNEDと分け、入退社日・退職処理の意味を変えない。新field名・型、対象状態、解除可否、詳細/ID/履歴の閲覧、通常編集/退職/User作成の可否はまだ確定していない。保存場所を残すことでarchiveと新規参照の競合問題そのものがなくなるとは扱わない。既存archive collectionの公開問題も別途閉じる。

EMP-01-ARCHIVE-STATE-COMPAREの静的reviewでは、移動・原本削除・旧削除triggerを避けられる利点と、現readerにarchive判定がない点、User作成で存在だけでは不十分になる点、旧全文writer対策が必要な点を確認した。runtime・競合再現・data変換の要否は未検証である。

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
