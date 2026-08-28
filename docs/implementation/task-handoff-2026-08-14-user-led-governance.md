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

## PC migration shutdown checkpoint

- 日付: 2026-08-17。利用者は本日の作業終了と、翌日の新Windows PCへのproject移行を指示した。
- active coordinatorはPM（AirGuardV2）-05 task `01a00f49-9460-7940-8b98-11fa4cab17fe` host `local`、callback destinationも同taskである。
- repository/environmentはWindows native、PowerShell、保存済みrepository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal taskであり、Codex worktreeやWSLではない。
- shutdown文書更新前のbranchは`codex/user-write-boundary`、HEADは`3e3fb9dcde4fdb08ebb1935cd5767b3d1553f081`、root worktreeはcleanだった。branchにupstreamは設定されていないため、remote cloneだけでは現在refを復元できない。`.git`を含むAirGuard directory copyとrepositoryごとのGit bundleを必要とする。
- AirGuard配下で確認したtop-level 7 repositoryと内部`air-vuetify-v3`はcleanだった。`air-vuetify-v3`はbranch `main`、HEAD `07886a412262184636380bd4936f11b9a12f052c`である。
- `.codex-test/runtime`は空、Codex専用port `14400`、`14500`、`14600`、`15001`、`18080`、`19000`、`19099`、`19199`にLISTENはなかった。`.output`は空directoryで、移行対象または受入れ証拠にしない。
- Git外local dataとして`.env`、`.env.development`、`.env.local`、利用者用`saved-data`、`.codex-test/saved-data`が存在する。内容を表示せず、暗号化された媒体でrepositoryとともに移す。`node_modules`と`functions/node_modules`は再生成し、copyしない。
- Codex task sizeは1.15 MiBで300 MiB handoff閾値未満。Codex全体は約1615.98 MiBで2 GiB参考警告未満だったが、scanは1 errorを含むため完全な容量証明ではない。
- Codex local thread復元はbest-effortとし、app停止後にsession、thread DB、設定、個人skill等のportable subsetをcopyする。`auth.json`、sandbox secret、SID、installation ID、browser profile、worktree、log、cacheはcopyせず、新PCでOpenAI、plugin、connector、Firebase CLI、Git hostへ再loginする。
- 新PCのWindowsユーザー名は同じ`seven`とし、project pathを一致させる。最初は現在と同じWindows native・PowerShellを維持し、WSLへの切替は別の明示判断とする。
- official progressは10%のまま。implementation checkpoint `126e903`は未完成で、新browser基準では未検証である。
- restore後の最初の作業は変更なし`PC-MIGRATION-RESTORE-001`。repository、関連repository、local data存在、active instructions、callback、permission、validatorを照合し、成功するまで新規実装、Emulator、server、browser、remote接続を開始しない。
- mandatory restartは、build identity fail-closed、candidate acceptance fingerprintと停止済みpromotion gate、verifier会社名カナ・Firestore path segment、Auth POST/Firestore GET契約分離である。その後human-equivalent UIを再検証する。
- remote、Dev、Prod、利用者用local、実data、external service、Git push、deploy、main mergeは未承認のままである。旧PCとbackupは新PCのrestore checkpointと最初の実file限定commit確認後まで保持する。

## COORDINATOR-HANDOFF-009 migrated local coordinator activation checkpoint

- 状態: PM（AirGuardV2）-06 migrated local coordinator有効化済み、PM（AirGuardV2）-05 archive可能。
- new coordinator task: `01a0184a-48ef-7690-beb4-607dd384a874` host `DESKTOP-9L00IP0`。
- old coordinator task: `01a00f49-9460-7940-8b98-11fa4cab17fe` host `local`（旧PC）。
- callback destination: 今後のcheckpointはnew coordinator `01a0184a-48ef-7690-beb4-607dd384a874` host `DESKTOP-9L00IP0`。
- repository/environment: 保存済みrepository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うWindows native local task。Codex worktreeではない。
- `COORDINATOR-HANDOFF-008`はcompleted。branchは`codex/user-write-boundary`、baseline HEADは`92d17c81162b6125a3afaff6942d4b596db43486`、baseline worktreeはcleanだった。
- common governanceは`1.0.0`、公式進捗は10%である。
- root repositoryと`air-vuetify-v3`は移行後cleanで、`git fsck --full`が成功した。`air-vuetify-v3`はbranch `main`、HEAD `07886a412262184636380bd4936f11b9a12f052c`である。
- Node v22.23.2、npm 10.9.8、OpenJDK 21.0.12、Firebase CLI 15.27.0を確認済みである。
- rootとFunctionsの依存関係は`npm ci`後に`npm ls --depth=0`が成功した。Functionsの`@emnapi/runtime@1.8.1 extraneous`表示は`sharp@0.34.5`のoptional dependency由来と照合済みで、変更・prune・lockfile変更は行っていない。
- `.env`、`.env.development`、`.env.local`、`saved-data`、`.codex-test\saved-data`の存在を内容非表示で確認済みである。
- project-owned validator、managed governance validator、`git diff --check`が成功した。
- implementation checkpoint `126e903`は未完成で、新browser基準では未検証である。
- 旧UI証拠は履歴としてだけ保持する。正規signup、candidate export/import、再sign-in、dashboard到達は新基準で未検証である。
- mandatory restartは、build identity fail-closed、candidate acceptance fingerprintと停止済みprocessのpromotion gate、verifierの会社名カナ・Firestore path segment検証、Auth POSTとFirestore GETの契約test分離である。その後、human-equivalent UIを再検証する。
- browser UI証拠は実利用者相当のpointer・keyboard操作だけで取得する。`fill`、`clear`、DOM・storage・cookie・Auth persistenceの直接変更、event・handler・component method・client APIの直接呼出し、force操作、disabled・hidden・overlay回避は禁止する。read-only観測とnon-UI setup・backend assertionはUI証拠から分離する。
- Nortonが隔離したhelperは復元・再利用せず、processはforegroundだけを使用する。buildは実行ごとの明示承認を必要とする。
- remote、Dev、Prod、利用者用local、実data、external service、Git push、deploy、main mergeは未承認のままである。
- 旧PCと外付けHDD backupは、このactivation commitを旧coordinatorが確認するまで保持する。
- PC間Remote実験はrepository変更なしで終了した。cross-host callbackは利用不能だったため、このcheckpoint結果は利用者が旧coordinatorへ手動中継する。
- next: mandatory restart 4項目を設計者との壁打ちで最小segment化する。利用者の開始指示までは新規実装しない。

## PM-ACTIVATION-010 mandatory restart checkpoint 1

- 2026-08-19にPM（AirGuardV2）-06で自己完結local UI test環境の構築を再開した。最初の最小segmentは専用build identityのfail-closed gateであり、application code、build、Emulator、server、browser、saved-dataを対象外とした。
- `npm run test:local:ui:build`は専用dotenvの全キー・全値をdemo project、loopback、Emulator用合成値のallowlistと照合し、build前後のclean source HEADが同一の場合だけ`.output/codex-local-ui-build-identity.json`を生成する。build失敗またはsource変化時は有効markerを残さない。
- generated serverはmarker、専用dotenv SHA-256、現在のclean source HEAD、project identity、外部作用拒否が一致しなければ`.output/server/index.mjs`をimportせず停止する。手動markerは正規経路としない。
- sourceの構文検査、build identity・foreground契約test 14件、`git diff --check`は成功した。Nuxt build、generated server、Emulator、browserは実行しておらず、実build identityの受入れは実行ごとの明示承認待ちである。
- mandatory restartの残りは、candidate acceptance fingerprintと停止済みprocessのpromotion gate、verifierの会社名カナ・Firestore path segment検証、Auth POSTとFirestore GETの契約test分離である。公式進捗は10%のまま。

## PM-ACTIVATION-010 mandatory restart checkpoint 2

- candidate exportだけでは専用saved-dataへ昇格できないようにし、candidate importに対するbackend verifier合格後だけ、candidate directory SHA-256、clean source HEAD、demo project identityを別acceptance receiptへ記録する経路を追加した。合成email・会社名・表示名だけを入力とし、password、token、実在情報は扱わない。
- promotionはacceptance receiptとcandidate再計算SHA-256・現在HEADの一致に加え、専用Emulator hub/logging、Functions、Auth、Firestore、Realtime Database、Storage、generated serverの8 portがすべて停止済みであることを変更前に要求する。receiptと既存saved-dataは失敗時の復旧対象に含めた。
- Node・PowerShell構文検査、candidate fingerprint・build identity・foreground契約test 16件、`git diff --check`は成功した。candidate export/import、backend verifier、promotion、Emulator、server、browserは実行していない。
- mandatory restartの残りは、verifierの会社名カナ・Firestore path segment検証と、Auth POST・Firestore GETの契約test分離である。実build identityの受入れとhuman-equivalent UI再検証は別途build承認後に行う。公式進捗は10%のまま。

## PM-ACTIVATION-010 mandatory restart checkpoint 3

- backend verifierの期待identityへ会社名カナを追加し、全角カタカナ・半角／全角space・40文字以内の合成値だけを許可してCompany保存値との完全一致を要求した。candidate acceptance commandも会社名カナを別の合成環境変数から受け取る。
- claim company IDとAuthentication UIDを、空、前後space、`.`、`..`、slash、NUL、UTF-8 1500 bytes超過ではない単一Firestore path segmentとして検証し、検証後に各segmentをURL encodeしてCompany/User documentを読むようにした。
- verifier・acceptance sourceの構文検査、会社名カナ・path segment・candidate・build identity・foreground契約test 19件、`git diff --check`は成功した。Emulator/backend接続、candidate、server、browser、buildは実行していない。
- mandatory restartの残りはAuth POST・Firestore GETの契約test分離だけである。その後、実行ごとのbuild承認を得てbuild identityとhuman-equivalent UIの受入れを行う。公式進捗は10%のまま。

## PM-ACTIVATION-010 mandatory restart checkpoint 4

- backend verifierのtransportを注入可能なread-only helperへ分離した。Authentication account列挙はAuth Emulator `127.0.0.1:19099`へJSON body付きPOSTを1回だけ行い、Company/User document読取りはFirestore Emulator `127.0.0.1:18080`へbodyなしGETを2回だけ行う。
- 独立した契約testでAuth helperがFirestore portへ、Firestore helperがAuth portへ到達しないこと、method、request body、owner header、URL encoded pathを確認した。source-patternだけでなくstub fetchが受けた実request引数を検証している。
- verifier source構文検査、Auth POST・Firestore GET分離を含むmandatory restart関連契約test 21件、全domain単体test 359件、project-owned validator、managed governance validator、`git diff --check`は成功した。Emulator、server、browser、build、candidate data操作は実行していない。
- mandatory restart 4項目の実装・非接続契約検証は完了したが、runtime受入れは未完了である。次は利用者の実行ごとの明示承認を得て専用buildを1回行い、build identity fail-closed、正規signup、candidate export/import、backend acceptance、停止済みpromotion、実利用者相当の再sign-in・dashboard、console/network、cleanupを順に検証する。公式進捗は10%のまま。

## GOVERNANCE-TURNOVER-001 managed governance 1.3.0 coordinator activation checkpoint

- 日付: 2026-08-21。
- former coordinator: PM（AirGuardV2）-03 / task `01a0224f-3efd-7ea3-84a2-37f6d7a1b134`。
- new coordinator: PM（AirGuardV2）-04 / task `01a022d4-dced-7562-83a4-878aa7f47b7e` host `local`。
- repository/environment: 保存済み利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex専用worktreeまたは別repository copyではない。
- branchは`codex/user-write-boundary`、baseline HEADは`45932a0a4c7871c3e1baabe5281845fd65377e42`、baseline worktreeはcleanだった。
- managed common governanceは`1.3.0`、common SHA-256は`d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10`である。
- `NO-CHANGE-CALLBACK-003`は成功した。cwdとGit top-levelは保存済み利用者repositoryそのもの、branchとHEADはbaselineに一致し、worktreeはcleanだった。直接repository接続、権限、`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`とtask-routed authoritative documentsを含むactive instruction sourcesをrepositoryから復元した。
- UWB-02R〜04Rのapplication実装とlocal自動検証は完了済みである。未完了gateはpermission分離後のhuman-resource provision-only actorによる正規UI再受入れであり、role選択が表示されずemailだけでEmployee連携仮登録Userを作成・削除できることを確認する。このgate完了後にUWB-05へ進む。
- Git push、`main` merge、deploy、Dev、Prod、remote service、実dataの操作は未承認であり、実行しない。
- coordinator ownershipはnew coordinatorへ移管した。former coordinator taskはmanaged common governanceに従ってCodexがarchiveまたはdeleteせず、利用者が削除できる状態である。

## COORDINATOR-HANDOFF-011 PM-05 coordinator activation checkpoint

- 日付: 2026-08-25。
- former coordinator: PM（AirGuardV2）-04 / task `01a022d4-dced-7562-83a4-878aa7f47b7e`。
- new coordinator: PM（AirGuardV2）-05 / task `01a03666-dab2-7ab2-aec1-c2ba9925f622` host `local`。
- repository/environment: 保存済み利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex専用worktreeまたは別repository copyではない。
- branchは`codex/user-write-boundary`、baseline HEADは`787ffcab8813dd39d2a90281fe92c1b6b0442ac4`、baseline worktreeはcleanだった。
- managed common governanceは`1.3.0`、common SHA-256は`d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10`である。
- `NO-CHANGE-CALLBACK-004`は成功した。cwdとGit top-levelは保存済み利用者repositoryそのもの、branchとHEADはbaselineに一致し、worktreeはcleanだった。直接repository接続、権限、`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`とtask-routed authoritative documentsを含むactive instruction sourcesをrepositoryから復元した。
- UWB-01〜06は完了した。UWB-07/08はapplication・server・Rules実装、自動検証、Codex UI smoke、利用者local UI受入れ、super-user UI/server policy parityまで完了した。
- UWB-07の未完了gateはretention contractであり、履歴reader、保持期間、legal hold、terminal後UID縮小を確定する必要がある。次は現状をread-onlyで調査し、現行契約、提案、影響、互換性、移行、rollback、testを利用者へ提示する。
- UWB-08は自動検証完了であり、利用者による`firestore.rules`確認を待つ。
- 公式進捗は10%である。Git push、`main` merge、deploy、Dev、Prod、remote service、実dataの操作は未承認であり、実行しない。
- coordinator ownershipはnew coordinatorへ移管した。former coordinator taskはmanaged common governanceに従ってCodexがarchiveまたはdeleteせず、利用者が削除できる状態である。

## IN-APP-BROWSER-GOVERNANCE-001 PM-05 turnover preparation

- 日付: 2026-08-25。
- coordinator: PM（AirGuardV2）-05 / task `01a03666-dab2-7ab2-aec1-c2ba9925f622` host `local`。
- repository/environment: `C:\Users\seven\projects\AirGuard\air-guard-v2`へ直接接続し、branch `codex/user-write-boundary`、開始HEAD `4ea6001540ba853f076556cdf7d12dcfe33d008e`、開始worktree cleanで実施した。
- managed common governanceは`1.3.0`、common SHA-256は`d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10`のまま変更しない。
- Codex専用Emulator ready、Nuxtの`Vite client warmed up`、初回module graph 2巡probe後にインアプリブラウザを初めて開く手順で、cold restart 3回すべてreloadなしに製品topへ到達し、保存済み合成accountのsign-inからdashboard到達も確認した。利用者はこの手順を標準採用し、project governance更新とtask交代を明示承認した。
- 利用者Chromeは補助経路へ変更する。session喪失時の一時credentialは専用loopback Auth Emulator内の合成accountだけに限定し、saved-data・repository・出力へ残さず、平文表示中の観測を禁止し、即時再mask、saved-data指紋不変、Emulator停止による失効を要求する。
- instruction-chain変更のため、文書検証・local commit・clean worktree確認後に完全新規task `PM（AirGuardV2）-06`を作成する。新taskのID、no-change callback、最初のfile限定commitは新task自身がこのhandoff文書へ追記する。成功するまでownershipはPM-05に残す。
- UWB-01〜08は完了し、公式進捗は10%である。次のapplication工程はUWB-09のrole・permission対応表をschemas packageへ統合する範囲と導入順序の確認であり、task交代完了までは開始しない。
- Git push、`main` merge、deploy、Dev、Prod、remote service、実dataは未承認であり、実行しない。旧taskのarchive・deleteはCodexが行わず、交代成功後に利用者へ手動削除可能と報告する。

## COORDINATOR-HANDOFF-012 PM-06 coordinator activation checkpoint

- 日付: 2026-08-25。
- former coordinator: PM（AirGuardV2）-05 / task `01a03666-dab2-7ab2-aec1-c2ba9925f622`。
- new coordinator: PM（AirGuardV2）-06 / task `01a037d6-c3a8-7f01-837e-66236b2a9508` host `local`。
- repository/environment: 保存済み利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex専用worktreeまたは別repository copyではない。
- branchは`codex/user-write-boundary`、baseline HEADは`7b6ce86375c99f430e247367942a3ae09cfbaeac`、baseline worktreeはcleanだった。
- managed common governanceは`1.3.0`、common SHA-256は`d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10`である。
- `NO-CHANGE-CALLBACK-005`は成功した。cwdとGit top-levelは保存済み利用者repositoryそのもの、branchとHEADはbaselineに一致し、worktreeはcleanだった。直接repository接続、権限、`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`とtask-routed authoritative documentsを含むactive instruction sourcesをrepositoryから復元した。
- Codex専用local UI testは、Emulatorの`All emulators ready`、Nuxtの`Vite client warmed up`、loopback応答、初回module graphの2巡bounded probe成功を初回navigation前に確認する。起動templateまたはHTTP 200だけを成功証拠にせず、Codexインアプリブラウザを標準経路、Chromeを補助経路とする。
- Codex専用一時credentialは専用loopback Auth Emulatorの合成accountだけに限定する。値をsaved-data、repository、terminal、応答、log、screenshot、DOM・console・network観測へ残さず、平文表示中は観測を停止し、通常keyboard入力後に即時再maskする。Emulator停止による失効とsaved-data指紋不変を要求する。
- UWB-01〜08は完了し、公式進捗は10%である。次はUWB-09のrole・permission対応表をschemas packageへ統合する範囲と導入順序を確認する。
- Git push、`main` merge、deploy、Dev、Prod、remote service、実dataの操作は未承認であり、実行しない。
- coordinator ownershipはnew coordinatorへ移管した。former coordinator taskはmanaged common governanceに従ってCodexがarchiveまたはdeleteせず、利用者が削除できる状態である。

## COORDINATOR-HANDOFF-013 PM-07 coordinator activation checkpoint

- 日付: 2026-08-27。
- former coordinator: PM（AirGuardV2）-06 / task `01a037d6-c3a8-7f01-837e-66236b2a9508`。
- new coordinator: PM（AirGuardV2）-07 / task `01a04120-454b-70d3-9b3e-c5d4da13591d` host `local`。
- repository/environment: 保存済み利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex専用worktree、linked worktree、task-specific worktree、alternate repository copyではない。
- branchは`codex/dev-user-reservation-migration`、activation baseline HEADは`5ac546edb68f6f6b9569bfd6eb91373411a163cc`、baseline worktreeはclean、upstreamはnone、primary worktree registryは上記repository 1件だけだった。
- managed common governanceは`1.3.0`、common SHA-256は`d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10`である。
- `NO-CHANGE-CALLBACK-006`は成功した。cwdとGit top-levelは保存済み利用者repositoryそのもの、branchとHEADはbaselineに一致し、upstreamはnone、worktreeはcleanかつprimary-onlyだった。直接repository接続、現taskの権限、`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`とtask-routed authoritative documentsを含むactive instruction sourcesをrepositoryから復元した。
- Devは正式運用準備または正式運用開始の完了前でも、検証済み変更を積極的にdeploy・受入れする非本番試行環境とする。利用者が対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を含む一つのbounded Dev release checkpointを承認した場合、そのrunbook内のbuild、deploy、remote検証はcommandごとの再承認を必要としない。新しいmigration、破壊的repair、対象service・data・期間の拡張、Prod適用は別の明示承認を必要とする。
- UWBの初回Dev導入は予約処理だけを選択deployしない。System全体maintenance、整合snapshot、UWBの全server境界、server deploy後のfresh create-only予約migration、client/Hosting、maintenance中検証、解除・remote受入れを一つのcutoverとして行う。System maintenanceはclient route制御であり、Rules、Functions、Admin SDK、scheduled・direct Functions、開始済みwriteを停止する排他lockではない。
- local `main`とlocal tracking ref `origin/main`は`4eab588895a2ab47e7ae2ec867c9c10a0d7c5917`である。branch上には未push local commit `40264f32f068783c2d2fd584236fd2d462f4c133`（guarded Dev reservation migration）と`5ac546edb68f6f6b9569bfd6eb91373411a163cc`（Dev trial release runbook）の2件がある。正式運用準備roadmapの公式進捗はDev証拠未取得のため10%のままである。
- 次はfull release commitと対象Firebase project、services、data影響、backup、rollback、停止条件、検証を固定したbounded Dev release checkpointを構築し、利用者承認後に実行する。実際のDev deploy、network、snapshot、migration、remote検証、実data操作はまだ0件である。
- coordinator ownershipはnew coordinatorへ移管した。former coordinator taskはmanaged common governanceに従ってCodexがarchiveまたはdeleteせず、利用者が削除できる状態である。

## GOV14-AIRGUARDV2-01 migration preparation checkpoint

- 日付: 2026-08-28。
- coordinator: PM（AirGuardV2）-07 / task `01a04120-454b-70d3-9b3e-c5d4da13591d` host `local`。
- program coordinator / callback destination: PM（SPG）-04 / task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8` host `local`。
- ownerはinstalled `scaffold-project-governance` common governance `1.4.0`への移行、限定local commit、AirGuardV2の全active task交代を承認した。program source commitは`25fb125a1a656b7a6906d11456f6c7f0a4050363`である。
- migration baselineはbranch `codex/dev-user-reservation-migration`、HEAD `e9af484d47005b8eb28afe764a038b195d7409d2`、upstream none、clean、保存済みprimary repository `C:\Users\seven\projects\AirGuard\air-guard-v2`のworktree 1件だけである。
- managed common governanceは移行前`1.3.0`、common SHA-256 `d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10`である。installed skillは36 files、`1.4.0`、skill validator exit 0である。
- active AirGuardV2 Codex taskはPM（AirGuardV2）-07だけ、内部subagentは0である。未統合worktree変更はなく、交代対象はPM-07 1件である。
- current product stateはCCB-02、Company設定roadmap 10%、正式運用準備roadmap 10%である。Schemas exact `2.4.2-dev.167`公開・検証、Admin SDKのfail-closed安全停止、AirGuardV2 app/Functionsのexact package導入とcompatible reader local実装まで完了した。次はcanonical parity、PrivateSettings backup、SettingAudits restore契約を確定する。application変更、deploy、migration、remote/data操作をgovernance移行へ含めない。
- 移行前のtask sessionは73.45 MiB / 300 MiBでhandoff threshold未到達だった。旧2 GiB Codex-wide scanは2004.64 MiB、scan incomplete / error 1であり、全体容量の完全な判断証拠には使用しない。
- 移行はmanaged artifactをsync commandだけで更新し、project-owned容量alias、coordination runbook、measurement script、仕様、ADR、roadmap、operations、INITIAL_PROMPT、validator/test、changelog、handoffを整合させる。push、fetch、network、deploy、data操作、archive/delete、history rewrite、別worktreeは禁止する。
- migration commitと全検証後、完全新規task `PM（AirGuardV2）-08`を保存済みprojectへ直接作成し、governance `1.4.0`、managed restricted workspace-write、primary-only worktree、no-change callback、最初のfile限定self-routing commitを確認する。成功するまでownershipはPM-07に残し、旧taskをCodexがarchive/deleteしない。
- managed sync後はcommon governance `1.4.0`、common SHA-256 `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`、generated `AGENTS.md` 13,659 bytes / 32,768 bytesである。project specificationは`0.5.15`へ更新した。
- 容量確認は実task IDを必須とし、exactly one matching JSONLだけを測定する。handoff閾値はtask session 300 MiB、Codex全体10 GiBは別の参考warningであり、session本文を表示しない。移行中の実測は74.10 MiB / 300 MiB、24.70%、handoff不要だった。Codex全体scanは2011.32 MiB / 10 GiB、scan incomplete / error 1のため完全値として扱わない。
- pre-commit検証ではmanaged governance、renderer、project documentation、documentation negative fixtures、capacity routing regression 7件、`git diff --check`が独立exit 0となった。最初のproject documentation検査はWindows PowerShellの日本語literal文字コード解釈でparser exit 1となり、validator/test内のalias fixtureをUTF-8 Base64復号へ変更した後に再実行してexit 0を確認した。

## GOV14-AIRGUARDV2-PM08-SELF-ROUTING-001 coordinator activation checkpoint

- 日付: 2026-08-28。
- checkpoint: `GOV14-AIRGUARDV2-PM08-SELF-ROUTING-001`。
- former coordinator: PM（AirGuardV2）-07 / task `01a04120-454b-70d3-9b3e-c5d4da13591d` host `local`。
- new coordinator: PM（AirGuardV2）-08 / task `01a047c6-d014-7241-9b46-1e3d12073747` host `local`。
- repository/environment: 保存済み利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使うlocal task。Codex worktree、linked worktree、task-specific worktree、alternate repository copyではない。
- activation baselineはbranch `codex/dev-user-reservation-migration`、HEAD `c60e700dccaf34979e7adc9daa50ef6aaf517ed1`、upstream none、clean、保存済みprimary repositoryのworktree 1件だけである。
- managed common governanceは`1.4.0`、common SHA-256は`d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`、project specificationは`0.5.15`である。
- `NO-CHANGE-GOV14-AIRGUARDV2-001`は成功した。exact cwdとGit top-levelは保存済み利用者repositoryそのもの、branchとfull HEADはbaselineに一致し、upstreamはnone、worktreeはcleanかつprimary-onlyだった。直接repository接続、managed restricted `workspace-write`、`auto_review`、network restricted、`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`とtask-routed authoritative documentsを含むactive instruction sources、承認・権限境界をrepositoryとtrusted task metadataから復元した。
- governance移行commit `c60e700dccaf34979e7adc9daa50ef6aaf517ed1`は21 files、363 insertions、34 deletionsである。PM（AirGuardV2）-07ではpost-commitのmanaged governance validator、renderer、project-owned documentation validator、documentation negative fixture、capacity routing regression 7件、committed diff checkがそれぞれ独立exit 0だった。
- current product stateはCCB-02、Company設定roadmap 10%、正式運用準備roadmap 10%である。Schemas exact `2.4.2-dev.167`は公開・artifact検証済み、Admin SDKのfail-closed safety guardは完了し、AirGuardV2 app/Functionsへのexact package導入とcompatible reader local実装も完了した。
- nextはcanonical parity、PrivateSettings backup、SettingAudits restore契約の確定である。application変更、test code変更、deploy、migration、network、remote/data操作、push、`main` merge、Prod、未承認scopeは別checkpointとする。
- 本checkpointの限定commitとpost-commit verificationが成功した時点で、active AirGuardV2 coordinator ownershipをPM（AirGuardV2）-08へ移管する。former PM（AirGuardV2）-07はCodexがarchiveまたはdeleteせず、利用者が手動削除できる状態とする。
- 今後のAirGuardV2 checkpoint callbackとassignmentはPM（AirGuardV2）-08 / task `01a047c6-d014-7241-9b46-1e3d12073747` host `local`へretargetする。program完了callbackだけはformer PM（AirGuardV2）-07がPM（SPG）-04 / task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8` host `local`へ一度送る。

## CCB-02-PARITY-RECOVERY-CONTRACT-001 checkpoint

- 日付: 2026-08-28。
- 利用者はcanonical parity、PrivateSettings backup、SettingAudits restoreの3契約を承認した。project specificationは`0.5.16`へ更新し、判断理由と復旧境界はADR 0028を正本とする。
- canonical parityは、未分類・不正・partial・決定不能が1件でもあれば全tenant write 0とし、条件を満たすtenantへ8 target documentをcreateするだけとする。既存root・target・auditのupdate/delete、partial setの自動修復、途中成功分の推測削除を禁止する。
- PrivateSettingsは既存logical backupへ含めず、そのbackupを完全backupと呼ばない。当面の復旧基盤はmanaged Firestore backup/PITRとし、専用暗号化logical backup/restoreは別仕様・別承認とする。
- SettingAudits restoreは同一company・同一schema・同一document IDのcreate-only、既存同値skip、異値で全体停止とし、update/delete/clear/generic mergeを禁止する。専用実装・復旧演習までは利用不可である。
- 関連repository `air-guard-v2-schemas`ではlocal generated capacity cacheを`.gitignore`へ追加し、local commit `7a3b0cbf04659f0cf0f87a3d20f8fc8093a72e2f`を作成した。repositoryはcleanで、push・network・package・application変更は行っていない。
- current product stateはCCB-02、Company設定roadmap 10%、正式運用準備roadmap 10%のままである。次はlocal migration plan/digest・synthetic fixture・停止/再実行test、PrivateSettings除外表示、専用audit restoreの実装範囲をcheckpoint化する。application/test code変更、Rules、Emulator、deploy、migration、network、remote/data操作、push、`main` merge、Prodは本checkpointに含めない。

## CCB-02-LOCAL-PURE-PLANNER-001 checkpoint

- 日付: 2026-08-28。
- 利用者は実dataへ触れる前までのlocal implementation、合成test、文書、local commitを承認した。本checkpointは保存済みprimary repository、branch `codex/dev-user-reservation-migration`、baseline `0ab844fa009a753c8def16f96415608c45580bd6`、upstream none、clean、primary-only worktreeから開始した。
- `scripts/migrate-company-settings.mjs`へFirestore/network非接続のpure plannerを追加した。Schemas exact `2.4.2-dev.167`のlegacy mappingと公開Firestore REST Valueのtype-tagged canonical encodingを使い、candidate union、edition、manifest/root、8 target、audit/unexpected pathを`eligibleCreate`、`alreadyEquivalent`、6種のblocking分類へ決定的に分ける。
- blockingが1件でもあれば全tenantのoperationを空にし、成功planはtenantごとにSettings 6件・PrivateSettings 2件のcreateだけを返す。root、既存target、SettingAuditsのupdate/delete、partial repair、activationは実装しない。summaryは件数、digest、opaque subject、create予定数だけで、company ID、名称、path、document bodyを出力しない。
- 合成fixtureとdomain testを追加し、create-only 8件、complete exact、partial、不一致、unknown、invalid、ambiguous、manifest/root mismatch、orphan target、audit、active marker、edition未確認、integer/double差、manifest digest binding、fresh re-plan、非識別summary、固定version/receipt guardの17件を確認した。
- pre-commit検証はCompany migration 17件、compatible reader 8件、既存User予約migration 18件、Node構文検査、project documentation validator、managed governance validator、renderer、`git diff --check`がそれぞれexit 0だった。managed validatorの最初のnested PowerShell既定引数呼出しだけ`PSScriptRoot`が空となりexit 1だったため不採用とし、absolute `-ProjectPath`を明示した独立processでexit 0、managed hash current、AGENTS 13,659 / 32,768 bytesを確認した。直接実行停止はprocess内`LASTEXITCODE=64`を確認した。
- plannerはFirestore reader、credential、dry-run CLI、transaction apply、post-checkを持たない。直接実行はexit 64で停止する。Emulator/application/server/browser、network、remote/data read/write、deploy、push、`main` merge、Prodは0件である。
- current product stateはCCB-02、Company設定roadmap 10%、正式運用準備roadmap 10%のままである。次はCodex専用合成Emulatorだけを対象に、public REST reader、local target guard、create-only transaction、read-after-write/post-checkを別checkpointで実装・検証する候補である。実dataに触れるDev/Prod read、manifest生成、apply、backup/restoreは利用者へ停止境界を示して別承認を得る。
