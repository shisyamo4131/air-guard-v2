# User Write Boundary（UWB）改修計画

- 改修名: `User Write Boundary`
- 略称: `UWB`
- 状態: Active（UWB-01契約確定）
- 対象: `Companies/{companyId}/Users/{userId}`への書込み境界
- 基準branch: `main`
- 基準commit: `3b161ff186b236963e4aa3324b70c5c8ad98776e`
- 作成日: 2026-08-16
- 関連仕様: [現行仕様](../specification.md)の「テナントと認証」
- 関連ADR: [ADR 0015](../decisions/0015-user-led-implementation-and-codex-assurance.md)、[ADR 0016](../decisions/0016-firemodel-crud-boundary.md)、[ADR 0017](../decisions/0017-callable-auth-identity-gate.md)、[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)
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
| 実装ゲート | 2 | 9 | UWB-01〜02完了 |
| Dev環境受入れ | 0 | 1 | 未承認・未実施 |

実装ゲートは部分加点しない。各ゲートの完了条件をすべて満たし、利用者が対象application fileを確認した時点で完了とする。

## 前提として完了済みの認証基盤

- [x] 一般User本登録は、確認済みAuthentication emailに一致する一意の仮登録をserver側で解決する。
- [x] 初期会社管理者は、メール確認後にCompany・User・custom claimsを作成する。
- [x] 会社所属済み6 Callableは共通Auth identity gateを通る。
- [x] `disableUser`、`enableUser`、`changeAdminUser`は操作固有のactor・target検査を持つ。
- [x] Firestore・Storage Rulesはverified email、会社claim、tenant path、有効な本登録Userを共通入口で検査する。
- [x] 上記はlocal `main`の`3b161ff`へ統合済みである。

これらはUWBの前提であり、UWB実装ゲートの完了数には含めない。

## 現行の書込み経路

| 操作 | 現行経路 | UWBでの扱い |
|---|---|---|
| User一覧から仮User作成 | `UsersManager`からmodel `create()` | server境界へ移行する |
| 従業員画面から仮User作成 | `EmployeeUserManager`からmodel `create()` | server境界へ移行する |
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
- 会社管理者と`users:write`保有者が、同じ会社の仮登録Userを作成・編集・削除できる。
- `manager`と`human-resource`へ`users:write`を付与する。`employees:write`だけからUser管理権限を派生させない。
- 単独仮UserとEmployee連携仮Userは別の公開作成操作とする。
- Employee連携では同一会社のEmployee存在、未紐付け、1 Employee対最大1 Userをserver側で検証する。
- `employees:read`だけのactorはEmployee詳細でUserの紐付け・状態を確認できるが、User管理操作は行えない。必要な最小表示をUser文書全体のreadへ依存させない。
- User一覧は会社管理者と`users:write`保有者を対象とし、非管理者には管理者移譲、有効化・無効化、本登録User削除、role変更を提供しない。
- UWBは仮登録Userと保護fieldのCritical境界から開始し、本登録User lifecycleを一括変更しない。

### 後続ゲートへ分離した契約

- 本登録Userの削除条件とEmployee退職時のUser/Auth状態遷移。
- role値をpresetだけに限定するか、明示permission文字列も許可するか。
- 本人が変更できるUser設定fieldと更新方式。
- 仮登録emailの競合防止に使用する予約文書の具体pathとmigration。
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
- [x] `users:write`と既存Employee permissionの責務を分離した。
- [x] 一括確定しない本登録User lifecycleとEmployee Self Accessを後続専用ゲートへ分離した。
- [x] 利用者の回答を仕様、ADR、CONF、UWBへ反映した。

#### 完了条件

- [x] 利用者が仮登録Userのactor/action matrixと段階的なgate縮小を承認している。
- [x] 現行仕様、ADR 0018、関連FUT/CONF、UWB文書が一致している。
- [x] UWB-02開始に必要な`users:write`の意味と初期付与roleが確定している。

### UWB-02 `users:write`認可基盤

- 状態: Completed（2026-08-17 利用者確認）
- 主な影響file: client／Functions role対応表、server role展開utility、仮登録User管理actor policy

#### 作業

- [x] clientとFunctionsに同一のrole・permission対応表を設置する。
- [x] parity testで両対応表の完全一致を検証する。
- [x] permission catalogへ`users:write`を追加する。
- [x] `manager`と`human-resource`へ`users:write`を付与する。
- [x] 既知presetだけを展開し、未知roleと直接permission文字列をserver認可で拒否する。
- [x] `employees:write`だけではUser管理を許可しないtestを追加する。
- [x] 会社管理者は明示permissionの有無にかかわらず仮登録Userを管理できることを維持する。
- [x] `isSuperUser`だけではUser管理actorにならないことを維持する。
- [x] User一覧とEmployee詳細のaction表示は、未接続APIを先に露出しないようUWB-03、UWB-04、UWB-06の各接続segmentへ移す。

#### 完了条件

- [x] client／Functionsの対応表と`users:write`付与presetがparity testで一致している。
- [x] serverが会社管理者、`manager`、`human-resource`だけを仮登録User管理actorとして許可する。
- [x] permissionなし、他社、仮登録、無効、不正状態、未知role、直接permission、`isSuperUser`だけのactorを拒否する。
- [x] 利用者が各application implementation fileを確認している。
- [x] 対象単体testが成功している。UIは後続API接続前のため変更・実行していない。

### UWB-03 仮登録User削除のserver境界

- 状態: Not started
- 主な影響画面: `components/Users/Manager/index.vue`、`components/Employee/UserManager.vue`

#### 作業

- [ ] 会社管理者または`users:write`保有者だけをactorとする。
- [ ] 同社の仮登録Userだけを対象とし、本登録、管理者、自己、他社、状態不正を拒否する。
- [ ] 仮登録User削除ではAuthenticationへ一切作用しない。
- [ ] 単独UserとEmployee連携Userの削除結果を分けて検証する。
- [ ] 仮登録Userのclient直接`delete()`をCallableへ置換する。
- [ ] 削除API接続と同時に、User一覧・Employee詳細の削除actionをactor・対象状態別に表示制御する。
- [ ] 本登録User削除とEmployee退職・削除連鎖は実装せず、Rulesでclient直接deleteを閉じるまでdeploy不可として保持する。
- [ ] 確認、処理中、取消、成功、失敗のUI状態を確認する。

#### 完了条件

- [ ] 仮登録削除ではAuthenticationへ作用しない。
- [ ] 本登録User、管理者、許可されていないactorからの削除が拒否される。
- [ ] 既存削除triggerが仮登録削除でAuthへ進まないことと再試行結果が記録されている。
- [ ] 利用者が各application implementation fileを確認している。
- [ ] 単体testと対象UIのlocal確認が成功している。

### UWB-04 仮登録User作成のserver境界

- 状態: Not started
- 主な影響画面: `components/Users/Manager/index.vue`、`components/Employee/UserManager.vue`

#### 作業

- [ ] 仮登録作成actorをUWB-01の契約に限定する。
- [ ] `companyId`を実行者identityから解決し、client入力を信頼しない。
- [ ] `isTemporary=true`、`isAdmin=false`、`disabled=false`をserverで固定する。
- [ ] email、displayName、employeeId、roles初期値のfield・型を検証する。
- [ ] emailとemployeeIdの重複・同時実行方針を実装する。
- [ ] User一覧と従業員画面の直接`create()`をCallableへ置換する。
- [ ] 作成API接続と同時に、User一覧・Employee詳細の作成actionを`users:write`または会社管理者へ限定する。
- [ ] 作成失敗時に未完成Userや誤った画面状態を残さない。

#### 完了条件

- [ ] `users:write`を持たない一般Userや他社Userから仮登録を作成できない。
- [ ] clientから本登録・管理者・無効Userを作成できない。
- [ ] 重複、競合、再試行の結果が定義されている。
- [ ] 利用者が各application implementation fileを確認している。
- [ ] 単体testと両作成UIのlocal確認が成功している。

### UWB-05 通常プロフィールと本人設定のfield境界

- 状態: Not started
- 主な影響画面: `components/Users/Manager/index.vue`、User設定の呼出し元

#### 作業

- [ ] このgateの実装前に、管理者・`users:write` actorが編集できる通常プロフィールfieldを利用者と確定する。
- [ ] このgateの実装前に、本人が編集できる設定fieldを利用者と確定する。
- [ ] role値をpreset限定または明示permission許可のどちらにするか確定し、role変更は会社管理者専用Callableへ分離する。
- [ ] email、companyId、isAdmin、isTemporary、disabled、rolesの混入を拒否する。
- [ ] `tagSize`と通知受信flagの型・許容値を検証する。
- [ ] FireModelのfull updateで非対象fieldが再保存されないことを確認する。
- [ ] 必要なら管理者更新と本人設定を別Callableへ分離する。

#### 完了条件

- [ ] 本人設定が他Userやserver-only fieldへ作用しない。
- [ ] 管理者プロフィール編集がAuth連携fieldを暗黙変更しない。
- [ ] 既存設定UIの表示・保存・再読込みが維持される。
- [ ] 利用者が各application implementation fileを確認している。
- [ ] 単体testと対象UIのlocal確認が成功している。

### UWB-06 User管理UIの統合回帰

- 状態: Not started
- 主な影響画面: User一覧、従業員詳細、管理者移譲、本人設定

#### 作業

- [ ] 作成・編集・削除・有効化・無効化・管理者移譲のloadingを独立管理する。
- [ ] 同一操作の二重送信を防止する。
- [ ] error後にdialog、editor、一覧、対象Userが正しい状態へ戻ることを確認する。
- [ ] UIの非表示・disabledだけを認可境界として扱っていないことを確認する。
- [ ] keyboard、focus、確認dialog、取消操作への回帰がないことを確認する。
- [ ] 共通UI packageの変更が必要な場合は、別repository境界として事前承認を得る。

#### 完了条件

- [ ] 各操作の成功・拒否・失敗・再試行をChromeで確認している。
- [ ] console errorと意図しないFirestore直接writeがない。
- [ ] 利用者が変更されたUI implementation fileをすべて確認している。

### UWB-07 Firestore Rulesのactor・field制約

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

### UWB-08 role・permission対応表のschemas package統合

- 状態: Not started
- 対象repository: `air-guard-v2-schemas`、本repositoryのroot・Functions dependency

#### 作業

- [ ] client／Functionsで重複管理しているrole・permission対応表をschemas packageの共通constantsへ移す。
- [ ] schemas packageの責務、export名、互換性、version、公開順序を提示し、別repository変更の明示承認を得る。
- [ ] schemas packageへ対応表と単体testを追加し、dev versionを公開する。
- [ ] rootとFunctionsを同じschemas versionへ更新し、両lockfileのversion・integrity一致を確認する。
- [ ] clientとserverをpackage constants参照へ変更し、重複したlocal対応表を削除する。
- [ ] role展開、`users:write`、未知role、既存presetの回帰testを実行する。

#### 完了条件

- [ ] role・permission対応表の正本がschemas package内の1箇所だけになっている。
- [ ] rootとFunctionsが同じ公開versionと内容を使用している。
- [ ] package更新・rollback・導入順序が記録されている。
- [ ] 利用者が関連repositoryと本repositoryのapplication implementation fileを確認している。

### UWB-09 全体検証・文書確定・main統合準備

- 状態: Not started

#### 作業

- [ ] 全domain単体testを実行する。
- [ ] Codex専用Firestore/Auth Emulator testを実行する。
- [ ] 認証済みChromeでUser管理flowを一巡する。
- [ ] application code、Rules、UI、仕様、ADR、roadmap、changelogを再照合する。
- [ ] project-owned validatorとmanaged governance validatorを実行する。
- [ ] `git diff --check`とclean worktreeを確認する。
- [ ] 未検証、残存risk、rollback、Dev受入れ項目を整理する。
- [ ] 利用者の全file確認とlocal動作確認後にmain統合承認を得る。

#### 完了条件

- [ ] UWB-01〜UWB-08がすべて完了している。
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
- 本登録User削除とEmployee退職・削除時のUser/Auth状態遷移。
- Employee連携User本人へ提供するEmployee Self Accessのfield・path境界。
- 将来の明示的なsuper-user support access。
- Dev・production deployとremote受入れ。

## 変更記録

| 日付 | 状態 | 内容 | Commit | 検証 |
|---|---|---|---|---|
| 2026-08-16 | Planning | `User Write Boundary（UWB）`と改修追跡ゲートを作成 | 本変更 | project-owned・managed governance validator pass |
| 2026-08-16 | UWB-01 completed | 単独／Employee連携User、`users:write`、仮登録管理actor、段階的gate縮小を確定 | 本変更 | project-owned・managed governance validator pass |
