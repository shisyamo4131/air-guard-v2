# CUSTOMER-02 状態表示・編集 local検証記録

- 状態: In progress / 対象UI操作は成功、承認済みの専用UI郵便番号通信隔離の修正・再検証待ち
- 日付: 2026-09-03
- checkpoint: `CUSTOMER-02-STATUS`
- branch: `codex/customer-status`
- 開始HEAD: `cfa23595b37f2709131caab6f2a4be03713a8f95`
- 実装・test・文書のlocal統合commit / 専用build source: `cc562f2ed8b22502986556ab0799ce2d721c646e`
- 今回のUI観測source: `2c05c912eaae1d2ba1cb4a22696567586666b6c1`（上記実装からの変更は文書だけ）。clean worktreeで再build・generated serverを起動した。
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

### 承認済みの追加隔離修正（実装・再検証中）

- `CUSTOMER-02-UI-ISOLATION-DESIGN`（High、278秒）で、専用client buildの実path限定module置換を採用。`CUSTOMER-02-POSTAL-ISOLATION-DESIGN-REVIEW`（High）で、Nitro prefixと親object overrideによる環境差替え拒否を追加必須とし採用した。
- developer Mediumのscope: `nuxt.config.js`、`scripts/vite-codex-postal-isolation.mjs`（新規）、`scripts/codex-local-ui-build-identity.mjs`、`scripts/build-codex-local-ui.mjs`、`scripts/run-codex-local-ui-dev.mjs`、`scripts/serve-codex-local-ui.mjs`。tester Lowは既存3 codex config/identity/foreground testと新郵便番号隔離testだけを所有する。
- 専用buildで対象のasync検索関数を無通信・null返却へ置換し、対象未検出/未置換をfail-closedにする。生成receiptをbuild wrapperが確認後だけidentity markerを成立させる。build・serve双方で専用設定を固定し、継承Nuxt/Nitroの迂回overrideを拒否する。専用診断dev launcherは未隔離のためspawn前拒否し、通常Devは変更しない。
- Schemas・関連package・通常検索・Customer保存契約・Functions/Rules・data形状は不変更。新しい製品要件やdata migrationではなく、承認済み専用UIの隔離条件を満たす補正である。新ADRは作らず、既存ADR 0042の診断経路の現行提供状態とrunbook・operationsを整合させる。governance/permission/role/担当規則は変更しない。
- 再検証選択: 直接4test → 最終`domain-full`・新しい専用`local-ui-build`・UI再試験・`project-docs`/`diff-check`。成功済み`project-docs-negative`/`capacity-regression`/`managed-governance`は対応するvalidator/policy/容量手順/managed artifactが不変なら再利用する。`local-emulator-suite`はFunctions/Rules/Schema/fixture/Customer writerが不変で、そのsuiteが専用Nuxt client moduleを実行しないため118件の証拠を維持する。Dev/Prod build・deployは対象外。
- 追加iteration: `node --test test/domain/codex-nuxt-config.test.mjs test/domain/codex-ui-build-identity.test.mjs test/domain/codex-ui-foreground-contract.test.mjs test/domain/codex-postal-isolation.test.mjs` は37/37成功・exit 0（130.2936ms）。実sourceをmock隔離し、専用client条件・無通信null応答・実watchの住所emitなし・通常utility維持・環境override拒否・receipt/marker・診断launcher停止を検証した。実buildとUI再試験の代替ではない。
- 初回の追加修正全domainは850/850・exit 0（1937.0531ms）。ただしHigh一般reviewが、Nuxtのpublic asset copy対象外であるclient rootのreceiptをoutput側から読むP1を実build前に発見した。wrapperをfresh client receipt検証後の明示転送へ修正し、末尾filenameだけのmockからexact path・削除/転送順と失敗時marker不成立のtestへ補強する。この後続変更により850件の結果は最終証拠として失効し、再実行する。

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
- 今回のUI操作・cleanupは実施済みだが、専用UIの通信隔離修正と再検証・最終統合は未完了。自動test/build成功やlocal実装commitを、Customerフェーズ全体の完了・Dev受入れ・正式運用可と読み替えない。[FUT-0184](../implementation/future-actions.md#fut-0184-codex専用uiのブラウザ直接郵便番号通信を遮断する)を後続checkpointで扱う。
