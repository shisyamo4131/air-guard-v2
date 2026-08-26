# User Write Boundary（UWB）改修計画

- 改修名: `User Write Boundary`
- 略称: `UWB`
- 状態: Active（UWB-01〜06・08〜10完了。UWB-07は実装・自動検証・local UI受入れまで進んでいるが、競合・部分失敗・通知・Auth raceの残存陰性証拠が未完了）
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
| 実装ゲート | 9 | 10 | UWB-01〜06・08〜10完了。UWB-07の残存陰性証拠が未完了 |
| Dev環境受入れ | 0 | 1 | 未承認・未実施 |

実装ゲートは部分加点しない。各ゲートの完了条件と検証証拠を満たし、利用者が変更挙動、security境界、残存risk、rollbackを受け入れた時点で完了とする。利用者による全file・全行の確認は完了条件にしない。

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

- 状態: Completed（実装・自動検証・利用者UI受入れ完了）
- 主な影響画面: User一覧、従業員詳細、管理者移譲、本人設定

#### 作業

- [x] 共通managerの作成・編集・削除は`isLoading`中の`submit()`再入を拒否し、有効化・無効化、管理者移譲、本人プロフィール保存は共通operation stateで対象ごとのpendingを管理する。
- [x] 通常UIの再入は共通manager guardと独自actionのpendingで抑止する。全documentへ汎用single-flightを展開する変更は採用せず、多重実行riskと追加対策の要否をUWB-10後段へ移す。
- [x] error後にdialog、editor、一覧、対象Userが正しい状態へ戻ることを確認する。
- [x] UIの非表示・disabledだけを認可境界として扱わず、既存のCallable・Firestore Rulesによるserver認可を維持する。
- [x] keyboard、focus、確認dialog、取消操作への回帰がないことを確認する。
- [x] super-user、会社管理者、manager、human-resourceで管理者メニューとUser管理routeの期待表示・拒否を確認する。
- [x] 利用者が共通UI packageの`useItemManager.submit()`へ`isLoading`再入guardを追加した。AirGuardV2ではUser専用operation stateをapplication共通composableへ昇格し、共通managerを通らない3系統だけへ接続する。
- [x] 現行`hasPermission`利用箇所を監査し、一般page判定はsuper-user wildcard・直接permissionを許容する従来契約、User管理route・navigation・actionは既知User presetまたは会社管理者だけを許可するstrict判定へ分類する。
- [x] 全35 routeをVue/Nuxt非依存の共有`accessPolicy` catalogへ移行し、route middlewareとnavigationを同じevaluatorへ接続する。12のpathなしgroupはpolicyを持たず、アクセス可能なnavigation childから表示を導出する。
- [x] `public`、`roles`、`strictPresetPermissions`、`allowAdmin`をpage設定から除去し、未知・複製policy、旧field併記、不正contextをruntimeとvalidatorでfail closedとする。
- [x] `/settings/users`のroute・navigationとUser管理actionをstrict preset／会社管理者判定へ揃え、直接permission文字列、未知role、`isSuperUser`だけではUser管理を許可しない。
- [x] super-userは従来の`/settings/company`直接route許可に合わせて管理者メニュー内の会社設定を表示する。User管理と`navigation: false`のcheckoutは表示しない。

#### 完了条件

- [x] 各操作の成功・拒否・失敗・再試行をCodex専用local UI環境のブラウザ、または移行期間中の承認済みChromeで確認している。
- [x] console errorと意図しないFirestore直接writeがない。
- [x] 利用者が変更されたUI implementation fileをすべて確認している。

### UWB-07 本登録Userの利用停止・退職・削除境界

- 状態: In progress（実装・自動検証・Codex UI smoke・利用者local受入れ・UI policy parity・固定保存期限なし・会社管理者専用履歴readerは完了。下記の残存陰性証拠は未完了）
- 主な影響画面: User一覧、Employee詳細、退職処理、誤退職訂正、lifecycle履歴
- 主な実装境界: 専用Callable、Authentication、Users、Employees、予約、`LifecycleOperations`、監査・復旧、Firestore Rules・Indexes
- 関連ADR: [ADR 0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)

#### 確定済み契約

- [x] AirGuardV2の操作権限だけを剥奪し、Employeeと業務記録を維持する場合は、UserとAuthenticationを削除せず既存の無効化を使用する。
- [x] UWB-07AはEmployee退職、UWB-07Bは単独本登録Userのaccount offboarding、UWB-07Cは誤って完了したEmployee退職の訂正として分離する。
- [x] `employees:terminate`を新設してstrict `human-resource`へ付与し、有効な本登録会社管理者にも退職overrideを許可する。manager単独は退職不可だが、別Userへ`human-resource` roleを設定して退職担当者を任命できる。
- [x] 退職日はserverのAsia/Tokyo暦日で入社日以降かつ実行日以前とし、将来日退職、予約取消、実際の退職期間を伴う再雇用はUWB-07から分離する。
- [x] Employee退職に伴う本登録User削除では、旧accountが同じメールアドレスの再利用を妨げないようAuthentication account、User document、User email予約、Employee予約を削除する。競合する新Authがない通常系だけ再登録を確認し、新UIDの自動削除や無条件の再登録保証は行わない。Employeeと勤怠・配置・請求等の業務記録は削除しない。
- [x] 単独本登録Userの物理削除は有効な本登録会社管理者だけに許可し、自己、会社管理者、super-user、他社、仮登録、Employee連携Userを拒否する。
- [x] User/Authは`Users_archive`へ保存せず、旧UID、email、role、通知設定、User/Auth全文を復元しない。Employee連携UserはEmployee訂正後のEmployee連携provisioning、単独Userは会社管理者による単独provisioningで新UIDとして再作成する。
- [x] `LifecycleOperations`を3操作の実行状態と監査の唯一の正本にし、対象別lockとappend-only eventをserver-onlyで管理する。別々のUser削除auditとEmployee退職auditを完了判定の正本にしない。
- [x] 誤退職訂正は会社管理者だけに許可し、完了済みUWB-07Aを参照して同じEmployeeを`ACTIVE`へ戻す。元の退職operationを変更せず、User/Authと業務記録を自動復元・変更しない。
- [x] 元の退職日と現在上限20文字の退職理由は訂正後もserver-only履歴へ保持する。現段階では固定の保存期間を設けず、自動purge、legal hold、terminal後識別子縮小を実装しない。data量、法令・社内規程、privacy、費用、運用上の必要性から見直しが必要と判断した時点で改めて仕様変更する。履歴一覧は会社管理者専用の最小Callable projectionとし、その実装・検証まではProd公開不可とする。

#### Firestore実装baseline

- [x] UWB-07の対象となるDev Firebase projectは`air-guard-v2-dev`、databaseは`(default)`であり、2026-08-17にFirebase CLI 15.27.0の読み取り専用`firestore:databases:list`・`firestore:databases:get`で`Edition: STANDARD`、`Type: FIRESTORE_NATIVE`を確認済みである。確認値と再確認commandは[運用・開発手順のFirestore instance baseline](../operations.md#firestore-instance-baseline)を正とする。
- [x] Prod Firebase project `air-guard-v2`のeditionと保護設定は未確認であり、このDev baselineをdeploy判断へ流用しない。Prodへ進む場合は別承認のもと同じ読み取り専用commandで再確認する。

#### Callable transport契約

- `operationId`はlower-case UUID v4、document IDは空白・`/`を含まない安全な単一segment、日付は実在する`YYYY-MM-DD`、全input objectはunknown fieldを拒否する。
- 3 Callableは`request.auth`を必須とし、既存のcurrent Auth identity gateで現在のAuthentication accountを再取得する。tokenとcurrent AuthのUID、canonical email、email verified、company claim、`isSuperUser`のboolean型と値、disabled状態を照合し、company IDは検証済みidentityから導出してclient入力を受け取らない。初回transactionでもactor Userが同社・有効・本登録であり、操作ごとのstrict roleまたは会社管理者条件を満たすことを再検証する。
- `requestFingerprint`は、`operationId`を除き`actorUid`、`operationType`、正規化済みinputを下表のfingerprint key順で並べたUTF-8 JSONのSHA-256 lowercase hexとする。同じoperation IDでfingerprintが異なる場合は再利用を拒否する。

| Callable | exact input key順 | fingerprint用normalized input key順 | 成功応答 |
|---|---|---|---|
| `terminateEmployee` | `operationId`, `employeeId`, `terminationDate`, `reasonOfTermination` | `employeeId`, `terminationDate`, `reasonOfTermination` | `{ success: true, operationId, status: "completed" | "completed-cleanup-pending", employeeId, userDeletion: { kind: "none" | "registered", userAccessDeleted: boolean } }` |
| `deleteStandaloneRegisteredUser` | `operationId`, `targetUserId`, `reason` | `targetUserId`, `reason` | `{ success: true, operationId, status: "completed" | "completed-cleanup-pending", userId: targetUserId }` |
| `reinstateEmployee` | `operationId`, `employeeId`, `reversesOperationId`, `correctionReasonCode` | `employeeId`, `reversesOperationId`, `correctionReasonCode` | `{ success: true, operationId, status: "completed", employeeId, employeeReinstated: true, userAccessRestored: false, requiresUserReprovisioning: boolean }` |

- `completed-cleanup-pending`はAuth/User/予約の削除が完了し、FCM cleanupだけをserver reconcile中であることを表す。利用者へcore削除成功とcleanup継続を分けて表示し、UWB-07Cのreverse元には使用できない。
- error messageへemail、company ID、target UID、role、内部pathを含めず、clientは次のdomain codeとCallable codeを安定契約として扱う。

| domain code | Callable code | 主な条件 |
|---|---|---|
| `UNAUTHENTICATED` | `unauthenticated` | `request.auth`がない |
| `AUTH_IDENTITY_INVALID` | `failed-precondition` | current Auth不存在・disabled、email未確認、token/current UID・email・claim・super-user不一致または型不正 |
| `INVALID_INPUT` | `invalid-argument` | UUID、document ID、日付、理由、型、unknown fieldが不正 |
| `ACTOR_NOT_ALLOWED` | `permission-denied` | actor role・状態・tenantが不許可 |
| `TARGET_NOT_FOUND` / `SOURCE_OPERATION_NOT_FOUND` | `not-found` | Employee、User、reverse元が不存在 |
| `OPERATION_ID_CONFLICT` | `already-exists` | 同じoperation IDへ異なるfingerprint |
| `SELF_OPERATION_DENIED` / `TARGET_STATE_INVALID` / `ADMIN_TARGET_DENIED` / `SUPER_USER_TARGET_DENIED` | `failed-precondition` | 自己、状態、保護targetが不許可 |
| `RELATIONSHIP_INCONSISTENT` / `AUTH_IDENTITY_MISMATCH` / `TEMPORARY_USER_LINKED` | `failed-precondition` | 予約・User・Auth identityが不整合、または仮Userが連携済み |
| `SOURCE_NOT_COMPLETED` / `ALREADY_REINSTATED` / `LATEST_OPERATION_MISMATCH` | `failed-precondition` | 訂正元、Employee lifecycle head、reverse状態が不正 |
| `TARGET_OPERATION_ACTIVE` | `aborted` | 別operationが同じUser/Employee lockを保有 |
| `UPSTREAM_UNAVAILABLE` | `unavailable` | Auth・Firestoreの一時障害またはretry可能な失敗 |
| `INTERNAL` | `internal` | allowlist外の未分類障害 |

#### UWB-07A Employee退職

- Callableは`terminateEmployee`とし、exact inputを`operationId`、`employeeId`、`terminationDate`、`reasonOfTermination`に限定する。
- Employeeだけ、仮登録User連携、本登録User連携を`EmployeeUserReservations/{employeeId}`とpointer先Userから解決する。予約なし、Employeeを指すUserなし、release前invariant audit cleanの3条件をEmployee-onlyとする。User linkがあるのに予約がない、pointer先がない、不一致・複数User、他tenant、会社管理者・super-user連携はfail closedとし、旧queryの先頭結果へfallbackしない。仮登録User連携も`TEMPORARY_USER_LINKED`で拒否し、既存`deleteTemporaryUser`を完了してEmployee-only状態を再確認してから別requestとして退職する。
- actor自身に紐付くEmployeeの退職を拒否し、別のhuman-resourceまたは会社管理者を要求する。
- Employeeだけの場合はEmployeeを`RESIGNED`へ変更する。仮登録Userとemail予約がある間にclientがAuthentication accountを直接作成でき、Firestore transactionだけではその作成元をserver-verifiableにbindできないため、UWB-07Aはcanonical email、claim不存在、未setup状態からAuth UIDを推定・削除しない。仮登録削除後に残り得るAuth-only部分状態も退職operationへ取り込まず、FUT-0081/FUT-0083のaccount repairで扱う。UWB-07Aは仮User、仮User候補Auth、同emailの新しい予約・tenant・Authへ作用しない。
- 本登録User連携では、target AuthのUID、canonical email、email確認、company claim、super-user状態とUser・予約を照合する。最初のtransactionでoperationとlockを取得し、Employeeを`RESIGNED`、Userをaccess-revoked状態にしてからAuth削除へ進む。durable intent保存後の削除直前にもAuthを再取得して同じidentityを再照合し、不一致・型不正なら削除せずreconcile対象にする。Auth不存在はoperation target、User、両予約が完全一致する再試行だけで`auth-already-absent`として扱う。
- access revokeのtransaction完了後は、通知dispatcherが送信対象Userを送信直前に再取得し、同じ会社の有効な本登録Userかつ`disabled=false`である場合だけtoken取得・送信へ進む。lifecycle lock保有中またはUser不在・仮登録・disabled・company不一致では送信しない。外部FCM送信と退職transactionはatomicにできないため、transaction commit前にeligibility確認を通過したin-flight messageは、FCMへの引渡しがcommit後でも回収不能な残存riskとする。commit後にeligibility確認を開始するqueued eventと新規token登録は拒否する。

#### UWB-07B 単独本登録User削除

- Callableは`deleteStandaloneRegisteredUser`とし、exact inputを`operationId`、`targetUserId`、trim済み1〜20文字の`reason`に限定する。reasonは固定期限なし・自動削除なしのserver-only履歴へ保存し、会社管理者専用readerの最小projectionをProd前に確定する。
- 有効な本登録会社管理者だけが、同じ会社のEmployee未連携・非管理者・非super-user本登録Userを削除できる。active/disabledは対象にできるが、自己削除を許可しない。
- Employee予約またはEmployee連携があればUWB-07A、仮登録なら既存`deleteTemporaryUser`を要求し、対象種類をclient指定だけで切り替えない。

#### UWB-07C 誤退職訂正

- Callableは`reinstateEmployee`とし、exact inputを`operationId`、`employeeId`、`reversesOperationId`、`correctionReasonCode=MISTAKEN_RETIREMENT`に限定する。雇用開始日として誤用される`effectiveDate`やemail、旧UIDは受け取らない。
- UIはserver-only ledgerを直接読まず、`getEmployeeReinstatementContext`へ`employeeId`だけを送り、会社管理者・対象状態・User関係・latest head・元退職完了をserverで確認したうえで`reversesOperationId`とUser再登録要否だけを受け取る。これは訂正入力の準備であり、`reinstateEmployee`のtransaction内最終検証を置き換えない。履歴一覧readerは会社管理者専用の`listLifecycleOperations`最小Callable projectionと専用pageへ実装済みである。
- 有効な本登録会社管理者だけに許可する。`employees:terminate`、manager、human-resource、super-user、直接permission文字列だけでは実行できない。
- 対象Employeeが`RESIGNED`で、参照するUWB-07A operationが同じ会社・同じEmployeeの`completed`、`cleanupState`が`completed`または`not-applicable`であり、`EmployeeLifecycleHeads/{employeeId}`のlatest operationとrevisionがその退職を指すことをtransactionで確認する。active lock、User・Employee予約があれば拒否する。同じ訂正operation ID・同じfingerprintの再送だけは保存済み結果を返し、別IDで既にACTIVEまたはreverse済みなら`ALREADY_REINSTATED`とする。
- 1回のFirestore transactionで訂正operationとlockを作成し、Employeeを`ACTIVE`へ戻して現在値の退職日・退職理由を消去し、元operationへのreverse linkと完了eventを記録してlockを解除する。
- 旧User/Auth、role、通知設定、旧UID参照を復元・書換えない。accountが必要なら訂正完了後に既存のEmployee連携User作成を別操作として実行する。同じemailが別tenantで使用済みでもEmployee訂正は成功させ、他tenantへ作用しない。
- UWB-07導入前のRESIGNED Employeeは自動訂正対象にせず、退職記録backfillと関係不整合を確認する別の管理者repair checkpointで扱う。実際に退職期間が存在する再雇用はCONF-0063/FUT-0077へ残す。

#### operation・reconcile・privacy

- operation pathは`Companies/{companyId}/LifecycleOperations/{operationId}`とする。exact fieldは`schemaVersion`、`operationId`、`operationType`、`state`、`actorUid`、`actorDisplayName`、`employeeId`、`targetUserUid`、`targetDisplayName`、`reversesOperationId`、`terminationDate`、`reasonOfTermination`、`offboardingReason`、`correctionReasonCode`、`requestFingerprint`、`authDisposition`、`cleanupState`、`attemptCount`、`lastErrorPhase`、`lastErrorCode`、`createdAt`、`updatedAt`、`authDeletedAt`、`dataFinalizedAt`、`completedAt`だけとし、operation typeに不要なfieldは`null`とする。`targetUserUid`はUWB-07A/Bで削除する本登録User document IDだけを表し、仮User候補Auth UIDを保存するfieldは設けない。表示名と理由はtrim済み1〜6文字、1〜20文字へそれぞれ限定する。
- `schemaVersion`はinteger `1`、`attemptCount`は0以上のinteger、各ID・enum・fingerprint・表示名・理由はstringまたは操作種別に応じた`null`、`terminationDate`は`YYYY-MM-DD` stringまたは`null`、`createdAt`と`updatedAt`はserver Timestamp、その他の時刻はserver Timestampまたは未到達時`null`とする。unknown field、undefined、NaN、client timestampを拒否する。
- enumは`operationType=employee-retirement|standalone-registered-user-deletion|employee-reinstatement`、`state=access-revoke-pending|access-revoked|auth-delete-intent|data-finalized|completed|failed-retryable`、`authDisposition=not-applicable|present|deleted|already-absent`、`cleanupState=not-applicable|pending|completed|failed`、`correctionReasonCode=MISTAKEN_RETIREMENT`に限定する。
- event pathは`Companies/{companyId}/LifecycleOperations/{operationId}/Events/{phase}-{attempt}`とし、fieldを`phase`、`attempt`、`outcome`、`errorCode`、`at`だけに限定する。開始intentはoperation stateで表し、各phase/attemptのterminal outcomeを1件だけ同じdocument IDで冪等作成する。eventのupdate/deleteを許可しない。
- eventの`phase`は`employee-retirement|access-revoke|auth-disable|auth-delete-intent|auth-delete|data-finalize|fcm-cleanup|employee-reinstatement`、`outcome`は`succeeded|failed-retryable|already-completed`に限定する。`errorCode`は成功時`null`、失敗時はCallable error tableのdomain codeだけとし、`attempt`は1以上のinteger、`at`はserver Timestampとする。
- lock pathは`Companies/{companyId}/UserLifecycleLocks/{targetUserUid}`と`Companies/{companyId}/EmployeeLifecycleLocks/{employeeId}`とし、fieldを`operationId`、`operationType`、`createdAt`だけに限定する。最初のtransactionで取得し、terminal finalize transactionだけが対応operationのlockを解除できる。
- lockの`operationId`と`operationType`はoperation schemaと同じstring・enum、`createdAt`はserver Timestampとし、unknown fieldを拒否する。
- Employee lifecycle headは`Companies/{companyId}/EmployeeLifecycleHeads/{employeeId}`とし、fieldを`revision`、`latestOperationId`、`latestOperationType`、`updatedAt`だけに限定する。`revision`は1以上のinteger、`latestOperationId`はoperation IDと同じstring、`latestOperationType`は`employee-retirement|employee-reinstatement`、`updatedAt`はserver Timestampとし、unknown fieldを拒否する。UWB-07A/CがEmployeeと同じtransactionでrevisionを単調増加させ、UWB-07Cはreverse元がlatestであることを検証する。operation、event、lock、headのclient直接read/writeは禁止する。
- 同じoperation ID・同じ入力は現在phaseから再開または同じ完了結果を返し、同じID・異なる入力と別ID・同一targetの進行中操作を拒否する。User/Employeeのdeterministic lifecycle lockをtransactionで取得し、enable、role変更、管理者移譲、退職、訂正との競合を拒否する。
- Employee-only Aは、operation・Employee lock・head、Employee更新、`employee-retirement` event、`state=completed`を一つのtransactionで確定し、同じtransactionでlockを解除する。`targetUserUid=null`、`authDisposition=not-applicable`、`cleanupState=not-applicable`とする。仮User連携Aはoperationを開始せず、仮User/Auth/FCM cleanupをUWB-07Aへ含めない。
- 本登録User連携AとBは下表の順で進める。Auth外部APIをFirestore transaction callback内で呼ばない。

| 段階 | state / disposition | 必須作用とlock |
|---|---|---|
| 初回transaction | `access-revoke-pending` / `present` / `pending` | operation・User/Employee lockを作成し、Userを`disabled=true`へ変更する。AはEmployeeを`RESIGNED`へ更新しhead revisionも進める。UWB-08のRulesと全保護Callableはdisabled Userを直ちに拒否する。 |
| Auth access revoke | `access-revoked` | Admin SDKでtarget Authをdisableし、同じUIDがdisabledになったことを確認する。失敗時はlockを保持してreconcileする。 |
| delete intent transaction | `auth-delete-intent` | durable intentを保存する。直後にAuthを再取得・再照合してから削除し、`authDisposition=deleted|already-absent`を保存する。 |
| finalize transaction | `data-finalized` | User、email予約、AのEmployee予約を再検証して削除し、FCM cleanup完了までlockを保持する。 |
| cleanup成功 | `completed` / `completed` | FCM cleanupの冪等完了eventを保存し、対応lockを解除して`completed`応答を返す。 |
| cleanup失敗 | `data-finalized` / `failed` | core削除は戻さずlockを保持し、`completed-cleanup-pending`を返す。同じoperationまたはreconcilerがcleanupを再試行する。 |

- `failed-retryable`はdata finalize前の失敗で、lockを保持して同じoperationだけを再開する。server reconcilerは新しいactor requestではなく、保存済みoriginal actor・fingerprint・targetをservice identityで再検証して続行するため、original actorが後にdisabled・削除されてもactorUidを置換しない。既知phaseにretry上限や直接unlockを設けず、回復不能な不変条件違反はlockを保持して運用alertを出す。別actorによる手動lock削除・fingerprint変更は許可せず、将来admin repairを提供する場合は別の監査付きoperationとして仕様変更する。UWB-07Cは一つのtransactionでoperation・Employee lock・head、Employee訂正、event、`state=completed`を確定してlockを解除する。
- Functions停止、Auth応答喪失、Firestore競合、FCM cleanup失敗は同じoperation IDの再送とserver-only reconcilerで処理する。最初のtransaction完了後は利用者取消を許可せず、元operationをcancelledへ書き換えない。
- Auth削除成功からFirestore finalizeによるemail予約解放までの間に同emailの新Auth UIDが作成された場合、旧operationはそのUIDを検索・削除せずcore finalizeを完了する。email予約解放だけではAuthenticationのemail再利用を無条件に保証できないため、signup leaseまたは同等のserver-verifiable gateを採用するまで、新UIDの検出・repairはUWB-07の完了条件にせずFUT-0081/FUT-0083で扱う。
- email、email hash、role、通知設定、User/Auth全文、claims、FCM tokenをledger、event、error、logへ保存しない。pending/reconcile中のraw UID、actor/targetのtrim済み最大6文字表示名、Employee ID、退職日・最大20文字退職理由、単独User削除理由だけを最小snapshotとする。core削除後の`state=data-finalized, cleanupState=pending|failed`からは、cleanup成功時の`state=completed, cleanupState=completed`へだけ遷移できる。`completed-cleanup-pending`はCallable応答statusでありoperation stateではない。completed operationは現行の訂正・冪等性・参照整合性を維持するserver-only記録として固定期限なしで保持し、自動purge、legal hold、terminal後UID縮小を実装しない。会社管理者専用readerの実装・検証まではProd公開しない。

#### 履歴一覧readerの確定契約

- 公開Callableを`listLifecycleOperations`、pageを`/settings/lifecycle-history`、titleを「退職・アカウント削除履歴」とする。route、navigation、page内部、Callableのすべてを有効な本登録会社管理者だけへ限定し、super-user、manager、human-resource、直接permissionだけのUserはfail closedで拒否する。client判定はUX補助とし、Callableは`resolveCallableAuthIdentity`と同社actor Userを再取得して最終認可する。
- exact inputは`{ cursor: string | null }`だけとし、plain object、exact key、nullまたはlower-case UUID v4を検査する。会社ID、page size、state、operation type、Employee/User、検索、sortを受け取らない。cursorはserver由来company ID配下だけで取得し、存在、operation exact schema、Firestore Timestamp、`snapshot.id === operationId === cursor`を検査する。不在、他社、利用不能cursorの違いはclientやlogへ出さない。
- queryは同社の`LifecycleOperations` direct collectionを`createdAt desc`、document ID descで並べ、cursorがある場合は検証済みanchor snapshotの後から`limit(21)`で取得する。全21件を検査して先頭20件を返し、21件目がある場合だけ20件目のoperation IDを`nextCursor`とする。collection group、全件count、全page preload、Events・locks・heads・Users・Employees join、fallback scanを行わない。作成時刻はpagination中に変更しない。
- responseは`{ schemaVersion: 1, items, nextCursor }`のexact objectとし、`items`は0〜20件、`nextCursor`は`string | null`とする。itemは`operationType: "employee-retirement" | "standalone-registered-user-deletion" | "employee-reinstatement"`、`status: "processing" | "retrying" | "completed"`、`actorDisplayName: string`、`employeeId: string | null`、`subjectDisplayName: string | null`、`includesUserAccountDeletion: boolean`、`effectiveDate: string | null`、`reason: string | null`、`createdAt: string`、`completedAt: string | null`のexact 10 fieldとする。`subjectDisplayName`は単独User削除だけ、`employeeId`は退職・訂正だけ、`effectiveDate`と`reason`は退職、`reason`は単独User削除でも使用し、不要値はnullとする。`includesUserAccountDeletion`は退職または単独User削除で本登録User/Authの削除対象を持つ場合だけtrueとし、削除phase完了の意味には使わない。timestampはFirestore Timestampを厳格検査してUTC ISO stringへ変換し、未完了operationの`completedAt`はnullとする。
- public statusは`completed|processing|retrying`だけとする。保存`completed`は`completed`、`failed-retryable`と`state=data-finalized, cleanupState=failed`は`retrying`、`access-revoke-pending|access-revoked|auth-delete-intent`と`state=data-finalized, cleanupState=pending`は`processing`へ変換する。raw state、cleanupState、error、attempt、dispositionを返さず、schemaと一致しない組合せをpublic unknownへ丸めない。
- itemへoperation ID、reverse operation ID、actor/target UID、request fingerprint、内部schema version、raw state、Auth・cleanup disposition、attempt、last error、updated/auth-deleted/data-finalized timestamp、correction reason code、event、lock、head、path、email、role、claim、tokenを含めない。cursorのoperation IDは非秘密の同社内位置情報としてclientへ渡り得るが、画面、URL、永続store、storage、analytics、console、server logに出さず、認可根拠にしない。
- clientはdesktop tableとmobile cardで実行日時、操作、対象、理由、実行者、状態を同じ情報量で表示する。公開labelは従業員退職、単独ユーザー削除、誤退職訂正、処理中、再処理中、完了とする。`includesUserAccountDeletion=true`は「アカウント削除対象あり」と表示し、statusが未完了でも「削除済み」と表示しない。初回loading、empty、安全な固定error、再試行、前へ・次へを提供し、検索、filter、export、total count、page size選択を初版へ含めない。表示中20件とcursor stackだけをmemoryへ保持し、取得失敗時は現在pageを維持し、権限喪失、sign-out、unmountで破棄する。前pageは保存済み一覧ではなくcursorから最新状態を再取得するため、閲覧中に新しいoperationが追加された場合は行が移動し得る。ledgerや現在のUser/EmployeeをFirestore clientから直接読み直さない。
- 必須testはexact input/output、会社管理者陽性、他role・super-user・仮・disabled・他社・stale identity陰性、identity-derived tenant path、固定`limit(21)`、20/21件境界、同時刻document ID tie-break、cursor replay・他社・不在・不正、全state mapping、Timestamp・schema・document ID不正時のpage全体失敗、projection/logへの除外field混入0、Rules direct read deny回帰、route/navigation/page policy、loading・empty・safe error・前後page・多重fetch・memory破棄、desktop/mobile UIを含む。`includesUserAccountDeletion`はaccess revoke前、再処理中、cleanup失敗、完了の各状態で「対象あり」だけを表し、削除完了の判定に使われないことを固定する。
- 初版は既存data migration、Rules緩和、cursor secret、新規filter用composite indexを必要としない。実装後にCodex専用Emulatorでqueryを確認し、index要求が実証された場合だけ`firestore.indexes.json`を変更する。Dev・Prod既存operationのschema invariant、App Check、rate limitは別の未完了gateとし、remote接続、deploy、実data操作は別承認を必要とする。rollbackはpageとCallable exportを閉じ、ledger、A/B/C、reconciler、Rules deny、保存dataを変更・削除しない。
- 通知logは該当する場合の`operationId`、件数、allowlist済みdomain error codeだけに限定し、raw・partial FCM token、token由来識別子、email、退職・削除理由、通知本文、custom data、provider response全文を記録しない。既存`sendMulticastNotification`とnotification triggerのtoken・payload logをUWB-07/08 release gateで是正する。

#### 実装checkpoint

1. [x] permission catalog、actor/target/input policy、role preset parity testを実装する。
2. [x] `LifecycleOperations`、events、locks、共通registered User deletion engineとfailure injection testを実装する。
3. UWB-07A、UWB-07B、UWB-07Cのuse-case、Callable、error mapper、exportsを順次実装する。
   - [x] UWB-07A core: Employee-only atomic completion、本登録User連携の予約pointer整合、Auth disable・再照合・delete、User・両予約finalize、FCM cleanupと同一operation再開。
   - [x] UWB-07A transport: current Auth gateを使うCallable、error mapper、public export、Functions transport／Emulator検証。
   - [x] UWB-07B/C use-case、Callable、error mapper、public export。
4. [x] UWB-08でUsers、Employees、予約、operation、event、lock、headをCompanies汎用matchから除外し、User client deleteとEmployee退職・訂正fieldのclient writeを閉じる。
5. [x] 既存User/Employee削除triggerの連鎖、email log、FCM cleanup、通知dispatcherのactive User再検証、token・payload logを新operation/reconcile契約へ整合させる。
6. [x] client policy、composable、Employee詳細、User管理、訂正用最小projectionを接続する。履歴一覧projectionも会社管理者専用の最小Callableと専用pageへ接続する。
7. [x] 5分reconcilerの`LifecycleOperations.state` collection-group queryに必要なindexを`firestore.indexes.json`へ明示し、source contract testで固定する。
8. [x] 単体、EmulatorのRules・並行・phase failure、Codex UI smoke、利用者local操作受入れ、super-userの3操作control/server policy parity、固定保存期限なし・自動削除なしの保持方針、会社管理者専用履歴readerの実装・自動検証・Chrome空状態確認、利用者による`firestore.rules`確認を完了する。

#### 完了条件

- [ ] 無効化、Employee退職、単独User削除、誤退職訂正が別操作としてUI・Callable・履歴で区別されている。
- [x] 本登録User連携のUWB-07A後に旧Authと旧Userが不存在で、Employeeと業務記録が維持され、EmployeeのUser紐付けだけが解除されている。Employee-onlyではAuth/Userへ作用しない。
- [ ] 旧User/Authと予約が同じメールアドレスの再登録を妨げず、競合する新Authがない通常系では別tenantへ正規登録できる。Auth削除直後から予約解放までの競合では新UIDを検索・削除しないことを陰性testで確認し、検出・repairはFUT-0081/FUT-0083の未完了gateとして残す。
- [x] UWB-07Bが会社管理者専用で、Employee連携、仮登録、管理者、自己、super-user、他社を拒否する。
- [x] UWB-07Cが元退職履歴を保持したままEmployeeだけを同じIDで`ACTIVE`へ戻し、User/Auth・旧UID・業務記録へ作用しない。
- [ ] 管理者、自己、他社、状態不正、二重実行、並行operation、全phaseの部分失敗をfail closedまたは安全にreconcileできる。
- [ ] 3 Callableがmissing auth、stale token、current Auth不存在・disabled、email未確認、UID・email・company claim・super-user不一致、actor User不在・仮登録・disabled・他社を拒否する。
- [x] UWB-08のgeneric match迂回、User直接delete、Employee退職・訂正field直接write、ledger/event/lock/head直接accessの拒否testが成功している。
- [ ] access revoke commit後にeligibility確認を開始するqueued通知、disable後token登録、Auth disable/delete失敗中、Firestore finalize失敗中に対象Userへ送信せず、FCM cleanup failureをreconcileできる。commit前にeligibility確認を通過したin-flight messageだけは回収不能riskとしてテスト結果と運用表示で区別する。logger captureでraw・partial token、token由来識別子、email、退職・削除理由、通知本文、custom dataが0件である。
- [ ] 仮User連携を`TEMPORARY_USER_LINKED`で拒否し、UWB-07Aがsignup途中Authを検索・削除せず、仮登録削除完了後のEmployee-only再実行だけを許可する陰性testが成功している。
- [ ] 予約解放直後に別tenantが同emailで作成した新予約・新Auth UIDと、既存仮登録削除raceで残ったAuth-only accountへUWB-07Aが作用しない。
- [ ] 単体・Emulator・UI testと利用者受入れによりlocal UWB-07実装を完了できる。固定保存期限なし・自動削除なしの契約、会社管理者専用reader projection、履歴pageのChrome空状態確認、UWB-08 release gateは完了済みである。履歴data行と実page移動は対象dataがなかったため実browser未確認であり、上記の未完了条件とともに完了判断前に再照合する。Prod公開は別承認まで行わない。

### UWB-08 Firestore Rulesのactor・field・lifecycle制約

- 状態: Completed（自動検証・利用者Rules確認完了）
- 主な実装file: `firestore.rules`

#### 作業

- [x] Companies配下の汎用matchから`Users`、`Employees`、`EmployeeUserReservations`、`LifecycleOperations`、events、lifecycle locks、`EmployeeLifecycleHeads`を除外する。個別matchの拒否が汎用matchの許可に負けない構造にする。
- [x] Usersの`read`、`create`、`update`、`delete`を分離する。現行User create/update/deleteはすべて専用Callableへ移行済みのため、client create/update/deleteはfield allowlistを設けず全面拒否する。
- [x] User読取、Employee一般write、FcmTokens createで実行者の有効な本登録状態とtenantを既存Userから型付きで検証する。会社管理者・strict presetの最終認可は各Callableで再検証する。
- [x] `request.resource.data`だけを権限根拠にせず、既存の実行者Userを参照する。
- [x] Employee createは`ACTIVE`かつ退職fieldなし/null、FcmTokens createはexact field allowlist・型・本人・会社一致へ限定する。User client createは全面拒否する。
- [x] Employee updateは`diff().affectedKeys()`でlifecycle field不変を要求し、FcmTokensとUserのclient updateは全面拒否する。
- [x] immutable・server-only fieldの直接変更を拒否する。
- [x] 本登録Userのclient deleteを拒否する。
- [x] Employeeの`ACTIVE`/`RESIGNED`遷移、`dateOfTermination`、`reasonOfTermination`の変更とEmployee deleteをclientから拒否し、UWB-07A/CのAdmin SDKだけに限定する。
- [x] `LifecycleOperations`、events、User/Employee lifecycle locks、`EmployeeLifecycleHeads`のclient read/writeを全面拒否し、訂正用最小Callable projectionと会社管理者専用の履歴一覧Callableだけを公開する。履歴一覧はRulesを緩和せず、server identityから導出した同社dataのexact最小projectionだけを返す。
- [x] FcmTokens createはcurrent Authと同じUIDの有効な本登録User、User・token・tenant claimの同一company、`token == document ID`、`token`・`uid`・`companyId`・`updatedAt`だけのexact field/typeに限定する。client updateは全面拒否し、同deviceを別Userが使う場合は旧ownerがsign-out時に削除してから新ownerがcreateする。旧owner削除失敗時はowner上書きを許可せずserver cleanup対象とする。deleteはresource owner本人だけに許可し、server cleanupはAdmin SDKで行う。
- [x] super-user claimによる恒久的な例外を追加しない。

#### 完了条件

- [x] 汎用matchからUsers、Employees、予約、operation、event、lock、headの制約を迂回できない。
- [x] disabled・仮登録・User不在・company不一致Userのcreate、`token != document ID`、unknown field・型不正、全client update、既存owner上書きを拒否する。同device User切替は旧owner delete成功後の新owner createだけを許可し、access revoke後の通知dispatcherはtokenを読出し・送信しない。
- [x] actor、対象、操作、field、型ごとの許可・拒否testが成功している。
- [x] 既存CallableはAdmin SDK経由で正常に動作する。
- [x] 利用者が`firestore.rules`のUser client write拒否、Employee lifecycle field・delete拒否、lifecycle ledger/event/lock/head直接access拒否を確認している。

### UWB-09 role・permission対応表のschemas package統合

- 状態: Completed
- 対象repository: `air-guard-v2-schemas`、本repositoryのroot・Functions dependency

#### 作業

- [x] client／Functionsで重複管理しているrole・permission対応表をschemas packageの共通constantsへ移す。
- [x] schemas packageの責務、export名、互換性、version、公開順序を提示し、別repository変更の明示承認を得る。
- [x] schemas packageへ対応表と単体testを追加し、dev versionを公開する。
- [x] rootとFunctionsを同じschemas versionへ更新し、両lockfileのversion・integrity一致を確認する。
- [x] clientとserverをpackage constants参照へ変更し、重複したlocal対応表を削除する。
- [x] `hasPresetPermission`とserver preset resolverが同じcatalog・unknown fail-closed規則を使用する構成を確定する。
- [x] role展開、`users:write`、未知role、既存presetの回帰testを実行する。

#### 完了条件

- [x] role・permission対応表の正本がschemas package内の1箇所だけになっている。
- [x] rootとFunctionsが同じ公開versionと内容を使用している。
- [x] package更新・rollback・導入順序が記録されている。
- [x] 利用者が関連repositoryと本repositoryのapplication implementation fileを確認している。

### UWB-10 全体検証・文書確定・main統合準備

- 状態: Completed（2026-08-26 local検証・Chrome受入れ・利用者確定。main統合は別承認）

#### 作業

- [x] 全domain単体testを実行する。
- [x] Codex専用Firestore/Auth Emulator testを実行する。
- [x] 利用者起動のlocal Emulator・開発サーバーへ接続したChromeでUser管理flowを一巡する。
- [x] application code、Rules、UI、仕様、ADR、roadmap、changelogを再照合する。
- [x] UWB-01〜09の実装状態を再照合し、未対応client、複数tab・端末・actorからの多重実行riskを操作別に再評価した。role更新と有効・無効変更だけへclient期待値とtransaction内現在値の一致確認を追加し、対象Userのlifecycle lock中は拒否する。会社管理者移譲、仮User作成・削除、UWB-07 lifecycleは既存transaction・予約・lock・reconcileを維持し、通知設定の同時編集はlast-write-winsとして受容する。全document共通revision・lock・ledgerは採用せず、通常CRUDと他collectionへ展開しない。
- [x] project-owned validatorとmanaged governance validatorを実行する。
- [x] `git diff --check`とclean worktreeを確認する。
- [x] 未検証、残存risk、rollback、Dev受入れ項目を整理する。
- [x] 変更挙動、security境界、test、残存risk、rollback、main統合対象を提示し、利用者がUWB-10のlocal確定を明示した。全file・全行の確認は要求しない。main統合は別承認のため未実施である。

#### 完了条件

- [x] UWB-01〜09を再照合し、UWB-07だけに残る未完了条件をUWB-10やUWB全体の完了へ誤って含めず記録している。
- [x] 多重実行の後段評価について、追加改修またはrisk受容の判断と根拠が記録されている。
- [x] local testとChrome受入れがすべて成功している。
- [x] 利用者がUWB-10のlocal確定を明示している。
- [x] main統合対象は`bc4745970717514ef459ec8ae651e68ee0e0579b`、`40b6889d91efc529abf7f3dc8492f9acfd6a6baf`と本完了文書commitであり、差分、test、未確認事項を提示している。main merge・push・deployは未承認・未実施である。

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
- `LifecycleOperations`のdata量、法令・社内規程、privacy、費用、運用上の必要性に基づく保存期間・legal hold・terminal後識別子縮小・purgeの再検討。
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
| 2026-08-24 | UWB-06 page access policy | 全35 routeを共有accessPolicy catalogへ移行し、route・navigationを同じevaluatorへ接続。12 pathless groupは子から導出し、legacy field併記と未知policyをfail closed化。User管理strict判定を維持し、super-userの会社設定menu表示をroute許可と整合 | 本変更 | 全domain単体test 521件（page policy、validator、navigation matrix、対象SFC compileを含む）pass。server・Rules・fixtureは未変更のため専用Emulatorは直前の79件passを参照。利用者UI受入れは未完了 |
| 2026-08-24 | UWB-06 completed | 利用者がUser管理操作、dialog・keyboard・focus・取消、権限別の管理者メニューとroute拒否を画面確認し、UWB-06のUI受入れ完了を報告 | 本変更 | 利用者UI受入れ完了。自動検証証拠はUWB-06 automated、concurrency scope corrected、page access policyの各記録を参照 |
| 2026-08-24 | UWB-07 specification confirmed | 退職・単独本登録User削除・誤退職訂正をA/B/Cへ分離し、`employees:terminate`、会社管理者専用B/C、User archive不採用、統合`LifecycleOperations`、本登録Auth削除intent・reconcile、仮Userのfail-closed分離、User/Auth非復元、legacy repair・再雇用分離、UWB-08同時Rules gateを確定 | 本変更 | 設計・security subagentのread-only reviewを反映。application・Rules・test・dataは未変更。文書validatorは本変更の完了時に実行 |
| 2026-08-24 | UWB-07 checkpoint 1 | `employees:terminate`をstrict `human-resource`へ追加し、A/B/Cのexact input・actor・target純粋policyとrole preset parity testを実装 | 本変更 | 対象test 34件、全domain単体test 540件が成功。operation基盤、use-case、Callable、Emulator、Rules、UIは未実装 |
| 2026-08-24 | UWB-07 checkpoint 2 | server-only operation/event/lock/head schema、request fingerprint、Firestore transaction store、外部Auth/FCM作用をtransaction外へ分離した共通registered User削除phase engineを実装 | 本変更 | 対象test 17件、全domain単体test 557件が成功。正常完了、operation ID競合、lock、phase飛越し拒否、Auth disable/delete・disposition不正、data finalize、FCM cleanup、transaction・failure記録失敗を注入。A/B/C use-case、gateway、Callable、Emulator、Rules、UIは未実装 |
| 2026-08-24 | UWB-07 checkpoint 3A core | Employee-only退職をoperation・event・一時lock・head・Employee更新の単一transactionへ統合し、本登録User連携Aを予約pointer・一意User検査、Auth identity再照合、共通削除phase engine、FCM cleanupへ接続 | 本変更 | UWB-07A対象testを含む対象35件、全domain単体test 575件が成功。仮User、予約欠損＋User残存、会社管理者、super-user、Auth disable前delete、cleanup失敗後再開を陰性・failure testで固定。Callable、error mapper、public export、Emulator、B/C、Rules、UIは未実装 |
| 2026-08-24 | UWB-07/08 automated ready | A/B/C Callable、5分間隔reconcilerと必要なcollection-group index、訂正用最小context、client policy/composable、Employee詳細・User管理UI、User/Employee/lifecycle/FCM Rules、通知eligibility再検証とprivacy log是正を実装 | 本変更 | 全domain単体test 609件、専用Emulator suite 88件（Rules 35件を含む）pass。Codex専用UIで合成管理者sign-in、User設定、在職者一覧、退職者検索のsmokeを通常pointer/keyboardで確認し、console error 0件、既知PWA warningのみ、全専用port閉鎖、saved-data 7 files・3492 bytes不変。利用者local操作受入れ、`firestore.rules`確認、履歴reader・保持期間・legal hold・terminal後UID縮小は未完了 |
| 2026-08-24 | UWB-07 local UI acceptance | 利用者用EmulatorとChromeでhuman-resource、super-user、会社管理者の権限別表示とA/B/Cを確認。正規UIでEmployee連携仮Userを作成し、一般User signupとAuth Emulator OOB確認で本登録へ変換してから、同じUserを伴う退職・Auth/User削除・誤退職訂正を一巡 | 本変更 | human-resourceのEmployee-only・本登録User連携退職、会社管理者のEmployee-only退職・訂正、単独本登録User削除、本登録User連携退職・訂正が成功。訂正後はEmployeeが同一IDで在職一覧へ戻り、User/Authは非復元。対象操作中のconsole warning/error 0件。既存旧fixtureの予約不整合はserverがfail closedした。super-userの訂正control表示から判明した不一致は退職・訂正・単独User削除の全client policyをserverと同じfail closedへ修正した。sign-out時listener permission-deniedは既存の共通認証課題FUT-0005へ分離し、retention contractは未完了 |
| 2026-08-25 | UWB-07 retention decision | `LifecycleOperations`は現段階で固定保存期限を設けず、自動purge、legal hold、terminal後UID縮小を実装しない。data量・法令・社内規程・privacy・費用・運用上の必要性から見直しが必要と判断した時点で再検討する。履歴一覧は会社管理者専用の最小Callable projectionとして残す | 本変更 | 3件のread-only code/security調査を反映。application、Rules、test、dataは未変更。文書validatorは本変更の完了時に実行 |
| 2026-08-25 | UWB-07 lifecycle history reader automated | 会社管理者専用`listLifecycleOperations`、20件cursor paging、全stateの3段階projection、専用route・navigation、desktop/mobile pageを実装。返却直前にcurrent Authとactor Userを再検証し、全operation Timestampとcursorを厳格検査する。Firestore client直読denyと固定保存期限なし・自動削除なしを維持 | 本変更 | 対象70/70、全domain 635/635、Codex専用Emulator 92/92が成功。実queryに追加index要求なし。Nuxt dev serverはHTTP接続・console error 0だが既知の起動templateからhydrateせず、通常reload 1回後も履歴pageへ到達できなかったため実browser確認は未完了。利用者Rules確認、Dev/Prod/remoteは未確認 |
| 2026-08-26 | UWB-10 authentication concurrency automated | role更新へ編集前`expectedRoles`、有効・無効変更へ`expectedDisabled`を追加し、transaction内の現在値との不一致と対象Userのactive lifecycle lockを安全な`aborted`として拒否した。通知設定・本人プロフィール・通常CRUD・他collectionへ共通revision、lock、ledgerを展開しない境界をADR 0023へ記録 | 本変更 | 全domain単体test 646/646、Codex専用Emulator 93/93、project-owned・managed governance validator、renderer drift、`git diff --check`が成功。内蔵ブラウザはEmulator ready、Vite warmup、root 200、11 moduleの2巡probe後も2回とも起動templateで停止し、Nuxtに`ECONNRESET`、browser console error 0件を観測した。Chrome補助経路は接続不可。全専用port閉鎖、saved-data 7 filesの指紋不変、runtime残留0を確認。通常UI受入れ、利用者の全file確認、feature commit・main統合は未完了 |
| 2026-08-26 | UWB-10 Chrome concurrency acceptance | 利用者起動のimport-only local Emulator、開発サーバー、会社管理者でsign-in済みChromeをCodexが通常pointer操作で使用。非管理者の対象Userを無効化・再有効化し、2画面の片方で`労務`を先行保存、もう片方の古い`法務`保存を競合させた | `bc47459` | 無効化・再有効化が成功。古い保存は「対象ユーザーの役割が別の操作で変更されました。最新状態を確認して再実行してください。」で拒否され、`法務`は保存されず`労務`だけが維持された。最後にrole未設定へ戻し、対象Userが有効・全preset未選択であることを再読込確認。既知のChrome extension message-channel errorと期待されたstale拒否loggerを分離し、account切替・削除・他User変更は0件 |
| 2026-08-26 | UWB-10 completed | 利用者は全file・全行の確認を完了条件にせず、変更挙動、security境界、test、残存risk、rollbackに基づいてUWB-10のlocal確定を承認した | 本変更 | UWB-10は完了。UWB-07の競合・部分失敗・通知・Auth raceの残存陰性証拠は未完了のため、UWB全体は9/10のActiveを維持する。main merge・push・deploy・Dev/remote受入れは未実施 |
