# Employee（従業員）マスター実装調査

2026-09-06の最新方針は[現行仕様](../specification.md#employeeの操作権限と保持)と[共通データ仕様](../specification.md#共通データ仕様)、[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)を参照する。archiveは別collection移動に戻し、必要な従属writerの保護を設計する。以下は静的実装事実と未実装の設計であり、適用・進捗は[Employeeロードマップ](../roadmaps/employee.md)を正とする。

## EMP-02での実装差分

作成・基本・国籍は`functions/apis/saveEmployee.js`の専用Callable、`functions/modules/employees/saveEmployee.js`のtransaction保存、`functions/shared/employeeContract.js`の共有契約へ移した。`components/Employee/Editor.vue`と`useEmployeeEditor.js`はraw snapshotから独立draftを作り、保存await・拒否時の入力保持・明示再読込・応答不明の照合を扱う。基本住所入力、明示表示名優先、国籍解除の従属値消去を同じ保存契約へ揃えた。

原本とarchiveのRulesは会社管理者・既知6業務roleのreadへ限定し、直接client CUDと汎用/nested迂回を拒否する。作成入口は在職一覧に集約した。警備員・資格・3保険はEMP-03/04の移行まで一時read-onlyで、User/退職の専用操作は維持する。新規Employeeの保険世代値は3種とも0を保存するが、保険遷移の実装はEMP-04に属する。住所の座標取得は専用adapterへ移し、失敗時の住所保存・旧座標消去・遷移後にも残る通知を実装した。実provider接続とDev反映は未実施。

各工程の検証結果・未検証・適用判定は[local検証記録](../verification/employee-02-04-local.md)と[ロードマップ](../roadmaps/employee.md)を参照する。

## EMP-03での実装差分

警備員登録は`updateEmployeeSecurity`と既存EmployeeEditorのsecurity操作、資格は`updateEmployeeCertifications`と`useEmployeeCertifications.js`の専用draftへ移した。警備員登録解除は9fieldのraw期待値を照合し、関連defaultだけを保存する。資格の入力行はCertificationの明示validationを行い、配列全体のraw期待値と原本位置でadd/update/removeを実行する。名称由来keyや表示順を保存対象行のIDにしない。変更しない行・unknown field・Timestamp精度を保持する。

詳細の警備員・資格編集を再開し、3保険だけをEMP-04までread-onlyにする。資格の再読込みは古い行位置を破棄して再選択を求める。表示用Tableの名前key依存と到達しない編集actionを除き、実操作は専用dialogへ集約した。工程の受入れ完了は上記roadmap/検証記録を参照する。

## 現行経路の再照合

2026-09-06、EMP計画/EMP-01で当時のcode、installed schema、Rules、test sourceを再照合した。以下は改修前の静的確認履歴であり、上記の実装差分で置換された経路を含む。runtime・実data・Devの現在状態の証拠にはしない。工程・進捗は[Employeeロードマップ](../roadmaps/employee.md)、未採用契約の判断は[確認事項台帳](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)を正とする。

| 操作/境界 | 現行事実と主な根拠 | 対応する設計・実装条件 |
|---|---|---|
| 通常作成・編集 | `pages/employees/index.vue`→`components/Employees/Manager/index.vue`、詳細→`components/Employee/Manager/index.vue`はmodel create/update。client adapterはupdate時に全文set。基本・国籍・警備員を同じlive Employeeから編集する | 専用draft/operation、最新candidate検証、所有fieldだけ保存。基本inputの`address`漏れを扱う |
| 保険・資格 | 詳細の3保険/資格はlive map/配列のv-model変更後、`submit:complete`でEmployee全体update。保存PromiseはManager成功判定の外 | 保存await、確定拒否時draft保持、応答不明の照合、history/配列の局所競合。local-only例外にしない |
| User/退職 | `Employee/UserManager.vue`は専用仮User作成・削除composable、`Employee/LifecycleActions.vue`は専用退職・訂正controllerを使う。旧schema methodや削除triggerの存在と通常UI到達は別 | [ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)/[0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)の予約・actor・Auth非復元を維持。User panelはshellだけ整理 |
| Rules | Employeesは同社の有効な本登録Userへ全文read、ACTIVE条件付きcreate、退職3field保持付きupdateを許可しdelete拒否。Employees_archiveは同社read/writeを許可し、汎用matchの除外にも含まれない（`firestore.rules`） | roleなし等の過剰read/writeを現存riskとする。archiveは個別/汎用/nested双方を閉じる設計が必要 |
| 名前・code | 名前setterはdisplayNameを再生成、displayNameKanaは別保存。tokenFieldsはcode/姓名/カナ/foreignName/displayName。`EmployeeSelect`は`DailyAttendance/Index`から到達し、任意codeへlocaleCompareする | 氏名同時変更時は明示表示名を優先。空code表示修正と新しい採番/一意性仕様を分離 |
| 一覧・検索 | 在職一覧は空検索で全件、フリガナ順。退職検索は空なら0件、非空で検索する。退職一覧にも共通Managerのplusが描画される。退職検索にlatest-wins/error/loading管理がない | 在職一覧への作成入口集約、検索race/状態表示。manualの空検索最近10件記述は訂正対象 |
| 期間reader | `useEmployeesInRange`はACTIVEの入社日、RESIGNEDの入退社日で直接購読。配置・勤怠・従業員別稼働が使う | 入社日訂正は表示対象期間へ影響。reader切替で必要な更新反映を維持し、transaction dataは再集計しない |
| ID reader | Worker/Tag/履歴はcurrent displayName、通知文はdisplayName/title、勤怠exportはcode/fullName、worker autocompleteはID/候補表示を使用 | 空cache/既選択ID/退職者も許可fieldだけで解決。過去時点の名前snapshot機能とはしない |
| Class/cache | `Employee/ListItem`は取得値をEmployee.initializeへ渡す。fullName/Kanaはclass accessorで姓名から再導出。`useFetchBase`はSchemaClassのinstanceofを要求し、既存IDのpushは更新しない | 全項目readを維持しDTO化しない。Employee Classの表示互換を保ち、cache更新・削除・権限喪失を確認する。全文readと全文writeを混同しない |
| 背景処理 | 通知作成はEmployeeの現在名を読む。勤怠/日次/履歴/Billing同期はOperationResult起点。Employee通常updateがこれらを再構築する経路は確認していない | 通知既存本文/業務recordを遡及変更しない。reader互換とwriter改修を分離 |
| 地理情報 | EmployeeはGeocodableMixin、client plugin→geocoding Callable→外部providerの経路を持ち、utilityに座標/住所logがある | 将来の現場・自宅経路図のため取得保存を継続。失敗時も住所保存・旧座標消去・未取得通知を採用済み。最新住所照合・log・専用保存境界は下記の未実装設計。今回外部接続・座標削除なし |

既存testではUWB policy/use-case、仮Userの専用controller接続、Employee lifecycle field/deleteのRules拒否を確認するsourceがある。これは通常CRUD・3保険・資格の完了証拠ではない。既存source testがshell名へ依存する場合は、移行時に保存/認可/feedbackの実契約へ対応づける。

`EmployeeAutocomplete`のcreatable枝、`ScheduleCalendar`は今回の静的検索で現在の到達callerを確認できない候補であり、runtime全経路で不使用と証明したものではない。

## EMP-01最終案の位置付け

2026-09-06、利用者が最終提案を採用し確定を承認した。表示名/作成導線、archive閲覧、段階移行/提供工程を含む確認済み要件は[現行仕様](../specification.md#employeeの操作権限と保持)、工程配分は[ロードマップ](../roadmaps/employee.md)を正とする。以下は採用要件に対応する設計契約であり、見出しの「案」は既存link維持のため残す。その後EMP-04までの連続実施が承認された。工程別の適用済み部分は冒頭の実装差分、現在の適用状態・次工程はEmployeeロードマップを参照する。

### 通常保存の技術契約

| 項目 | 設計契約 | 拒否・成功・再試行の扱い |
|---|---|---|
| 保存単位 | 作成、基本、国籍、警備員登録、資格配列、保険種別ごとの遷移を専用Callableと共有operation contractで実装。原本は単一Employeeを維持 | tenantは認証contextで確定。現在Auth/User・許可role・最新ACTIVE・許可field・型/相関をserverで検証。直接client CUDと汎用matchの迂回を閉じる |
| 通常更新 | 基本・国籍・警備員の変更fieldだけを最新原本へ重ね、派生fieldとuid/updatedAtを必要時だけ保存 | no-opはwrite 0。通常可逆fieldはlast-write-winsを受容。同じ編集sectionの外部変更を受信したらdraftを保持し再読込を要求する。通知前の競合が残ることを明示 |
| 相関する変更 | 入社日変更は開始時点のdateOfHire、国籍/警備員flag解除は消去対象のfield群、資格は配列全体、保険は当該保険map全体を局所期待値として照合 | 全Employeeのrevision/lockは追加しない。不存在とnullを区別。対象が変わっていればwrite 0・入力保持・再読込。別sectionの更新は保持 |
| 資格の行識別 | 現Certification.keyはname由来なので永続IDにしない。操作はadd/update/remove、更新/削除は開始時の配列と行位置を指定し、serverが期待配列全体の一致を確認して対象行だけ変更 | 同名行でも位置を誤らない。別行の同時変更も上書きせず競合拒否する。新資格ID・配列自動merge・新たな重複資格禁止は追加しない。name/type/issuedBy/issueDateAt/expirationDateAt/serialNumberを入力対象とする |
| 保険の再送 | 3保険それぞれで現6操作を維持し、保険mapと当該保険の巻き戻さない世代値を期待値として正規遷移を計算 | 喪失→履歴復元で同じmapに戻っても古い要求は拒否。世代値を同transactionで進め、historyの二重push/popを防ぐ。原本再取得で反映有無を案内し、曖昧なら結果不明を保つ |
| 作成 | dialog開始時に新規IDを生成してmemory保持。serverは同ID原本/archive不存在の場合だけcreate。新規ACTIVE・既定の従属field・actor/時刻をserverで確定 | ID再生成による自動再送をしない。既存同IDを上書きしない。応答不明は同IDを現在権限で取得し、入力とserver派生値を照合。後続変更で照合不能なら成功断定しない。同dialog中のみ復旧支援し、PII draftを永続化しない |
| 住所と座標 | [共通設計](address-geocoding.md#共通仕様との対応2026-09-06)を使う。取得対象は現fullAddressのprefCode/city/address。location/geopoint未取得は共にnull | 取得前に認可・入力を検査し、外部処理後の最終transactionで現在認可・ACTIVE・取得基準住所を照合する。古い結果は保存しない。preflightで住所同値でも最終candidateで新たな住所変更になった場合はwrite 0で競合拒否する。国籍/保険等では取得0回。無期限に保存を待たせずprovider timeoutを取得失敗として住所保存へ進める |
| raw保存 | 検証用Classと永続化patchを分け、既存rawのunknown field・不存在・他sectionを保持 | schemaの全beforeUpdateやconverter出力で全体setしない。入力のunknown/dotted field、prototype経由field、非finite値、不正日時は拒否する |
| 日時と期待値 | wireでは日付入力と局所期待値を別codecで扱う。入力日付は有効なJST暦日を表すYYYY-MM-DDを受け、現schemaに必要なDateへ変換。期待値はTimestampのseconds/nanoseconds・不存在を失わないtag付き値でrawと比較 | 任意Date.parseに委ねず、不正暦日・余分なfield・型偽装を拒否。既存の時刻を期待値codecで日付だけに丸めない。入力変更のない日時fieldは書かない |

editor開始時の期待値は、converterを通さない原本snapshotから、対象field/map・保険世代値・Timestamp精度を同時に取得する。表示用Classとは別のmemory contextに保持し、Class初期化で消えたfieldを「legacy不存在」と扱わない。取得失敗・権限不足・途中の取得状態では保存不可とし、再取得後に開始する。原本snapshotでmapの不存在を確認した場合だけlegacy 0を適用する。新collectionや専用read APIは追加しない。既存raw購読を再利用する場合も原本とcontextの同時点性を維持する。

編集中のlistener更新で世代値だけを新しくして古いdraftへ組み合わせない。外部変更時は入力を保持して再読込を求め、明示再読込でdraftとraw期待値を一緒に置換する。保存後・再開時も原本snapshotから取得できること、Classに世代値が現れない場合・取得失敗・古い応答を受入れ試験へ追加する。閉じる/tenant・権限変更ではcontextを破棄し、PIIを永続化・log出力しない。

保険の世代値はEmployee内のapplication所有field `insuranceOperationVersions`へ、healthInsurance/pensionInsurance/employmentInsuranceの3つの非負safe integerを持たせる設計とする。履歴復元でも巻き戻さず、成功した対象保険操作だけを1増加し、上限時は拒否する。全Employee共通revision・lock・操作台帳へ広げない。新規Employeeはserverで3つを0に初期化する。既存documentでmap自体が存在しない場合だけlegacyの3つの0として扱い、最初の成功する保険操作と同transactionで保存する。mapが存在する場合のnull/欠損key/不正型は0へ補正せず拒否する。通常の他section保存はこのfieldを保持し、clientに変更させない。別packageのschemaに追加せず専用raw patchで保存し、archive snapshotの既知optional fieldとして検証・保持する。一括backfillは既定にせず、旧writerの拒否と共存条件をEMP-04/09で検証する。

mapだけの比較ではA→喪失→履歴復元→A後の古い喪失要求を識別できないため、この限定metadataを加える。受入れには「喪失→復元→古い喪失要求」「復元→再加入等→古い復元要求」、世代値不存在/null/不正・別保険同時変更を含める。拒否時はwrite 0とし、過去操作の結果を特定できない応答不明を成功断定しない。

入力fieldは下表を正とし、資格/保険の具体配列構造は現schema・保険調査へ従う。API識別子や内部helper名の選択は通常の実装詳細であり、別の業務承認事項にしない。各工程で直接回帰・代表UI・同時保存の失敗経路を検証する。

### 利用者へ提示する操作案

- codeは任意・手入力・重複可を維持する。姓名だけの変更では現schemaの表示名生成を維持し、同じ保存で表示名を明示変更したときは明示値を最後に適用する。表示名カナは独立入力を維持する。
- 在職一覧は空検索で一覧、退職検索は空なら0件を維持。新規登録を在職一覧に集約し、退職検索のplusは外す。通常候補のACTIVE/RESIGNEDおよび期間内在籍者は現条件を維持し、新規配置を在職者だけへ制限しない。
- archive閲覧は通常Employeeと同じ会社管理者・既知6業務roleへ全項目を許可する。同社User全員へは開かず、直接CUD・復元は禁止する。通常一覧/候補へ混ぜず、今回archive管理一覧は新設しない。この閲覧範囲は最終回答で明示採用された。
- localのEMP-02中は未移行の警備員/資格/保険editorを一時read-onlyとし、EMP-03/04で再開する。UWB専用操作は維持し、Devへ途中状態を反映しない。旧全文writerを暫定許可して移行済fieldへ書ける状態にはしない。

## EMP-01の保存・読取り契約案

通常編集・退職・誤登録archive/物理削除のactor、既知業務roleへの全項目read、自宅座標取得の必要性は採用済みである。退職後の通常編集禁止、在職Employeeの保険履歴復元actorと現行遷移維持は[ADR 0059](../decisions/0059-employee-retired-edit-and-insurance-operation-boundary.md)で追加採用済み。保存operation・競合の技術選択は上の最終案へ集約する。操作表示・archive閲覧・段階移行/工程割当も最終回答で採用済み。保持期限等の将来判断は[CONF-0061](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)、[CONF-0065](pending-confirmations.md#conf-0065-employee-code表示名退職者候補の規則)、[CONF-0120](pending-confirmations.md#conf-0120-employee個人住所geocodingの目的同意保持)で扱う。

### EMP-02の入力と保存対象

| operation（仮称） | 直接入力field | 制御点 |
|---|---|---|
| 作成 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, title, gender, dateOfBirth, zipcode, prefCode, city, address, building, mobile, email, dateOfHire | 現作成入力18field。初期remarks、ACTIVE、国籍/警備/3保険/資格のdefault、actor/時刻はserver確定。保険/資格/User/lifecycle操作を混在させない |
| 基本 | code, lastName, firstName, lastNameKana, firstNameKana, displayName, displayNameKana, gender, dateOfBirth, dateOfHire, title, zipcode, prefCode, city, address, building, mobile, email, remarks | 会社管理者・統括・人事へ同じ入力範囲を許可し、他roleの更新を拒否。住所の編集漏れを補う。変更したfieldだけpatch |
| 国籍 | isForeigner, foreignName, nationality, residenceStatus, hasPeriodOfStayLimit, periodOfStay, hasWorkRestrictions | false化に伴う従属消去も同operation所有とする |

現在のClass共通必須・長さ・相関を維持し、unknown/dotted field、型偽装、非finite/不正Dateをoperation境界で拒否する。日付は現在のJST暦日という意味を維持し、新しい生年月日/入社日相関・番号制度を推測で追加しない。User/Auth/予約/退職3fieldは通常updateの入力にも派生closureにも含めない。

serverは最新raw documentを取得し、不存在とnullの区別を保持してcandidateを構築する。Classとoperationをserverで検証できる専用Callableを使用する設計とする。Employee.update/beforeUpdateの全体hookをそのまま使わず、operationの変更だけを正規化し、実際に変更した所有field・派生field・uid/updatedAtだけを保存する。validation用default補完をpatchへ混ぜず、他section、unknown field、createdAt、誤訂正後の退職field不存在を保持する。

派生closureは、姓名→fullName/確定したdisplayName、姓名カナ→fullNameKana、code/姓名/カナ/displayName/foreignName→最新candidateからtokenMap、prefCode/city/address→prefecture/fullAddressとする。displayName明示値は姓名設定後に反映し、displayNameKanaは独立値を維持する。国籍flag解除時の従属field消去は国籍operation内だけで行う。在留期間制限の解除（hasPeriodOfStayLimit=false）も現schemaの相関を維持し、periodOfStayをnullへ戻す。この解除では開始時点のhasPeriodOfStayLimitとperiodOfStayを局所期待値で照合する（isForeigner=falseなら国籍field群全体）。解除と従属field入力を混在させても、最終candidateの消去値と実際のpatchを一致させる。基本保存で警備/国籍/保険を正規化しない。座標はCONF-0120の回答に従い、外部作用をtransaction再試行callbackへ入れない。

座標取得失敗時の保存可否は回答済みである。新規作成・住所変更時は、入力・認可・競合検証が成功すれば住所を保存し、古い座標を消して未取得を知らせる。住所不変の更新では既存座標を維持する。住所が後から他actorに変更された場合に古い取得結果を保存しないこと、provider失敗とFirestore保存失敗を分けること、未取得表現と結果表示をEMP-02で検証する。実data一括変更や自動再取得を追加する指示ではない。

### 作成・競合・段階移行（最終案整理前の比較履歴）

現在の技術選択は上の最終案を参照する。以下は比較の経緯であり、同じ技術項目の再質問を要求しない。

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

全項目read・保存契約・archive形式・依存query/必要writer・操作表示・段階移行/提供工程を確定した。最終採用反映の独立review・検証結果と次工程判定は[ロードマップ](../roadmaps/employee.md)へ集約する。以下の設計をruntime検証済みとは扱わず、EMP-02以降の実装・検証で確認する。

## Employeeのarchive設計

承認済みの別collection移動・従属なし・会社管理者/統括・非連鎖削除を満たす実装設計である。保存形式と依存queryは下記へ固定し、API名・個別writer差分は実装工程で具体化する。旧直接物理削除案・状態flag比較はADR 0057/0058とGit履歴を参照し、現行案と混在させない。

### 専用操作と閲覧

- 専用Callable入力は`employeeId / reason / operationId`の3つを基本とし、任意path・tenant・原本snapshotをclientから受け取らない。現在Authと同社の有効な本登録会社管理者/統括をserverで検査し、System状態もSiteと同じく確認する。
- transaction内で現在User、通常Employee、同ID `Employees_archive`、従属catalogを読む。原本は誤登録・重複として指定され、状態はACTIVE/RESIGNEDを識別する。RESIGNEDを「履歴不要」の根拠にはせず、保持すべきlifecycle/業務参照があれば拒否する。通常編集でRESIGNEDを変える抜け道にしない。
- snapshotはEmployeeの検証済みraw fieldと欠損状態を保持し、schema初期値で既存dataを補完・正規化してから移さない。形式version、原本snapshot、実行者・server時刻・理由・操作IDのenvelopeを作成し、同transactionで原本をdeleteする。既存archiveへの上書き、原本/archive両存、不正形式、検査失敗はwrite 0で拒否する。exact envelopeとraw保持の条件は次の保存形式に固定する。
- 応答不明時は同じactor・対象・理由・操作IDを照合し、確認できた同一archiveだけを再送成功とする。不存在だけを成功扱いにしない。UIは成功後に通常一覧/候補/cacheから外し、古いdraftからの更新はnot-foundとして拒否する。
- archive閲覧は明示採用により原本と同じ7actorの全項目get/listを許可する。直接client CUD/restoreは個別・汎用・nested双方で拒否する。通常一覧/候補へ混ぜず、archive管理一覧は新設しない。
- 旧generic delete/restoreと旧全文setによる再生成を閉じ、通常作成は同ID archiveがあれば拒否する。`functions/modules/Employees.js`のUser削除triggerはarchiveからUser/Authを消す作用を停止し、遅延旧eventもUserを削除できないことを確認する。既存UWB退職・User削除専用operationは保持する。

### archiveの保存形式

新規envelopeのexact keyは`schemaVersion / employee / audit`、versionは整数1。`audit`のexact keyは`operationId / reason / actorUid / archivedAt`とし、理由はtrim後1〜200文字、IDは1〜128文字のpath-safe文字列、日時はserver Timestampとする。入力は`employeeId / reason / operationId`だけを受け取る。clientにaudit・原本・保存pathを指定させない。

`employee`はtransaction内で読み取ったraw snapshotをそのまま保持する。次の既知fieldを検証し、未知fieldは元データの一部として無加工で保持する。unknown入力を許可する意味ではない。`new Employee(raw).toObject()`、JSON往復、保存hook、外部geocodingをarchiveのコピーに使わない。

| 検証する既知部分 | fieldと条件 |
|---|---|
| 識別・監査 | docIdは対象pathと一致、uidは非空識別子、createdAt/updatedAtはTimestamp。内部propertyを補完しない |
| 基本・国籍 | 上のoperation field表に従う。現在schemaの必須・型・長さ・相関を検証用candidateで検査し、optional不存在をコピー時にdefault補完しない |
| 警備員登録 | hasSecurityGuardRegistration, dateOfSecurityGuardRegistration, bloodType, emergencyContactName, emergencyContactRelation, emergencyContactRelationDetail, emergencyContactAddress, emergencyContactPhone, domicile。現条件付き必須を維持 |
| 資格 | securityCertifications。各entryのname/type/issuedBy/issueDateAt/expirationDateAt/serialNumberと、存在するkeyの型を確認。未知fieldは保持し、name由来keyをarchive時に再生成しない |
| 保険 | healthInsurance/pensionInsurance/employmentInsurance。status/previousStatus/enrollmentDateAt/number/lossDateAt/lossReason/isProcessing/isRetire/historyの既知型・現schema条件を確認。history entryのstatus/previousStatus/enrollmentDateAt/lossDateAt/lossReason/numberを保持。履歴を再計算・消去しない |
| 保険操作metadata | insuranceOperationVersionsは既知optional field。存在するなら上記3key・非負safe integerを検証し、存在しなければarchiveで補完しない |
| lifecycle | employmentStatusはACTIVE/RESIGNED。RESIGNEDではdateOfTermination/reasonOfTerminationと入社日の相関を検査。ACTIVEの退職2fieldは不存在とnullを区別して保持する。誤退職訂正が2fieldをdeleteする現契約に従う |
| 派生・座標 | fullName/fullNameKana/fullAddress/prefecture/tokenMap/location/geopointは存在する既知型を検査。座標値は有効範囲・有限性を確認。古い派生値をarchive操作で正規化・修復しない |

日時はrawではTimestamp、検証用candidateだけDateへ変換する。未知fieldを含むrawと`envelope.employee`の深い同値、欠損/null・入れ子の未知fieldをtestする。形式不正・コピー不能・保存容量等でcommitが失敗した場合は原本を保持し、archive成功とは扱わない。legacy archiveのflat形状は新envelopeの再送成功対象にせず、同ID衝突として拒否する。既存archiveの一括変換・復元は追加しない。

### 依存catalogと必要な保存境界

Employeeが誤登録なら、そのIDへの保存済み参照は正常な過去参照として除外しない。Siteの下流siteId snapshot除外をEmployeeへ流用しない。次のcatalogを設計対象とし、各field・writerの網羅を実装前の静的照合と対応testで閉じる。queryは原則存在検出の`limit(1)`、型・欠損の既知不整合は拒否する。

`P = Companies/{認証済みcompanyId}`、`E = 対象Employee ID`。archive transactionで次を読み、状態・期間・処理完了を理由に参照を除外しない。

| 保存先 | 検査方法 |
|---|---|
| P/SiteOperationSchedules、P/OperationResults | employeeIds array-contains E、limit(1) |
| P/ArrangementNotifications、P/SiteEmployeeHistories、P/Users | employeeId == E、limit(1)。Userの仮/無効も拒否 |
| P/EmployeeUserReservations/E | document直接取得。存在・不整合は拒否 |
| P/EmployeeLifecycleLocks/E、P/EmployeeLifecycleHeads/E | document直接取得。headは完了済みでも拒否 |
| P/LifecycleOperations | employeeId == E、limit(1)。種類・状態で除外しない |
| P/Billings | 新規query用employeeIds array-contains E、limit(1) |
| P/DailyAttendances、P/DailyOperationsByEmployee | 本人IDと埋込み全実績の従業員IDの和集合を持つ新規employeeIds array-contains E、limit(1) |

`UserLifecycleLocks`はUser UIDキーでありEmployee IDでgetしない。Userが存在すればその時点で拒否する。LifecycleOperations配下のEventsは親operation存在で拒否できるためcollection-group検索を増やさない。global UserEmailReservationsをEmployee IDで検索しない。孤立event・不整合が実際に判明した対象は正常と扱わず、別の限定repairとして処理する。

### 埋込み参照・索引・保存経路

静的再確認で、勤怠と従業員別稼働は該当本人の明細だけでなくOperationResult全体を保存すると分かった。Aの勤怠内にもBへの参照が残るため、root employeeIdだけの検査案を修正する。Billingと合わせた3collectionへ、保存candidateの実参照から導くroot employeeIdsを追加する設計とする。これは業務計算やsnapshot内容を変更しない検索用dataである。

導出元はOperationDetailの`isEmployee === true`かつ`id`、予定/実績のemployees、埋込みoperationResultsの全従業員明細とする。既存の申告employeeIdsや派生employeeIdだけを信頼しない。外注明細は除き、各元配列の形状と明細の整合を検査し、重複を除いた安定順のID集合にする。日次2collectionではroot本人employeeIdも和集合へ含める。不正明細をskipして索引から落とさない。

| 保存境界 | 所有する対応・実source |
|---|---|
| 予定 | `utils/siteOperationSchedule/siteScheduleGuard.js`の単件/複数create/updateと複製。必要なworker明細保存だけserverへ接続し、直接Rules迂回を閉じる |
| 実績 | `handlers/operationResultHandlers.js`と`components/OperationResult/Generator/index.vue`の作成/編集/実績化。明細と索引を同じ境界で確定 |
| 通知 | `composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js`からのnotifyと予定保存hook、ArrangementNotificationのcreate/update。本人種別とid/employeeIdの対応を強制 |
| 勤怠 | `functions/modules/dailyAttendances/`のsyncOperationResultToDailyAttendances、addOperationResultToDailyAttendances、removeOperationResultFromDailyAttendances、saveDailyAttendances。追加・置換・削除・移動元の更新でも索引を再計算 |
| 従業員別稼働 | `functions/modules/dailyOperationsByEmployee/`の対応するsync/add/remove/save4処理。勤怠と同じ索引・追加参照検査を適用 |
| 請求 | `functions/modules/billings/`のaddOperationResultToBilling、removeOperationResultFromBilling、syncOperationResultToBillingの全分岐。新規・同先更新・移動・削除先双方を対象にする |
| 現場履歴 | `functions/modules/siteEmployeeHistories/`のrebuildHistory/rebuildHistories/rebuildAllHistories。生成はEmployee存在を確認、不要履歴削除は現条件を維持 |
| User/予約/lifecycle | `functions/modules/auth/`のcreateTemporaryUser/setupUserAccount/deleteTemporaryUserとlifecycleのterminateEmployee/reinstateEmployee/lifecycleOperationStore/reconcileLifecycleOperations。既存の同transaction Employee読取りと予約排他を照合して再利用する |
| 旧入口 | `functions/modules/Employees.js`のUser削除作用、旧全文set・generic delete/restore、対象collectionの個別/汎用Rulesを閉じる |

新fieldを現Classへ代入するだけで保存できたと扱わない。3collectionの最終保存payloadにraw query fieldを明示合成するapplication内のserver保存処理を使い、同transactionで業務payloadと索引を確定する。既存serializerによるfield消失・二段階writeを避け、通常create/updateだけでなく移動・削除同期をtestする。Classが計算する金額・集約の意味は維持し、package変更を前提にしない。必要な参照readは全writeより先に完了し、背景transactionの途中へreadを追加しない。

既存dataの確認は対象tenantの予定・実績のemployeeIds/実明細、通知のemployeeId/id/種別、日次2種・請求の新employeeIds/全埋込みに限定する。型・欠損が不明なまま「従属なし」としない。承認済み環境でdry-run→必要なquery fieldのbackfill→一致検証を行い、直接/旧writerの迂回が閉じてからarchiveを開放する。未確認・不一致の対象では拒否する。全repository/全tenantを走査しない。

query用fieldの実効schema変更と整合確認は必要だが、実data件数・不整合・対象indexのremote状態は未確認。実行前に対象・backup・dry-run・apply・post-check・旧client停止とrollbackを別承認のreleaseへ固定する。削除後のrollbackで古い広域writerを再開せず、archive機能停止を先に行う。

### 読取り負担と競合対策

保存境界で読んだ現在documentとcandidateの実明細から、重複を除いた`追加ID = 保存後ID − 保存前ID`を算出する。clientの古いdraftや申告配列だけから差分を決めない。変更なし・削除・並替え・同じ従業員の時間等の更新ではEmployee存在確認の追加readは0、新規10人なら最大10種類のEmployeeを読み、1人入替えなら新しい1人を読む。これはEmployee存在確認だけの設計上の数であり、認可・document取得・競合再試行等の総課金read数ではない。

複数IDの新設/変更をRulesのdocument access上限や配列検証へ押し込まず、必要なworker明細操作を専用server保存へ寄せる設計とする。参照不変のclient更新は、Rulesで実明細との対応と参照不変を証明できる範囲だけ残す。証明できない明細更新は同じserver operationで扱い、そこで追加IDだけを読む。配置の既存即時表示を維持し、保存拒否時のrollback・正本再取得・再試行を同時に検証する。新しい従業員数の上限を便宜的に追加しない。

参照の検査と保存は同transactionで行う。archive側も同じ原本と依存を検査することで、参照保存が先ならarchiveを拒否し、archiveが先なら参照保存を拒否する。背景処理も同じ条件に従い、既存参照・索引の不整合を正常扱いしない。参照writerが揃う前にarchiveだけを提供しない。

### 物理削除と実装順

物理削除は[共通設計案](archive-restore.md#物理削除の設計案)へ分離する。通常原本の直接削除は提供しない。使用済みIDの最小記録・運用・保持が決まるまではpurgeを未提供としてarchive本体を維持できる。purgeを検討中であることをarchive安全性の完成証拠にも、通常CRUDの停止理由にもしない。

実装順は、EMP-02〜04の通常writer保護 → EMP-05のreader/参照writer・Rules・索引対応 → 旧削除trigger/再生成対処 → 専用archiveと候補/cache除外 → 機能間回帰。工程配分と重みは[ロードマップ](../roadmaps/employee.md)で確定した。purge実行は後続専用工程（FUT-0146）へ分離し、EMP-01では共通仕様と設計までとする。

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
