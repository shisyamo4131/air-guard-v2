# Employee（従業員）マスター実装調査

2026-09-06の最新方針は[現行仕様](../specification.md#employeeの操作権限と保持)と[共通データ仕様](../specification.md#共通データ仕様)、[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)を参照する。archiveは別collection移動に戻し、必要な従属writerの保護を設計する。以下は静的実装事実と未実装の設計であり、適用・進捗は[Employeeロードマップ](../roadmaps/employee.md)を正とする。

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
| 地理情報 | EmployeeはGeocodableMixin、client plugin→geocoding Callable→外部providerの経路を持ち、utilityに座標/住所logがある | 将来の現場・自宅経路図のため取得保存を継続。失敗時も住所保存・旧座標消去・未取得通知を採用済み。最新住所照合・log・専用保存境界は残設計。今回外部接続・座標削除なし |

既存testではUWB policy/use-case、仮Userの専用controller接続、Employee lifecycle field/deleteのRules拒否を確認するsourceがある。これは通常CRUD・3保険・資格の完了証拠ではない。既存source testがshell名へ依存する場合は、移行時に保存/認可/feedbackの実契約へ対応づける。

`EmployeeAutocomplete`のcreatable枝、`ScheduleCalendar`は今回の静的検索で現在の到達callerを確認できない候補であり、runtime全経路で不使用と証明したものではない。

## EMP-01の保存・読取り契約案

通常編集・退職・誤登録archive/物理削除のactor、既知業務roleへの全項目read、自宅座標取得の必要性は採用済みである。退職後の通常編集禁止、在職Employeeの保険履歴復元actorと現行遷移維持は[ADR 0059](../decisions/0059-employee-retired-edit-and-insurance-operation-boundary.md)で追加採用済み。その他の保存operation・競合・段階移行の詳細は未採用案として区別する。残る判断は[CONF-0061](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)、[CONF-0065](pending-confirmations.md#conf-0065-employee-code表示名退職者候補の規則)、[CONF-0120](pending-confirmations.md#conf-0120-employee個人住所geocodingの目的同意保持)で扱う。

### EMP-02の入力と保存対象

| operation（仮称） | 直接入力field | 制御点 |
|---|---|---|
| 作成 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, title, gender, dateOfBirth, zipcode, prefCode, city, address, building, mobile, email, dateOfHire | 現作成入力18field。初期remarks、ACTIVE、国籍/警備/3保険/資格のdefault、actor/時刻はserver確定。保険/資格/User/lifecycle操作を混在させない |
| 基本 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, gender, dateOfBirth, dateOfHire, title, zipcode, prefCode, city, address, building, mobile, email, remarks | 会社管理者・統括・人事へ同じ入力範囲を許可し、他roleの更新を拒否。住所の編集漏れを補う。変更したfieldだけpatch |
| 国籍 | isForeigner, foreignName, nationality, residenceStatus, hasPeriodOfStayLimit, periodOfStay, hasWorkRestrictions | false化に伴う従属消去も同operation所有とする |

現在のClass共通必須・長さ・相関を維持し、unknown/dotted field、型偽装、非finite/不正Dateをoperation境界で拒否する。日付は現在のJST暦日という意味を維持し、新しい生年月日/入社日相関・番号制度を推測で追加しない。User/Auth/予約/退職3fieldは通常updateの入力にも派生closureにも含めない。

serverは最新raw documentを取得し、不存在とnullの区別を保持してcandidateを構築する。Classとoperationをserverで検証できる専用Callableを第一候補とする。Employee.update/beforeUpdateの全体hookをそのまま使わず、operationの変更だけを正規化し、実際に変更した所有field・派生field・uid/updatedAtだけを保存する。validation用default補完をpatchへ混ぜず、他section、unknown field、createdAt、誤訂正後の退職field不存在を保持する。

派生closureは、姓名→fullName/確定したdisplayName、姓名カナ→fullNameKana、code/姓名/カナ/displayName/foreignName→最新candidateからtokenMap、prefCode/city/address→prefecture/fullAddressとする。displayName明示値は姓名設定後に反映する案、displayNameKanaは独立値を維持する案である。国籍flag解除時の従属field消去は国籍operation内だけで行う。基本保存で警備/国籍/保険を正規化しない。座標はCONF-0120の回答に従い、外部作用をtransaction再試行callbackへ入れない。

座標取得失敗時の保存可否は回答済みである。新規作成・住所変更時は、入力・認可・競合検証が成功すれば住所を保存し、古い座標を消して未取得を知らせる。住所不変の更新では既存座標を維持する。住所が後から他actorに変更された場合に古い取得結果を保存しないこと、provider失敗とFirestore保存失敗を分けること、未取得表現と結果表示をEMP-02で検証する。実data一括変更や自動再取得を追加する指示ではない。

### 作成・競合・段階移行

EMP-01再開時の判断案は、通常CRUDの安全化に必要な変更と業務仕様の変更を分ける。下表では退職後編集禁止と保険のactor・現行遷移維持を採用済みと明記し、それ以外の技術案を未採用として区別する。

| 判断 | 具体案 | 維持する条件・受入れ |
|---|---|---|
| 基本/国籍の保存 | 専用Callableで最新原本にpatchを重ね、Classとoperation契約を検証。通常可逆fieldはfield限定last-write-wins、同じ編集中sectionの変更通知を受けたら再読込 | User/Auth・退職field・他section・unknown fieldを保持。保存先が不存在ならupdateを拒否し、全文setで再作成しない。国籍解除等で他fieldを消す操作と入社日の相関は局所expectedの対象案 |
| 作成/編集の氏名 | 姓名変更による表示名生成の後に、その保存で明示変更した表示名を適用。表示カナは独立入力のまま | 姓名だけの変更、表示名だけの変更、両方変更を別々に確認。原簿氏名を表示名へ置き換えて帳票の意味を変えない |
| 退職後の通常編集（採用済み） | 基本・国籍・警備員・資格・保険の通常編集を全actorで禁止する。閲覧は維持 | 最新EmployeeがRESIGNEDなら保存拒否。編集中退職も対象。専用誤退職訂正の既存条件を維持し、通常情報訂正の迂回として使わない |
| 保険 | 在職者の現6操作は履歴復元も会社管理者・統括・人事へ許可、手続中条件は現行維持と採用済み。退職後は操作不可。専用保存へ移す方式を設計する | 操作前の対象保険mapと最新値を照合し、historyの二重push/popを拒否。他の保険や基本fieldは保持。行政手続・保険料計算・監査制度を追加しない |
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

全項目read採用によりDTO比較は不要。archiveの方式と必要な従属writer保護はADR 0060へ更新した。通常保存/氏名・段階移行の詳細とarchive工程配分はEMP-01の残作業である。以下の設計をruntime検証済みとは扱わず、EMP-02準備完了の判定と区別する。

## Employeeのarchive設計

承認済みの別collection移動・従属なし・会社管理者/統括・非連鎖削除を満たす実装設計である。API名、保存fieldのexact schema・個別writer差分は実装工程のcontractへ落とす。旧直接物理削除案・状態flag比較はADR 0057/0058とGit履歴を参照し、現行案と混在させない。

### 専用操作と閲覧

- 専用Callable入力は`employeeId / reason / operationId`の3つを基本とし、任意path・tenant・原本snapshotをclientから受け取らない。現在Authと同社の有効な本登録会社管理者/統括をserverで検査し、System状態もSiteと同じく確認する。
- transaction内で現在User、通常Employee、同ID `Employees_archive`、従属catalogを読む。原本は誤登録・重複として指定され、状態はACTIVE/RESIGNEDを識別する。RESIGNEDを「履歴不要」の根拠にはせず、保持すべきlifecycle/業務参照があれば拒否する。通常編集でRESIGNEDを変える抜け道にしない。
- snapshotはEmployeeの検証済みraw fieldと欠損状態を保持し、schema初期値で既存dataを補完・正規化してから移さない。形式version、原本snapshot、実行者・server時刻・理由・操作IDのenvelopeを作成し、同transactionで原本をdeleteする。既存archiveへの上書き、原本/archive両存、不正形式、検査失敗はwrite 0で拒否する。Employeeのexact snapshot schemaはEMP-01残contractとして確定する。
- 応答不明時は同じactor・対象・理由・操作IDを照合し、確認できた同一archiveだけを再送成功とする。不存在だけを成功扱いにしない。UIは成功後に通常一覧/候補/cacheから外し、古いdraftからの更新はnot-foundとして拒否する。
- 推奨read案は`Employees_archive`のclient直接read/CUDを拒否し、今回通常のarchive一覧・restore画面を設けない。原本全項目readからarchive readへ許可を広げない。必要なarchive確認は後続の管理操作で限定提供する。この閲覧案の採否は、通常Employeeの全項目read回答とは別にreviewする。
- 旧generic delete/restoreと旧全文setによる再生成を閉じ、通常作成は同ID archiveがあれば拒否する。`functions/modules/Employees.js`のUser削除triggerはarchiveからUser/Authを消す作用を停止し、遅延旧eventもUserを削除できないことを確認する。既存UWB退職・User削除専用operationは保持する。

### 依存catalogと必要な保存境界

Employeeが誤登録なら、そのIDへの保存済み参照は正常な過去参照として除外しない。Siteの下流siteId snapshot除外をEmployeeへ流用しない。次のcatalogを設計対象とし、各field・writerの網羅を実装前の静的照合と対応testで閉じる。queryは原則存在検出の`limit(1)`、型・欠損の既知不整合は拒否する。

| 対象 | archive拒否の対象・必要な変更 |
|---|---|
| SiteOperationSchedules / OperationResults | 実従業員明細に含まれるID。保存候補から導くemployeeIdsとの一致を強制。作成/複製/実績化は全ID、更新は追加IDだけ通常Employeeを検査 |
| ArrangementNotifications | 従業員のemployeeId。外注明細をEmployeeとして判定しない。作成・参照変更の存在確認と直接write拒否条件を追加 |
| DailyAttendances / DailyOperationsByEmployee / SiteEmployeeHistories | employeeIdを保持する本人の業務記録。新規作成・背景再生成のtransactionで通常Employeeを読む。参照元の削除/訂正・不要な集約の削除は既存計算を維持 |
| Users / EmployeeUserReservations / lifecycle | User.employeeId、Employee予約、対象Employeeに対応するlock/head/operation。専用writerの既存Employee読取りを再利用できるか確認。記録あり/不整合を拒否し、User/Auth/監査を消してarchive可能にしない |
| Billingsの埋込みOperationResults | 埋込みEmployee IDも拒否対象にする設計。単純なroot employeeId queryでは検出できないため、保存済みsnapshotから導出するroot employeeIdsを検索用に追加する案。金額・明細snapshotの意味は変えない。更新する全経路で候補から再計算し、追加Employeeの存在を同transactionで確認する。直接writeの索引偽装を閉じる |

archiveで検索に使う索引は、Billingの新fieldだけでなく、既存予定・実績のemployeeIdsと実明細の一致も開放前の確認対象とする。旧Rulesで一致が強制されなかった既存dataを、新writer導入だけで整合済みと扱わない。対象tenant・collection・fieldを限定して整合を確認し、必要な補正は別承認のmigrationとして扱う。未確認・不一致・検査不能の対象ではarchiveを開放しない。全repositoryの全件走査へ広げない。

Billingのquery用field案は、既存dataの欠損が「参照なし」となるためbackfill/整合確認がarchive開放の条件になる。EMP-01で対象writer・index・影響を確定し、実環境は別承認の限定migrationを行う。実行未承認のまま全Billing走査・無条件index追加を行わない。検索fieldを追加せずtransactionで全埋込みを読む代替は件数・処理上限の根拠が不足するため既定にしない。query可能性が未解決の間はarchiveを開放しない。

### 読取り負担と競合対策

保存境界で読んだ現在documentとcandidateの実明細から、重複を除いた`追加ID = 保存後ID − 保存前ID`を算出する。clientの古いdraftや申告配列だけから差分を決めない。変更なし・削除・並替え・同じ従業員の時間等の更新ではEmployee存在確認の追加readは0、新規10人なら最大10種類のEmployeeを読み、1人入替えなら新しい1人を読む。これはEmployee存在確認だけの設計上の数であり、認可・document取得・競合再試行等の総課金read数ではない。

複数IDの新設/変更をRulesのdocument access上限や配列検証へ押し込まず、必要なworker明細操作を専用server保存へ寄せる設計を推奨する。参照不変のclient更新は、Rulesで実明細との対応と参照不変を証明できる範囲だけ残す。証明できない明細更新は同じserver operationで扱い、そこで追加IDだけを読む。配置の既存即時表示を維持し、保存拒否時のrollback・正本再取得・再試行を同時に検証する。新しい従業員数の上限を便宜的に追加しない。

参照の検査と保存は同transactionで行う。archive側も同じ原本と依存を検査することで、参照保存が先ならarchiveを拒否し、archiveが先なら参照保存を拒否する。背景処理も同じ条件に従い、既存参照・索引の不整合を正常扱いしない。参照writerが揃う前にarchiveだけを提供しない。

### 物理削除と実装順

物理削除は[共通設計案](archive-restore.md#物理削除の設計案)へ分離する。通常原本の直接削除は提供しない。使用済みIDの最小記録・運用・保持が決まるまではpurgeを未提供としてarchive本体を維持できる。purgeを検討中であることをarchive安全性の完成証拠にも、通常CRUDの停止理由にもしない。

実装順案は、EMP-02〜04の通常writer保護 → 参照writer・Rules・必要な既存data対応 → 旧削除trigger/再生成対処 → 専用archiveと候補/cache除外 → 機能間回帰。具体工程・重みはロードマップの未確定事項として残す。purgeを通常CRUDへ紛れ込ませず、設計review後に提供工程を定める。

受入れは、許可2actor/人事拒否/他tenant、参照0件/各従属あり/検査失敗、archive対参照保存の両順序、既存索引の欠損/実明細不一致・明細/索引偽装、10人参照不変/1人追加の実read測定、複製/実績化/通知/遅延再生成、User/予約/lifecycle競合、旧削除event、同ID再作成、応答不明・別actor/別操作再送を含む。他Employee/Outsourcer・金額/集計・過去snapshotが変わらないことも確認する。今回の設計reviewはこれらのruntime成功を示さない。

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
