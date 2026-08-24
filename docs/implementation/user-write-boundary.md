# User Write Boundary（UWB）改修計画

- 改修名: `User Write Boundary`
- 略称: `UWB`
- 状態: Active（UWB-01〜05完了、UWB-06は自動検証済み・利用者UI受入れ待ち）
- 対象: `Companies/{companyId}/Users/{userId}`への書込み境界
- 基準branch: `main`
- 基準commit: `3b161ff186b236963e4aa3324b70c5c8ad98776e`
- 作成日: 2026-08-16
- 関連仕様: [現行仕様](../specification.md)の「テナントと認証」
- 関連ADR: [ADR 0015](../decisions/0015-user-led-implementation-and-codex-assurance.md)、[ADR 0016](../decisions/0016-firemodel-crud-boundary.md)、[ADR 0017](../decisions/0017-callable-auth-identity-gate.md)、[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)、[ADR 0019](../decisions/0019-client-operation-policy-composable-boundary.md)
- 関連実装調査: [User / Firebase Auth lifecycle](user-auth-lifecycle.md)、[Callable認可境界](callable-authorization.md)
- 関連backlog: FUT-0080、FUT-0082、CONF-0066

## 目的

Usersコレクションへの書込みを、同一会社であることだけに依存した直接Firestore CRUDから、操作・実行者・対象User・変更fieldを検証できる境界へ移行する。

管理者移譲、有効化・無効化、role変更、仮登録、本登録、削除、本人設定を別の操作として扱い、重要なUser/Auth不変条件をclient UIやmodelの表示制御だけに依存させない。

この文書はUWBの実装順序、利用者確認、検証結果、完了状態を追跡する。確認済み仕様の正本は[現行仕様](../specification.md)、公式進捗の正本は[AirGuardV2ロードマップ](../roadmaps/airguard-v2.md)とする。

## 現在の進捗

| 区分 | 完了 | 総数 | 状態 |
|---|---:|---:|---|
| 準備 | 2 | 2 | 改修名と追跡文書を作成 |
| 実装ゲート | 4 | 10 | UWB-01〜04完了 |
| Dev環境受入れ | 0 | 1 | 未承認・未実施 |

実装ゲートは部分加点しない。各ゲートの完了条件をすべて満たし、利用者が対象application fileを確認した時点で完了とする。

## 前提として完了済みの認証基盤

- [x] 一般User本登録は、確認済みAuthentication emailに一致する一意の仮登録をserver側で解決する。
- [x] 初期会社管理者は、メール確認後にCompany・User・custom claimsを作成する。
- [x] 会社所属済み8 Callableは共通Auth identity gateを通る。
- [x] `disableUser`、`enableUser`、`changeAdminUser`は操作固有のactor・target検査を持つ。
- [x] Firestore・Storage Rulesはverified email、会社claim、tenant path、有効な本登録Userを共通入口で検査する。
- [x] 上記はlocal `main`の`3b161ff`へ統合済みである。

これらはUWBの前提であり、UWB実装ゲートの完了数には含めない。

## 現行の書込み経路

| 操作 | 現行経路 | UWBでの扱い |
|---|---|---|
| User一覧から仮User作成 | `createStandaloneTemporaryUser` Callable | UWB-04でserver境界へ移行し、Codex専用local UIで確認済み |
| 従業員画面から仮User作成 | `createEmployeeLinkedTemporaryUser` Callable | UWB-04でserver境界へ移行し、Codex専用local UIで確認済み |
| displayName・roles等の編集 | `UsersManager`からmodel `update()` | field別に分離する |
| 有効化・無効化 | 既存Callable | 維持し、Rules迂回を閉じる |
| 管理者移譲 | 既存Callable | 維持し、Rules迂回を閉じる |
| User削除 | clientからmodel `delete()` | 仮登録・本登録を分離してserver境界へ移行する |
| 本人のtagSize変更 | Auth User modelの直接更新 | 本人専用field境界を設ける |
| 本人の通知受信設定 | User document field | 本人専用field境界を設ける |

現行のUsers専用Rulesは、同じ会社の有効な本登録Userに全fieldのread/writeを許可する。さらにCompanies配下の汎用matchもUsersへ一致するため、Users専用Rulesを変更するときは汎用matchから`Users`を除外しなければならない。

## UWBで守る不変条件

### 確定済み

- 本登録Userのdocument IDはAuthentication UIDと一致する。
- 仮登録から本登録への変換はserver-onlyとする。
- 一般clientは`companyId`、`roles`、`isAdmin`、Auth linkを変更できない。
- 会社管理者によるrole変更もtenant・actor・fieldを検証するCallableに限定する。
- `disabled`変更は`disableUser`または`enableUser`だけを使用する。
- `isAdmin`変更は`changeAdminUser`だけを使用する。
- 管理者Userは削除できない。
- 恒久的なsuper-user他社write bypassは設けない。

### UWB-01で確定した段階契約

- Userを単独UserとEmployee連携Userに分類する。仮登録・本登録、管理者、有効・無効は別の状態軸とする。
- 会社管理者と`users:provision`保有者が、同じ会社の仮登録Userを作成・削除できる。
- `manager`へ`users:provision`と`users:write`、`human-resource`へ`users:provision`だけを明示付与する。`employees:write`だけからUser管理権限を派生させない。
- 会社管理者と`users:write`保有者だけが仮登録作成時に既知roleを設定できる。provision-only actorの非空rolesはserverで拒否する。
- 単独仮UserとEmployee連携仮Userは別の公開作成操作とする。
- Employee連携では同一会社のEmployee存在、未紐付け、1 Employee対最大1 Userをserver側で検証する。
- `employees:read`だけのactorはEmployee詳細でUserの紐付け・状態を確認できるが、User管理操作は行えない。必要な最小表示をUser文書全体のreadへ依存させない。
- User一覧は会社管理者と`users:write`保有者を対象とし、非管理者には管理者移譲、有効化・無効化、本登録User削除、role変更を提供しない。
- UWBは仮登録Userと保護fieldのCritical境界から開始し、本登録User lifecycleを一括変更しない。

### 後続ゲートへ分離した契約

- 本登録Userの削除条件とEmployee退職時のUser/Auth状態遷移。
- role値をpresetだけに限定するか、明示permission文字列も許可するか。
- 本人が変更できるUser設定fieldと更新方式。
- 予約導入後のDev/Prod migration実行時期とmaintenance window。予約path、runtime契約、Codex専用Emulator向けdry-run/apply toolはUWB-04で確定・実装済みである。
- Employee連携User本人へ公開するEmployee fieldと提供path。これはEmployee Self AccessとしてUWB外の専用ゲートで扱う。

後続ゲートの未確定事項を推測でRulesやCallableへ固定しない。

## 利用者確認の進め方

UWBはUser管理UIへ大きく影響するため、次の手順を各application implementation fileへ適用する。

1. Codexが変更前の挙動、今回の変更、UI影響、失敗経路、rollback、テスト観点を説明する。
2. 一度に提示するapplication implementation fileは原則1ファイルとする。
3. Codexは実装file提示前に、当該fileに対応する単体testを実行する。
4. test fileは利用者のfile review対象外とするが、追加内容と結果を報告する。
5. 利用者がapplication implementation fileを確認するまで、次のapplication implementation fileへ進まない。
6. UI fileでは表示だけでなく、作成・編集・削除・取消・連打・error後の状態を確認する。
7. 各独立segmentをlocal commitにし、後続segmentと混ぜずにrollback可能にする。
8. Rules変更後は、単体testだけでなくEmulatorと認証済みChromeで既存操作を再確認する。

文書、test、local GitはCodexが管理する。main merge、push、deploy、Dev・remote data操作は別の明示承認を必要とする。

## 実装ゲート

### UWB-01 操作・actor・field契約の確定

- 状態: Completed（2026-08-16 利用者承認）
- application file変更: なし

#### 作業

- [x] 現行のUser管理画面で到達可能な操作を画面別に再確認した。
- [x] 仮登録Userのcreate/read/update/deleteをactor別に固定した。
- [x] 単独UserとEmployee連携User、および仮登録・本登録等の状態軸を分離した。
- [x] `users:provision`、`users:write`、既存Employee permissionの責務を分離した。
- [x] 一括確定しない本登録User lifecycleとEmployee Self Accessを後続専用ゲートへ分離した。
- [x] 利用者の回答を仕様、ADR、CONF、UWBへ反映した。

#### 完了条件

- [x] 利用者が仮登録Userのactor/action matrixと段階的なgate縮小を承認している。
- [x] 現行仕様、ADR 0018、関連FUT/CONF、UWB文書が一致している。
- [x] UWB-02開始に必要なUser permissionの意味と初期付与roleが確定している。

### UWB-02 User permission認可基盤

- 状態: Completed（2026-08-17、2026-08-21 permission分離改訂）
- 主な影響file: client／Functions role対応表、server role展開utility、仮登録User管理actor policy

#### 作業

- [x] clientとFunctionsに同一のrole・permission対応表を設置する。
- [x] parity testで両対応表の完全一致を検証する。
- [x] permission catalogへ`users:provision`と`users:write`を追加する。
- [x] managerへ両permission、human-resourceへ`users:provision`だけを明示付与する。特殊なpermission包含展開は追加しない。
- [x] 既知presetだけを展開し、未知roleと直接permission文字列をserver認可で拒否する。
- [x] `employees:write`だけではUser管理を許可しないtestを追加する。
- [x] 会社管理者は明示permissionの有無にかかわらず仮登録Userを管理できることを維持する。
- [x] `isSuperUser`だけではUser管理actorにならないことを維持する。
- [x] User一覧とEmployee詳細のaction表示は、未接続APIを先に露出しないようUWB-03、UWB-04、UWB-06の各接続segmentへ移す。

#### 完了条件

- [x] client／Functionsの対応表と両permissionの付与presetがparity testで一致している。
- [x] serverが会社管理者、`manager`、`human-resource`だけを仮登録User管理actorとして許可する。
- [x] permissionなし、他社、仮登録、無効、不正状態、未知role、直接permission、`isSuperUser`だけのactorを拒否する。
- [x] 利用者が各application implementation fileを確認している。
- [x] 対象単体testが成功している。UIは後続API接続前のため変更・実行していない。

### UWB-03 仮登録User削除境界

- 状態: Completed（2026-08-20）
- 主な影響画面: `components/Users/Manager/index.vue`、`components/Employee/UserManager.vue`

#### 作業

- [x] 会社管理者または既知preset由来の`users:provision`保有者だけをactorとする。
- [x] 同社の仮登録Userだけを対象とし、本登録、管理者、自己、他社、状態不正を拒否する。
- [x] 仮登録User削除use-caseはAuth serviceを受け取らず、Authenticationへ一切作用しない。
- [x] 単独UserとEmployee連携Userの削除結果を分けて検証する。
- [x] 仮登録Userのclient直接`delete()`をCallableへ置換する。
- [x] 削除API接続と同時に、User一覧・Employee詳細の削除actionをactor・対象状態別に表示制御する。
- [x] User一覧の直接`delete()`をCallableへ置換し、会社管理者またはstrict preset由来`users:provision`と有効な仮登録targetだけで操作を有効化する。
- [x] server側policyのうちclientで確認可能な条件を、VueやFirebaseに依存しないclient専用仮登録User削除policyとして実装する。
- [x] client policyは許可可否だけでなく安定した拒否理由を返し、実行者、対象User、会社、document ID、Employee画面固有の紐付けcontextをfail closedで検査する。
- [x] `useTemporaryUserDeletion` composableを実装し、client policyのreactiveな適用結果、拒否理由、Callable実行をcomponentへ提供する。
- [x] composableは表示用判定だけに依存せず、Callable実行直前にもclient policyを再評価し、拒否状態ではrequestを送信しない。
- [x] User一覧とEmployee詳細から重複した削除可否判定を除き、同じcomposableへ接続する。Employee詳細だけは表示中Employeeとの紐付け一致を追加contextとして渡す。
- [x] client policyとserver policyで共通する条件についてparity testを設ける。client事前判定はUX補助であり、server最終認可を代替しないことを固定する。
- [x] 本登録User削除とEmployee退職・削除連鎖は実装せず、Rulesでclient直接deleteを閉じるまでdeploy不可として保持する。
- [x] 確認、処理中、取消、成功、失敗のUI状態を確認する。

#### 完了条件

- [x] 仮登録削除ではAuthenticationへ作用しない。
- [x] 本登録User、管理者、許可されていないactorからの削除が拒否される。
- [x] client policy、composable、User一覧、Employee詳細の許可・拒否結果が一致し、拒否時にCallableが呼ばれない。
- [x] 既存削除triggerが仮登録削除でAuthへ進まないことと再試行結果が記録されている。
- [x] 利用者が各application implementation fileを確認している。
- [x] 単体testと対象UIのlocal確認が成功している。

### UWB-04 仮登録User作成のserver境界

- 状態: Completed（2026-08-24 利用者受入れ・整理後回帰検証完了）
- 主な影響画面: `components/Users/Manager/index.vue`、`components/Employee/UserManager.vue`

#### 作業

- [x] 仮登録作成actorを会社管理者またはstrict preset由来`users:provision`へ限定し、transaction内で再検証する。
- [x] `companyId`を確認済み実行者identityから解決し、client入力を受け取らない。
- [x] `isTemporary=true`、`isAdmin=false`、`disabled=false`をserverで固定する。
- [x] standaloneとEmployee-linkedのexact allowlist、email、displayName、employeeId、roles、tag・通知fieldを検証する。
- [x] Employee連携を在職中・同社・未紐付けEmployeeへ限定する。会社管理者と`users:write` actorだけがrolesを任意指定でき、provision-only actorの非空rolesを拒否する。
- [x] canonical email予約と同社Employee予約をserver-only正本とし、同時callをFirestore transactionで排他する。
- [x] 仮登録削除、本登録変換、初期管理者作成、未認証事前登録確認、初期管理者email事前確認を予約awareへ揃える。
- [x] 予約missing・malformed・mismatchをfail closedとし、runtime legacy query fallbackを廃止する。
- [x] Codex専用demo Emulator以外を初期化前に拒否するdry-run既定の予約migration toolとpure unit testを追加する。実dataへのapplyは行っていない。
- [x] 予約collectionをFirestore clientからrecursive denyし、Companies汎用matchからEmployee予約を除外する。Users直接writeはUWB-08 blockerとして残す。
- [x] User一覧と従業員画面の直接`create()`を各Callableへ置換し、送信直前にclient policyを再評価する。
- [x] User設定routeは会社管理者または`users:write`に維持し、Employee-linked作成actionは`users:provision`へ合わせる。role選択UIは会社管理者と`users:write` actorだけに表示する。
- [x] 製品caller 0を確認して`checkEmailAvailabilityGlobal`を公開API indexとclient transportから除外する。source fileはrollback用に残置する。
- [x] 2026-08-20時点の全domain単体test 462件と対象SFC compileが成功している。
- [x] Codex専用saved-dataへ予約migration dry-runを実行し、変更0、blocker 0、既存予約1件のno-opを確認した。apply・candidate promotionは不要と判断し、saved-dataを変更していない。
- [x] 専用Emulator suite 74件でconcurrency、予約Rules、Callable lifecycle、Employee連携削除、本登録変換を確認した。
- [x] 単独仮登録Userを正規UIで作成してbackend状態を確認し、同じUIから削除してUser・email予約・Authentication不存在を確認した。
- [x] Employeeを正規UIで作成し、既知role `human-resource`付きのEmployee連携仮登録Userを同じ正規UIで作成した。backend assertionで仮登録状態、Employee link、role、email・Employee予約pointer、Authentication不存在を確認し、同じUIでUserを削除した。削除後はUser・両予約・Authenticationが不存在でEmployeeが残ることを確認した。
- [x] 2026-08-21に利用者が機能branchのlocal UIで、単独仮登録User作成、Employee連携仮登録User作成、取消、削除、表示・操作感を受入れた。Employee詳細では「仮登録」表示を確認した。User一覧には明示的な「仮登録」表示がない現行挙動も確認し、UWB-04の受入れをOKとした。
- [x] 2026-08-24に利用者が提示済みの最小確認項目によるUWB-04 test通過を報告した。
- [x] `functions/modules/auth`直下のpolicy・permission定義を`policies/`、Callable error mapperを`mappers/`へ整理した。export名と挙動は変更せず、全参照を更新した。

#### 完了条件

- [x] 単体testで`users:provision`を持たない一般User、他社、仮登録、無効、不正actorを拒否し、provision-only actorの非空rolesを拒否する。
- [x] 単体testでclientから本登録・管理者・無効Userや保護fieldを作成できない。
- [x] 重複、競合、再試行、claims部分失敗、予約pointer lifecycleが定義されている。
- [x] 利用者がUWB-04に限り1 application fileごとの確認を省略し、単体test完了までの連続作業を承認している。
- [x] 単体testと両作成UIのlocal確認が成功している。
- [x] 2026-08-21のpermission分離改訂でdomain単体test 467件と専用Emulator 74件が成功し、human-resourceのrole付きEmployee連携作成拒否とroleなし作成成功を確認した。
- [x] 改訂後のhuman-resource画面でrole選択が表示されず、emailだけで作成・削除できることを正規UIで再受入れした。作成後は`roles=[]`、Employee link、email・Employee予約、Authentication不存在を確認し、UI削除後はUser・両予約・Authentication不存在とEmployee残存を確認した。
- [x] directory整理後に全domain単体test 468件と専用Emulator suite 74件が成功し、利用者用saved-data 7 files・3492 bytesが不変であることを確認した。

### UWB-05 通常プロフィールと本人設定のfield境界

- 状態: Completed（実装・自動検証・利用者受入れ完了）
- 主な影響画面: `components/Users/Manager/index.vue`、User設定の呼出し元

#### 確認済みの現行挙動

- User一覧の更新は`item.update(item)`からFireModel client adapterの`txn.set(docRef, this)`へ進み、User instance全体を再保存する。field単位のpartial updateではない。
- User一覧editorは`displayName`、`roles`、`tagSize`、配置確認・上番・下番の通知受信flagを編集可能にし、emailは更新時disabled、company・admin・temporary・disabled・Employee linkはhiddenとする。hidden fieldもfull document再保存には含まれ得る。
- `/settings/users`のclient routeは会社管理者またはstrict preset由来`users:write`へ提供されるが、Firestore Rulesは同社の有効な本登録UserへUsers全fieldの直接writeを許すため、UI guardを迂回できる。
- `useUserSettingsActions.updateTagSize`は`tagSize`だけを受け取るが、静的callerはなく、到達した場合も`auth.user.updateProperties()`からfull document updateへ進む。
- `displayName`または`disabled`の変更はUser update triggerからAuthentication同期を試みる。tag・通知flag・role変更はAuth同期対象外である。

#### 作業

- [x] 本人が編集できるfieldを`displayName`と`tagSize`に限定する契約を利用者が承認した。
- [x] 通知受信3フラグを`users:write`管理fieldとする契約を利用者が承認した。
- [x] role値を既知presetだけに限定し、`users:write`を持つmanagerまたは会社管理者が他の非管理者Userを変更できる契約を利用者が承認した。自己role変更と会社管理者targetは拒否する。
- [x] 本人設定、通知設定、role変更をfield別の専用Callableへ分離する。
- [x] 各Callableで許可field以外のemail、companyId、isAdmin、isTemporary、disabled、roles等の混入を拒否する。
- [x] `tagSize`と通知受信flagの型・許容値を検証する。
- [x] User一覧と本人設定からFireModelのfull updateを除き、非対象fieldを再保存しないpartial updateへ置換する。
- [x] 管理者による通知・role更新と本人による`displayName`・`tagSize`更新を別Callableへ分離する。

#### 完了条件

- [x] 本人設定が他Userやserver-only fieldへ作用しないことをdomain単体testと専用Emulatorで確認する。
- [x] 管理者による通知・role編集がAuth連携fieldを暗黙変更しないことをdomain単体testと専用Emulatorで確認する。
- [x] 既存設定UIの表示・保存・再読込みが維持される。
- [x] 利用者が各application implementation fileを確認している。
- [x] 単体testと対象UIのlocal確認が成功している。

### UWB-06 User管理UIの統合回帰

- 状態: In verification（実装・自動検証完了、利用者UI受入れ待ち）
- 主な影響画面: User一覧、従業員詳細、管理者移譲、本人設定

#### 作業

- [x] 共通managerの作成・編集・削除は`isLoading`中の`submit()`再入を拒否し、有効化・無効化、管理者移譲、本人プロフィール保存は共通operation stateで対象ごとのpendingを管理する。
- [x] 通常UIの再入は共通manager guardと独自actionのpendingで抑止する。全documentへ汎用single-flightを展開する変更は採用せず、多重実行riskと追加対策の要否をUWB-10後段へ移す。
- [ ] error後にdialog、editor、一覧、対象Userが正しい状態へ戻ることを確認する。
- [x] UIの非表示・disabledだけを認可境界として扱わず、既存のCallable・Firestore Rulesによるserver認可を維持する。
- [ ] keyboard、focus、確認dialog、取消操作への回帰がないことを確認する。
- [x] 利用者が共通UI packageの`useItemManager.submit()`へ`isLoading`再入guardを追加した。AirGuardV2ではUser専用operation stateをapplication共通composableへ昇格し、共通managerを通らない3系統だけへ接続する。
- [x] 現行`hasPermission`利用箇所を監査し、一般page判定はsuper-user wildcard・直接permissionを許容する従来契約、User管理route・navigation・actionは既知User presetまたは会社管理者だけを許可するstrict判定へ分類する。
- [x] `/settings/users`のroute・navigationとUser管理actionをstrict preset／会社管理者判定へ揃え、直接permission文字列、未知role、`isSuperUser`だけではUser管理を許可しない。

#### 完了条件

- [ ] 各操作の成功・拒否・失敗・再試行をCodex専用local UI環境のブラウザ、または移行期間中の承認済みChromeで確認している。
- [ ] console errorと意図しないFirestore直接writeがない。
- [ ] 利用者が変更されたUI implementation fileをすべて確認している。

### UWB-07 本登録Userの利用停止・退職・削除境界

- 状態: Specification discussion required（具体例による壁打ち待ち）
- 主な影響画面: User一覧、Employee詳細、退職処理
- 主な実装境界: 専用Callable、Authentication、Users、Employee連携、監査・復旧

#### 確定済み契約

- [x] AirGuardV2の操作権限だけを剥奪し、Employeeと業務記録を維持する場合は、UserとAuthenticationを削除せず既存の無効化を使用する。
- [x] Employeeの退職に伴う本登録User削除では、別tenantで同じメールアドレスを再利用できるようAuthentication accountを削除する。
- [x] 退職時は本登録User documentを物理削除し、EmployeeとのUser紐付けを解除する。
- [x] EmployeeとEmployeeに紐付く勤怠・配置・請求等の業務記録はUser削除に連鎖して削除しない。

#### 実装前に具体例で確定する事項

- [ ] `Users_archive`を設けるか、退避するfield、個人情報の保持期間、参照権限、復旧可否を具体例で確定する。
- [ ] 作成者・更新者として保存されたUIDの全参照箇所を調査し、User削除後の表示名・監査主体・不明User表記を具体例で確定する。
- [ ] 会社管理者本人、移譲前後の会社管理者、通常User、無効User、Employee未連携User、他社Userの削除可否を具体例で確定する。現行の「管理者Userは直接削除不可・別Userへの管理者移譲を先行」という規則も、この壁打ちで具体例へ照合する。
- [ ] 退職取消、誤削除、同一メールで別tenantへ再登録、元tenantへの再入社を具体例に、復旧方法と再登録契約を確定する。
- [ ] Authentication削除、User削除、Employee紐付け解除、監査記録の実行順序、冪等性、部分失敗reconcileを確定する。
- [ ] 監査記録へ保存するactor、target、理由、時刻、元tenant、結果、失敗段階と、閲覧権限・保持期間を確定する。

#### 完了条件

- [ ] 無効化と退職削除が別操作としてUI・Callable・監査記録で区別されている。
- [ ] 退職削除後に旧Authと旧Userが不存在で、Employeeと業務記録が維持され、EmployeeのUser紐付けだけが解除されている。
- [ ] 同じメールアドレスで別tenantへ正規登録できる。
- [ ] 管理者、自己、他社、状態不正、二重実行、各段階の部分失敗をfail closedまたは安全にreconcileできる。
- [ ] archive・UID参照・監査・復旧について利用者が具体例を確認し、単体・Emulator・UI testが成功している。

### UWB-08 Firestore Rulesのactor・field制約

- 状態: Not started
- 主な実装file: `firestore.rules`

#### 作業

- [ ] Companies配下の汎用matchから`Users`を除外する。
- [ ] Usersの`read`、`create`、`update`、`delete`を分離する。
- [ ] 実行者の有効な本登録状態と会社管理者状態を型付きで検証する。
- [ ] `request.resource.data`だけを権限根拠にせず、既存の実行者Userを参照する。
- [ ] create時のfield allowlist、必須field、型、会社一致、仮登録状態を検証する。
- [ ] update時は`diff().affectedKeys()`で許可fieldだけに限定する。
- [ ] immutable・server-only fieldの直接変更を拒否する。
- [ ] 本登録Userのclient deleteを拒否する。
- [ ] super-user claimによる恒久的な例外を追加しない。

#### 完了条件

- [ ] 汎用matchからUsers制約を迂回できない。
- [ ] actor、対象、操作、field、型ごとの許可・拒否testが成功している。
- [ ] 既存CallableはAdmin SDK経由で正常に動作する。
- [ ] 利用者が`firestore.rules`を確認している。

### UWB-09 role・permission対応表のschemas package統合

- 状態: Not started
- 対象repository: `air-guard-v2-schemas`、本repositoryのroot・Functions dependency

#### 作業

- [ ] client／Functionsで重複管理しているrole・permission対応表をschemas packageの共通constantsへ移す。
- [ ] schemas packageの責務、export名、互換性、version、公開順序を提示し、別repository変更の明示承認を得る。
- [ ] schemas packageへ対応表と単体testを追加し、dev versionを公開する。
- [ ] rootとFunctionsを同じschemas versionへ更新し、両lockfileのversion・integrity一致を確認する。
- [ ] clientとserverをpackage constants参照へ変更し、重複したlocal対応表を削除する。
- [ ] `hasPresetPermission`とserver preset resolverが同じcatalog・unknown fail-closed規則を使用する構成を確定する。
- [ ] role展開、`users:write`、未知role、既存presetの回帰testを実行する。

#### 完了条件

- [ ] role・permission対応表の正本がschemas package内の1箇所だけになっている。
- [ ] rootとFunctionsが同じ公開versionと内容を使用している。
- [ ] package更新・rollback・導入順序が記録されている。
- [ ] 利用者が関連repositoryと本repositoryのapplication implementation fileを確認している。

### UWB-10 全体検証・文書確定・main統合準備

- 状態: Not started

#### 作業

- [ ] 全domain単体testを実行する。
- [ ] Codex専用Firestore/Auth Emulator testを実行する。
- [ ] Codex専用local UI環境のブラウザでUser管理flowを一巡する。
- [ ] application code、Rules、UI、仕様、ADR、roadmap、changelogを再照合する。
- [ ] UWB-01〜09完了後に、未対応client、複数tab・端末・actorからの多重実行riskを操作別に再評価する。100%防御や攻撃経路が存在しないことの証明を完了条件にせず、transaction、policy、version、idempotency、reconcileの追加改修を採用するか残存riskとして受容するかを記録する。
- [ ] project-owned validatorとmanaged governance validatorを実行する。
- [ ] `git diff --check`とclean worktreeを確認する。
- [ ] 未検証、残存risk、rollback、Dev受入れ項目を整理する。
- [ ] 利用者の全file確認とlocal動作確認後にmain統合承認を得る。

#### 完了条件

- [ ] UWB-01〜UWB-09がすべて完了している。
- [ ] 多重実行の後段評価について、追加改修またはrisk受容の判断と根拠が記録されている。
- [ ] local testとChrome受入れがすべて成功している。
- [ ] 利用者がUWBのlocal確定を明示している。
- [ ] main統合対象commit、差分、test、未確認事項が提示されている。

## Dev環境受入れ

- 状態: Not approved

UWBのlocal確定とmain統合だけではdeploy可能とは扱わない。Dev環境でのRules・Functions deploy、remote data確認、既存User migration、実Auth accountを使う受入れは、対象とrollbackを提示して別途承認を得る。

## UWB完了後も残る境界

- App Checkとrate limit。
- 匿名email・事前登録状態の列挙抑止。
- custom claims変更後の既発行token失効。
- 一般User本登録でclaims設定に失敗した場合のreconcile。
- Auth・Firestore triggerの部分失敗監視と再同期。
- Employee連携User本人へ提供するEmployee Self Accessのfield・path境界。
- 将来の明示的なsuper-user support access。
- Dev・production deployとremote受入れ。

## 変更記録

| 日付 | 状態 | 内容 | Commit | 検証 |
|---|---|---|---|---|
| 2026-08-16 | Planning | `User Write Boundary（UWB）`と改修追跡ゲートを作成 | 本変更 | project-owned・managed governance validator pass |
| 2026-08-16 | UWB-01 completed | 単独／Employee連携User、`users:write`、仮登録管理actor、段階的gate縮小を確定 | 本変更 | project-owned・managed governance validator pass |
| 2026-08-17 | UWB-03 client policy | 仮登録User削除のclient事前判定policyと拒否理由を追加 | `7998440` | client／server関連単体test 31件、`node --check`、`git diff --check` pass |
| 2026-08-17 | UWB-03 client integration | 共通composableを追加し、User一覧・Employee詳細の表示判定と削除実行を接続。共通条件parity、自己対象拒否、再試行を追加 | `5338cbc`、`14202f4`、`27f2050`、`4869807`、`8ceb540` | UWB-03対象単体test 73件、自己対象・再試行・trigger関連28件、両SFC compile、`git diff --check` pass。UI／Emulator未実施 |
| 2026-08-17 | UWB-03 local delete verification | composableの明示importを修正し、削除modeで更新field validationを走らせず、削除禁止時にhandlerへ進まない共通UI package境界を追加 | `5a26ef4`、air-vuetify-v3 `07886a4` | composable単体test 3件、共通UI package単体test 3件、SFC compile、構文、Chrome＋Emulatorで合成仮登録User削除、Firestore対象不存在、Auth 3件不変を確認。全UI状態は未完了 |
| 2026-08-20 | UWB-03 completed | 正規UIで作成した単独・Employee連携仮登録Userを対象に、取消、処理中、成功、既削除への安全な失敗をインアプリブラウザで確認。正規signup管理者をCodex専用saved-dataへ昇格 | 本変更 | UWB-03単体test 32件、Auth 1件・管理者User 1件不変、仮登録3件不存在、通常import、dashboard、console error 0件、全専用port閉鎖、snapshot fingerprint不変 |
| 2026-08-20 | UWB-07 planning | 本登録Userの単なる利用停止は無効化、退職時はAuth・User物理削除とEmployee紐付け解除としてUWB内へ追加。archive、UID参照、削除条件、監査・復旧は具体例による壁打ち事項として分離 | 本変更 | project-owned・managed governance validator、`git diff --check` pass。application codeとdataは未変更 |
| 2026-08-21 | UWB-04 completed | 予約migration、専用Emulator、単独／Employee連携仮登録Userの正規UI作成・削除を完了 | 本変更 | 全domain単体test 462件、SFC compile、専用Emulator 74件。Employee連携Userは`human-resource`付きで作成し、作成後・削除後のUser、email予約、Employee予約、Auth、Employee残存をbackend assertion。外部geocoding拒否の既知console error 1件、snapshot不変、全専用port閉鎖 |
| 2026-08-21 | UWB-02R〜04R automated | `users:provision`を新設し、managerへ両User permission、human-resourceへprovisionだけを付与。provision-only actorのroles指定をclient/serverで拒否 | 本変更 | domain単体test 467件、SFC compile、専用Emulator 74件。role付き作成はpermission-denied、roleなし作成は成功。全専用port閉鎖、利用者用saved-data不変。human-resource UI再受入れは未実施 |
| 2026-08-21 | UWB-04R UI completed | 一般User signupの通常submitがpage reloadで中断される問題と、provision-only Employee User dialogにgeneric role fieldが残る問題を修正。human-resourceの正規signup、Employee作成、roleなし仮登録Userの作成・削除を製品UIで再受入れ | 本変更 | domain単体test 468件、変更2 SFC compile、専用Emulator 74件。作成後の`roles=[]`、Employee link、両予約、Auth不存在と、削除後のUser・両予約・Auth不存在、Employee残存をbackend assertion。全専用port閉鎖、saved-data 7 files・3492 bytes不変 |
| 2026-08-24 | UWB-04 final completed | 利用者が最小確認項目の通過を報告。Functions authのpolicy・permission定義を`policies/`、Callable error mapperを`mappers/`へ整理し、export名と挙動を維持 | 本変更 | 全domain単体test 468件、専用Emulator suite 74件、project-owned・managed governance validator、`git diff --check` pass。全専用port閉鎖、saved-data 7 files・3492 bytes不変 |
| 2026-08-24 | UWB-05 automated | 本人プロフィール、管理対象Userの通知3フラグ、他の非管理者Userのroleを3つの専用Callableへ分離。exact allowlistとstrict preset認可をserverで強制し、User一覧・本人設定のFireModel full updateを除去 | 本変更 | 全domain単体test 490件（対象SFC 2件のcompileを含む）、専用Emulator suite 79件 pass。全専用port閉鎖、runtime残留0、saved-data 7 files・3492 bytes不変。利用者によるapplication file・local UI受入れは未完了 |
| 2026-08-24 | UWB-05 completed | 利用者がUWB-05のapplication implementation fileと動作を確認し、完了を承認 | 本変更 | 利用者受入れ完了。自動検証証拠は直前のUWB-05 automated記録を参照 |
| 2026-08-24 | UWB-06 automated | User管理操作をoperation・target単位のsingle-flightへ統合し、対象ごとのloading、二重送信防止、会社管理者専用controlのfail-closed表示、`/settings/users`のstrict preset route・navigation判定を実装。User管理経路の直接Firestore writeがないことを監査 | 本変更 | 全domain単体test 507件（対象SFC 6件のcompileを含む）、専用Emulator suite 79件 pass。全専用port閉鎖、runtime残留0、専用saved-data 7 files・3492 bytes不変。error後の画面状態、keyboard・focus・確認・取消、console error、利用者による変更file確認は未完了 |
| 2026-08-24 | UWB-06 concurrency scope corrected | 全documentへの汎用single-flight展開を採用せず、利用者が共通UI `useItemManager.submit()`へ最小の`isLoading`再入guardを追加。AirGuardV2のUser専用operation stateをapplication共通composableへ昇格し、有効化・無効化、管理者移譲、本人プロフィール保存だけへ接続。包括的な多重実行対策の要否はUWB-10後段へ移管 | 共通UI `5705426`、本変更 | 全domain単体test 508件（共通UI guard source contractを含む）pass。server・Rules・fixtureは未変更のため専用Emulatorは直前の79件passを参照。利用者UI受入れは未完了 |
