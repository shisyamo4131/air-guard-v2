# AirGuardV2 運用・開発手順

## 現在利用できる運用

- Nuxt 開発サーバーの起動
- Firebase Emulator Suite を使うローカル確認環境
- 開発・本番設定による静的生成
- Firebase Hosting、Functions、Firestore Rules/Indexes、Storage Rules、Realtime Database Rules のデプロイ
- メンテナンス状態とキルスイッチの切り替え
- Firestore のスケジュールバックアップ（既存資料上の記載。現在の設定はデプロイ前に再確認する）

デプロイ、データ変更、Secret 登録は Codex が自動実行する操作ではなく、人の明示的承認と環境確認を必要とします。

## 準備

### 必要なもの

- Node.js。Cloud Functions の指定ランタイムは Node.js 22
- npm
- 対象 Firebase プロジェクトへアクセスできる Firebase CLI 認証
- 用途に応じた `.env.development`、`.env.local`、`.env`
- Stripe ローカル Webhook を確認する場合は Stripe CLI とローカル Secret

依存関係のインストール前にはロックファイルと変更差分を確認します。証明書の問題がある環境では、検証を無効化せず、必要な PowerShell プロセス内だけで次を設定します。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npm install
```

## 通常の開発

### 担当と変更単位

- application codeの標準実装者はユーザーとする。
- Codexは変更前の現行挙動、仕様、影響、失敗経路、互換性、rollback、確認方法を整理し、ユーザー実装後の差分review、許可済みtest、documentとlocal Gitを管理する。
- Codexの`developer`によるapplication code編集は、ユーザーが対象fileまたは機能境界を明示した補助実装だけで行う。
- `tester`によるtest code編集は明示されたtest scopeだけで行い、application codeを変更しない。
- 認証・認可・tenant分離は一括改修せず、独立して説明・review・rollbackできる最小segmentを1件ずつ扱う。

### 非同期UI操作のerror・loading責務

2026-08-17に、特定機能へ限定しないproject共通原則として次を確定した。

- `AirArrayManager`または`AirItemManager`がsubmitを管理するCRUDでは、operation handlerはerrorを握りつぶさずmanagerへrejectを伝播する。managerの`error` eventを`useBaseManager`、`useLogger`、`useErrorsStore`、`useMessagesStore`へ接続し、component内で同じerrorを重複して`logger.error()`または`errors.add()`へ渡さない。
- manager管理下のCRUDはmanager固有の処理中状態を使用し、理由なくglobal loadingを重ねない。確認、取消、処理中、失敗後のdialog維持はmanagerの契約として扱う。
- manager外の独立操作は、`useLoadingsStore.add()`、`try`、成功message、`catch`での`logger.error({ error })`、`finally`でのloading削除を基本形とする。errorをcallerへ再伝播するか吸収するかはoperationの成功条件として明示する。
- Callableはserver側で内部情報を含まないcode・利用者向けmessageへ変換する。clientは安全なmessageをfeedback経路へ渡し、UID、会社ID、内部例外、秘密情報を画面へ表示しない。
- `useLogger`へ`useErrorsStore()`を渡した場合、`logger.error()`がErrors Storeとerror色messageの登録を兼ねる。同じerrorへ`errors.add()`を併用しない。
- error/loading基盤全体のtyped error、retry、owner、reference count、取消し、layout lifecycleはFUT-0136、FUT-0137、FUT-0139で継続する。Air managerの責務分割はFUT-0181へ統合し、現時点では低優先度の構造整理として扱う一方、既知のdisable・single-flight等の安全上の不具合は同FUTの重大度を維持する。

### Client操作policyとcomposableの責務

2026-08-17に、特定機能へ限定しないproject共通原則として次を確定した。判断理由は[ADR 0019](decisions/0019-client-operation-policy-composable-boundary.md)を正とする。

- ドメイン上の操作可否をclientで事前検証する場合、Vue、component、Firebase transportへ依存しない純粋policyを設ける。
- application composableがpolicyをreactiveな状態へ適用し、操作可否、安定した拒否理由、実行処理をcomponentへ提供する。
- componentはrole、permission、対象状態のpolicyを再実装せず、composableの結果を表示と操作へ反映する。
- composableはrequest送信直前にもpolicyを再評価し、拒否状態では送信しない。
- client事前判定を認可境界として扱わず、serverはidentity、actor、tenant、対象、入力、最新状態を必ず再検証する。
- field単体の必須、文字数、書式validationはこの構造を強制せず、既存validatorまたはcomponent ruleを使用できる。
- 既存機能は一括移行せず、新規機能と改修対象機能からpolicy、composable、component接続、server共通条件parity testを小segmentで追加する。

認証・認可segmentは、実装前に次を揃えます。

```text
segment: <一つの入口・権限・data境界>
current-behavior: <codeとtestから確認した現行挙動>
threat-or-failure: <actor、前提、操作、影響>
in-scope: <今回変更するfile・rule・contract>
out-of-scope: <後続segmentへ残す境界>
proposed-contract: <許可・拒否・状態遷移>
compatibility-and-data: <既存利用者・data・migrationへの影響>
rollback: <code、rule、data、外部作用を戻す条件と方法>
tests: <許可経路、拒否経路、tenant境界、失敗経路>
user-confirmation: <実装前判断と実装後確認>
```

開発環境:

```powershell
npm run dev
```

### Firestore instance baseline

2026-08-17にFirebase CLI 15.27.0でDev環境を読み取り確認した。

| 項目 | 確認値 |
|---|---|
| Firebase project | `air-guard-v2-dev`（`.firebaserc`の`default`・`dev` alias） |
| Database | `(default)` |
| Edition | `STANDARD` |
| Type | `FIRESTORE_NATIVE` |
| Location | `asia-northeast1` |
| Delete protection | `DELETE_PROTECTION_DISABLED` |
| Point-in-time recovery | `POINT_IN_TIME_RECOVERY_DISABLED` |

確認には次の読み取り専用コマンドを使用する。edition依存のFirestore実装を開始するときは、まず本baselineを確認し、対象projectまたはdatabase構成が変更されている場合だけ再取得する。

```powershell
npx -y firebase-tools@latest use
npx -y firebase-tools@latest firestore:databases:list --project air-guard-v2-dev
npx -y firebase-tools@latest firestore:databases:get "(default)" --project air-guard-v2-dev
```

Prod環境`air-guard-v2`のdatabase editionと保護設定は未確認であり、deploy判断へ流用しない。

ローカル用設定でホストを公開する場合:

```powershell
npm run local
```

Firebase Emulator Suite は `firebase.json` で Auth、Functions、Firestore、Realtime Database、Storage、Hosting、Emulator UI を構成しています。起動前に使用プロジェクトと `.env.local` のエミュレーター設定を確認してください。

利用者が画面確認用のlocal環境を起動する場合は、利用者用の保存済みデータを読み込みます。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npx -y firebase-tools@latest emulators:start --import=./saved-data
```

- 明示的な指示なしに `--export-on-exit` を指定しない。
- CLIが未起動サービスから本番へ到達する可能性を警告した場合、対象コードとテスト操作を確認し、外部作用を排除できなければテストしない。
- FunctionsからStripe、メール、FCM、ジオコーディングなどの外部サービスを呼ぶ操作は、個別に隔離できることを確認する。

### Codex専用localテスト

Codexの自動テストは、利用者用`./saved-data`、通常の`firebase.json`、`.env.local`を変更しません。[ADR 0014](decisions/0014-codex-dedicated-local-test-data.md)に従い、Git対象外の`.codex-test/saved-data`へ合成fixtureだけを保存します。

初回または承認済みの再生成時だけ、専用seedを作成します。

```powershell
npm run test:local:seed
```

- `demo-air-guard-v2-codex`だけを使い、remote Firebase projectを選択しない。
- Auth、Firestore、Realtime Database、Storageを`127.0.0.1`の専用ポートで起動する。
- Functions Emulatorは起動しないため、FCM、Stripe、ジオコーディングの実呼出し経路を含まない。
- 合成会社・合成利用者だけを作成し、実在データ、`.env.local`のアカウント、利用者用`./saved-data`を複製しない。
- 既に`.codex-test/saved-data`がある場合は上書きせず失敗する。削除・再生成は別の承認済み作業として行う。

通常テストは専用exportを読込専用で使用します。

```powershell
npm run test:local
```

- `--import=.codex-test/saved-data`を使い、`--export-on-exit`は指定しない。
- 実行前後に利用者用`./saved-data`と専用exportの指紋を比較し、変化した場合は失敗する。
- `.codex-test`が50 MiB以上なら警告し、100 MiB以上ならEmulator起動前に停止する。通常は20 MiB以下を目標とする。
- 一時ログと子スクリプトは`.codex-test/runtime`だけに作り、終了時にproject配下であることを確認して削除する。
- CodexのSQLite、WAL、セッション記録へテスト成果物を書かない。タスク容量は`check-codex-session-size.ps1`で別に監視する。

現在のsuiteは専用seed、Authサインインに加え、Firestore・Storage Rulesについてverified email、正常な会社claim、tenant path、有効な本登録User、恒久的なsuper-user bypass拒否を検証します。Companies本体、名前付きsubcollection、未定義descendant、SecurityReportIndexes・StripeDataの個別操作制約と、SecurityReportsのupload、list、metadata、download URL、byte download、deleteを確認します。さらに、正式な`functions/apis/index.js`から公開する10 Callableを専用Functions Emulatorで読み込み、内部helperが非公開であることとCallable transport readinessを確認します。再構築、全会社メール重複確認、signup用メール利用可否に加え、仮登録検索、管理者会社作成、一般User本登録・有効化・無効化・管理者移譲の入口guardを検証し、管理者会社作成はCompany、User、custom claimsの成功時整合と再実行も確認します。合計72件です。Realtime Database Rules、画像圧縮、実端末FCM、外部API、Authentication削除triggerのevent transportは未対象です。追加のFunctionsテストでは、外部作用をモックまたはfail-closedで隔離します。

### Codexだけで完結するlocal UI test

2026-08-17に旧browser操作基準で最小経路を検証した。専用Functions、Firebase clientの専用port解決、loopback server設定、確認済み合成Auth account、company claim、有効な本登録User、Codex管理ブラウザsign-in、dashboard到達、process・runtime cleanupの履歴証拠は保持する。2026-08-17に追加した実利用者相当のpointer・keyboard操作基準では、正規signupからのbaseline生成、再import後sign-in、dashboard再到達が未検証であり、自己完結UI modeの現在の受入れは未完了とする。外部作用は専用Functionsでdenyし、専用UIではPWA module、Service Worker登録、通知permission、FCM token登録を無効化する。

ブラウザUIの挙動・受入れ証拠は次の操作契約に従う。

- 可視・有効で通常のactionability条件を満たすcontrolを、通常のpointer clickまたはkeyboardで操作する。文字入力はfocusした可視controlへ一文字ずつ行い、削除・選択・確定も利用者が行うkeyまたは可視UIで実行する。
- `locator.click()`相当は通常のpointer入力経路とactionabilityを満たす場合だけ許可し、`pressSequentially()`相当はfocusした可視controlへ通常のkey eventを順に送る場合だけ許可する。mechanismを確認できない場合はmouse・keyboard操作へ切り替える。
- `fill`、`clear`、DOMの`value`・`checked`・`selected`等の変更、scriptによるwrite、`dispatchEvent`、`element.click`、event handler・component method・`requestSubmit`・client API/SDKの直接呼出し、force-click、disabled・hidden・overlay回避を禁止する。shortcut型の選択・check・file設定を利用者操作の代用にしない。
- 初期URLのopenとreloadは環境準備として許可するが、route発見性や画面内navigationの証拠には数えない。以後の遷移は可視UIから行う。
- tool-nativeのread-only DOM・ARIA、text、属性、disabled状態、URL、screenshot、console、networkは観測に使用できる。read-only script評価は状態を変更しない診断に限定し、credential、password、token、OOB code、入力値を出力しない。
- clean browser contextの準備、Authentication EmulatorのOOB確認、backend verifier、candidate export/importは非UI処理である。結果は`UI user-equivalent action`、`non-UI setup`、`backend assertion`へ分け、UI成功の代用にしない。
- 許可された実利用者相当操作をtoolが実行できない場合は、DOMやeventを直接操作して回避せず未検証と報告する。

Emulatorと開発サーバーは、次の2つの独立した前景processとして起動する。`Start-Process`、detach、background helperは使用しない。

```powershell
npm run test:local:emulators
npm run test:local:ui:server
```

Windows上のCodex管理ブラウザでは、Nuxt開発サーバーのVite moduleをHTTP 200で取得できてもSPA hydrationが完了しない事象を確認した。一回限りの利用者承認により、`config/codex-test-ui.env`を使ったNuxt buildと`127.0.0.1:14600`限定のNode serverで代替検証し、sign-inからdashboard到達まで成功した。プロジェクト規則のbuild禁止は維持されるため、Codexがこのbuild経路を再実行する場合は、その都度明示承認を得る。生成した`.output`は検証後に削除する。

承認済みの専用buildは`npm run test:local:ui:build`だけを使用する。このcommandはbuild前後にroot worktreeがcleanで同じHEADであること、専用dotenvがallowlist済みのdemo project・loopback・Emulator設定だけであることを確認し、成功した`.output`へ設定SHA-256とsource HEADを含むidentity markerを作成する。`npm run test:local:ui:server:generated`はmarkerの欠損・破損、現在のdotenvまたはHEADとの差、dirty worktreeのいずれでもgenerated serverをimportせず停止する。markerを手動作成・更新してはならない。実buildとgenerated serverの受入れ確認は引き続き実行ごとの明示承認を必要とする。

`scripts/run-codex-local-ui-child.ps1`を使うprocess管理案はNortonに`IDP.Generic`として検出されたため破棄・revertした。隔離解除、allowlist登録、同方式の復元を行わない。現在の前景commandはこのhelperに依存しない。

完成条件は次のとおりとする。

1. `demo-air-guard-v2-codex`と通常local環境とは異なるloopback portだけを使用する。
2. CodexがAuth、Firestore、Realtime Database、Storage、必要なFunctions、local serverを起動し、Codexが起動したprocessだけを終了する。
3. 合成会社、super-user兼管理者、管理者、一般User、仮登録User、必要な業務documentを再生成可能なfixtureから作成する。
4. Functionsから外部API、Stripe、mail、FCM、通知、ジオコーディング等へ到達しないことを陰性testまたは明示拒否設定で確認する。
5. Codex管理ブラウザが実利用者相当のpointer・keyboard操作だけでlocal appを開き、合成accountでsign-inし、対象画面を操作できる。非UI setup・backend assertionは別証拠として記録する。
6. 利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataが実行前後で変更されない。
7. 終了時にserverとEmulatorを停止し、一時runtimeをproject配下の明示pathだけから削除する。失敗時も同じcleanupと状態報告を行う。

2026-08-17の旧基準による受入れでは、専用suite 72件、UI設定契約9件、専用build、dashboard表示、dashboard滞在中のconsole error 0件、全専用port閉鎖、`.codex-test/runtime`空、`.output`削除を確認した。ただし`fill`等を含む旧操作証拠は新基準の受入れには再利用しない。サインアウト直後に購読解除前のFirestore snapshot listenerが2件の`permission-denied`を出す既存挙動は残っており、製品側のlogout cleanup課題として扱う。

数百件のdocumentを必要とする場合は小さいbatchから段階的に投入し、件数、応答時間、memory、Emulator logを記録する。約1000件でEmulatorが停止した利用者経験をlocal riskとして扱い、同規模の一括投入は行わない。正確な安全件数は実測前に固定せず、停止兆候があれば追加投入とUI操作を中止する。

### `isSuperUser` claimの正規化

関連repository `air-guard-v2-admin-sdk`の`migration is-super-user-claim`は、所属済みAuthentication User、Company、同一UIDの本登録Userが整合する場合だけ、未設定の`isSuperUser`を`false`へ正規化します。既定はdry-runで、不正claim、identity不整合、読取errorがある場合はapply前に停止します。Emulatorまたは明示的なDev環境だけを許可し、Prod環境では拒否します。

```powershell
# Emulator: dry-run -> apply -> dry-run
npm run cli:emulator -- migration is-super-user-claim
npm run cli:emulator -- migration is-super-user-claim apply
npm run cli:emulator -- migration is-super-user-claim

# Dev: 個別のremote data操作承認後だけ、同じ順序で実行
npm run cli:dev -- migration is-super-user-claim
npm run cli:dev -- migration is-super-user-claim apply
npm run cli:dev -- migration is-super-user-claim
```

実行前に対象環境、復旧可能性、件数だけを出力することを確認します。dry-runの`invalidIdentity`、`invalidClaim`、`errors`がすべて0の場合だけapplyへ進み、apply後のdry-runで`eligibleMissing`が0であることを確認します。

Codexまたはテスターがローカル画面を起動する場合は、`.env.local` を使用し、LANへ公開しないようloopbackへ限定します。

```powershell
npx nuxt dev --dotenv .env.local --host 127.0.0.1
```

認証後の画面操作が必要な場合は、Emulator専用アカウントを使用します。利用者用local環境では必要なアカウント作成を利用者へ依頼します。Codex専用環境では、Codexが実在情報を含まない合成accountをfixtureまたは実行時生成で作成します。

### 利用者用local環境を使うブラウザ操作の現在の制約

CodexのインアプリブラウザとChrome拡張による操作のどちらからもNuxtローカルサーバーの画面は取得できますが、現在の環境ではCodexがAuth Emulatorの `127.0.0.1:9099` へ直接接続してサインインを自動化する経路が、ブラウザ操作レイヤーで `ERR_BLOCKED_BY_CLIENT` として遮断されます。

Codex専用UI modeが完成するまで、利用者用local環境で認証後のUIテストを行う場合は、次の準備をユーザーが行った後、Codexがサインイン済みChromeタブを引き継ぐ方式とします。

1. `--import=./saved-data` を付けてFirebase Emulatorを起動する。
2. `.env.local` を使ってローカルサーバーを起動する。
3. Chrome拡張が有効なプロファイルでChromeを起動する。
4. Emulator専用アカウントでサインインし、必要に応じてテスト対象画面まで移動する。
5. 画面の準備が完了したことをCodexへ伝える。

Codexは既存タブを引き継いだ後、SPAローディングテンプレートの表示を即時エラーとみなさず、画面遷移の完了または明確なタイムアウトまで待機します。データ作成・更新・削除を伴う操作は、ユーザーがテスト内容として明示的に許可した範囲だけで行います。テスト終了時はユーザーが起動したEmulator、ローカルサーバー、ChromeをCodex側から停止しません。

危険なChrome起動オプションや利用者の通常profile変更は採用しません。Codex専用UI modeは利用者用環境の制約を回避するために混在させず、専用project、専用port、合成account、Codex管理ブラウザで独立して検証します。

Chrome拡張を使う場合、拡張機能を有効にしたChromeプロファイルでChromeを先に起動しておく必要があります。現在の環境では、Chrome終了後にCodexからChromeを自動起動・再接続することはできません。Chromeを終了した場合は、ユーザーが対象プロファイルでChromeを再起動してから検証を再開します。

## 静的生成

開発向け:

```powershell
npm run generate:dev
```

本番向け:

```powershell
npm run generate:prod
```

生成物は `dist/` に配置され、Firebase Hosting は同ディレクトリを公開します。Codex はプロジェクト規則により生成・ビルドを実行しません。

## デプロイ

1. `git status` と差分を確認する。
2. 対象が開発環境か本番環境かを確認する。
3. 対応する環境設定で静的生成する。
4. `firebase use <alias>` で対象を確認する。
5. デプロイ対象と影響を確認し、明示的承認後に `firebase deploy` または限定デプロイを行う。
6. Firebase Console、Functions ログ、対象画面で結果を確認する。

Storage Rulesに`firestore.get()`または`firestore.exists()`が含まれる場合、coordinatorはStorage Rulesを含むデプロイ承認を求める前に、利用者へ次を明示して通知する。

- 対象Firebase project ID・aliasと、Storage Rulesをデプロイすること。
- Firebase CLIまたはConsoleがStorageとFirestoreの連携許可を求める可能性があること。
- 許可時にFirebase Storage service accountへ`Firebase Rules Firestore Service Agent` roleが付与されること。
- 許可が付与済みか、初回promptで付与できたか、権限不足で失敗したかをデプロイ結果として報告すること。
- デプロイ後に正常Userと拒否対象UserのStorage accessを確認し、連携roleが欠ける場合のfail-closedを検出すること。

共通Auth identity gateまたは再構築認可を使うFunctionsをデプロイする場合、実行service accountがFirebase Authentication Userの参照権限を持つことを事前に確認し、Codexは次回deploy承認前に利用者へこの確認を通知する。デプロイ後の開発環境では、同社の有効な実行者による正常実行と、Auth無効・claim不一致・User無効・他社指定など各APIの拒否をFunctions logと画面結果で確認する。権限不足によるAuth参照失敗はfail closedとして検出し、権限を推測で追加せず対象project・service account・必要roleを確認する。

開発環境の生成、Firebase alias の切り替え、デプロイを連続して行うスクリプトも定義されています。

```powershell
npm run deploy:dev
```

このコマンドは外部環境を変更するため、対象プロジェクトと差分を確認し、明示的承認を得た場合だけ実行します。

## 関連パッケージの更新

`air-guard-v2-schemas` の開発版をルートアプリと Cloud Functions の両方へ反映する場合:

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npm run install:schemas@dev
```

公開元でのバージョン作成・タグ push・Trusted Publishing は`governance/project-rules.md`と次の手順に従います。ローカルから`npm publish`しません。

1. `air-guard-v2-schemas`のbranchとworktreeを確認し、変更をcommitする。
2. `npm version prerelease --preid=dev`を実行する。
3. current branchと作成された`v*-dev.*` tagを個別にpushする。`--follow-tags`は使用しない。
4. `.github/workflows/publish.yml`のTrusted Publishingと`npm view @shisyamo4131/air-guard-v2-schemas@dev version`で公開結果を確認する。
5. pushだけが失敗した場合は`npm version`を再実行せず、既存commit・tagを確認して失敗したpushだけを再開する。

## 出力と成功確認

- Nuxt の生成物: `dist/`
- Cloud Functions のログ: Firebase Console または `npm run logs`（`functions/`）
- Emulator UI: `firebase.json` のポート設定に従う
- Hosting: 対象 Firebase プロジェクトの Hosting URL
- Stripe: Webhook 配送履歴、署名検証結果、Company の同期状態

成功はコマンド終了だけで判断せず、対象環境、ログ、データ、主要画面をユーザーが確認します。

## Git統合

- 作業単位ごとにユーザーとbranch境界を相談し、原則として機能単位の `codex/<機能名>` ブランチを合意済み基準から作成する。開始時に現在ブランチ、基準コミット、作業ツリーを確認する。
- Codexはlocal branch作成・切替、review済みfileのstage・commit、差分確認を担当する。ユーザーの未コミットapplication codeを独自判断で修正、破棄、stage、commitしない。
- 専門タスクは担当ファイルだけを編集・検証し、原則としてステージやコミットを行わない。
- 専門タスクはチェックポイントID、正確な変更ファイル、差分、テスト、未確認事項、承認境界、作業ツリー状態をコーディネーターへ報告する。
- コーディネーターは差分と仕様・ロードマップとの整合を確認し、合意済み作業単位のreview済みfileだけをステージ、コミット、統合する。ユーザー実装をcommit対象に含める場合は対象差分と検証状態をユーザーと確認する。専門タスクが既にコミットを作成している場合は、確認後に再利用する。
- 並行書込みでは共通の基準コミットとチェックポイントIDを使用し、担当ファイルを重複させない。限定された一群を統合・検証してから次の共通基準へ昇格する。
- 未統合の変更を、別タスクの確定済み依存関係として扱わない。統合待ちがある場合は新規割当より統合を優先する。
- ユーザーは機能ブランチ上の動作を確認する。明示的な受入れ承認を得るまで `main` へマージしない。
- `main` へは原則としてマージコミットを作成し、機能単位の統合境界を残す。競合解消後に関連テストとガバナンス検証を再実行する。
- `main` への直接コミット、`main` へのマージ、Git push、履歴書換え、デプロイは、それぞれユーザーが対象操作を明示した場合だけ行う。
- 受入れ後に問題が判明した場合は、機能単位のマージコミットをrevert可能か、データ・契約互換性を確認する。安全にrevertできない場合は修正ブランチと移行・復旧手順を用意する。

## プロジェクト管理タスクループ

長期作業は、定時確認ではなくタスク間通知を用いたイベント駆動型を標準とします。

### 開始確認

1. コーディネーターと専門タスクのID・ホスト、作業ツリーを記録する。
2. 現在のロードマップ、基準コミット、チェックポイントID、担当・禁止ファイル、承認境界を確認する。
3. 終了条件を記録する。標準は「安全に独立実行できる作業が尽きた時点」とする。
4. コールバック先を記録する。
5. タスク作成、交代、Codexアプリ再起動後は、ファイルを変更しない確認用チェックポイントを送り、次の形式のコールバックが1回到達することを確認する。

```text
<checkpoint-id> <completed|failed|question|approval-boundary>
files: <exact paths or none>
diff: <summary or none>
tests: <commands and results or not run>
unverified: <items or none>
approval-boundaries: <items or none>
worktree: <clean or exact dirty paths>
```

### 通常ループ

1. Codexが現行挙動、変更契約、影響、rollback、test条件を、利用者が理解・判断できる最小単位に整理する。
2. ユーザーの承認後、ユーザーがapplication codeを実装する。補助実装またはtest編集を委譲する場合だけ、Codexが明示された範囲を専門タスクへ割り当てる。
3. 専門タスクは完了、失敗、仕様質問、承認境界で一度だけ通知し、待機する。
4. コーディネーターはユーザーまたは専門タスクの差分、テスト、未確認事項、作業ツリー、仕様・ロードマップとの整合を確認する。
5. 合意済み変更をコミットし、必要な統合検証とdocument同期を行う。
6. 終了条件に達していなければ次のチェックポイントへ進む。

通常の割当・通知は利用者へ逐次報告せず、終了時または早期停止時に統合して報告します。承認、安全・外部作用・破壊的操作の境界、テスト失敗、仕様競合、進捗低下、タスク・作業ツリー消失、状態取得・コールバック障害、容量閾値は直ちに報告します。突然の終了で統合報告できなかった場合は、再開後最初の確認で未報告期間をまとめます。

通知に失敗した専門タスクは再送を繰り返さず、完全な最終結果をそのタスクに残して停止します。コーディネーターは状態を安全に1回だけ再取得し、最新指示と照合できなければ同じ割当を再送しません。コールバックを利用できない場合、またはユーザーが明示した場合だけ差分型ポーリングへ切り替え、対象、間隔、停止条件を記録します。変更なしの確認は通知せず、確認間隔を作業期限とみなしません。

## Codexセッションのライフサイクル

### 容量確認

対象のタスクIDを指定して、作業開始、コールバックによる状態変更後、終了時に確認します。状態変化がない場合は1時間に1回を上限とします。タスクIDを指定せず「最新ファイル」を選ぶ方法は、並行タスクがある場合に使用しません。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-codex-session-size.ps1 -SessionId <task-id>
```

- コーディネーターのセッション閾値: 300 MiB
- Codex全体の参考警告値: 2 GiB。これは削除を自動実行する基準ではない。
- 容量スクリプトは `.codex/sessions` のJSONLとCodexルート全体を読み取る。業務データや秘密情報の本文は出力しない。

### 安全な引継ぎ

1. 300 MiB到達時は新規割当と自動レビューを停止する。
2. 基準コミット、ロードマップ進捗、実行中・待機中チェックポイント、未統合ブランチ、テスト、承認事項、承認境界、次の指示をリポジトリの正本へ記録する。
3. 旧コーディネーターは自身の完了変更を検証・コミットする。専門タスクは担当ファイル、差分、テスト、未確認事項、作業ツリー状態を報告し、コーディネーターが受入れた変更をコミット・統合する。
4. 文書検証と必要なテストを実施し、作業ツリーがクリーンであることを確認する。
5. 未コミット例外が不可避な場合は、ファイル、目的、検証状態、コミットできない理由、所有者、再開手順を正本へ記録する。同じ差分を旧新タスクへ重複所有させない。
6. コーディネーター交代についてユーザーの明示承認を得る。専門タスクは、安全なチェックポイントで差分統合済みの場合だけ自動交代できる。
7. 履歴をforkせず、同じ基本名に次の連番を付けた新規タスクを作成する。
8. 旧タスクID、基準コミット、チェックポイント、進捗、結果、テスト、未統合作業、承認事項、担当・禁止範囲、次の指示、コールバック先を送る。
9. 新タスクがリポジトリから状態を復元し、割当先とコールバックIDを更新できたことを確認する。プロジェクトの承認方針、権限プロファイル、自動レビュー設定を使用する場合は、それらも確認する。
10. 変更なしコールバックと、新タスクによる最初の実ファイル限定ステージ・コミットを確認してから旧タスクをアーカイブする。失敗時は旧タスクを維持し、重複割当を行わない。
11. アーカイブ後に、アクティブ・アーカイブ済みを含む容量を再測定する。

アーカイブは状態またはUI上の操作であり、物理削除や保存容量の縮小を保証しません。Codexが所有するSQLite、WAL、セッション記録の直接削除や定常的な `VACUUM` は通常運用に含めません。

## Windows PC移行

AirGuardV2とCodex local taskを別のWindows PCへ移す場合、Git repositoryを作業状態の正本とし、Codexのlocal thread復元は補助経路として扱います。新旧PCでWindowsユーザー名とprojectの絶対pathを一致させます。AirGuardV2の標準pathは`C:\Users\seven\projects\AirGuard\air-guard-v2`です。

ChatGPT desktop app for WindowsはWindows nativeとWSL2の両方を選択できます。現在のAirGuardV2 coordinatorはWindows native、PowerShell、保存済みrepositoryへ直接接続するlocal taskです。新PCでも最初はこの構成を維持し、WSLを移行作業の途中で追加・有効化しません。WSLへ切り替える場合は、Windows側`C:\Users\<user>\.codex`とWSL側`/home/<user>/.codex`が別の保存先になることを前提に、別の承認済み移行として扱います。

### 1. 旧PCで作業を確定する

1. application、Emulator、server、browser検証を停止し、専用loopback portにLISTENがないことと`.codex-test/runtime`が空であることを確認します。
2. AirGuardV2と内部`air-vuetify-v3`、同時に移す関連repositoryについて、branch、HEAD、`git status --short`を記録します。
3. 未コミット差分を残しません。未統合branchにupstreamがない場合、remote cloneでは復元できないため、`.git`を含むrepository全体のcopyとGit bundleを両方作成します。pushは代替手段ではなく、別の明示承認が必要です。
4. project-owned validator、managed governance validator、`git diff --check`、必要に応じて`git fsck --full`を実行します。application testを省略する場合は理由をhandoffへ記録します。
5. `.env`系file、利用者用`saved-data`、`.codex-test/saved-data`はGit外の重要local dataとして、内容を表示せず存在、件数、容量だけを確認します。秘密情報と実dataを含み得るため、暗号化された外付けdriveまたは同等の保護された媒体だけを使います。

### 2. Repositoryをbackupする

`<BACKUP_ROOT>`は暗号化された外付けdrive上の新規directoryへ置き換えます。`/MIR`は誤削除を伝播するため使用しません。次のcopyは`.git`、nested repository、`.env`系file、`saved-data`、`.codex-test/saved-data`を含み、再生成可能なdependencyとbuild生成物を除外します。

```powershell
$backupRoot = "<BACKUP_ROOT>"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
robocopy "C:\Users\seven\projects\AirGuard" "$backupRoot\AirGuard" /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /XD node_modules .nuxt dist .output
if ($LASTEXITCODE -ge 8) { throw "AirGuard repository backup failed: robocopy exit $LASTEXITCODE" }
```

copy破損と`.git`欠落に備え、各repositoryの全refをbundleへ保存します。内部`air-vuetify-v3`は親repositoryとは別のGit repositoryなので個別bundleが必要です。

```powershell
$bundleRoot = Join-Path $backupRoot "git-bundles"
New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null
$repoRoots = Get-ChildItem "C:\Users\seven\projects\AirGuard" -Directory | Where-Object { Test-Path (Join-Path $_.FullName ".git") }
foreach ($repo in $repoRoots) {
  git -C $repo.FullName bundle create (Join-Path $bundleRoot ($repo.Name + ".bundle")) --all
  if ($LASTEXITCODE -ne 0) { throw "Git bundle failed: $($repo.FullName)" }
}
git -C "C:\Users\seven\projects\AirGuard\air-guard-v2\air-vuetify-v3" bundle create (Join-Path $bundleRoot "air-vuetify-v3.bundle") --all
if ($LASTEXITCODE -ne 0) { throw "Git bundle failed: air-vuetify-v3" }
Get-ChildItem $bundleRoot -File | Get-FileHash -Algorithm SHA256 | Format-Table -AutoSize | Out-File (Join-Path $backupRoot "git-bundle-sha256.txt") -Encoding utf8
```

### 3. Codex local stateをbackupする

CodexのSQLite、WAL、JSONLを実行中にcopyしません。この手順を実行する前に本taskの最終応答を確認し、ChatGPT desktop app、Codex CLI、IDE extensionを完全に終了します。Task Managerでも関連processが終了したことを確認します。SQLiteを開いて編集、`VACUUM`、WAL削除、schema変更は行いません。

OpenAI認証は新PCで再実行します。`auth.json`はaccess tokenを含むためcopy対象にせず、repositoryや通常のbackupへ含めません。OS credential store、plugin、connector、Firebase CLI、Git hostの認証も新PCで再設定します。

local thread復元はOpenAIの正式なPC間import契約ではないためbest-effortです。経験上重要なthread DB、session JSONL、設定、個人skillだけを、app停止中にportable backupへcopyします。machine固有のsandbox、SID、installation ID、browser profile、worktree、log、cache、credentialはcopyしません。

```powershell
$codexSource = Join-Path $env:USERPROFILE ".codex"
$codexTarget = Join-Path $backupRoot "codex-portable"
New-Item -ItemType Directory -Path $codexTarget -Force | Out-Null
foreach ($name in @("sessions", "archived_sessions", "attachments", "skills", "rules", "plugins")) {
  $source = Join-Path $codexSource $name
  if (Test-Path $source) {
    robocopy $source (Join-Path $codexTarget $name) /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ
    if ($LASTEXITCODE -ge 8) { throw "Codex backup failed: $name" }
  }
}
foreach ($name in @("config.toml", ".codex-global-state.json", ".codex-global-state.json.bak", "session_index.jsonl")) {
  $source = Join-Path $codexSource $name
  if (Test-Path $source) { Copy-Item -LiteralPath $source -Destination $codexTarget -Force }
}
Get-ChildItem $codexSource -File | Where-Object { $_.Name -match "^(state_5|memories_1|goals_1)\.sqlite($|-shm$|-wal$)" } | Copy-Item -Destination $codexTarget -Force
Get-ChildItem $codexTarget -Recurse -File | Get-FileHash -Algorithm SHA256 | Sort-Object Path | Format-Table -AutoSize | Out-File (Join-Path $backupRoot "codex-portable-sha256.txt") -Encoding utf8
```

`auth.json`、`.sandbox-secrets`、`.sandbox`、`.sandbox-bin`、`cap_sid`、`installation_id`、`browser`、`computer-use`、`worktrees`、`logs_*.sqlite*`、`queue_*.sqlite*`、cache、tmpはportable backupへ含めません。他projectのCodex worktreeに未統合差分がある場合は、そのproject側で別途clean handoffまたはGit bundleを作成します。

### 4. 新PCの基盤を準備する

1. Windowsユーザー名を旧PCと同じ`seven`にし、projectを同じ絶対pathへ配置できることを確認します。表示名ではなく`C:\Users\seven`になることを確認します。
2. Windows Update、Git、Node.jsを導入します。Cloud FunctionsはNode.js 22を要求するため、rootと`functions`のlockfileを使えるNode.js 22環境を優先します。
3. ChatGPT desktop appをMicrosoft Storeまたは公式OpenAI Docs記載の`winget install --id 9PLM9XGG6VKS -s msstore`で導入します。
4. 最初はWindows nativeとPowerShellを選び、WSLを有効化しません。sandboxとapproval profileを旧PCと同等に設定します。
5. 外付けdriveをmalware scanし、bundleのSHA-256を再計算してmanifestと一致することを確認します。

### 5. Repositoryとlocal dataを復元する

1. ChatGPT desktop appを閉じた状態で`$backupRoot\AirGuard`を`C:\Users\seven\projects\AirGuard`へcopyします。新規PC側に同名directoryがある場合は`/MIR`や無条件上書きを使わず、退避してから復元します。
2. AirGuardV2のbranch、HEAD、clean worktree、内部`air-vuetify-v3`と関連repositoryのHEAD・cleanを確認します。期待したrefが欠ける場合は、copy元を変更せずGit bundleから別directoryへcloneして照合します。
3. `.env`系file、利用者用`saved-data`、`.codex-test/saved-data`の存在・件数・容量を確認します。値、credential、実dataをterminalやCodex応答へ出力しません。
4. `node_modules`はcopyせず、rootと`functions`でlockfileを確認して`npm ci`により再生成します。package更新、`npm audit fix`、lockfile変更は移行作業へ混ぜません。
5. `.output`、`.nuxt`、`dist`は復元しません。Codex用buildは実行ごとの明示承認が必要であり、mandatory build identity gateが完了するまで旧生成物を受入れ証拠に使いません。

### 6. Codexを復元する

1. ChatGPT desktop appを一度起動してOpenAIへ再loginし、Windows nativeであることを確認して完全に終了します。CLIを使う場合は`codex login status`で認証方式を確認します。
2. 新PCが生成した`C:\Users\seven\.codex`を別名で退避します。portable backupから`config.toml`、skill、rule、plugin、session、attachment、thread DB関連fileを、app停止中に復元します。新PCの`auth.json`、sandbox、SID、installation IDは上書きしません。
3. appを起動し、PM（AirGuardV2）-05 taskが表示され、本文を読めるか確認します。表示されてもrepository identityとCWDを確認するまでは続きを実行しません。
4. thread復元に失敗した場合、SQLiteやWALを修復・編集しません。新PC側`.codex`の退避へ戻し、利用者の明示承認後に新しい連番coordinator taskを保存済みrepositoryへ直接接続し、repositoryのhandoff記録から再開します。
5. pluginとconnectorは個別に再loginし、permissionを確認します。credentialやsession copyを接続確認の代替にしません。

### 7. 変更なしrestore checkpoint

新PCで最初に`PC-MIGRATION-RESTORE-001`を実行します。このcheckpointではapplication、test、Rules、Firebase設定、Emulator、server、browser、remote、external serviceを変更・起動しません。

- cwdとGit top-levelが`C:\Users\seven\projects\AirGuard\air-guard-v2`そのもの。
- branch、handoffに記録したHEAD、root clean。
- `air-vuetify-v3`と関連repositoryのHEAD、clean。
- common governance、active instruction sources、公式進捗、承認境界、mandatory restart 4項目。
- `.env`系file、`saved-data`、`.codex-test/saved-data`は内容を表示せず存在・件数・容量だけ照合。
- project-owned validator、managed governance validator、`git diff --check`が成功。
- Windows native、PowerShell、sandbox、approval、callback destinationが期待どおり。

変更なしcheckpointと、その後の最初の実file限定commitを確認するまで旧PCとbackupを消去しません。新PCでの復元後も、remote、Dev、Prod、利用者用local、実data、external service、push、deploy、main mergeは個別承認なしに実行しません。

参考情報は[OpenAI DocsのWindows app](https://learn.chatgpt.com/docs/windows/windows-app)、[Codex authentication](https://learn.chatgpt.com/docs/auth)、[Codex configuration](https://learn.chatgpt.com/docs/config-file/config-basic)を優先します。2026-03-05の[Windows PC移行経験記録](https://note.com/umarketing/n/n1359dbc60fe1)は、同一ユーザー名・pathとWindows/WSL保存先の分離を確認する補助資料として扱い、製品仕様の正本にはしません。

## ガバナンス文書の確認

Managed governanceの再生成と検証:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/render-governance.ps1 -ProjectPath .
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath .
```

`governance/common-governance.md`、lock、renderer、managed validator、生成`AGENTS.md`は直接編集せず、承認済みのskill syncで更新します。project固有規則は`governance/project-rules.md`を更新し、rendererとvalidatorを上記の明示path引数で実行します。

Project-owned文書・設定の検証:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1
```

相対MarkdownリンクとGitHub互換見出しアンカー、重要文書の索引到達性、ADR索引と本文の状態、ロードマップの重み・得点・無部分加点・索引進捗を確認します。Node.jsから正式なTOMLパーサーを使用し、`.codex/config.toml` と専門エージェントTOMLの構文、必須キー、型、名前、sandbox modeを確認します。アプリケーションのビルドや外部接続は行いません。

検証器自体の陰性試験:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1
```

## エラーと復旧

- 生成失敗: 最初のエラー、Node/npm バージョン、環境変数名、依存関係差分を確認する。
- Emulator 接続失敗: `NUXT_PUBLIC_FIREBASE_USE_EMULATOR`、ホスト、端末からの到達性、ポートを確認する。
- デプロイ失敗: 対象 alias、認証、権限、CLI 出力を確認し、失敗した限定操作だけを再実行する。
- Functions の部分失敗: 冪等性と重複実行の影響を確認してから再試行する。
- Stripe Webhook 失敗: 署名、イベント ID、対象会社、再配送時の重複反映を確認する。
- PWA 更新問題: Service Worker、キャッシュヘッダー、登録状態を確認し、利用者データを失う一律削除を安易に案内しない。

デプロイ後の復旧は、原則として Git 上の既知の正常版を再生成・再デプロイします。データスキーマ変更を伴う場合は、コードだけを戻して安全かを先に確認します。

## バックアップと保持

- 既存資料では Firestore のスケジュールバックアップが記載されているが、対象プロジェクト、スケジュール、保持期間、復元演習の現状は未確認である。
- データ移行前は、対象データと復旧手順を定め、必要なバックアップが取得済みであることを人が確認する。
- Storage、Authentication、Stripe の状態は Firestore バックアップだけでは完全に復元できない。
- 文書と仕様の履歴は Git で保持する。

## 秘密情報

- `.env` 系ファイルの値、Firebase Admin 資格情報、Stripe Secret、Webhook Secret をコミット・文書化しない。
- ローカル Stripe Secret は `functions/.secret.local`、デプロイ環境は Firebase Secret Manager を使用する設計である。
- ログや障害報告へ実際の個人情報、顧客情報、勤怠、請求、トークンを貼らない。

## 現在利用不可または要確認

- Codex専用local suiteはAuth、Firestore・Storage Rules、再構築Callable、全会社メール重複確認Callableのhandlerを確認する。Functions transport、Realtime Database Rules、UI、外部サービスの自動回帰testは未整備である。
- 正式運用の監視、SLA、バックアップ保持期間、復旧目標は未確定。
- Stripe の本番 Secret、Webhook、プラン、キャンセル、従業員数制限の運用状況は環境ごとに確認が必要。
