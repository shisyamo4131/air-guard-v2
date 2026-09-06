# Employee（従業員）マスター実装調査

2026-09-06の最新方針は[現行仕様](../specification.md#employeeの操作権限と保持)と[共通データ仕様](../specification.md#共通データ仕様)、[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)を参照する。archiveは別collection移動に戻し、必要な従属writerの保護を設計する。以下は静的実装事実と未実装の設計であり、適用・進捗は[Employeeロードマップ](../roadmaps/employee.md)を正とする。

## EMP-02での実装差分

作成・基本・国籍は`functions/apis/saveEmployee.js`の専用Callable、`functions/modules/employees/saveEmployee.js`のtransaction保存、`functions/shared/employeeContract.js`の共有契約へ移した。`components/Employee/Editor.vue`と`useEmployeeEditor.js`はraw snapshotから独立draftを作り、保存await・拒否時の入力保持・明示再読込・応答不明の照合を扱う。基本住所入力、明示表示名優先、国籍解除の従属値消去を同じ保存契約へ揃えた。

原本とarchiveのRulesは会社管理者・既知6業務roleのreadへ限定し、直接client CUDと汎用/nested迂回を拒否する。作成入口は在職一覧に集約した。警備員・資格・3保険はEMP-03/04の移行まで一時read-onlyで、User/退職の専用操作は維持する。新規Employeeの保険世代値は3種とも0を保存するが、保険遷移の実装はEMP-04に属する。住所の座標取得は専用adapterへ移し、失敗時の住所保存・旧座標消去・遷移後にも残る通知を実装した。実provider接続とDev反映は未実施。

各工程の検証結果・未検証・適用判定は[local検証記録](../verification/employee-02-04-local.md)と[ロードマップ](../roadmaps/employee.md)を参照する。

## EMP-03での実装差分

警備員登録は`updateEmployeeSecurity`と既存EmployeeEditorのsecurity操作、資格は`updateEmployeeCertifications`と`useEmployeeCertifications.js`の専用draftへ移した。警備員登録解除は9fieldのraw期待値を照合し、既存の従属初期化値（登録flag false、血液型A、登録日・緊急連絡先一式・本籍地null）だけを保存する。新規作成にも同じ初期化値を使い、入力部品の初期選択値とは区別する。資格の入力行はCertificationの明示validationを行い、配列全体のraw期待値と原本位置でadd/update/removeを実行する。名称由来keyや表示順を保存対象行のIDにしない。変更しない行・unknown field・Timestamp精度を保持する。

詳細の警備員・資格編集を再開し、3保険だけをEMP-04までread-onlyにする。資格の再読込みは古い行位置を破棄して再選択を求める。表示用Tableの名前key依存と到達しない編集actionを除き、実操作は専用dialogへ集約した。工程の受入れ完了は上記roadmap/検証記録を参照する。

## EMP-04での実装差分

3保険は`transitionEmployeeInsurance`、`employeeInsuranceContract.js`、`useEmployeeInsurance.js`へ分離し、InsuranceTransitionManagerを専用dialogへ置き換えた。既存の6操作を計算用Classへ適用し、保存は対象保険内の操作所有fieldと保険別世代値だけのpatchとする。未変更のraw履歴・未知field・Timestamp精度を保持し、Employee全文や保険map全文をClass出力で置き換えない。表示getterのenrollmentDateは既存rawにある場合だけ同期し、不存在なら新設しない。現在の実装・検証段階はロードマップと検証記録を参照する。

保険mapと同時点の世代値をraw snapshotから取得する。世代map全体が不存在の場合だけ初回操作で3種を原子的に初期化し、既存mapでは対象だけを増加する。履歴復元でも減らさず、同じ状態へ戻った後の古い要求も拒否する。別保険の更新は保持する。取得失敗や表示用Classのfield欠落をlegacyと解釈しない。保存不明時は対象map・期待する新世代値・actorを照合し、結果を特定できない場合は不明のまま入力を保持する。

## EMP-05での実装差分

05-Aでは`useFetchEmployee`をEmployee専用のraw購読/sessionへ接続し、現在Authと原本Userの7actor認可、必要IDだけの購読、Class表示互換、検索結果のmembershipと原本cacheの更新を分離した。権限/tenant変更・取得失敗・破棄でcache/search/待機中の取得を無効化し、古い応答を表示へ戻さない。期間queryの対象外と原本不存在を区別し、個別ID購読で確認済みの新raw/不存在を遅延queryで上書きしない。

Employee詳細は原本取得前の仮のEmployeeを表示せず、原本と連携Userの購読を一緒に破棄する。Autocomplete・Tag・Worker表示とSite詳細のEmployee接続は専用readerを使い、読込中・不存在・閲覧不可・取得失敗を区別する。共通cache基盤、Site本体の保存、Employee/Userの既存専用保存は維持した。

05-Bでは`saveOperation`と`operationWriteContract`へ予定・実績・OperationBillingのoperation保存を集約した。最新rawから保存先ごとの追加Employee参照を導き、全read後に所有fieldだけを確定する。予定の即時表示/rollbackには表示Classと同時点のraw contextを接続し、通知状態の管理側・本人側は同じ期待値照合付き部分transactionを使う。購読はserver確認済み値だけを公開し、そのmetadata変更通知も受け取る。計算用instanceのJST補正と寿命条件は下の操作契約を参照する。

05-Cでは`backgroundReferencePlan`・`dailyReferencePlan`・`billingReferencePlan`へ背景保存のraw検査/計算/書込計画を分離した。日次2種とBillingの最終payloadに埋込み全Employeeの索引を合成し、各保存先の現在rawとの差分から追加Employeeを同transactionで読む。履歴は現在のfirst/last実績とSiteを同transactionで確認する。旧`onEmployeeDeleted`は同名の無作用handlerとし、User/Auth削除を行わない。指定tenantの提供rawを検査する`inspectEmployeeReferences`/`runEmployeeReferenceDryRun`は、整合してもarchive開放を許可しない。

取引先請求の入金予定日は`updateBillingPaymentDate`と専用`PaymentDateEditor`/`useBillingPaymentDate`へ移した。日付3fieldと監査だけを部分保存し、日次2種・Billing・履歴の直接client CUDを閉じる。専用UIの背景trigger実行は既定offの明示opt-inで、通常API harnessへの継承はrunnerが除去する。

05-Dのarchiveは`employeeArchiveContract.js`で既知raw/入力/actor/envelopeを検証し、`functions/modules/employees/archiveEmployee.js`で現在Auth・User・System・12従属・同ID衝突を同transactionで確認する。コピーは取得rawを使用し、archive作成と通常原本削除を同時に確定する。通常作成の同ID archive拒否、既存7actor read/直接CUD拒否は再利用した。API factoryは通常indexへ公開せず、専用demo entryだけへ接続する。許可tenant設定は通常用`AIR_GUARD_EMPLOYEE_ARCHIVE_TENANTS`と専用用`AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS`を分け、厳密なJSON文字列配列・既定空集合とする。

専用`ArchiveDialog`/`useEmployeeArchive`は詳細原本の表示領域外に保持し、原本消失後も同sessionの不明な操作結果を確認できるようにする。raw/User表示の破棄と最小attemptの保持を分離し、通常成功後は一覧へ戻る。EMP-05の実装・最終統合をlocalで受け入れた。各内部単位の受入れ範囲・未検証・EMP-06へ渡す境界は[EMP-05 local記録](../verification/employee-05-local.md#05-e-統合次工程review)、現在地はロードマップを正とする。

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

実装担当者は、この節の保存形式・12従属先に加え、下の[EMP-05実装前契約](#emp-05実装前契約)を読む。後者は対象source、内部順序、失敗時の扱い、受入例を補い、確認済みの業務要件を変更しない。レビューの観測事実と検証結果は[実装前レビュー記録](../verification/employee-05-design-review.md)に分離する。

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

## EMP-05実装前契約

### 開発者の読取り順と作業境界

本節は実装前に確定した技術契約であり、全項目の実装完了を意味しない。現在地・実装開始承認は[ロードマップ](../roadmaps/employee.md)、業務要件は[共通仕様・Employee仕様](../specification.md#employeeの操作権限と保持)、理由は[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)を正とする。実装担当は通常startup後に、上記archive保存形式・従属catalog、本節、[設計レビュー記録](../verification/employee-05-design-review.md)を読み、担当checkpointのsourceと照合する。API/helper/testの新しい名前は内部実装詳細であり、既存fileや公開済み機能と誤記しない。

- 目的: Employeeの既存全項目read/表示と期間条件を維持し、全ての必要な参照保存を保護してから誤登録archiveを提供する。EMP-02〜04のraw保持・専用保存を壊さない。
- writer: application/Functions/Rulesは一人のdeveloperへ集中。以下の内部単位を順にreview・検証して統合する。内部単位はEMPの新milestoneではなく、EMP-05の20点を分割加点しない。
- 対象: 本節のEmployee reader、参照を新設・変更・再生成するwriterとRules、検索用fieldと限定整合確認手段、旧削除作用、専用archive、直接回帰test。参照保護で必要となるOperationBillingの保存境界も含む。
- 対象外: 金額計算・配置条件・通知内容の新仕様、User/Authの専用業務変更、全manager/cache基盤の刷新、他masterのarchive、package変更、物理削除/restore/定期処理/全件横断診断。統括退職actorとUser shell全面整理はEMP-06。
- この設計再確認では製品code・Rules・実効schema・実dataを変更しない。将来の実装検証はCodex専用demo/合成data/外部作用deny。Dev・Prod・実data補完・remote設定はEMP-09等の別承認。

### 内部順序と引渡し条件

| 単位 | 所有する作業 | 次へ渡す成果・停止条件 |
|---|---|---|
| 05-A reader | Employee専用の認可付きread/cache、期間reader、詳細の保護情報の破棄 | query/型/初期ID/期間内退職者の互換。権限喪失・古い応答・不存在の試験。archive入口はまだ接続しない |
| 05-B 参照計算と入口 | rawからの参照抽出、保存先ごとの差分、予定/実績/請求編集/通知の専用保存と迂回拒否 | 全入口とoperation所有fieldをtestに対応。既存Site/Customer保護・lock・保存失敗の表示を維持 |
| 05-C 背景保存と準備確認 | 日次2種/Billingのraw取得・検索field保持・移動/削除/再生成、現場履歴、限定dry-run手段、旧Employee削除作用の無効化 | 保存前read完了、索引一致、遅延再生成拒否。User/lifecycleの既存排他を照合。旧trigger無作用をAPI suiteと別に検証 |
| 05-D archive | 上記envelope/12従属/同時保存/応答不明、detailからの専用操作、成功後の通常候補除外 | 全必要writerの保護・検索fieldの整合が前提。未確認tenantはserver側で拒否 |
| 05-E 統合・次工程review | 最終diff、代表UI、全許可/拒否、raw/金額不変、必須gate、cleanup、文書 | 未達をEMP-06/08へ送らない。EMP-06がread/cache/保存境界を迂回しないことを独立確認 |

各単位の委譲前に、下表の具体fileから担当fileと禁止fileを固定する。複数単位の未統合変更を同時に抱えず、source変更後は影響するreview/testを更新する。設計と実sourceが矛盾した場合は当該単位のwriteを止め、原因と必要な設計補正をrootへ返す。単なる内部helper名の決定で利用者へ再質問しない。

### Readerとcacheの契約

現sourceの`composables/fetch/useFetchEmployee.js`は`useFetchBase.js`へ委譲する。共通baseは同IDのpushをskipし、`clearCache()`は検索結果と取得中Promiseを消さない。`composables/dataLayers/employee/useEmployeesInRange.js`は期間queryを購読してcacheへpushするが、期間変更後のsnapshot fetchに世代照合がない。詳細`pages/employees/[id].vue`は汎用`useDocument`と別のUser購読を持つ。これらを既に安全なEmployee read sessionと扱わない。

| 境界 | 実装契約 |
|---|---|
| 認可 | 原本/archiveの採用7actorを既存`employeeAllowed(context, false)`およびRulesと照合。companyId/uid・現在のUser/claimの有効性が不明なら開始しない。通常write用3actor判定をreadへ流用しない |
| 所有scope | Employee専用のfetch/cacheとread sessionへ限定。`useFetch.js`のprovide/injectと現在の呼出名/戻り型を維持し、他masterの`useFetchBase`を一括変更しない |
| 取得・反映 | 同scope内の必要ID取得を重複抑止し、既存の期間購読と必要IDの通常Employee購読から最新値を反映。ID cacheはupsert、検索結果はID集合と最新cacheを対応づける。全Employeeの追加購読・polling・通知collectionを新設しない |
| 検索・候補 | 既存の検索条件/limit/returnAllCachedの呼出契約を維持。通常候補では検索結果外cacheを混ぜない。原本更新で検索語/条件に一致しなくなったIDは結果から外し、必要なら当該queryを再取得する。検索cacheを使う場合もmembershipの再評価と失効が前提であり、過去のClass配列を無条件再利用しない |
| 無効化 | identity/権限変更、購読error、disposeでは、Employeeのitems・検索結果・in-flight所有権・購読・画面の保護値を一緒に破棄し、世代を進める。旧generationの成功/error/finallyは新scopeのdata/loadingを変更しない。現client管理memoryが対象で、配布済みexport等の回収ではない |
| 期間変更 | ACTIVE/RESIGNEDの現条件を維持。期間snapshot fetchは両query結果が同じrequest generationのときだけ公開。queryからの除外は退職/入社日訂正/期間変更でも起きるため、Employee原本不存在と同一視しない |
| 不存在 | 通常原本の不存在確認では当該IDを候補・cacheから除外。過去参照のID自体を書き換えたり、archiveから氏名補完して正常扱いしない。空cache・取得中・取得拒否・不存在を区別し、古いPIIを残さない |
| 詳細 | route/identity/権限/原本不存在で表示rawとUser購読を停止・破棄。read対象がないのに初期値Employeeを編集対象として表示しない。UWB操作そのものは既存controllerを維持 |
| Class/raw | 既存consumerのEmployee表示型、fullName/code/在籍期間を維持。archiveへのrawコピーや保存期待値には表示Classを使わない。clear後の遅延pushも旧scopeとして拒否 |

直接確認するconsumerはEmployee Autocomplete/ListItem/Tag、Worker Chip、Workers Table/DataTable、`useEmployeesInRange`を使う配置/勤怠/従業員別稼働、勤怠export、Site詳細の専用Employee cache。Site専用cacheは`composables/domain/site/siteDetailAccessSession.js`に既存のscope無効化があり、全Site設計を作り直さずEmployee read認可との接続だけ照合する。日時変更によるquery membershipと、同IDの表示更新を別caseにする。追加購読のreadは下記の参照保存時read数とは分けて測定する。

### 保存経路の閉鎖表

上の従属catalogを増やすものではなく、同じ保存先へ到達する経路を具体化する。下記file/symbolは静的確認した既存入口である。新専用moduleはFunctionsのapplication層に置き、schema package内部を変更しない。

| 保存先 | 既存source/到達経路 | 実装時に閉じる境界 |
|---|---|---|
| 予定 | `handlers/siteOperationScheduleHandlers.js`、`composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js`、`components/SiteOperationSchedule/Duplicator/index.vue` → `composables/useSiteOperationScheduleDuplicator.js` → `utils/siteOperationSchedule/siteScheduleGuard.js` | 単件/複数create/update/複製。Site・日付不変の分岐も対象。既存Site revision/配置即時表示を維持 |
| 実績 | `handlers/operationResultHandlers.js`、`components/OperationResult/Generator/index.vue`、`pages/operation-results/[id].vue`のworkers/articles完了event。複製は`components/OperationResult/Duplicator/useIndex.js` → `composables/application/operationResult/useDuplicate.js` → `composables/domain/operationResult/duplicate.js` | 通常編集と実績化、詳細配列編集後のdoc.update、複製のClass writerを同じ参照契約へ。複製の日付/lock/引継ぎ条件、実績createと予定pointer更新のatomic性を保持 |
| 実績の請求編集 | `components/OperationBilling/Manager/index.vue`、`components/OperationBillings/Manager/index.vue`、請求編集画面、`components/OperationBilling/Activator/Base/BtnToggleLock.vue` | OperationBillingはOperationResultsを保存する派生Class。`item.update()`/`toggleLock()`から古い全文・従業員配列を再保存しない。請求項目/lockの所有fieldだけを最新実績へ反映 |
| 配置通知 | 予定actionsとGeneratorからのnotify、`components/ArrangementNotification/Manager/index.vue`。既存本人状態操作は`components/ArrangementNotifications/Manager/index.vue`と`components/ArrangementNotification/Manager/toLeaved.vue` | 本人種別/id/employeeId整合、通知createと予定更新、通知状態変更。notify内部や予定保存hookのwrite後にEmployee readを足さない。本人操作の意味・認可・入力を維持し、既存Class全文保存だけをraw状態部分更新へ接続 |
| 勤怠 | `functions/triggers/operationResult.js` → `functions/modules/dailyAttendances/`のfetch/sync/add/remove/save | fetch段階からraw保持。本人IDと埋込み全従業員の和集合。新規/同先/移動元・先/削除を同契約へ |
| 従業員別稼働 | 同trigger → `functions/modules/dailyOperationsByEmployee/`のfetch/sync/add/remove/save | 勤怠と同じ。保存loop開始前に全targetのreadを終える |
| 請求 | `functions/modules/billings/addOperationResultToBilling.js`、`removeOperationResultFromBilling.js`、`syncOperationResultToBilling.js` | 現在取得と保存が別の同先更新・削除側もtransactionへ。移動元write前に移動先/Customer/追加Employeeを読む。金額計算は変更しない |
| 取引先請求の入金予定日 | `pages/billings/customers/[id].vue` → `CustomerBilling/PaymentDateEditor.vue` → `useBillingPaymentDate` → `updateBillingPaymentDate`。移行前は`useCustomerBillingManager`/`useDocManager`の全文update | 05-Cで既存1操作を専用date editor/Callableへ接続し、Billings直接CUDを閉じる。参照/金額を変えず予定日3fieldと監査だけを保存する。下記補正契約を使う |
| 現場履歴 | `functions/modules/siteEmployeeHistories/rebuildHistory.js`とrebuildHistories/rebuildAllHistories | 現在history・実績・Siteと必要Employeeをtransactionで読む。不要履歴削除は維持 |
| User/予約/退職 | `functions/modules/auth/`のcreateTemporaryUser/setupUserAccount/deleteTemporaryUser、lifecycle関連module | 既存User/予約/Employee/operation/headの排他を再利用。setupはUser/予約がarchiveを阻止するため、機械的にEmployee readを追加しない。仮/無効Userや完了headも除外しない |
| 旧削除 | `functions/modules/Employees.js`、通常entrypoint `functions/index.js` | 旧onEmployeeDeletedのUser検索・削除作用を無効化。同名handlerを無作用化して遅延eventを直接試験。exportを外しただけで既存remote停止済みと記録しない |
| Rules・公開 | `firestore.rules`、`functions/apis/index.js`、`functions/codex-test/index.js` | 個別と汎用/nestedを一緒に閉じる。日次2種は現状個別matchがなく汎用writeへ到達するため明示境界/汎用除外が必要 |

予定の原本期待値は`useSiteOperationSchedulesInRange.js`の原本取得から、`components/SiteOperationSchedule/Card/useIndex.js`、`components/Draggable/Workers/useIndex.js`、`components/Draggable/OperationSchedules/useIndex.js`のclone/initializeを経ても同時点のrawと原本行位置を継承する。表示Classや表示順から原本を推測し直さず、operation専用のmemory contextを使用する。期間/tenant変更・破棄時に旧contextを無効化し、不要な過去modelを強参照で保持し続けない。これは既存の即時表示/拒否時rollback契約の接続範囲であり、共通drag/cache基盤の刷新ではない。

予定worker詳細の`components/SiteOperationSchedule/WorkerDetailManager/index.vue`（`components/Arrangements/Manager/index.vue`から到達）、請求articlesの`pages/billings/operations/[id].vue`も直接updateの接続対象である。handler名の一覧だけで閉鎖済みとしない。

Class取得後にquery fieldを足すだけでは不十分である。新fieldは再取得時のClass初期化で落ち得るため、取得・検証・保存の各段階でrawと計算用Classを別変数で保持する。既存adapterの全文setや保存hookへ戻さず、raw snapshotを土台にoperation所有fieldと導出索引を保存する。対象documentの削除が既存業務上正しい分岐は削除を維持し、別masterへarchive前提を広げない。

### Operationごとの入力とfield所有

以下は専用保存へ移す操作の設計であり、新しい業務操作の追加ではない。参照を変更する操作はserver保存とし、独立した通知状態更新は下記のclient部分更新を使う。wireは対象ID・操作名・changes・必要なraw期待値に限定し、tenant/actor/任意path/employeeIds/監査field/派生getter/任意の全文snapshotを入力権限にしない。新しいAPI名は公開済み識別子ではない。既存UI/schemaのfield対応をtestのfixtureへ固定する。

概要field群は`siteId, securityType, dateAt, dayType, shiftType, startTime, endTime, isStartNextDay, breakMinutes, regulationWorkMinutes, requiredPersonnel, qualificationRequired, workDescription, remarks`。worker入力群は`id, startTime, endTime, isStartNextDay, breakMinutes, regulationWorkMinutes, isQualified, isOjt`を基本とし、employee/outsourcer種別は明示action/所属配列と照合する。日時の入力とraw期待値は既存Employee設計同様に分離し、保存前に秒/ナノ秒を失わない。

計算用Classをclientからserverへ移す際は、同じ日本時間の入力から同じ日付・開始終了時刻・勤務日・通知実時間・請求日と金額を得ることも移行条件とする。hostのlocal日付setter/getterをそのまま使うだけではこの条件を満たさない。Bの計算instanceだけに適用する日時処理で既存callback・worker同期を維持し、package/prototypeやprocess全体の時差は変更しない。create/overview/duplicate/workers/notify/convert/billing/通知状態をUTCとJSTの独立実行で比較し、翌日開始・夜勤・同時刻24時間・月年境界も確認する。金額式、締め規則、通知状態遷移を新設する補正ではない。実測と未達は[local実施記録](../verification/employee-05-local.md)へ記録する。

環境間の一致だけでなく固定期待値を置く。日勤08:00〜17:00・休憩60分は実働480分と同日終了、08:59〜09:01・休憩0分は2分、22:00〜06:00・休憩0分は480分、同時刻・休憩0分は1440分とする。rawからの生成、従業員/外注worker追加、配列再初期化、その後の親日付変更を通して親子同期を確認する。通知actualと予定が異なるケースは既存JSTのフラグ利用を維持し、日時不変操作で無関係なraw日時を一律正規化しない。

日時adapterはBの計算・独立draftの寿命内で使い、親instanceの`initialize()`後の再利用を保証する共通基盤ではない。現在の予定配列dragは再表示/rollbackで新しいinstanceへ置換する。Card/Workersが`initialize()`する別の表示cloneと混同しない。今後同一親instanceを再初期化して再使用する経路を追加する際は、descriptor再構成とadapter再適用を先に検証する。

| 操作 | changes所有field | 期待値と維持条件 |
|---|---|---|
| 予定概要 | 概要field群の変更分 | Site/日付/時間変更に連動するworker派生field・通知取消も同じ計画へ。変更開始時の相関元/影響配列をraw照合し、実績pointer・Site revisionを保持 |
| 予定worker | add/update/removeとworker入力群。表示順は限定操作として分離 | 最新employees/outsourcers配列へ対象行操作、開始時raw配列全体の一致。親のSite/日付は最新rawから導出 |
| 実績概要・worker | 概要field群またはworker入力群 | 現isLockedの通常編集拒否を維持。解除flagを混入させない。Customer/取極めは既存Site連動条件から導出 |
| 実績articles | articleId/price/quantityの配列操作 | 最新実績の通常編集lockを検査し、開始時articles配列の一致後に対象行を変更。worker配列は最新rawを保持 |
| 実績の請求編集 | 概要からsecurityTypeを除くfield群、agreement選択とbillingDateAt、調整群、articlesを別所有群として扱う | OperationBillingの現契約ではlock中の請求編集を許す。通常実績のlock拒否を流用しない。無関係な群は最新raw保持。agreementは現在のSite取極めから選択対象を再解決し、clientの任意料金全文を採用しない |
| 請求調整 | useAdjustedと下記8field | 対象群のraw期待値を照合し、既存の計算式を再利用。worker identityや並びを変更しない |
| 請求lock | desiredLocked/expectedLockedのboolean | toggle命令を再送せず、現在bool照合後にisLockedと監査だけ更新。worker全文を受け取らない |
| notify/実績化 | 予定ID、通知の実施選択、開始時のpointer/対象workerと実績化に使う通知の局所raw期待値 | 最新予定と下記通知rawから生成。notify(false)も同じ境界。実績create/予定pointer・通知create/予定更新を既存の保存単位で確定 |
| 通知状態 | targetStatus、actualStartTime/actualEndTime/actualIsStartNextDay/actualBreakMinutes/isQualified/isOjt | status/actual群のraw期待値照合。id/isEmployee/employeeId/siteIdは変更不可。既存4状態methodの計算/時刻を維持 |

認可は次の操作別とする。現行Rulesの広いallowと正規業務presetが一致しない箇所があるため、「既存actor維持」を広いallowの無条件移植と解釈しない。[共通認可仕様](../specification.md#テナントと認証)と業務presetに従い、今回serverへ移す具体operationに限定して強制する。全取引権限の刷新ではない。

- 予定・実績・予定に付随する通知生成/取消・実績化: 現在Auth/同社有効本登録Userを確認し、会社管理者/統括/管制。予定のmaintenance条件と実績化の既存厳密条件も維持する。
- 実績の請求編集/lock: 会社管理者/統括/経理。経理の`operation-billings:write`と、採用済み統括の通常業務範囲を区別してoperation policyへ表す。packageのpresetを変更しない。経理へ通常実績worker編集を許さない。lock変更を許す条件は既存請求操作の契約を確認し、確定dataの一般的な解除権限へ拡張しない。
- 独立した通知状態変更: componentの「管制」コメントだけでactorを新しく限定しない。今回は現行の同社認証境界を維持し、raw状態の期待値と部分patchをclient transactionで扱う。Rulesは状態/actual群/既存時刻・監査の所有fieldだけを許し、参照を含む全識別fieldと非所有fieldを不変にする。元Class全文setは拒否。通知のactor全体の見直しや本人専用操作の変更は今回追加しない。

本人向けの既存状態操作も同じRulesへ到達するため、保存接続の互換補正を05-Bへ含める。操作の追加・状態遷移の変更・認可の再設計を意味しない。編集/操作開始時のraw状態を保持し、現在rawとの期待値照合後に状態所有fieldとserver timestampだけを部分更新する。Classのclient時刻による全文保存へ戻さず、createdAtのsubmillisecond精度・未知field・参照を保持する。取消/拒否/応答不明、tenant/認可喪失と遅延transactionは管理側と同じ保護を使う。本人handlerから保存patchとRulesまでの直接回帰を必須とし、本人業務全体のUI受入れへは拡張しない。
- 背景保存: callable入力にsystem actorを指定させず、内部呼出と同tenantの実sourceを根拠にする。clientの参照変更を背景処理の権限で代行できる汎用APIを作らない。

調整8fieldは`adjustedQuantityBase, adjustedOvertimeMinutesBase, adjustedQuantityQualified, adjustedOvertimeMinutesQualified, adjustedUnitPriceBase, adjustedOvertimeUnitPriceBase, adjustedUnitPriceQualified, adjustedOvertimeUnitPriceQualified`。根拠は各CustomInputとinstalled Classであり、計算結果や保存hookまで同じfield群と決めつけない。通知の既存methodには一部遷移でactualBreakMinutesを60へ戻す挙動等があり、コメントから一方向遷移・時刻保持を新設しない。独立した既存問題を見つけた場合はFUTと当該工程の阻害有無を区別する。

worker/article等の行は、表示順や名称から推測せず、開始時のraw配列と原本位置を期待値として照合する。schemaで採番される行keyや取極めの選択keyはactual実装と突合し、衝突/不存在なら拒否する。独自ID導入や曖昧な先頭一致を追加しない。

実績化では予定だけを変換しない。`components/OperationResult/Generator/index.vue`が渡す通知mapとinstalled `SiteOperationSchedule.syncToOperationResult`の既存変換を維持する。serverは最新予定のemployees/outsourcers各行から現行notificationKey（予定IDとworkerIdによる既存導出）を得て、同tenantの対応する通知rawをtransaction内で全writeより先に取得する。通知の予定・worker種別/ID・Siteとの対応を検査し、clientが指定した別通知や通知本文の任意snapshotを生成元にしない。

- `actualStartTime / actualEndTime / actualBreakMinutes / actualIsStartNextDay`は、対応通知fieldがnullまたは不存在のときだけ予定worker値へfallbackし、0やfalseを有効値として保持する。
- `isQualified / isOjt`は、通知が存在するときはその値、通知自体が不存在なら予定worker値を使う。不正な通知を不存在としてskipしない。従業員と外注先の両配列に同じ既存変換を適用する。
- clientの確認開始時に、予定pointer/worker配列と、対応通知の存在状態・識別情報・上記6fieldをrawで取得し、局所期待値として保持する。表示Classの初期値を不存在の期待値にしない。serverの同transaction読取り値と異なればwrite 0・再読込/再確認とし、通知だけが並行更新された場合に古い確認で確定しない。期待値は比較専用であり、その値を実績へ直接コピーしない。
- 画面の「未通知ならnotify(false)」の準備後に、実績化の期待値を取り直す。通知作成と確認値取得が終わる前は実績化を送信できない。通知取得失敗と通知なしを区別する。

server成功は更新有無・対象IDを返し、実績化は確定result IDを返す最小形とする。clientは保存await後に正本を再取得し、拒否/競合はdraft保持、結果不明は自動再送しない。状態反転や実績化の再送で二重処理しない期待値を試験する。既存の即時表示がある操作では拒否時の表示rollbackと正本再取得を接続し、別の同時編集を古い全文で巻き戻さない。

### 全writerが共有する参照保存の契約

#### 05-Cの入金予定日互換補正

実装時の再照合で発見した既存Billingsのclient全文updateを閉じるための限定補正であり、新しい入金管理やrole制限を追加しない。現在同社の有効な本登録Userという境界を維持し、既存Callable identity解決とtransaction内の現在Userを使う。OperationBillingの経理/統括条件を流用しない。

- wireは固定BillingsのdocId、`paymentDueDate`（厳密なYYYY-MM-DDまたはnull）、開始rawの`paymentDueDateAt`と`billingDateAt`の局所期待値に限定する。tenant/path/監査値や任意本文は受け取らない。複合Billing IDは現Customer ID・Site ID・日付の生成契約に合わせ、Employee単体の128文字制限を流用しない。
- 最新Billingの存在と期待値を同transactionで確認し、欠損/null/Timestamp精度を区別する。日付指定時はJSTの請求日当日を許し、前日以前を拒否する。optionalのnullは維持する。保存はserverで導出した`paymentDueDateAt/paymentDueDate/paymentDueMonth`と`updatedAt/uid`だけ。null時は予定日3fieldをnullへ揃え、no-opは3field全て同値のときだけwrite 0とする。参照/索引/金額/非対象rawをClass全体の再計算で上書きしない。
- 独立draftはconverterなしの開始rawと対にし、reactiveなroute ID・actor/tenant/認可の変更で破棄する。保存await、確定拒否で入力保持、同予定日または請求日の競合は再読込/再確認。背景集計だけの変更は保持する。結果不明は自動再送せず、「現在値が希望値と一致」と自己要求のcommit証明を区別する。既知成功後の読取失敗は保存済みとして旧attemptを終え、不存在や読取失敗から未実行を断定しない。
- 通常・nullable・日付下限・不正/閏日/月年境界、複合ID、同値、局所競合/背景同時更新、raw保持、各拒否/不明/遅延応答を直接testし、Billingsの個別/汎用/nested client CUD拒否と一緒に受け入れる。page1操作以外の請求UI刷新や共通Manager変更を含めない。
- 代表UI用の背景処理は専用demo entryの明示opt-inで`onOperationResultChange`の実行だけを有効にする。既定offでAPI suiteのfixtureには実行せず、demo project/Functions Emulator/loopback/外部作用denyを照合する。通常entryや他triggerを変えない。正規UI-created実績からBilling/日次2種/履歴の4保存先、errorとcleanupを確認し、直接seedでUI成功を代用しない。

#### 保存先差分と追加参照

1. 現在identity/User・既存操作のactor/lock/状態を確認し、入力の種別・配列・id・派生IDの整合をClass化より先に検査する。ClassのsetterでisEmployee等を補正した後だけの検証にしない。
2. transaction内で各保存先の現在rawと必要な予定/実績/Customer/Site/予約等を取得する。不存在ならbefore集合は空。取得失敗、存在する不正raw、欠損索引は空と解釈しない。
3. 最新rawへその操作の所有fieldを重ねてcandidateを作る。現在の業務計算とhookの必要作用は計算とwrite計画へ分ける。入力の任意path/tenant/監査field/未知fieldを保存権限にしない。
4. raw明細からbefore/after参照集合を導く。日次2種では本人IDと埋込み実績全体、Billingでは埋込み実績全体のEmployeeを含める。既存索引がraw実参照と一致することを確認し、after索引を再計算する。外注明細は除くが、矛盾明細をskipしない。
5. **追加ID = 各保存先candidateの参照 − その保存先の現在raw参照**。移動先にない参照は、移動元にあっても追加。削除後再生成は全after参照が追加。eventのbeforeDataや古いclient draftをbefore集合にしない。
6. 全保存先の追加IDを重複排除し、同じtransactionで通常Employeeの存在を確認する。全readを全writeより先に完了する。新規Employee readにACTIVE限定を加えず、既存の期間・状態条件を維持する。
7. どれかが不正/不存在ならそのtransactionはwrite 0。正常ならcandidateと索引を同じwriteで確定し、未知field・非所有fieldを維持する。複数の既存背景transactionを新しい全体transactionへ統合する要件ではなく、各保存単位で参照保護を成立させる。

clientに残せる更新は、参照を含むraw配列・識別field・索引を変更しないことをRulesで証明できる最小部分だけとする。`employeeIds`だけ同値を条件にして明細配列変更を許可しない。証明できない配列編集・請求編集は専用server保存へ接続する。各operationのactorは当該予定/実績/通知等の現契約を維持し、Employeeの通常編集3actorで一括置換しない。

変更なし/削除/並替え/同じ人の時間変更ならEmployee存在確認の追加readは0。1人入替えなら追加1種類、新規10種類なら10種類。これは全経路の索引整合と迂回閉鎖を前提にした設計値であり、actor/保存先/query/listener/再試行の総read数ではない。testではEmployee pathのgetを分離計数し、意図した実際の保存先差分であることも確認する。

### 索引整合の確認とarchive開放

`array-contains`で0件でも、索引が欠けたdocumentの埋込み参照は検出できない。したがって「未確認なら拒否」はarchive要求内のqueryだけで実現しない。次を満たす**検査済みtenantのserver側許可集合**で開放を制御する。新しい参照counter/ledgerやarchive要求ごとの全件scanは追加しない。

- 設定はserver起動設定を使い、既定は空集合、不正設定・対象外は拒否。Callable入力、client flag、未認証read可能な`System/system`へ許可tenant一覧や検査詳細を置かない。config名等の内部命名は実装時に決められるが、対象tenantの厳密照合とdefault denyは変更しない。
- EMP-05のarchive APIは専用demo entrypointで明示公開し、通常`functions/apis/index.js`からの公開はEMP-09の後段に分ける。demo用許可注入は通常実行から利用できないようにする。参照writerは通常公開の接続まで用意してlocal検証し、remote反映はしない。
- EMP-05では限定整合確認の純粋検査/実行手段を作り、合成dataで正常/欠損/型不正/明細不一致を試験する。remote操作や利用者saved-dataの読取り・補完を実行しない。対象は選択したtenantの予定・実績・通知・日次2種・Billingとし、元rawと導出集合の一致を検査する。
- EMP-09では別承認のbounded maintenanceで旧client/背景writeを止め、対象・backup・dry-run・必要補完・post-check・旧trigger反映/実行中旧revision停止を確認する。書込み継続中のページ走査結果だけで整合済みとしない。欠損の所属Employeeを特定できない場合はtenant全体を開放しない。
- 開放前に直接/旧writerの迂回閉鎖、既存索引整合、旧User削除作用停止の全てを確認する。正常な新規writeが索引一致を維持することを前提とし、運営者による契約外の直接変更まで自動検知できると表現しない。不整合判明時は対象tenantを許可集合から外して操作停止し、限定repairを別承認する。

### Archive UIと結果契約

初回操作の入口は既存Employee詳細の操作領域に置き、退職操作と独立した理由入力・確認dialogにする。初回は原本と対象IDが確定し、会社管理者/統括の操作判定が許可するときだけ実行可能。人事を許す通常`employeeAllowed(write=true)`をarchiveへ流用しない。単なるread許可・super-user文字列を実行根拠にしない。

- 送信は上記exact inputのみ。dialogごとのoperationIdと理由をmemoryで保持し、処理中は再送/入力変更を防ぐ。PIIや理由をlocalStorage/logへ残さない。
- 確定拒否は理由入力を保持し、従属あり/権限不足/原本不正/衝突/未開放/検査失敗を安全なmessageへ対応させる。他tenant情報や従属document本文を表示しない。
- 成功応答は`success: true, archived: true`を基本とし、原本とarchiveの部分成功を表す戻り値を作らない。原本購読の不存在だけで自分の操作成功と断定しない。
- 応答不明は対象/actor/理由/operationIdを維持し、理由を編集不可として「同じ操作を確認」から同じ要求だけを明示再送できる。serverは未実行なら通常条件で実行、実行済みなら同一envelopeを照合する。別ID生成、自動retry、新しい理由での自動再送をしない。原本不存在・legacy archive・別actor/操作は成功根拠にしない。
- 処理中はdialogを閉じない。結果不明のdialogを閉じる場合は「処理結果を確認できていない」ことを案内し、その詳細session内ではattemptを保持して同じ対象から再確認できる。route離脱/認証・tenant変更時はPII/attemptを破棄し、その後の古い成功/errorを新画面やmessageへ反映しない。永続的な未完操作管理を新設しない。
- 保持済みattemptの「結果を確認」入口は初回入口と分け、原本不存在でも同じ詳細session・actor/tenant・現在のarchive認可の下で再度開ける。原本の表示raw/User購読の破棄でattemptを消さず、保持するのは同一要求の最小値のみとする。原本消失だけではrouteを離脱させない。この入口から新しい対象/理由/operationIdを入力させない。
- 成功後は通常一覧へ戻り、当該IDの通常cache/候補を除外する。成功通知は遷移先でも表示する。別画面の古いdraftは不存在として保存拒否する。archiveのget/list認可は検証するが、新しいarchive管理一覧・restore導線は追加しない。

### 受入れmatrixとreviewの完了条件

| ID | 操作・data | 必須結果・証拠 |
|---|---|---|
| R1 | 7actor read、read-only更新、roleなし/未知/直接permission/無効/仮User/他tenant | 原本/archive get/listの許可拒否、個別/汎用/nested迂回拒否。Rules実試験 |
| R2 | 空cache・初期選択ID・期間内退職者・任意code・氏名変更 | 現query/表示型を維持。更新後の現在名を表示し、過去業務recordは変更しない |
| R3 | 期間外移動と原本削除、取得中の権限/tenant変更、古い成功/error | query除外と不存在を区別。全保護memoryを破棄し旧応答で復活しない。制御したPromiseと代表UI |
| W1 | 全保存経路のraw種別/id/索引偽装、不正明細/索引欠損 | Class初期化前に拒否。直接writer/旧全文更新でも迂回不可 |
| W2 | 10人参照不変・並替え・時間更新・1人入替え・新規10人 | Employee存在確認readが0/0/0/1/10種類。actor等を別計数し総readと混同しない |
| W3 | 複製・実績化・notify・通知状態変更・OperationBilling編集/lock。予定と異なる通知actual値、通知なし/nullのfallback、0/false、通知だけの並行変更 | 全入口の保存await/拒否を確認。実績へ通知の6fieldを既存条件で反映、通知競合は再確認。Site revision、予定pointer、既存通知削除、金額/lock契約の回帰 |
| W4 | 日次2種/Billingの同先更新・移動・削除・削除後再生成 | 移動元/先別の差分、raw索引保持、全read先行。本人以外の埋込み参照も拒否対象 |
| W5 | 保存先削除→Employee archive→遅延create/update event、履歴rebuild | Employee不存在で参照再生成を拒否。旧event beforeDataでは追加0と誤判定しない |
| A1 | 管理者/統括、人事、他tenant、未開放tenant/不正設定 | 前2actorのみ条件付き成功。demo注入の通常実行利用不可。拒否write 0 |
| A2 | 12従属先それぞれあり、仮/無効User、完了head/operation、query失敗 | 状態/期間を理由に除外せずarchive拒否。User/Auth/予約/業務dataは不変 |
| A3 | archiveと参照作成・User作成・退職を両順序で競合 | 参照先行ならarchive拒否、archive先行なら参照拒否。専用Emulatorで制御した競合 |
| A4 | 同ID archive・原本両存、legacy、不正原本、保存失敗 | 上書き/部分移動なし。正しい原本保持。未知field/欠損/null/Timestampのraw深い同値 |
| A5 | 応答不明・同操作再送・別actor/理由/操作・旧ID作成。commit成功→応答未着→原本不存在通知→dialogを閉じる→再確認 | 原本なしでも保持済み同一attemptの入口から確認できる。同一操作だけ確認成功。自動再生成/二重archive/同ID再作成なし |
| A6 | 旧onEmployeeDeleted event、User/Auth削除依存へのspy | handler直接試験で削除0。API専用entrypointの成功をtrigger実行証拠にしない |
| G1 | 合成dataの整合検査、index欠損、不一致、未確認tenant | 正常検査と開放拒否。実data/remoteの準備完了とは扱わない |
| U1 | detail理由入力→取消/拒否/成功→一覧、別画面の候補/古いdraft | 正規UI操作とbackend原本/archive照合を分離。User/Auth不変、表示除外、保存await |

実装初期に、各行を実際のtest file・操作入口・失敗注入点へ対応づけ、stubの成功だけで呼出経路の保護を示さない。既存`test/domain/site-schedule-guard.test.mjs`、`billing-customer-reference-barrier.test.mjs`、Site archive tests、Employee testsと`test/local/codex-local-harness.test.mjs`は再利用候補。通常の専用Emulatorは背景triggerを自動公開しないため、背景use-case/旧handlerの直接試験と必要な専用接続を別証拠にする。

最終実装のgateはpolicyに従うUI/application/data・Rules/permissions/buildのunion。domain-full、local-emulator-suite、local-ui-build、comprehensive 5 gateと直接UIを必要な失効範囲で実行する。Dev/Prod generate・実data補完は別承認まで実行しない。05-Eの次工程reviewは、EMP-06がこのreader/cache認可・archive除外・専用保存を旧Manager全文writerへ戻さないこと、User shellの購読破棄と既存UWBの境界を確認する。

rollbackはまずarchive許可/入口を停止する。codeを戻すために旧直接writer・旧User削除作用を再開しない。raw検索fieldの追加は不要になっても自動削除せず、実data変更/復旧は別承認。archive済み原本を汎用restoreで上書きしない。設計変更のみのrollbackは所有文書差分のcorrective commitで行う。

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
