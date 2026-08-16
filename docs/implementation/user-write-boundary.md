# User Write Boundary（UWB）改修計画

- 改修名: `User Write Boundary`
- 略称: `UWB`
- 状態: Planning
- 対象: `Companies/{companyId}/Users/{userId}`への書込み境界
- 基準branch: `main`
- 基準commit: `3b161ff186b236963e4aa3324b70c5c8ad98776e`
- 作成日: 2026-08-16
- 関連仕様: [現行仕様](../specification.md)の「テナントと認証」
- 関連ADR: [ADR 0015](../decisions/0015-user-led-implementation-and-codex-assurance.md)、[ADR 0016](../decisions/0016-firemodel-crud-boundary.md)、[ADR 0017](../decisions/0017-callable-auth-identity-gate.md)
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
| 実装ゲート | 0 | 8 | 未開始 |
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

### UWB-01で確定する事項

- 同社User一覧を読めるactorの範囲。
- 本人が直接変更できるfieldの確定一覧。
- 会社管理者が変更できる通常プロフィールfieldの確定一覧。
- 仮登録Userを作成・編集・削除できるactor。
- 本登録非管理者Userの削除条件と、Employee退職との関係。
- role値をプリセット限定にするか、明示permission文字列も許可するか。
- 仮登録emailとemployeeIdの重複防止方式。

未確定事項を推測でRulesやCallableへ固定しない。

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

- 状態: Not started
- application file変更: なし

#### 作業

- [ ] 現行のUser管理画面で到達可能な操作を画面別に再確認する。
- [ ] create/read/update/deleteをactor別に表へ固定する。
- [ ] User fieldをimmutable、server-only、admin-editable、self-editableへ分類する。
- [ ] 仮登録、本登録、管理者、無効User、Employee紐付きUserの状態遷移を固定する。
- [ ] 未確定事項を利用者へ提示し、回答を仕様とCONFへ反映する。

#### 完了条件

- [ ] 利用者がactor/action/field matrixを承認している。
- [ ] 現行仕様、関連FUT/CONF、UWB文書が一致している。
- [ ] 後続ゲートで推測しなければならない業務判断が残っていない。

### UWB-02 role変更のserver境界

- 状態: Not started
- 主な影響画面: `components/Users/Manager/index.vue`

#### 作業

- [ ] role変更policyを独立モジュールとして実装する。
- [ ] 実行者、対象User、会社、登録状態、管理者状態、role入力を検証する。
- [ ] role以外のfieldを変更しないuse-caseを実装する。
- [ ] 内部情報を公開しないerror mappingを実装する。
- [ ] Callable APIとして公開し、client composableへ接続する。
- [ ] `UsersManager`の直接role更新をCallableへ置換する。
- [ ] 失敗時にeditor内容とUser一覧が不整合にならないことを確認する。

#### 完了条件

- [ ] 一般User、他社User、無効・仮登録actorのrole変更が拒否される。
- [ ] 許可された会社管理者だけが同社対象Userのroleを変更できる。
- [ ] `isAdmin`、`disabled`、`companyId`等が同時変更されない。
- [ ] 利用者が各application implementation fileを確認している。
- [ ] 単体testと対象UIのlocal確認が成功している。

### UWB-03 User削除のserver境界

- 状態: Not started
- 主な影響画面: `components/Users/Manager/index.vue`、`components/Employee/UserManager.vue`

#### 作業

- [ ] 仮登録User削除と本登録User削除のpolicyを分離する。
- [ ] 管理者削除、自己削除、他社削除、状態不正を拒否する。
- [ ] 本登録Userではdocument ID、Auth UID、会社claimを削除前に照合する。
- [ ] 任意UIDの偽造User documentからglobal Auth削除へ到達できないようにする。
- [ ] Employee紐付きUserの削除・無効化・退職の境界を確定契約に合わせる。
- [ ] clientの直接`delete()`をCallableへ置換する。
- [ ] 確認、処理中、取消、成功、失敗のUI状態を確認する。

#### 完了条件

- [ ] 仮登録削除ではAuthenticationへ作用しない。
- [ ] 本登録削除では検証済みの同一Userだけが対象になる。
- [ ] 管理者と許可されていないactorからの削除が拒否される。
- [ ] 削除triggerとの二重削除・部分状態・再試行結果が記録されている。
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
- [ ] 作成失敗時に未完成Userや誤った画面状態を残さない。

#### 完了条件

- [ ] 一般Userや他社Userから仮登録を作成できない。
- [ ] clientから本登録・管理者・無効Userを作成できない。
- [ ] 重複、競合、再試行の結果が定義されている。
- [ ] 利用者が各application implementation fileを確認している。
- [ ] 単体testと両作成UIのlocal確認が成功している。

### UWB-05 通常プロフィールと本人設定のfield境界

- 状態: Not started
- 主な影響画面: `components/Users/Manager/index.vue`、User設定の呼出し元

#### 作業

- [ ] 管理者が編集できる通常プロフィールfieldをUWB-01の確定一覧へ限定する。
- [ ] 本人が編集できる設定fieldをUWB-01の確定一覧へ限定する。
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

### UWB-08 全体検証・文書確定・main統合準備

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

- [ ] UWB-01〜UWB-07がすべて完了している。
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
- 将来の明示的なsuper-user support access。
- Dev・production deployとremote受入れ。

## 変更記録

| 日付 | 状態 | 内容 | Commit | 検証 |
|---|---|---|---|---|
| 2026-08-16 | Planning | `User Write Boundary（UWB）`と改修追跡ゲートを作成 | 本変更 | project-owned・managed governance validator pass |
