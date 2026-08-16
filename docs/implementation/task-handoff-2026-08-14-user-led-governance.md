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

## WORKSPACE-HANDOFF-002

- 本記録だけを新coordinatorのowned fileとして更新し、project-owned validator、managed governance validator、`git diff --check`を実行する。
- owned fileだけをstageし、`docs: activate local repository coordinator`でlocal commitする。application testは再実行しない。
- commit後、旧worktree targetがexact path、元repository外、`9a17`配下、detached HEAD `ff9871a32e6d347de17a933c85e65dc3a6c0d4b1`、cleanであることを読み取り確認する。
- 全条件が一致する場合だけ、元repositoryからnative Gitの`git worktree remove`を`--force`なしで実行する。`b4d7`は削除対象へ含めない。
- 削除条件不一致または削除失敗時は再試行せず、完全な結果をcallbackへ残す。

この記録にsecret、credential、private production data、Codex session本文は含めない。
