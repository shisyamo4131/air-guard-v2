# CUSTOMER-02 状態表示・編集 local検証記録

- 状態: Local completed / CONF-0146承認後の限定UI再試験・crash後cleanup・High最終review成功
- 日付: 2026-09-04
- checkpoint: `CUSTOMER-02-STATUS`
- branch: `codex/customer-status`
- 開始HEAD: `cfa23595b37f2709131caab6f2a4be03713a8f95`
- 実装・test・文書のlocal統合commit / 専用build source: `cc562f2ed8b22502986556ab0799ce2d721c646e`
- 今回のUI観測source: `2c05c912eaae1d2ba1cb4a22696567586666b6c1`（上記実装からの変更は文書だけ）。clean worktreeで再build・generated serverを起動した。
- 追加隔離の統合・再build source: `6ed23fc664b8988149bf4a6ca6183263b14936c6`。19 files、565追加 / 69削除。Customer本体・Rules・Schemas・関連packageは変更していない。
- CONF-0146承認・限定再試験source: `a33576ef9df06a7b8dcaa50be69792646868fd6f`。追加隔離以降の製品source変更はなく、今回の変更前worktreeはcleanだった。
- 対象: [状態編集ロードマップ](../roadmaps/customer-status.md)のlocal工程。Dev反映・受入れ、実data、請求・PDF、archive・restoreは対象外。

## 設計・差分review

- `CUSTOMER-02-DESIGN`（High）: 基本operation再利用、CREATE状態非入力、状態単独patch、一覧購読引数補正、非同期準備後の再確認、基本editor rollback解除を採用。
- `CUSTOMER-02-SECURITY-DESIGN`（High）: actor・tenant・26field・監査metadata・enum・支払混合拒否・delete/archive拒否を維持する条件で採用。
- `CUSTOMER-02-DOC-DESIGN-CHECK`（High、68秒）: 旧一覧ACTIVE限定断定と状態変更を後続専用操作とする記述を指摘。coordinatorが修正した。
- `CUSTOMER-02-CODE-REVIEW`（High、93秒）と`CUSTOMER-02-SECURITY-FINAL`（High）: application/Rules 7file差分に新規blocking指摘なし。静的reviewであり実行検証やrelease GOではない。
- security監査の既存残存risk: 郵便番号の独自長上限なし、派生情報の意味上の再計算不可。今回の状態変更による新規問題ではなく、独断でSchema制約を追加しない。
- `CUSTOMER-02-SECURITY-TEST-COVERAGE`（High）: 準備中のUID・会社変更、latest getterのinstance・docId変更、Rules陰性経路の追加を確認し、新規blocking指摘なし。実行証拠は下記testerのcommand結果と区別する。

## 自動test・command結果

自動testは開始HEAD上の該当差分に対して実行後、上記commitへ統合した。専用buildはそのclean commitで実行した。その後の変更は進捗・証拠・引継ぎの文書整理だけであり、application/Rules/test/configurationは変更していない。文書整理後に失効する`project-docs`と`diff-check`の再検証結果は当該checkpointのcommand reportを正とする。後続のapplication/Rules/test変更が該当gateを失効させた場合は再実行する。

| 段階 | Command | 結果 | Exit |
|---|---|---|---:|
| iteration | `node --test test/domain/customer-operations.test.mjs test/domain/customer-ui-source-contract.test.mjs test/domain/customer-status-sync.test.mjs test/domain/customer-list.test.mjs` | 44/44成功、228.8024 ms。初回はSchema getterの参照比較というtest不具合で39/40、構造比較へ修正後に再実行 | 0 |
| iteration | `node --check test/local/codex-local-harness.test.mjs` | 構文確認成功 | 0 |
| completion | `node --test test/domain/*.test.mjs` | 839/839成功。Node計測1.931秒 | 0 |
| completion | `npm run test:local` | 118/118成功。Node試験部分48.717秒。wrapperも0 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 21 fixture成功 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 7 checks成功、tool計測3.333秒 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功、内包rendererも0。tool計測0.839秒 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | build前に成功、215 Markdown / 44 ADR / 6 roadmap / 8 TOML。2.389秒。文書整理後の再検証はcommand reportへ記録 | 0（build前） |
| completion | `git diff --check` | 実装統合前に成功、0.253秒。`git diff --cached --check`も0。文書整理後の再検証はcommand reportへ記録 | 0（実装統合前） |
| completion | `npm run test:local:ui:build` | 初回実装commitで成功（client 10.984秒 / server 21 ms）。文書統合後のUI観測sourceでも成功（client 10.948秒 / server 18 ms）。双方の生成物は各検証後に削除済み | 0（両実行） |

## Emulator後処理

`CUSTOMER-02-VALIDATE`で、実設定・wrapperを照合し、専用demo project・loopback・外部作用deny・`isolated-saved-data`読込みで実行した。利用者saved-dataと専用exportの指紋はwrapperで前後一致。専用容量16,091 bytesで前後不変、専用7 portsとFunctions検出用8353のLISTENなし。自身のruntime `test-harness-44828`を削除し、既存runtime directoryは変更しなかった。CLIのMOTD取得不可・認証期限警告は再認証せず扱い、suiteは正常終了した。これはremote認証の確認・更新ではない。

## 証拠の分担

- domain: CREATE固定、状態patch/no-op、基本/支払分離、draft/競合/rollback、準備中の権限・UID・会社・instance変更、状態別一覧購読、終了済みの検索・ID取得・cache保持。
- Emulator: Rulesの許可4actor両方向、陰性actorの既存document update、値/型/削除/metadata/派生値/混合更新拒否、role剥奪、関連Site・予定存在、両状態のdelete/archive/nested拒否。fixtureは合成で、UI操作証拠にはしない。
- production同期handler: 実`onUpdateCustomer`をmock隔離して同社Siteの`customer`だけを更新することを検査。予定とSite自身の状態を変更しない。専用local Functionsはこのtriggerをexportしないため、triggerの配備・実発火成功や非同期配送を検証したとはしない。
- visible UIの担当: Low testerからの正規in-app browser接続は`Browser is not available: iab`で失敗し、親タスク接続成功後の再確認1回でも同じ結果だった。利用者は2026-09-03に画面テストだけを親で行う推論レベル指定の例外を承認した。自動test・環境準備・backend assertion・後処理はLowを維持した。提供scope差は可能性であり原因未確定。Dev・利用者Chromeへの代替切替はしていない。

## 可視UIの観測結果と隔離未達

- 専用build/source/config identity、Emulatorの`All emulators ready`、generated server ready、loopback root HTTP 200（確認command exit 0）後に初回navigationした。短時間の起動表示後、reloadなしでダッシュボードへ到達した。保存済み合成管理者sessionを再利用し、credential設定・表示は行っていない。
- browser visibilityは表示要求後もfalseだった。操作の可否とは別の制約として記録し、利用者が目視できたとは主張しない。
- 可視メニューから一覧へ移動し、通常入力で合成Customer 1件を作成した。CREATEには契約状態入力がなく、作成後の一覧・詳細は「契約中」。業務dataの直接注入は行っていない。
- 基本editorで「契約終了」を選んで取消し、「契約中」の維持を確認。再度「契約終了」を選んで通常保存し、詳細表示とreload後の保持を確認した。
- 一覧の「契約中」で対象なし、「契約終了」と「すべて」で対象1件を確認し、反復切替でも旧行が残らなかった。
- 「契約終了」のまま基本情報の支店名と、支払条件の入金サイト月数を別々に保存した。reload後も両値と状態を保持。「契約中」へ戻して保存・reloadしても両編集値が残った。契約中一覧へ復帰し、契約終了一覧には残らなかった。
- 390px幅で検索入力・通常keyboardによる解除、状態選択、追加dialogの表示・取消を確認した。1280px幅では一覧の状態列を確認した。終了前にviewport overrideをresetし、親が作成したtabを閉じ、tab一覧0件を確認した。
- 補助的なread-only backend assertionは、初回26 fields・ACTIVE、状態変更後26 fields・TERMINATED・実値差分が`contractStatus`/`updatedAt`のみ、最終ACTIVE・`branchName`/`paymentMonth`/`updatedAt`だけが初回との差分であることを確認した。同actorのためuid値は不変でありwriterの送信field数とは区別する。各単一GET＋assertionはexit 0（0.407 / 0.299 / 0.273秒）。exact invocationはtesterのtool inputに保持し、補助証拠とする。再現可能なcompletion gateは上表のdomain/Emulatorを正とする。
- consoleのwarn 1件は郵便番号`0000000`の住所未取得、error 1件は`[ClientGeocoding] Error: FirebaseError: internal`だった。後者は外部fetch前のdeny guardが存在する既存経路だが、当該実行のdeny直接記録を取得できず、error文だけから原因を断定しない。
- **隔離条件未達**: 郵便番号のwarnは、既存`air-vuetify-v3/src/utils/postalCode.js`が外部検索URLへ直接fetchし、`response.ok`とJSON解析成功後に出す分岐だった。JSONの`data.status=200`をHTTP status 200と取り違えない。コードと観測を合わせると外部検索応答を受けた可能性が高いが、network経路・cache・中継の観測はなく外部service本人への実到達は未確認。Functionsのdenyやbuild identityではbrowser直接通信を遮断できない。
- `CUSTOMER-02-UI-POSTAL-BOUNDARY-REVIEW`（High）はこの境界を確認し、CS-03の0点維持を判断した。合成郵便番号以外のCustomer値・Firebase tokenをこの要求に付けるコードはなく、実data・秘密情報の流出を示す根拠はない。追加UI操作を止めた後、専用UIだけの遮断修正と限定再試験は[CONF-0145](../implementation/pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint)で承認された。再検証前の操作成功を「外部隔離されたUI受入れ完了」へ昇格しない。

## 統合差分と後処理

### 承認済みの追加隔離修正（画面再検証待ち）

- `CUSTOMER-02-UI-ISOLATION-DESIGN`（High、278秒）で、専用client buildの実path限定module置換を採用。`CUSTOMER-02-POSTAL-ISOLATION-DESIGN-REVIEW`（High）で、Nitro prefixと親object overrideによる環境差替え拒否を追加必須とし採用した。
- developer Mediumのscope: `nuxt.config.js`、`scripts/vite-codex-postal-isolation.mjs`（新規）、`scripts/codex-local-ui-build-identity.mjs`、`scripts/build-codex-local-ui.mjs`、`scripts/run-codex-local-ui-dev.mjs`、`scripts/serve-codex-local-ui.mjs`。tester Lowは既存3 codex config/identity/foreground testと新郵便番号隔離testだけを所有する。
- 専用buildで対象のasync検索関数を無通信・null返却へ置換し、対象未検出/未置換をfail-closedにする。生成receiptをbuild wrapperが確認後だけidentity markerを成立させる。build・serve双方で専用設定を固定し、継承Nuxt/Nitroの迂回overrideを拒否する。専用診断dev launcherは未隔離のためspawn前拒否し、通常Devは変更しない。
- Schemas・関連package・通常検索・Customer保存契約・Functions/Rules・data形状は不変更。新しい製品要件やdata migrationではなく、承認済み専用UIの隔離条件を満たす補正である。新ADRは作らず、既存ADR 0042の診断経路の現行提供状態とrunbook・operationsを整合させる。governance/permission/role/担当規則は変更しない。
- 再検証選択: 直接4test → 最終`domain-full`・新しい専用`local-ui-build`・UI再試験・`project-docs`/`diff-check`。成功済み`project-docs-negative`/`capacity-regression`/`managed-governance`は対応するvalidator/policy/容量手順/managed artifactが不変なら再利用する。`local-emulator-suite`はFunctions/Rules/Schema/fixture/Customer writerが不変で、そのsuiteが専用Nuxt client moduleを実行しないため118件の証拠を維持する。Dev/Prod build・deployは対象外。
- 追加iteration: `node --test test/domain/codex-nuxt-config.test.mjs test/domain/codex-ui-build-identity.test.mjs test/domain/codex-ui-foreground-contract.test.mjs test/domain/codex-postal-isolation.test.mjs` は37/37成功・exit 0（130.2936ms）。実sourceをmock隔離し、専用client条件・無通信null応答・実watchの住所emitなし・通常utility維持・環境override拒否・receipt/marker・診断launcher停止を検証した。実buildとUI再試験の代替ではない。
- 初回の追加修正全domainは850/850・exit 0（1937.0531ms）。ただしHigh一般reviewが、Nuxtのpublic asset copy対象外であるclient rootのreceiptをoutput側から読むP1を実build前に発見した。wrapperをfresh client receipt検証後の明示転送へ修正し、末尾filenameだけのmockからexact path・削除/転送順と失敗時marker不成立のtestへ補強する。この後続変更により850件の結果は最終証拠として失効し、再実行する。
- `CUSTOMER-02-POSTAL-RECEIPT-REREVIEW`と`CUSTOMER-02-POSTAL-RECEIPT-SECURITY-REREVIEW`（High）でP1と削除順test不足の解消を確認し、追加blocking指摘なし。一般再reviewは19秒。静的reviewを実buildの証拠としない。
- 修正後の同じ4test commandは39/39・exit 0（128.9446ms）、`node --test test/domain/*.test.mjs`は852/852・exit 0（1904.8578ms）。`check-project-docs.ps1`の上表正規commandは215 Markdown / 44 ADR / 6 roadmap / 8 TOML・exit 0（1.8720秒）、`git diff --check`はexit 0（0.2543秒）。統合前`git diff --cached --check`もexit 0。この後の文書整理でdocs/diffだけを再検証する。
- cleanな追加隔離commitで`npm run test:local:ui:build`はexit 0（client 11495ms / server 17ms）。実client/outputの両receipt内容、source/config identity一致、配信対象client JS 111 filesのzipcloud endpoint一致0を非UI assertion（exit 0）で確認した。これは未調査の全外部通信0や実browser network traceの証明ではない。
- 専用EmulatorのAll emulators ready、generated server ready、loopback HTTP 200、既存専用portを確認した。親が新tabを開く前の準備成功と、その後の再確認commandはexit 0。visibility要求はfalse。初期templateからtopへ到達し、通常サインインbuttonで認証画面へ進んだが、保存済み合成sessionは再利用されなかった。console warn/errorは0。Customer作成・7桁入力・状態再試験はまだ行っていない。
- [CONF-0146](../implementation/pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外)で、一時合成credentialをagent間で受け渡さず、親が専用Auth Emulatorの一時設定から通常UI入力まで行う推論担当の限定例外を確認中。保存済みsnapshot・実account・通常環境の変更は許可対象にしない。
- 利用者からNortonと`test-verification-policy.ps1`について申告があり、新規操作を一時停止してread-only照合した。同名fileは通常検索対象外の`air-vuetify-v3/scripts/`内に存在し、今回の変更・実行対象ではない。通知の検出名・対象pathは不明。fileに`-EncodedCommand`はあるが、検知原因との因果は未確認で、誤検知とも断定しない。除外・回避・再実行はせず、今回build/runtime失敗の証拠もない。関連packageの修正は行わない。
- 認証例外の回答待ちで親tabを閉じ、Lowがserver→EmulatorをCtrl-C停止した（両process exit 1）。自身PID 4件、専用8 portsと派生9150/8056閉鎖の確認はexit 0。利用者saved-data 7 files / 6,012,330 bytes、専用saved-data 7 files / 3,492 bytesの前後指紋一致はexit 0。元rootログ2件のhash・timestampを復元し、安全な絶対path・reparse検査後に自身の`.output`と`.codex-test/runtime/customer-ui-log-backup-6ed23fc6`だけを削除（exit 0）。生成物不存在・一時メモ2件保持の確認もexit 0。生成物は正規buildで再生成可能。

### 2026-09-03 再開時の限定再試験

- 利用者の再開指示で、Low環境担当とLow UI担当のno-change callbackを確認した。Low UI担当は正規in-app browserのdocumentationとtab一覧取得に成功したため、親の認証例外を使わない通常分担で準備を開始した。
- cleanな`c08f175b82d4bd6f48366053b0a3c1e97acb2f16`でLow環境担当が`npm run test:local:ui:build`を実行し、exit 0（client 11221ms / server 18ms）。両receipt、source/config identity一致、配信対象client JS 111 filesのzipcloud endpoint一致0を確認した（assertion exit 0）。専用EmulatorのAll emulators ready、generated server ready、loopback HTTP 200の確認もexit 0。これはCustomerのUI成功証拠ではない。
- `CUSTOMER-02-RETEST-UI`は最初の表示要求で`Browser is not available: 1`となった。troubleshootingに従うbrowser再一覧は0件で、tab作成・Auth設定・credential生成/入力・Customer操作・backend assertionは未実施。初期接続確認の成功を実操作能力の確認と取り違えない。接続障害の原因は未確定。
- 親は既存の画面操作例外内で表示を要求し、新tabを開いて起動表示から初期topのサインイン案内へ到達した。visibilityはfalseで、利用者による目視とは区別する。保存済み合成sessionは再利用できず、Auth設定・入力・Customer操作へ進まず停止した。今回のconsole/network traceは未取得。親tabを閉じ、tab一覧0件を確認した。
- [CONF-0146](../implementation/pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外)は未回答を維持する。Low担当の実操作が利用できず、親の一時認証準備まで含める担当例外が必要になった。7桁手入力・手動住所・保存/reload・状態取消/終了/復帰/filterの再試験は未完了で、CS-03へ加点しない。
- `CUSTOMER-02-RETEST-ENV-CLEANUP`でLow環境担当がserver→Emulatorの順にCtrl-C停止した（両process exit 1）。所有PID 4件、専用8 portsと派生9150/8757のLISTEN残存0を独立確認した（exit 0）。両saved-dataは前回と同じfile数・byte数で全指紋一致（exit 0）。rootログ4件の復元は、初回確認で停止後の`firebase-debug.log`不存在によりexit 1となったが、開始前backupからの復元後に4件すべてのhash・bytes・timestamp一致を再確認した（exit 0）。安全な絶対path・reparse検査後に今回の`.output`と`.codex-test/runtime/customer-retest-c08f175b`だけを削除し、不存在・既存runtime 18件と一時メモ2件の保持を確認した（exit 0）。snapshot書込み・Auth設定はない。各非UI確認commandはLow担当callbackのtool inputに保持する。
- 今回のtracked変更は再開案内・CONF・本検証記録だけ。製品sourceは追加隔離commitから不変のためdomain 852件とEmulator 118件の成功証拠を維持する。governance移行後のproject-docs-negative 28件、capacity-regression 7件、managed-governance（renderer内包）は、各validator/fixture/policy/必須route/managed入力が今回不変のため再利用する。最終文書のproject-docs・diff-checkを再実行し、結果とexitはcommand reportと統合commit本文へ記録する。製品仕様・ADR・進捗・manual・operations・data契約・indexは変わらず、Dev/Prod build・deployは今回も対象外。

### 2026-09-04 CONF-0146承認後の限定再試験とcrash復旧

- 利用者はCONF-0146を承認した。親は専用Auth Emulatorに既に存在する合成account 1件の識別子を値として出力せずread-only照合し、今回新たにprompt・文書・永続logへ転記しなかった。暗号学的乱数から作った一時passwordだけを同Emulatorへ設定し、snapshotへ保存せず、親の一時memoryから通常UIへkeyboard入力した。dashboard到達後にpasswordとactorを保持した変数を破棄し、saved-data指紋不変とEmulator停止により一時passwordが永続化されていないことを確認した。
- cleanな`a33576ef9df06a7b8dcaa50be69792646868fd6f`でLow環境担当が`npm run test:local:ui:build`を実行し、exit 0（server 16ms、client所要時間はcommand出力から確認できないため記録しない）。client/outputの両receiptとsource/config identity一致、配信対象client JS 111 filesの`zipcloud.ibsnet.co.jp`一致0をassertion exit 0で確認した。専用Emulator、generated server、loopbackの準備完了後にUIを操作した。
- 親は通常のpointer/keyboard操作だけで合成Customer 1件を作成した。CREATEに契約状態入力はなく、作成直後は「契約中」。郵便番号`0000000`は7桁を手入力し、都道府県・市区町村・番地も手入力して保存した。詳細reload後も郵便番号・住所・契約状態を保持した。初回backend補助assertionは26 fields、入力値と既定値、`ACTIVE`を確認しexit 0（0.436秒）。
- 基本editorで「契約終了」を選んで取消し、詳細が「契約中」のままであることを確認した。次に状態だけを「契約終了」へ変更して通常保存し、詳細とreload後で`TERMINATED`を保持した。backend補助assertionは26 fields、初回との差分が`contractStatus`と`updatedAt`だけ、`uid`不変を確認しexit 0（0.343秒）。契約中一覧0件、契約終了一覧1件、全件一覧1件を確認した。
- 基本editorで状態だけを「契約中」へ戻して保存し、詳細reload後も郵便番号・住所・支払条件を保持した。契約中一覧1件、契約終了一覧0件を確認した。最終ACTIVEのbackend補助assertionを開始する前にCodexが停止したため、この1点は未実行であり成功扱いにしない。通常UIの保存・詳細reload・状態別filterは完了している。
- browser consoleには郵便番号住所未取得warnはなかった。errorは`[ClientGeocoding] Error: FirebaseError: internal` 1件（UTC `2026-09-03T15:44:38.334Z`）。専用Functionsはgeocoding callableをexportせず、通常Functionsにはその経路があることをread-onlyで確認したが、当該errorが外部作用denyで発生した直接記録はなく原因を断定しない。browser network traceは取得できず、全browser通信の外部到達0は未検証。郵便番号については配信JS 111 filesの外部endpoint一致0、39件の隔離test、住所未取得warn 0を根拠とする。
- Codex停止後の復旧時点で、所有PID 4件と専用・派生10 portsのLISTENは0だった。Low cleanup担当は両saved-dataを開始時指紋と再比較し、利用者側7 files / 6,012,330 bytes、専用側7 files / 3,492 bytesで不一致・追加0を確認した。4本のroot debug logを今回開始時backupのhash・bytes・UTC integer ticksへ復元し、各assertion exit 0。安全な絶対path・包含・reparse不在を再確認して今回の`.output`と`.codex-test/runtime/customer-auth-a33576ef`だけを削除し、既存runtime 18件、一時メモ2件、両saved-data、cleanなGitを保持した。各削除と最終aggregate確認はexit 0。
- 以前のcleanupでPowerShellのJSON DateTime変換によりroot debug logの更新時刻が開始前より9時間ずれた履歴がある。今回のbackupはその時点の状態を開始基準としており、今回の実行前状態へはinteger ticksで正確に復元したが、それ以前の元の更新時刻は確認不能で復元済みとはしない。内容・サイズ・hashの不一致や製品data変更を示す事実はない。
- 停止後のerror pageになったin-app browser tabは、通常のclose操作がURL safety policyで拒否され1件残った。専用serverは停止し、14600を含む対象portのLISTEN 0を確認済みである。tab残存をCustomer操作またはserver残存とは扱わない。
- 今回のtracked source/config変更はない。domain 852/852、Emulator 118/118、郵便番号隔離39/39の既存成功証拠は各invalidation triggerに該当しないため維持し、同じclean sourceで専用buildを再実行した。最終文書変更には`project-docs`と`diff-check`を実行する。Dev/Prod・remote・実dataは操作していない。
- `CUSTOMER-02-CRASH-FINAL-REVIEW`（High）は、上記認証記録の絶対表現を訂正後、blocking指摘なしと判断した。最終ACTIVEのbackend補助assertion欠落は、通常UIの保存・詳細reload・状態別再購読と既存の両方向patch/list/Rules自動testがあるためnonblocking。ClientGeocoding errorは専用Functionsでcallable未提供が最有力という推論に留め、原因確定せず、郵便番号隔離とは別の専用環境制約およびCS-04/Dev受入れ残件とした。CS-03の30点加点とFUT-0184完了をGOとした。

### 追加修正前までの統合・cleanup

- 実装commitは27 files、811行追加 / 111行削除。application/Rules 7 files、test 5 files、影響する仕様・ADR・manual・roadmap・引継ぎ・証拠等15 files。exact file一覧は当該commitの`git show --name-only`で確認できる。
- application/Rules: `composables/domain/customer/customerOperations.js`、`composables/application/customer/useCustomerActions.js`、`components/Customer/Editor/Base.vue`、`components/Customer/Activator/Base.vue`、`components/Customers/DataTable/index.vue`、`pages/customers/index.vue`、`firestore.rules`。
- test: `test/domain/customer-operations.test.mjs`、`test/domain/customer-ui-source-contract.test.mjs`、`test/domain/customer-list.test.mjs`、`test/domain/customer-status-sync.test.mjs`、`test/local/codex-local-harness.test.mjs`。
- UI接続不可のcheckpointではEmulator/serverを起動せず、browser tabも作成していない。自身の専用build生成物`.output`を削除し、primary repositoryのclean状態を確認した。生成物は同じ正規buildで再生成可能。
- その後のUI観測checkpointではserver→Emulatorの順にCtrl-C停止し、両processのexitは1。Emulatorのclean shutdownと対象PID消滅、専用8 portsおよび派生port 8353/8634/9150のLISTEN 0件を確認（確認command exit 0）。異常終了0と偽らず、正常な後処理確認を分ける。
- 利用者saved-data（7 files / 6,012,330 bytes）と専用saved-data（7 files / 3,492 bytes）は開始前後のSHA-256一致。既存rootログ2件は起動前に今回runtimeへ退避し、停止後に元内容・長さ・更新時刻・SHA-256を復元確認した（exit 0）。自身の`.output`とlog-backup runtimeだけを安全な絶対pathとreparse不在を確認して削除（exit 0）。既存runtimeと一時メモは保持し、tracked cleanを確認した。合成CustomerはexportせずEmulator停止で破棄した。
- 再開記録は[現coordinator handoff](../implementation/current-coordinator-handoff.md)。反省会用一時メモとsecurity設計メモはignoredな`.codex-test`配下に保持する。反省会と改善作業の終了前には削除しない。

## 未検証・残存制約

- Dev・Prod・remote状態と実trigger配送、既存不適合documentへの保存、正式運用可否は未確認。
- 新しい状態filterの見た目・使い勝手は利用者判断を残す。Dev延期をその受入れの自動成功にはしない。
- 一覧adapterの非同期listener error通知不足、送信後の同時更新競合、Payment editorの既存独自rollback経路、CREATE準備後の再認可は今回の限定補正外。
- `generate-dev`/`generate-prod`は別環境release未承認なので省略。standalone rendererはmanaged-governance内包のため重複しない。package・governance/権限設定・data形状変更やmigrationはない。
- 専用UIの通信隔離修正・自動test・独立review・buildと、CONF-0146承認後の限定画面再試験・crash後cleanup・High最終reviewは成功し、CS-03のlocal工程を完了した。Customerフェーズ全体の完了・Dev受入れ・正式運用可とはしない。[FUT-0184](../implementation/future-actions.md#fut-0184-codex専用uiのブラウザ直接郵便番号通信を遮断する)は既知の郵便番号経路の隔離完了として閉じ、全browser通信・ClientGeocoding・Dev/Prod/remoteの制約を残す。
