# 2026-08-14 利用者主導開発ガバナンス交代引継ぎ

- 状態: local repository直結の新coordinator有効化済み・旧coordinator archive可能
- new coordinator task: `01a003d9-8782-79b2-9419-682e582bb1ac` host `local`（PM（AirGuardV2）-03）
- old coordinator task: `019ffe53-4eb9-7922-9012-34a526ebbbd4` host `local`（PM（AirGuardV2）-02）
- callback destination: 今後のcheckpointはnew coordinator `01a003d9-8782-79b2-9419-682e582bb1ac` host `local`
- repository/environment: `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex worktreeではない
- branch: `codex/auth-user-trigger-tenant-guard`
- baseline HEAD: `25c78f484a1a9431a6792fe0f786b900386be0bc`
- baseline worktree: clean
- common governance version: `1.0.0`
- 公式進捗: 10%（変更なし）
- old worktree target: `C:\Users\seven\.codex\worktrees\9a17\air-guard-v2`
- excluded worktree: `C:\Users\seven\.codex\worktrees\b4d7\air-guard-v2`は別task所有の可能性があるため対象外

## 完了した変更

- application codeの標準実装者を利用者へ変更した。
- Codexを設計、仕様整理、脅威・失敗経路、差分review、test計画・許可済み検証、document、roadmap、ADR、local Git管理へ集中させた。
- Codex developerを明示された補助実装だけに限定し、testerのtest code編集を明示されたtest scopeで許可した。
- 認証・認可・tenant分離を最優先とし、利用者が理解、実装、review、rollbackできる最小segmentを1件ずつ扱う契約とsegment templateを追加した。
- local Emulatorはtest用1社、Devは利用者の会社と協力会社の2社が試用するremote環境であることを記録した。
- ADR 0007をSupersededとし、ADR 0015をAcceptedにした。
- 2026-08-13 handoffをHistoricalへ変更し、local test harness未mergeという古い指示がmain merge `36ace65`で履行済みであることを記録した。
- 2026-08-11 managed governance再構築後の一回限りのtask交代条件を、履歴上完了済みとして整理した。

application code、Functions、Firebase Rules、Firebase設定、test code、実data、remote環境、外部serviceは変更していない。

## local repository coordinatorの有効化結果

- `WORKSPACE-HANDOFF-001`はcompleted。
- cwdとGit top-levelは保存済みrepositoryそのものに一致し、Git directoryとcommon directoryはいずれも同repositoryの`.git`だった。
- branchは`codex/auth-user-trigger-tenant-guard`、HEADは`25c78f484a1a9431a6792fe0f786b900386be0bc`、worktreeはcleanだった。
- root `AGENTS.md`、`governance/project-rules.md`、task-routed authoritative documents、common governance 1.0.0、公式進捗10%をrepositoryから復元した。
- application codeの標準実装者は利用者とする。Codexは設計、仕様整理、脅威・失敗経路、差分review、test計画・許可済み検証、document、roadmap、ADR、local Gitを管理する。本task chainで利用者が明示したapplication実装範囲では、実装fileを1件ずつreviewし、test fileは利用者review不要、実装file提示前に単体testを行う。

## Pre-integration checkpoint

- baseline commit `25c78f4`（`security: prepare verified user account setup`）。
- verified email、一意な仮登録、path/company一致、client指定`companyId`・`tempUserId`を信頼しないpolicy、use-case、安全なerror mappingを追加した。
- 仮User削除時はglobal Authentication User削除へ進まないtrigger guardを追加した。
- 新しい`setupUserAccount` use-caseは既存auth-v2 Callable/client flowへ未接続である。
- 認証関連単体test 193件、project-owned validator、managed governance validator、4実装fileの`node --check`、`git diff --check`はpass済みである。
- Emulator、remote環境、実dataを使う検証は未実施である。
- 残存riskは、custom claims失敗後の部分状態、Security Rules、rate limit/App Check、既存重複data、登録User document ID経由のglobal Authentication User削除境界である。

## Client integration checkpoint

- 既存`setupUserAccount` Callableを新use-caseと安全なerror mappingへ接続し、client指定`companyId`・`tempUserId`を廃止した。
- 一般Userのclient flowはAuthentication account作成と確認メール送信で停止し、メール確認後にID tokenを強制更新してから本登録する。管理者は既存`companyId` claimにより一般User本登録をskipする。
- 確認画面のpollingをsingle-flight化し、本登録後に最新claimでsessionを初期化してからdashboardへ遷移する。
- application実装4fileは利用者が1fileずつreviewして確認済み。追加test fileは利用者review不要の契約に従った。
- 全domain単体test 200件、3 JavaScript実装fileの`node --check`、1 Vue SFC compile、`git diff --check`はpassした。Emulator、remote環境、実dataは未実施である。
- Auth accountが有効でも、確認済みメール、正常な会社claim、tenant path、対応する有効な本登録Userの整合が揃わなければFirestore、Storage、Callableを拒否する方針を利用者が採用した。
- 上記認可整合性は次の最優先segmentかつrelease blockerである。Firestore Rules、Storage Rules、Callableの実装と陰性testが完了するまで、本client接続をdeployしない。
- 残存riskは、custom claims失敗後の部分状態、既発行tokenとclaimの陳腐化、Rules、rate limit/App Check、既存重複data、登録User document ID経由のglobal Authentication User削除境界である。

## Client local acceptance checkpoint

- 利用者が起動したlocal Emulator、local server、認証済みChromeを使い、会社管理者兼super-userの既存session回帰と一般User本登録flowを確認した。super-user用の再構築処理は本segment外であり実行していない。
- 一般User本登録の初回確認で`unconfirmedEmail.vue`の`useAuthFunctions`明示import漏れを検出して修正した。
- メール確認済みでも`companyId` claimが未設定のUserをglobal middlewareがdashboardへ早期転送し、本登録Callableを実行できない問題を修正した。メール未確認または会社claim未設定の認証Userは`/unconfirmedEmail`へ限定し、両方が揃ったUserだけ通常の画面認可へ進む。
- local合成Userで仮登録照合、Authentication account作成、メール確認、本登録Callable、`companyId`と`isSuperUser: false`のclaim反映、dashboard到達、再読込み後のFirestore error不在を確認した。
- 全domain単体test 201件、対象middlewareの`node --check`、対象Vue SFC compile、project-owned validator、managed governance validator、`git diff --check`はpassした。
- prod環境は未構築であり確認対象外。Dev環境、remote data、deploy、実dataは未接続・未実施である。
- 次はAuth claim・tenant path・User状態の認可整合性を最優先segmentとして再開する。Firestore、Storage、Callableの保護が完了するまでdeploy不可の境界は変わらない。

## Firestore identity gate checkpoint

- FirestoreのCompanies配下では、Authentication email確認済み、非空文字列の会社claim、claim会社配下に存在する同一companyの本登録User、`isTemporary === false`、`disabled === false`、要求tenant path一致をすべて要求する。
- 恒久的なsuper-user全会社client bypassを廃止した。将来の他社support accessは、明示的な開始・終了手続きを持つ未実装の別機能として保留した。
- Companies本体、名前付き17 subcollection、未定義descendant、SecurityReportIndexes、StripeDataを専用loopback Emulatorで検証した。汎用CompaniesルールがStripeDataのupdate/delete禁止を迂回する競合をtestで検出し、汎用ルールからStripeDataを除外した。
- 専用local suiteは32件すべてpassし、Functions未起動、利用者用saved-data不変、専用saved-data読込専用を確認した。remote、実data、deployは未実施である。
- Firestore Rules fileは利用者確認済み。次はStorage Rulesの最小segment、その後Callableと本登録bootstrap例外へ進む。全認可整合性gateが完了するまでdeploy不可の境界は変わらない。

## Storage identity gate checkpoint

- StorageのSecurityReports pathでは、Authentication email確認済み、非空文字列の会社claim、claim会社配下に存在する同一companyの本登録User、`isTemporary === false`、`disabled === false`、要求tenant path一致をすべて要求する。恒久的なsuper-user他社bypassは設けない。
- 専用loopback Emulatorでupload、list、metadata、download URL、byte download、custom metadata、deleteと、未認証、未確認・不正claim、User不在、仮登録、無効、field欠損・型不正、会社不一致、super-user他社拒否を確認した。Firestore・Storageを含むlocal suite 39件はpassした。
- `utils/storage.js`のStorage pathはRulesと一致し、既存client flowに直ちに必要な実装修正は確認されなかった。画像圧縮、Vue画面、thumbnail Functions、StorageとFirestoreの連携IAM、Dev・remote受入れは未確認である。
- Storage Rulesを含む次回deploy前に、対象project・alias、cross-service IAM許可prompt、`Firebase Rules Firestore Service Agent` roleを利用者へ通知し、明示承認後にだけ実行する運用を追加した。
- 次はCallable identity gateと本登録bootstrap例外へ進む。全認可整合性gateが完了するまでdeploy不可の境界は変わらない。

## Rebuild Callable identity gate checkpoint

- スーパーユーザー向けの`rebuildAllHistories`と`rebuildSecurityReportIndexes`は、ID tokenのverified email・会社claim・`isSuperUser`、現在のAuthentication Userのemail確認・有効状態・会社claim・`isSuperUser`、同社User documentの本登録・有効状態、要求会社一致をすべて要求する。
- 既存`assertAuthUserCompany`と`assertUserDocumentCompany`を会社・UID・本登録整合性に再利用し、操作固有のAuth/User有効状態はCallable側で検証する。恒久的な他社再構築は許可しない。
- 専用loopback Emulator suiteは46件すべてpassし、両再構築の正常経路、未認証、未確認、権限不足、Auth不在・無効・claim不一致、User不在・仮登録・無効・会社不一致、他社指定拒否を確認した。全domain単体test 201件と対象fileの構文検査もpassした。
- Functions Emulatorは起動せずCallable handlerを直接実行した。利用者用saved-dataは不変、専用saved-dataは読込専用だった。Functions transport、Dev・remote、実data、deploy、runtime service accountのAuth参照権限は未確認である。
- 次は残る管理・signup Callableと本登録bootstrap例外の最小segmentへ進む。全認可整合性gateが完了するまでdeploy不可の境界は変わらない。

## Global email availability Callable checkpoint

- `checkEmailAvailabilityGlobal`は、verified emailと正常な会社claimを持つ現在の有効なAuthentication User、同社の有効な本登録User、`User.isAdmin === true`がすべて整合する場合だけ許可する。`isSuperUser`だけでは許可しない。
- 未認証、token不整合、現在Auth不在・未確認・無効・会社不一致、User不在・仮登録・無効・会社不一致・非管理者・型不正を更新前に拒否し、有効な会社管理者には全会社Userの重複確認を許可する。
- `checkEmailAvailabilityGlobal`、`rebuildAllHistories`、`rebuildSecurityReportIndexes`を`functions/apis`の単体ファイルへ分離した。`functions/apis/index.js`は3つの公開Callableだけをexportし、2つの再構築で共有する`authorizeCompanyRebuild`は公開しない。
- 正式なAPI index経由の専用loopback Emulator suite 51件、全domain単体test 201件、対象7ファイルの`node --check`、project-owned validator、managed governance validator、`git diff --check`はpassした。Functions Emulator、Functions transport、Dev・remote、実data、deployは未実施である。
- 次は残るsignup・管理Callableのactor/tenant、App Check、rate limit、本登録bootstrap例外を最小segmentで扱う。全認可整合性gateが完了するまでdeploy不可の境界は変わらない。

## Signup email availability API extraction checkpoint

- `checkEmailAvailability`を`functions/modules/auth-v2.js`から`functions/apis/checkEmailAvailability.js`へ移し、`functions/apis/index.js`から公開した。Cloud Functionsの公開名、入力、応答、error、loggingを含む既存挙動は変更していない。
- 正式なAPI index経由で入力型、Authentication重複、管理者登録時の全会社User重複、一般User登録時の仮User不在・存在を確認した。専用loopback Emulator suite 55件、全domain単体test 201件、対象ファイルの`node --check`、project-owned validator、managed governance validator、`git diff --check`はpassした。
- 未認証入口、caller指定`isAdmin`、email登録状況を識別できる応答、App Check・rate limitは既存の残存riskである。Functions Emulator、Functions transport、Dev・remote、実data、deployは未実施である。
- 次は`auth-v2.js`に残るCallableを一つずつ現行挙動と認可境界から確認し、利用者review後に単体APIへ整理する。

## Remaining Callable and Auth trigger extraction checkpoint

- `createAdminAccount`、`checkUserPreRegistration`、`setupUserAccount`、`disableUser`、`enableUser`、`changeAdminUser`を`functions/apis`へ移し、全10 Callableを正式API indexへ集約した。`disableUser`と`enableUser`は同じAPI fileで非公開request handlerを共有する。
- `onAuthUserDeleted`を`functions/modules/auth-v2.js`から`functions/triggers/auth.js`へ移し、旧`auth-v2.js`を廃止した。公開Function名、gen1、region、処理、error吸収を変更せず、`functions/index.js`のexport先だけを更新した。
- 移設前後のCallableとAuth削除trigger本体一致、対象fileの`node --check`、functions entry実import、全domain単体test 201件、正式API index経由の専用loopback Emulator suite 60件、`git diff --check`はpassした。Functions Emulator、Functions transport、Auth削除event transport、Dev・remote、実data、deployは未実施である。
- `createAdminAccount`の既存所属・再実行・部分状態、匿名signup入口、App Check、rate limit、Users Rules等の残存riskは変更していない。次は認可整合性検証の優先改修へ戻る。

## Chrome Callable transport checkpoint

- 会社管理者かつスーパーユーザーで認証済みのChromeからlocal Emulatorへ接続し、`rebuildAllHistories`、`rebuildSecurityReportIndexes`の成功応答を確認した。警備日報index再構築は処理0件・index 0件だった。
- 非管理者の合成test Userに対して`disableUser`と`enableUser`を順に実行し、画面上の操作表示が「無効化」→「有効化」→「無効化」と変化することを確認した。dashboard復帰後も認証状態を維持し、Chrome console errorは0件だった。
- Emulatorは利用者の指示どおりdata変更可、export-on-exitなしの環境を使用した。停止・exportは行っていない。`changeAdminUser`、signup系Callable、Auth削除event、Dev・remote・deploy・実dataは未確認である。
- この実測は4 CallableのFunctions transport証拠を追加するもので、残存する匿名signup情報境界、App Check、rate limit、部分状態、Users Rulesを解消しない。公式進捗は10%に据え置く。

## Pre-registration anonymous response checkpoint

- `checkUserPreRegistration`の未認証応答を`isPreRegistered`だけへ縮小し、companyId、displayName、roles、tempUserIdを公開しないよう変更した。検索は最大2件とし、複数temporary Userは`failed-precondition`で拒否する。
- signup画面は事前登録確認済みbooleanだけを保持して汎用の利用者表示を使い、Callable client contractもboolean応答へ統一した。匿名入力のemail・会社IDを当該Callableのlogへ残さない。
- 変更前にmetadata応答と重複先頭採用を再現し、修正後はCodex専用loopback Emulator suite 61件、全domain単体test 202件、JavaScript・Vue SFC検査、`git diff --check`がpassした。利用者用saved-dataは不変、専用saved-dataは読込専用だった。
- 存在有無の列挙、App Check、rate limit、招待token、`checkEmailAvailability`の匿名境界、Dev・remote・deploy・実dataは未解決・未確認である。公式進捗は10%に据え置く。

## Signup email preflight policy checkpoint

- `checkEmailAvailability`を初期会社管理者signup専用の未認証UX事前確認へ変更した。入力はemailだけとし、Authenticationと全会社の全User状態を照合する。caller指定`isAdmin`はpolicy選択に使用せず、追加入力されても無視する。
- 一般User signupから`checkEmailAvailability`を除去し、未認証段階は`checkUserPreRegistration`、Auth email一意性はFirebase Auth作成時、本登録対象の一意性は`setupUserAccount`で確認する。管理者signupのpage/composableもemailだけを送る。
- 専用loopback Emulator suite 61件、全domain単体test 207件、JavaScript・Vue SFC検査、`git diff --check`がpassした。Functions transport、Dev・remote・deploy・実dataは未確認である。
- 事前確認と作成はatomicではなく、同時実行競合とAuth-onlyを含む部分状態が残り得ることをFUT-0081へ利用者確認済みriskとして記録した。email列挙、App Check、rate limit、`createAdminAccount`の既存所属・再実行・部分状態は未解決である。
- 次は`createAdminAccount`のserver enforcementを、現行挙動、移行・rollback、陰性testを先に整理した最小segmentとして扱う。公式進捗は10%に据え置く。

## 未確認・承認境界

- `main`への直接commit・merge、Git push、history rewrite、deploy、npm公開、migration、remote接続・remote data操作、実data操作、外部service変更は個別の明示承認がないため行わない。
- 次は既存auth-v2 Callable/client flowへ接続する前の最小segmentから再開する。現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを先に整理する。
- 旧coordinatorのarchiveは`WORKSPACE-HANDOFF-002` callback成功後に旧coordinatorが行う。新coordinatorはarchiveしない。

## Initial administrator signup checkpoint

- `createAdminAccount`はメール確認済みで有効な未所属Authentication Userだけに新規Company作成を許可し、ID tokenと現在AuthのUID、email、email確認、disabled、company claim、`isSuperUser`の型と一致を検証する。
- 既存Userは同じUID・email・company pathの有効な本登録初期管理者で、Companyが存在する場合だけclaims失敗後の再実行として再利用する。別User、別company、不正claim、Company欠損等は更新前に拒否する。
- clientはAuth作成と確認メール送信で停止し、同じbrowserのsession storageへpending Company情報を保持する。メール確認後に`createAdminAccount`、token refresh、session初期化を行う。
- 管理者表示名は6文字以内をVuetify `rules`と処理前guardで強制し、超過値を切り捨てずfield errorを表示する。
- 専用local Emulator suite 67件、全domain単体test 212件、対象構文・SFC検査、ChromeによるAuth作成、メール確認状態のEmulator更新、Company/User/claims作成、dashboard到達、表示名境界を確認した。実メールlink、Dev・remote、deploy、実dataは未確認である。
- 次はカスタムクレーム整合性を、保護対象Callableの共通claim schema、token/current Auth/User/path整合性、Firestore・Storage Rulesで検証可能な境界へ分けて進める。一般Userのclaims失敗後回復、Users Rulesのfield/actor制約、App Check、rate limitは継続課題である。

## Super-user claim normalization checkpoint

- `assertAuthUserCompany`は、所属済みAuthentication Userの`isSuperUser`が`true`または`false`のbooleanであることを必須化し、欠損・文字列・数値・nullを拒否する。
- 関連repository `air-guard-v2-admin-sdk`の`claims remove-superuser`は他のclaimを保持して`isSuperUser: false`を保存する。専用migrationはdry-runを既定とし、Emulator・明示Devだけを許可し、全件検査で不正identity・不正claim・errorがある場合は書込み前に停止する。local commitは`1be81f6 security: normalize super-user claim state`である。
- 利用者Emulatorで3件を確認し、`true` 1件、`false` 2件、未設定・不正・不整合0件だった。dry-run、apply、再dry-runはいずれも成功し、更新対象は0件だった。利用者もAuthentication全件の更新状態を確認した。
- 明示承認されたDev `air-guard-v2-dev`で6件を確認し、`true` 1件、`false` 5件、未設定・不正・不整合0件だった。dry-run、apply、再dry-runはいずれも成功し、更新対象は0件だった。本番環境には接続していない。
- 管理SDKは3実装fileの構文検査、単体test 9件、`git diff --check`が成功した。AirGuardV2は全domain単体test 214件、専用local suite 67件、project-owned validator、managed governance validator、`git diff --check`を確定前に実行する。
- 次は10 Callableに散在するtoken/current Auth/User/path検査を可視化し、bootstrap例外を分離した共通claim schemaを最小segmentとして扱う。Users Rules、App Check、rate limit、一般Userのclaims失敗後回復は継続課題である。

## WORKSPACE-HANDOFF-002

- 本記録だけを新coordinatorのowned fileとして更新し、project-owned validator、managed governance validator、`git diff --check`を実行する。
- owned fileだけをstageし、`docs: activate local repository coordinator`でlocal commitする。application testは再実行しない。
- commit後、旧worktree targetがexact path、元repository外、`9a17`配下、detached HEAD `ff9871a32e6d347de17a933c85e65dc3a6c0d4b1`、cleanであることを読み取り確認する。
- 全条件が一致する場合だけ、元repositoryからnative Gitの`git worktree remove`を`--force`なしで実行する。`b4d7`は削除対象へ含めない。
- 削除条件不一致または削除失敗時は再試行せず、完全な結果をcallbackへ残す。

## Common Callable Auth identity gate checkpoint

- 会社所属済みの認証必須Callable向けに`resolveCallableAuthIdentity`を追加し、ID tokenと現在のAuthentication UserのUID、email、email確認、company claim、`isSuperUser`のboolean型と値、disabled状態をAPI固有処理より先に照合する境界を確立した。
- 共通identity errorを内部情報のない`permission-denied`または`internal`へ変換するmapperを追加した。匿名事前確認Callableは対象外とし、`createAdminAccount`と`setupUserAccount`は所属確立前bootstrapの専用検査を維持する。
- 最初の適用対象は`disableUser`と`enableUser`である。共通gateの確認済みUID・companyだけを有効状態変更use-caseへ渡し、use-case内に重複していたactor token/current Auth検査を除去した。actor Userの本登録・有効・管理者検査とtarget User/Auth検査はAPI固有policyとして維持した。
- 全domain単体test 228件、Codex専用loopback Emulator suite 69件、対象実装fileの構文検査、project-owned validator、managed governance validator、`git diff --check`を確定条件とする。利用者用`./saved-data`は変更せず、専用seedは読込専用とする。
- 実装fileは利用者が1fileずつ確認済みである。公式進捗は10%のまま。次は`changeAdminUser`など残る会社所属済みCallableを1つずつ共通gateへ移す。
- Users Rulesのfield/actor制約、App Check、rate limit、token失効、部分状態、残るCallableの共通gate移行、Dev・remote受入れは未完了である。main merge、push、deploy、remote data操作は未承認のまま。

## Established Callable Auth identity gate completion checkpoint

- 共通Auth identity gateを`changeAdminUser`、`checkEmailAvailabilityGlobal`、`authorizeCompanyRebuild`へ追加し、共有認可を通じて`rebuildAllHistories`と`rebuildSecurityReportIndexes`へ適用した。既適用の`disableUser`・`enableUser`と合わせ、会社所属済み6 Callableすべてが共通gateをAPI固有policyより先に通る。
- `changeAdminUser`のuse-caseから重複していたactor Auth取得・会社・disabled検査と旧error codeを除去した。target Auth、actor/target User、唯一の会社管理者、tenant、transaction検査は維持した。global email確認と再構築は重複したtoken/current Auth検査を共通gateへ置換し、会社管理者・スーパーユーザー・User document・対象会社検査を維持した。
- 未認証の`checkEmailAvailability`・`checkUserPreRegistration`は共通gate対象外である。所属claim確立前の`createAdminAccount`・`setupUserAccount`は各bootstrap lifecycleの専用identity検査を維持する。分類契約testでこの境界を固定した。
- 全domain単体test 226件、Codex専用loopback Emulator suite 71件、対象8実装fileの`node --check`、`git diff --check`が成功した。専用suiteでは6 Callableの必須claim欠損・現在Auth不整合拒否と、管理者移譲を含む正常経路を確認した。利用者用`./saved-data`は不変、専用seedは読込専用だった。
- 公式進捗は10%のまま。次はUsers Rulesのfield/actor制約、その後App Check・rate limitとDev受入れである。token失効、部分状態、匿名列挙、main merge、push、deploy、remote data操作は未完了または未承認のまま。

この記録にsecret、credential、private production data、Codex session本文は含めない。

## Codex self-contained local UI test governance checkpoint

- 2026-08-17に、利用者のChrome、Emulator、local server、test account準備へ依存せず、Codexが専用環境の起動、合成account/data作成、browser操作、終了までを担当する方針が承認された。
- 許可対象は`demo-air-guard-v2-codex`、専用loopback port、`.codex-test`配下、Codex管理process、合成dataだけである。利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote service、実dataへ拡張しない。
- Functionsは外部API、Stripe、mail、FCM、通知、ジオコーディング等をfail-closedで隔離できたものだけを専用UI modeで起動する。現行suiteはFunctionsを起動せず、自己完結UI modeは未実装・未検証である。
- Codexは合成会社、super-user兼管理者、管理者、一般User、仮登録User、必要な業務documentを作成してよい。実在情報・資格情報・sessionはrepository、log、promptへ保存しない。
- 数百件のdocumentは段階投入する。約1000件でEmulatorが停止した利用者経験をlocal riskとし、同規模の一括投入は停止条件・復旧方法を定めた別承認なしに行わない。Firebaseの公式上限とは扱わない。
- 基準application commitは`5a26ef4`（仮登録User削除composableの明示importと単体test）である。関連package `air-vuetify-v3`は利用者が`07886a4`を`main`へcommit・push済みと報告し、local repositoryはcleanを確認した。remote pushは未検証である。
- 公式進捗は10%のまま。次はinstruction-chain変更に伴うcoordinator交代を完了し、新taskで専用Functions、専用開発サーバー設定、合成account fixture、Codex管理ブラウザsign-in、process cleanupを最小segmentに分けて実装・検証する。
- main merge、AirGuardV2のGit push、deploy、remote接続、remote data、実data、外部service変更は未承認のまま。

## COORDINATOR-HANDOFF-005 activation checkpoint

- 状態: PM（AirGuardV2）-04 local coordinator有効化済み、PM（AirGuardV2）-03 archive可能。
- new coordinator task: `01a00e4f-2255-7122-8f9c-9c3765013558` host `local`（PM（AirGuardV2）-04）。
- old coordinator task: `01a003d9-8782-79b2-9419-682e582bb1ac` host `local`（PM（AirGuardV2）-03）。
- callback destination: 今後のcheckpointはnew coordinator `01a00e4f-2255-7122-8f9c-9c3765013558` host `local`。
- repository/environment: 保存済みrepository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex worktreeではない。
- `COORDINATOR-HANDOFF-004`はcompleted。repositoryからactive instruction sourcesと正本を復元し、変更なしcallbackが旧coordinatorへ到達した。
- branchは`codex/user-write-boundary`、baseline HEADは`b208fc384fdfe855cf6fe86a8467a704f02a0156`、baseline worktreeはcleanだった。
- common governanceは`1.0.0`、公式進捗は10%である。
- self-contained UI testの許可対象は`demo-air-guard-v2-codex`、専用loopback port、`.codex-test`、Codex管理process、合成account/dataだけである。利用者用local、Dev、Prod、remote、実dataへ拡張しない。
- self-contained UI modeは方針確定済みだが未実装・未検証である。専用Functions、専用server設定、合成account fixture、Codex管理browser sign-in、cleanupを利用可能とは扱わない。
- 数百件のdocumentは段階投入し、約1000件でEmulatorが停止した利用者経験をlocal riskとして扱う。同規模の一括投入は停止条件と復旧方法を定めた別承認を必要とし、Firebaseの公式上限とは扱わない。
- main merge、AirGuardV2のGit push、deploy、remote接続・remote data、実data、外部service変更は未承認のままである。
- next: self-contained UI環境を、外部作用fail-closed、専用Functions、専用server設定、合成account fixture、Codex管理browser sign-in、cleanupの最小segmentで構築・検証し、その後UWBへ戻る。

## Self-contained local UI minimum segment result

- 2026-08-17にPM（AirGuardV2）-04で最小segmentを完了した。専用Functions、Firebase Emulator port解決、loopback server、PWA・Service Worker・通知・FCM無効化、メール確認済み・company claim付き合成account、有効な本登録User、Codex管理browser sign-in、dashboard到達、cleanupまで確認した。
- 専用suite 72件とUI設定契約9件が成功し、dashboard滞在中のconsole errorは0件だった。利用者用`./saved-data`は不変、専用seedはread-only testで不変、容量0.01 MiB、終了後は全専用port閉鎖、`.codex-test/runtime`空、`.output`削除を確認した。
- Nuxt開発サーバーはHTTP readyだったが、Windows上のCodex管理ブラウザではVite module取得後にSPA hydrationが完了しなかった。利用者の一回限りの明示承認で専用Nuxt buildとloopback Node serverを使い、生成版でUI検証を完了した。恒久的なbuild許可には変更せず、再実行は個別承認を必要とする。
- `scripts/run-codex-local-ui-child.ps1`はNortonが`IDP.Generic`として検出したため利用者が隔離し、実装をrevertした。復元・allowlist登録は行わず、現在はEmulatorとserverを独立した前景processとして直接起動する。
- 残存事項として、sign-out直後に購読解除前のFirestore snapshot listenerが`permission-denied`を2件出す。dashboard到達と通常表示には影響しなかったが、logout cleanupの製品課題として未完了に残す。
- remote、Dev、Prod、利用者用local、実data、外部service、push、deploy、main mergeは実行していない。公式進捗は10%のまま。next product workはUWBへ戻る。

## User-equivalent browser interaction governance checkpoint

- 2026-08-17に利用者は、Codex自身のin-app browser testを、可視画面上で実利用者が行える通常のpointer・keyboard操作へ限定した。`fill`、DOM・storage・Auth persistenceの直接変更、event・handler・component method・client APIの直接呼出し、force操作、disabled・hidden・overlay回避は禁止する。read-only観測と非UI setup・backend assertionは許可するがUI操作証拠から分離する。
- 旧基準で得たsignup、button状態、dashboard到達等のbrowser証拠は履歴として保持するが、新基準の受入れには使用しない。source・単体testと、固定loopbackのAuth・Firestore backend読取りはそれぞれsource/test証拠、backend assertionとして維持する。
- self-contained UI再設計の未完成checkpointをcommit `126e903`（`test: checkpoint regular-route UI harness`）へ保存した。このcommitは正規signup由来baseline、candidate export/import、再sign-in、full 72件suite、console・network、cleanupを完了したものではない。
- 必須の再開事項は、専用build identityのfail-closed検証、candidate acceptance fingerprintと停止済みprocessのpromotion gate、verifierの会社名カナ・Firestore path segment検証、Auth POSTとFirestore GETの契約test分離である。その後、正規signupからのbaseline生成と再import後sign-inを新browser基準で検証する。
- 誤った`!`入り合成passwordを使った観察と、それに基づく製品不具合推定は受入れ証拠にしない。利用者は通常操作で無効passwordのfield errorと「次へ」無効になる画面を画像とともに報告したため、製品application codeの追加修正は採用していない。
- browser、generated server、Emulatorは停止済みで、専用portのLISTENは残っていない。`.output`は承認済みbuildの再利用候補として残しているが、build identity gate実装前に一般化したserver commandへ使用しない。
- このproject-wide検証・証拠契約と`ui_tester` role変更はinstruction-chain変更である。common governance `1.0.0`は不変。ガバナンスcommit後、PM（AirGuardV2）-04を含むactive project taskをrepositoryから再開する新taskへ交代する必要があり、coordinator交代は利用者の別の明示承認を待つ。
- 公式進捗は10%のまま。remote、Dev、Prod、利用者用local、実data、external service、push、deploy、main mergeは未承認・未実行のままである。

## COORDINATOR-HANDOFF-007 activation checkpoint

- 状態: PM（AirGuardV2）-05 local coordinator有効化済み、PM（AirGuardV2）-04 archive可能。
- new coordinator task: `01a00f49-9460-7940-8b98-11fa4cab17fe` host `local`（PM（AirGuardV2）-05）。
- old coordinator task: `01a00e4f-2255-7122-8f9c-9c3765013558` host `local`（PM（AirGuardV2）-04）。
- callback destination: 今後のcheckpointはnew coordinator `01a00f49-9460-7940-8b98-11fa4cab17fe` host `local`。
- repository/environment: 保存済みrepository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex worktreeではない。
- `COORDINATOR-HANDOFF-006`はcompleted。repositoryからactive instruction sources、承認境界、正本、未完成checkpoint、再開条件を復元し、変更なしcallbackが旧coordinatorへ到達した。
- branchは`codex/user-write-boundary`、baseline HEADは`2a97a49332f150eb98c413fa198f84d98adb43be`、baseline worktreeはcleanだった。
- common governanceは`1.0.0`、公式進捗は10%である。
- implementation checkpoint `126e903`は未完成で、新browser基準では未検証である。governance commit `2a97a49`でinstruction-chainが変更済みである。
- browser UIの挙動・受入れ証拠は、可視・有効なcontrolへの実利用者相当のpointer・keyboard操作だけで取得する。`fill`、`clear`、DOM・storage・cookie・Auth persistenceの直接変更、event・handler・component method・client APIの直接呼出し、force操作、disabled・hidden・overlay回避は禁止する。read-only観測とnon-UI setup・backend assertionはUI操作証拠から分離する。
- 旧基準のUI証拠は履歴としてだけ保持する。正規signup、candidate export/import、再sign-in、dashboard到達は新基準で未検証である。
- mandatory restartは、専用build identityのfail-closed検証、candidate acceptance fingerprintと停止済みprocessのpromotion gate、verifierの会社名カナ・Firestore path segment検証、Auth POSTとFirestore GETの契約test分離である。その後、human-equivalent UIを再検証する。
- Nortonが隔離したhelperは復元・再利用せず、processはforegroundだけを使用する。buildは実行ごとの明示承認を必要とする。
- remote、Dev、Prod、利用者用local、実data、external service、Git push、deploy、main mergeは未承認のままである。
- next: mandatory restart項目を設計者との壁打ちで最小segment化して実装・検証し、正規UI routeのbaseline生成へ戻る。
