# AirGuardV2 運用・開発手順

## 現在利用できる運用

- Nuxt 開発サーバーの起動
- Firebase Emulator Suite を使うローカル確認環境
- 開発・本番設定による静的生成
- Firebase Hosting、Functions、Firestore Rules/Indexes、Storage Rules、Realtime Database Rules のデプロイ
- メンテナンス状態とキルスイッチの切り替え
- Firestore のスケジュールバックアップ（既存資料上の記載。現在の設定はデプロイ前に再確認する）

Devの静的生成、デプロイ、remote検証は、対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を含む利用者承認済みのbounded release checkpointとして実行します。Prod、Secret登録、新しいdata migration、破壊的repairは別の明示的承認と環境確認を必要とします。

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

Firebase CLIはWindowsユーザーのglobal npm領域へ導入し、正式運用開始まではlatestを使用する。新規PCまたは更新時は`npm install -g firebase-tools@latest`を実行し、`firebase --version`で確認する。AirGuardV2のCodex専用Emulator scriptはglobal `firebase` commandを使用し、npm/npxのoffline cacheを実行前提にしない。CLI更新で回帰した場合は、直前に確認済みのversionを`npm install -g firebase-tools@<version>`で再導入して戻す。

Windows上のFirebase CLIは`C:\Users\seven\.config\configstore\firebase-tools.json`を参照する。Codexのworkspace sandbox内ではこの参照が`EPERM`になることを確認済みであるため、Firebase CLIを起動するCodex専用Emulator suite（`npm run test:local`、専用seed、専用UI Emulatorを含む）は、既存のCodex専用demo data承認境界に基づき最初からsandbox外の承認済みprocessとして実行する。sandbox内で一度失敗させることを前提にしない。demo project、loopback bind、合成data、外部作用denyのpreflightは省略せず、network、利用者用local環境、Dev、Prod、remote service、実dataへ許可を広げない。

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

初回、fixture変更時、または破損からの再生成時だけ、専用seedを作成します。

```powershell
npm run test:local:seed
```

- `demo-air-guard-v2-codex`だけを使い、remote Firebase projectを選択しない。
- Auth、Firestore、Realtime Database、Storageを`127.0.0.1`の専用ポートで起動する。
- Functions Emulatorは起動しないため、FCM、Stripe、ジオコーディングの実呼出し経路を含まない。
- 合成会社・合成利用者だけを作成し、実在データ、`.env.local`のアカウント、利用者用`./saved-data`を複製しない。
- 既に対象の専用exportがある場合は上書きせず失敗する。Codexは対象path、demo project、容量、指紋、復旧方法を確認したうえで、専用saved-dataを削除・再生成でき、操作ごとの利用者承認を必要としない。

通常テストは専用exportを読込専用で使用します。

```powershell
npm run test:local
```

- 実行前にglobal `firebase` commandが利用可能であることを確認する。正式運用開始まではglobal CLIをlatestへ更新してよい。
- `--import=.codex-test/saved-data`を使い、`--export-on-exit`は指定しない。
- 実行前後に利用者用`./saved-data`と専用exportの指紋を比較し、変化した場合は失敗する。
- `.codex-test`が50 MiB以上なら警告し、100 MiB以上ならEmulator起動前に停止する。通常は20 MiB以下を目標とする。
- 一時ログと子スクリプトは`.codex-test/runtime`だけに作り、終了時にproject配下であることを確認して削除する。
- CodexのSQLite、WAL、セッション記録へテスト成果物を書かない。タスク容量は`check-codex-session-size.ps1`で別に監視する。
- `.codex-test/saved-data`、`.codex-test/ui-candidate`、`.codex-test/isolated-saved-data`、専用runtimeまたは通常のCodex専用test sessionにある合成dataの作成・変更・削除、予約migration、candidate acceptance・promotionは、操作ごとの利用者承認を必要としない。利用者用`./saved-data`、Dev、Prod、remote service、実dataは対象外とし、CodexまたはBrowserの上位安全policyが要求するaction-time confirmationは省略しない。

#### UWB-04 User予約migration

`scripts/migrate-user-reservations.mjs`はFirestoreのUserを監査し、全Userのemail予約とEmployee予約を再構築する。既定はdry-runで、対象ごとにproject、Emulator routing、資格情報をAdmin SDK初期化前に検査する。`codex-local`は専用demo projectと`127.0.0.1:18080`だけを許可する。`user-local`は利用者用`air-guard-v2-dev` Emulatorと`127.0.0.1:8080`だけを許可し、Devと同じcreate-only制約で動作する。`dev`はEmulator routingを拒否し、明示されたDev service account資格情報のproject・identityを検査する。Prod targetは提供しない。

```powershell
# 専用Emulatorをcandidate importで起動した別process内の環境を使用する
node scripts/migrate-user-reservations.mjs --target codex-local

# dry-runが出力したplanDigestと同じ状態にだけ適用する
node scripts/migrate-user-reservations.mjs --target codex-local --apply --plan-digest <64文字のdigest>

# apply後に再度dry-runし、cleanを確認する
node scripts/migrate-user-reservations.mjs --target codex-local
```

利用者用EmulatorでDev適用前のcreate-only経路を確認する。

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
node scripts/migrate-user-reservations.mjs --target user-local
node scripts/migrate-user-reservations.mjs --target user-local --apply --plan-digest <64文字のdigest>
node scripts/migrate-user-reservations.mjs --target user-local
```

Dev実環境はmaintenance開始と必要なbackup確認後に、次の3 commandを個別processとして実行する。`<DEV_SERVICE_ACCOUNT_JSON>`の値と秘密鍵本文をlog・応答・repositoryへ出さない。

```powershell
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
$env:GOOGLE_APPLICATION_CREDENTIALS = "<DEV_SERVICE_ACCOUNT_JSON>"
node --use-system-ca scripts/migrate-user-reservations.mjs --target dev

node --use-system-ca scripts/migrate-user-reservations.mjs --target dev --apply --plan-digest <64文字のdigest> --confirm-project air-guard-v2-dev --confirm-backup

node --use-system-ca scripts/migrate-user-reservations.mjs --target dev
```

- dry-runで変更予定がある場合の終了codeは2、data blockerは3である。applyはblocking findingが1件でもあればwrite 0で停止する。
- canonical email重複、同社Employee重複、不正User状態、dangling Employee、予約のmissing・malformed・mismatch・orphanを監査する。
- `codex-local` applyが変更できるのは、missing予約のcreateと、旧pointer先Userが不存在で競合再検査に合格したstale pointerのupdateだけである。`user-local`と`dev`はmissing予約のcreateだけを許可し、updateを含むplanはwrite 0でblockする。すべてのtargetで予約delete、User、Employee、Authenticationのwriteは行わない。
- reportは分類別件数、計画digest、opaque subject hashだけを出力し、email、氏名、company ID、User ID、path、document bodyを出力しない。
- `.codex-test/saved-data`を直接上書きしない。candidate importへdry-run・apply・再dry-runを行い、backend verifierと既存candidate acceptance/promotion gateを通した後だけsnapshotを置換する。Codex専用candidateでの操作は個別承認を要しない。利用者用`saved-data`は事前backupとexport candidate検証なしに上書きしない。
- Dev applyはmaintenance、必要なbackup、直前dry-run、利用者の実data migration承認、project名とbackup確認flagを必須とする。dry-run後にUser・Employee・予約が変化するとdigestまたはtransaction再検査で停止する。途中失敗で一部create済みの場合は予約を推測削除せず、再dry-runして残りのcreateだけを再計画する。
- Dev rollbackは自動deleteやUser/Auth変更を行わない。公開前の追加予約は既存runtimeに参照されないが、削除が必要な場合は事前・事後証拠から本migrationが新規作成したexact reservationだけを特定し、別のrepair・実data操作承認で扱う。Prod migrationは未提供である。

UWB-03までに確認したsuiteは、専用seed、Authサインイン、Firestore・Storage Rules、旧公開Callableを含む72件である。UWB-04では`functions/apis/index.js`の公開Callableを12件へ更新し、旧global availability testを退役させた。2026-08-21にemail/Employee予約fixture、予約Rules、仮登録作成・削除、本登録変換、初期管理者作成、cross-tenant emailとEmployeeのconcurrencyを含む専用Emulator suite 74件を確認した。2026-08-25には会社管理者専用`listLifecycleOperations`、20/21件cursor paging、同時刻document ID tie-break、exact projection、actor拒否、cursor failure統一、LifecycleOperations client read denyを含む専用Emulator suite 92件を確認し、追加composite indexが不要であることを実queryで確認した。2026-08-26にはcurrent Auth disabledの全UWB-07 mutation Callable拒否、仮User削除前後の退職境界、完了済み旧退職の再送が同emailの別tenant新User・予約・新Auth UIDまたはAuth-only accountへ作用しないことを追加し、suite 96件を確認した。Realtime Database Rules、画像圧縮、実端末FCM、外部API、Authentication削除triggerのevent transportは未対象である。

### Codexだけで完結するlocal UI test

2026-08-25にNuxt開発サーバーを使う自己完結経路を再確認した。Codexが専用Emulator、Functions、Nuxt、インアプリブラウザを順に管理し、Nuxt/Viteを十分に予熱してから初回navigationすることで、reloadなしに製品topへ到達するcold restartを3回連続で確認した。続けて保存済み合成Auth accountでsign-inし、`/dashboard`へ到達した。HTTP 200または起動templateだけは成功証拠ではない。正規signupからのbaseline再生成はこの最小経路とは別の受入れである。外部作用は専用Functionsでdenyし、専用UIではPWA module、Service Worker登録、通知permission、FCM token登録を無効化する。

標準の起動・確認・終了順序は次のとおりとする。

Windows上でCodexがこの経路を実行する場合、Firebase CLIだけでなくNuxt開発サーバーも、最初からworkspace sandbox外の承認済み前景processとして起動する。sandbox内ではNuxtのdependency解決がfilesystem read制限で停止することが既知であるため、成功しない予備起動を試してから再起動する手順にしない。これは既存のCodex専用demo project、loopback、合成data、外部作用denyの承認境界に限ったprocess実行方法であり、network、利用者用local環境、Dev、Prod、remote service、実dataへの許可拡張ではない。

1. 専用portが未使用で、`.codex-test/saved-data`にexport metadataとAuth fixtureがあることを確認する。
2. `npm run test:local:ui:emulators`を独立した前景processで起動し、`All emulators ready`まで待つ。
3. `npm run test:local:ui:server`を別の前景processで起動する。このwrapperは専用dotenvのexact allowlist、demo project、loopback emulator設定を値を出力せず検証し、`AIR_GUARD_EXTERNAL_EFFECTS=deny`を固定してからNuxtを同じ前景processで起動する。`Vite client warmed up`とNitro readyを待ち、loopback rootと初回読込みで発見したVite/Nuxt entry・plugin moduleをbounded probeする。同じmodule集合を2巡し、全requestがHTTP 200で完了してからbrowserを開く。requestがpending、timeout、非200ならnavigationへ進まず停止する。
4. Codexインアプリブラウザで`http://127.0.0.1:14600/`を初めて開く。visibility機能が利用可能な場合は操作開始前に表示を要求し、その状態を報告する。利用者が監視する場合もChrome profileではなく同じCodex Desktop内のtabを使う。
5. 製品landmarkが現れるまでbounded waitし、起動templateを成功証拠にしない。予熱後も起動templateが残る場合はreloadを通常手順にせず失敗として停止し、Nuxt/Vite readiness、module request、console、FUT-0005・FUT-0008・FUT-0096・FUT-0178の既知再発要因を診断する。
6. 可視UIからsign-inへ移動し、保存済み合成accountを通常のkeyboard入力で使用して対象画面へ到達する。
7. Codexが作成したtabを閉じ、Nuxt、Emulatorの順に停止し、専用portがLISTENしていないことを確認する。

インアプリブラウザはCodex Desktop内の専用browserであり、利用者のChrome profileを使用しない。利用者が目視を希望する検証ではvisibilityを要求し、同じtabを監視対象にする。visibility状態を機械的に取得できない場合は、利用者が実際に監視できた事実とtool上の未確認を分けて報告する。Chrome拡張経路は、利用者が既存sessionを使う受入れまたはインアプリブラウザ障害の補助経路であり、標準のCodex専用UI testの前提ではない。

`.codex-test/saved-data/auth_export/accounts.json`には実在情報を含まない検証済み合成Auth accountを保存する。2026-08-20時点のUI snapshotは、正規管理者signup UIから作成した管理者1件だけを含む。通常起動は`--import .codex-test/saved-data`だけを使い、確認済みのCodex管理ブラウザ認証sessionを再利用する。sign-in credentialはtracked repository、応答、検証logへ保存・出力しない。browser sessionを喪失した場合は、対象が専用loopback Auth Emulatorの保存済み合成accountであることを確認し、running Emulator内だけへrandom alphanumeric passwordを一時設定してよい。saved-dataを更新せず、停止後に同じcredentialを再利用可能と扱わない。永続管理が必要になった場合はrepository外の保護済みlocal credential storeと復旧手順を別途確定するまで平文保存しない。Rules・Callable test用の`CODEX_LOCAL_USERS`とは分離し、いずれもlocal demo project以外へ使用しない。起動ごとにaccountを作成せず、既存snapshotを読取り利用する。snapshot破損時だけ、candidate生成・backend assertion・promotion手順で置換し、通常のUI testから`--export-on-exit`で上書きしない。

Codex専用demo Emulator、loopback限定、外部作用deny、実在情報を含まない合成accountという承認済み境界内では、保存sessionの再利用または合成credentialの通常keyboard入力によるsign-inのたびに利用者へ再承認を求めない。credentialは画面へ入力する直前まで表示せず、repository、応答、command出力、検証logへ残さない。接続先が利用者用local環境、Dev、Prod、remote serviceまたは実dataへ変わる場合はこの継続承認を適用しない。

`npm run test:local:seed`が生成する`.codex-test/isolated-saved-data`はRules・Callable test用であり、UI用`.codex-test/saved-data`を生成・更新しない。UI snapshotの更新はcandidate受入れ・promotion手順だけで行う。

インアプリブラウザで`type=password`への通常typingが利用できない場合は、専用loopback demo accountの一時credentialに限って、製品の可視なpassword表示切替controlを通常pointerで操作し、可視fieldへ一文字ずつkeyboard入力した直後に再maskする。平文表示中はscreenshot、DOM snapshot、console、networkその他のread-only観測も行わない。入力値をtool outputへ含めず、終了時にEmulatorを停止してcredentialを失効させ、実行前後のsaved-data file数・SHA-256指紋が一致することを確認する。実account、利用者用local、Dev、Prod、remote serviceではこのfallbackを禁止し、通常のsecure credential入力を利用できなければ未検証として停止する。

ブラウザUIの挙動・受入れ証拠は次の操作契約に従う。

- UI受入れで作成・編集・削除する業務dataは、実在情報を含まないテスト値を使いつつ、製品の可視UIと正規application処理経路から作成する。Firestore、Authentication、client SDK、Emulator API、Admin SDK、seed scriptによる直接注入で対象状態を作らない。
- 非UI fixture、import、backend APIは、sign-in actorや環境baselineの準備、またはUI操作後のread-only assertionに限定する。UIで正規作成できる対象を非UIで作成してUI受入れの代用にしない。
- 作成と削除を検証する場合は、同じtest sessionで可視UIから正規作成したdataを対象に可視UIから削除し、backend assertionで作成結果、削除結果、非対象serviceの不変を確認する。
- 可視・有効で通常のactionability条件を満たすcontrolを、通常のpointer clickまたはkeyboardで操作する。文字入力はfocusした可視controlへ一文字ずつ行い、削除・選択・確定も利用者が行うkeyまたは可視UIで実行する。
- `locator.click()`相当は通常のpointer入力経路とactionabilityを満たす場合だけ許可し、`pressSequentially()`相当はfocusした可視controlへ通常のkey eventを順に送る場合だけ許可する。mechanismを確認できない場合はmouse・keyboard操作へ切り替える。
- Chrome拡張への接続・再接続または利用者tabの再取得直後は、上部のデバッグ開始表示によるviewport変化が完了するまで3秒待つ。座標操作は待機後の最新screenshotまたは可視DOMから対象を取り直して1回だけ行い、接続前・中断前の座標を再利用しない。操作が中断または無反応だった場合は、対象状態とserver到達有無を確認してから再試行し、同じ変更を重複実行しない。
- `fill`、`clear`、DOMの`value`・`checked`・`selected`等の変更、scriptによるwrite、`dispatchEvent`、`element.click`、event handler・component method・`requestSubmit`・client API/SDKの直接呼出し、force-click、disabled・hidden・overlay回避を禁止する。shortcut型の選択・check・file設定を利用者操作の代用にしない。
- 初期URLのopenとreloadは環境準備として許可するが、route発見性や画面内navigationの証拠には数えない。以後の遷移は可視UIから行う。
- tool-nativeのread-only DOM・ARIA、text、属性、disabled状態、URL、screenshot、console、networkは観測に使用できる。read-only script評価は状態を変更しない診断に限定し、credential、password、token、OOB code、入力値を出力しない。
- clean browser contextの準備、Authentication EmulatorのOOB確認、backend verifier、candidate export/importは非UI処理である。結果は`UI user-equivalent action`、`non-UI setup`、`backend assertion`へ分け、UI成功の代用にしない。
- 許可された実利用者相当操作をtoolが実行できない場合は、DOMやeventを直接操作して回避せず未検証と報告する。

Emulatorと開発サーバーは、次の2つの独立した前景processとして起動する。`Start-Process`、detach、background helperは使用しない。

```powershell
npm run test:local:ui:emulators
npm run test:local:ui:server
```

Windows上のCodex管理ブラウザでは、Nuxt開発サーバーがHTTP 200を返しても、Viteの初回module変換中にSPA hydrationが完了しない事象を確認した。2026-08-25にEmulator ready、`Vite client warmed up`、2巡のmodule probeを初回navigationより前へ置くことで、reloadなしの製品top到達を3回連続、sign-inからdashboard到達を1回確認した。初回module集合はsource変更で変わり得るため件数を固定せず、各実行でrootから発見した集合を記録する。専用build serverはdev経路がこのready契約を満たしても失敗する場合の診断用fallbackとする。プロジェクト規則のbuild禁止は維持されるため、Codexがbuild経路を再実行する場合は、その都度明示承認を得る。生成した`.output`は検証後に削除する。

承認済みの専用buildは`npm run test:local:ui:build`だけを使用する。このcommandはbuild前後にroot worktreeがcleanで同じHEADであること、専用dotenvがallowlist済みのdemo project・loopback・Emulator設定だけであることを確認し、成功した`.output`へ設定SHA-256とsource HEADを含むidentity markerを作成する。`npm run test:local:ui:server:generated`はmarkerの欠損・破損、現在のdotenvまたはHEADとの差、dirty worktreeのいずれでもgenerated serverをimportせず停止する。markerを手動作成・更新してはならない。実buildとgenerated serverの受入れ確認は引き続き実行ごとの明示承認を必要とする。

正規signup後のexportは直ちに専用saved-dataへ昇格せず、`.codex-test/ui-candidate`へ置く。candidate importを起動し、backend verifierへ正規signupで使用した合成email、会社名、会社名カナ、表示名を`CODEX_UI_SYNTHETIC_EMAIL`、`CODEX_UI_SYNTHETIC_COMPANY_NAME`、`CODEX_UI_SYNTHETIC_COMPANY_NAME_KANA`、`CODEX_UI_SYNTHETIC_DISPLAY_NAME`として渡して`npm run test:local:ui:candidate:accept`を実行する。この処理はUI証拠ではなくbackend assertionであり、合格時だけcandidate directory SHA-256とclean source HEADを`.codex-test/ui-candidate-acceptance.json`へ記録する。実在情報やpasswordを渡さない。verifierは会社名カナを正規signup入力と完全一致で確認し、会社名カナ形式・40文字境界と、claim company ID・Auth UIDが単一の安全なFirestore path segmentであることを検証してからURL encodeしてGETする。

backend verifierのtransport契約は分離する。Authentication account列挙はAuth Emulator `127.0.0.1:19099`の`accounts:query`へJSON bodyを伴うPOSTを1回だけ行う。CompanyとUserはFirestore Emulator `127.0.0.1:18080`へbodyなしGETを各1回行う。Auth helperからFirestoreへ、Firestore helperからAuthへ到達せず、いずれも外部hostを使用しない。このbackend assertionをbrowser UI操作の証拠として数えない。

promotion前にCodex管理browser、generated server、Emulatorを停止する。`npm run test:local:ui:promote`は専用port `14400`、`14500`、`14600`、`15001`、`18080`、`19000`、`19099`、`19199`のLISTENがなく、acceptance receiptとcandidateの再計算SHA-256・現在のclean source HEADが一致する場合だけ`.codex-test/saved-data`を置換する。candidate変更、source変更、receipt欠損、process残存時は変更前に停止する。receiptと既存saved-dataは置換前にruntimeへ退避し、置換失敗時は復旧する。置換後のbackup削除だけが失敗した場合はpromotionを維持して`cleanup_required`を返し、対象runtime backupを明示する。

`scripts/run-codex-local-ui-child.ps1`を使うprocess管理案はNortonに`IDP.Generic`として検出されたため破棄・revertした。隔離解除、allowlist登録、同方式の復元を行わない。現在の前景commandはこのhelperに依存しない。

完成条件は次のとおりとする。

1. `demo-air-guard-v2-codex`と通常local環境とは異なるloopback portだけを使用する。
2. CodexがAuth、Firestore、Realtime Database、Storage、必要なFunctions、local serverを起動し、Codexが起動したprocessだけを終了する。
3. sign-in actorと環境baselineは再生成可能な専用fixtureから準備できる。UI受入れ対象の仮登録Userや必要な業務documentは、架空のテスト値を使って製品の可視UIと正規application処理経路から作成する。
4. Functionsから外部API、Stripe、mail、FCM、通知、ジオコーディング等へ到達しないことを陰性testまたは明示拒否設定で確認する。
5. Codex管理ブラウザが実利用者相当のpointer・keyboard操作だけでlocal appを開き、合成accountでsign-inし、対象画面を操作できる。非UI setup・backend assertionは別証拠として記録する。
6. 利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataが実行前後で変更されない。
7. 終了時にserverとEmulatorを停止し、一時runtimeをproject配下の明示pathだけから削除する。失敗時も同じcleanupと状態報告を行う。

2026-08-17の旧基準による受入れでは、専用suite 72件、UI設定契約9件、専用build、dashboard表示、dashboard滞在中のconsole error 0件、全専用port閉鎖、`.codex-test/runtime`空、`.output`削除を確認した。ただし`fill`等を含む旧操作証拠は新基準の受入れには再利用しない。サインアウト直後に購読解除前のFirestore snapshot listenerが2件の`permission-denied`を出す既存挙動は残っており、製品側のlogout cleanup課題として扱う。

2026-08-19のレビュー後再試験では、専用dotenv exact allowlistと外部作用拒否のpreflight、保存Auth fixture 2件、saved-data fingerprint、全専用port未使用、Emulator importと全service ready、Nuxt/Vite/Nitro ready、loopback HTTP 200を確認してからインアプリブラウザを開いた。起動template後の一回限定reloadで製品topを確認し、可視button clickと一文字ずつのkeyboard入力だけでsign-inして`/dashboard`へ到達し、dashboard滞在中のconsole errorは0件だった。終了後は全専用port閉鎖とsaved-data fingerprint不変を確認した。visibilityは`false`のままで利用者目視だけは未達である。network host一覧のbrowser証拠は取得しておらず、exact configとdemo projectのEmulator fail-closed出力を非UI証拠とする。

2026-08-20のUWB-03受入れでは、fresh専用Emulator上で初期会社管理者を正規signup UIから作成し、Authentication EmulatorのOOB確認だけを非UI setupとして行った。User一覧から単独仮登録Userを、Employee詳細からEmployee連携仮登録Userをそれぞれ可視UIで作成し、取消、削除中、成功を確認した。別tabで先に削除した対象へ古い確認dialogから再実行する競合では`Item to delete not found.`を表示し、画面を壊さず失敗した。削除後のbackend assertionはAuth 1件と管理者User 1件だけが残り、3件の仮登録Userが不存在であることを確認した。Employee作成時は外部geocoding拒否による既知のconsole errorが1件出たが作成・User連携・User削除は完了した。正規signup後の管理者だけをcandidate受入れ・promotion経路で`.codex-test/saved-data`へ昇格し、通常import、HTTP 200、Auth/User各1件、`/dashboard`復帰、console error 0件、終了時全専用port閉鎖、saved-data fingerprint不変を再確認した。Firebase CLIがWindows上でexport一時directoryのrenameを`EPERM`にしたため、Emulatorが残した最新の完全exportについてworkspace内、metadata、容量上限、candidate未存在を検証してcandidateへ移し、通常のacceptance verifierとpromotion gateを通した。

2026-08-21のUWB-04受入れでは、既存の専用snapshotを読込専用で起動し、Employeeを正規UIで作成した後、Employee詳細から合成emailと既知role `human-resource`を指定してEmployee連携仮登録Userを作成した。作成後のbackend assertionで仮登録User、Employee link、role、email予約、Employee予約が一致し、Authentication accountが存在しないことを確認した。同じEmployee詳細UIから仮登録Userを削除し、User・両予約・Authenticationが不存在でEmployeeだけが残ることを確認した。UI操作は通常のpointer clickと一文字ずつのkeyboard入力だけを使った。Employee作成時のconsole errorは外部geocodingをfail-closedで拒否した既知の`FirebaseError: internal` 1件だけだった。終了後は全専用port閉鎖、runtime空、saved-dataのfile数・容量不変、root worktree cleanを確認した。

同日のpermission分離後再受入れでは、保存済み合成管理者から正規UIで`human-resource`仮登録Userを作成し、一般User signupとAuth EmulatorのOOB確認を経てhuman-resourceとしてdashboardへ到達した。通常submitのpage reload中断と、Employee User dialogでcustom role slotが空でもgeneric `roles` fieldが残る問題を修正した。human-resourceのactor Userが`roles=["human-resource"]`であること、作成dialogの入力がemail 1 fieldだけでrole controlが存在しないことを確認した。正規UIでEmployeeとEmployee連携仮登録Userを作成し、作成後は`roles=[]`、Employee link、email・Employee予約pointer、Authentication不存在をbackend assertionした。同じUIから仮登録Userを削除し、User・両予約・Authentication不存在とEmployee残存を確認した。終了後は全専用port閉鎖、saved-data 7 files・3492 bytes不変を確認した。

#### UWB-04 利用者向け最小UI確認一覧

機能branchを利用者が確認するときは、次を最小確認とする。Dev・Prod・実dataではなく、承認済みlocal環境の合成dataを使用する。

- User設定で、会社管理者または`users:write`を持つ既知roleから単独仮登録Userを作成でき、email・表示名が一覧へ表示される。2026-08-21時点のUser一覧には明示的な「仮登録」表示はなく、Employee詳細だけが「仮登録」を表示する。
- Employee詳細で、未紐付けの在職Employeeへemailを指定して仮登録Userを作成でき、email・仮登録状態が表示される。会社管理者と`users:write`を持つmanagerは任意の既知roleを指定できる。`users:provision`だけを持つhuman-resourceにはrole選択を表示せず、serverも非空rolesを`permission-denied`で拒否する。
- 作成dialogの取消ではUserが作成されず、確定の連打中は二重作成されない。
- 作成した単独／Employee連携仮登録Userを同じ画面から削除でき、削除後は未登録表示または一覧からの不存在へ戻る。
- permissionなし、既登録・管理者・無効・他社・既に紐付いたEmployeeなどの拒否対象では作成・削除actionが提供されないか、安全なerrorで終了する。
- Employee作成時の外部住所・geocoding失敗はUser作成結果と分けて確認し、外部作用denyを解除しない。

2026-08-21に利用者が上記最小UI確認を実施し、単独／Employee連携の作成、取消、削除、表示・操作感を受入れた。User一覧に「仮登録」表示がない点を確認したうえでUWB-04の利用者testをOKとした。

#### UWB-07 利用者向けlocal UI確認一覧

UWB-07/08の自動検証完了後、利用者用local環境のテストデータで次を確認する。実データ、remote、Dev、Prod、deployは使用しない。

1. `human-resource` Userでは、他の在職Employee詳細に「退職処理」が表示され、自分自身と会社管理者に紐づくEmployeeでは表示されないこと。退職日・20文字以内の理由、取消、未来日拒否を確認する。
2. Employee-only対象を退職すると「現在在職していません」となり、Employeeが残ること。会社管理者で「誤退職を訂正する」を実行すると同じEmployeeが在職へ戻り、退職日・理由が消えること。
3. 本登録User連携Employeeを退職するとEmployeeは残り、User一覧から対象Userが消え、旧accountでsign-inできないこと。誤退職訂正後も旧User/Authは自動復元されず、必要ならEmployee連携Userを別操作で再登録する案内が表示されること。
4. 会社管理者のUser管理で、Employee未連携・非管理者・本登録Userに「アカウント削除」が表示されること。理由・取消・最終確認を確認し、削除後に一覧から消えて旧accountでsign-inできないこと。仮登録、Employee連携、自己、会社管理者には表示されないこと。
5. 退職・User削除・訂正を連打しても対象単位のloading中に再送されず、成功後にdialogが閉じること。失敗時は画面が壊れず再試行できること。
6. `firestore.rules`でUsersのclient create/update/delete、Employee lifecycle field/delete、lifecycle ledger/event/lock/head、FcmTokens updateが拒否される方針を確認すること。

会社管理者専用の履歴一覧readerと利用者による`firestore.rules`確認は完了した。Firestore Rules全体に残る広いtenant内write、App Check、Dev/Prod/remote受入れが完了するまでdeploy可能とは扱わない。

`LifecycleOperations`は現段階で固定保存期限を設けず、自動削除しない。削除を前提とするlegal hold、terminal後UID縮小、purge command・scheduled jobは提供しない。data量、法令・社内規程、privacy、費用、運用上の必要性から見直しが必要と判断した場合は、実dataへ作用する前に参照chain、誤退職訂正、移行、backup・復旧を含む新しい仕様とrollbackを承認する。

履歴一覧readerは`/settings/lifecycle-history`から`listLifecycleOperations`だけを呼び、会社管理者へ新しい順に20件ずつ表示する。clientから会社ID、件数、検索、filter、sortを送らず、cursorは画面・URL・永続store・storage・analytics・consoleへ出さない。page移動失敗時は現在pageを維持し、権限喪失、sign-out、page離脱時にitemsとcursor stackをmemoryから破棄する。Emulator受入れでは会社管理者の3操作・3公開状態・前後page、他roleとsuper-userのroute/Callable拒否、raw UID・内部error非表示、ledger/event/lock/headのclient直読拒否を確認する。実装前後を通じてRulesをreaderのために緩和しない。

2026-08-25と26の利用者Chrome受入れでは、ログイン済み会社管理者が可視navigationの管理者menuから「退職・アカウント削除履歴」へ到達し、loading、空状態、無効な前後buttonを確認した。対象環境に履歴dataがない場合、実page移動のためだけに21件の退職・削除を作らない。data行のexact projection、20/21件境界、cursorによる次page・前page再取得は単体・Emulatorで直接検証し、Chromeは実route、認可された到達、読み込み、empty、button状態を受け持つ。この分離をlocal受入れの完了証拠とする。

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

利用者用local環境そのものの受入れが必要な場合は、Codex専用UI testと混在させず、次の準備をユーザーが行った後にCodexがサインイン済みChromeタブを引き継ぐ補助経路を使います。

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
5. デプロイ対象と影響を確認し、Prodは対象操作の明示的承認後、Devは承認済みbounded release checkpoint内で `firebase deploy` または限定デプロイを行う。
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

このコマンドは外部環境を変更するため、対象プロジェクトと差分を確認します。Devでは承認済みbounded release checkpoint内、Prodでは別の明示的承認後だけ実行します。完了証拠では静的生成とFirebase deployの結果・終了statusを分離するため、通常は次のcommandを独立して実行します。

```powershell
npm run generate:dev
firebase deploy --project air-guard-v2-dev
```

### Dev maintenance deployment・migration標準checkpoint

Devは正式運用開始前の試行環境であり、正式運用準備roadmapの未完了をdeploy禁止理由にしない。一方で実account・実dataを持つため、変更を無制限に即時反映せず、次の一つのbounded checkpointをDev deploy、data migration、remote受入れの再利用可能なひな型とする。個別migrationはこのひな型に、対象collection、plan、dry-run、apply、post-check、固有rollbackを追加する。

1. **release固定**: branch、full commit、clean worktree、root/Functions dependencyのversion・resolved・integrity、対象Firebase service、local test、未検証範囲を記録する。複数段階の未統合差分や未commit scriptを実dataへ使用しない。
2. **cutover承認**: 対象project、release commit、静的生成、Rules、Functions、Hosting、data影響、backup、rollback、停止条件、受入れを一つのcheckpointとして利用者が承認する。checkpoint内の各deploy commandに同じ承認を繰り返さない。新しいmigration、破壊的repair、対象拡張、Prodは別承認とする。
3. **maintenance開始**: `air-guard-v2-admin-sdk`で`npm run cli:dev -- system status`、`maintenance-on`、`status`を独立実行する。`maintenance-toggle`は使わない。Dev画面が`/maintenance`へ遷移することを確認し、Devへ接続したlocal server・browser、User管理操作、他operator作業を停止してin-flight requestを収束させる。System maintenanceはclient route制御であり、Rules、Functions、Admin SDK、既に開始したwriteを物理的に停止しない。
4. **整合snapshot**: maintenance開始後の完了済みUTC分を`--snapshot-time`へ指定し、固有prefixのCloud StorageへFirestore全体を`gcloud firestore export`する。`--async`を使わず、command exit、operation `done`、error不在、output URI、metadata objectを独立確認する。exportは復旧証拠だが、snapshotに存在しない追加documentをimportだけで削除できるとは扱わない。
5. **server境界deploy**: clientより先に、releaseで変更したFirestore Rules/Indexes、Storage Rules、Realtime Database Rules、Cloud Functions、共有contractを整合した単位でdeployする。認証改修では予約Functionだけを選択せず、role・permission、User/Auth作成・更新・削除、lifecycle、concurrencyを含む全変更Functionsを導入する。deploy成功、runtime/service account権限、公開Function集合、logを確認し、旧revisionの開始済み処理が収束する時間を置く。
6. **fresh migration**: server deploy完了後に対象dataをread-only dry-runし、件数、blocking finding、plan digestを記録する。承認済み固有apply条件を満たす場合だけmigrationを実行し、直後の再dry-runでcleanを確認する。dry-run後のdata変化、digest不一致、競合、部分失敗はfail closedとし、推測deleteや自動rollbackを行わない。
7. **client deploy**: Dev用静的生成を独立実行し、release commitとの対応を確認してHostingをdeployする。古いtab・cache済みJavaScriptが残ってもserver側が最終認可を行うことを確認し、利用者へreloadまたは再sign-inを求める。
8. **maintenance中検証**: deployed revision、Rules、Functions、Hosting、migration post-check、主要正常経路、role・tenant・disabled・stale inputの拒否、Functions log、秘密情報非出力を確認する。メンテナンス画面だけを全機能成功の証拠にしない。
9. **解除と受入れ**: 全必須check成功後だけ`maintenance-off`と`status`を独立実行する。新しいbrowser sessionでsign-in、role別control、User/Auth lifecycle、主要画面を確認する。失敗した場合は直ちにmaintenanceへ戻し、未確認状態で運用を継続しない。
10. **失敗・rollback**: server deploy前の失敗は変更を適用せず停止する。server deploy後またはmigration後の失敗はmaintenanceを維持し、新契約に沿うcorrective releaseまたは証拠付きrepairを使用する。予約backfill後に予約を保守しない旧Functionsへ戻してtrafficを再開せず、npm unpublish、force push、history rewrite、推測data削除に依存しない。

各stepのcommand、結果、独立exit status、remote operation ID、対象commit、data件数、未確認事項をcheckpoint evidenceとして残す。正式運用開始可否はこのDev checkpointの成功だけでは確定せず、Devで得た証拠を正式運用準備roadmapへ反映する。

## 関連パッケージの更新

`air-guard-v2-schemas`の公開済みversionをルートアプリとCloud Functionsへ同時に反映する場合、security・authorizationに関係するcatalog変更では`@dev`やrangeを使わず、承認済みのexact versionを両方へ指定する。UWB-09で確認済みのversionは`2.4.2-dev.166`である。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npm install --save-exact @shisyamo4131/air-guard-v2-schemas@2.4.2-dev.166
Push-Location functions
npm install --save-exact @shisyamo4131/air-guard-v2-schemas@2.4.2-dev.166
Pop-Location
```

各commandのexit statusを独立して確認し、ルートとFunctionsの`package.json`、`package-lock.json`、実installについてversion、resolved tarball、integrityが一致することを検証する。role preset catalogの導入では、公開`./constants` importへ全callerを移行してからlocal catalogを削除し、client strict判定、Functions strict判定、一般client互換判定を別々に回帰確認する。公開packageの存在だけでconsumer導入成功とはみなさない。

UWB-09のconsumer rollbackは、AirGuardV2の依存をexact `2.4.2-dev.164`へ戻し、両local catalogとpackage import以前のcatalog参照を同時に復元する。ただし、旧実装のtruthyな`ROLE_PRESETS[role]`判定は復元せず、local catalogに対する`typeof role === "string" && Object.hasOwn(ROLE_PRESETS, role)`相当のprototype-safe membershipをstrict経路と一般展開へ維持する。`toString`、`constructor`、`__proto__`を含む陰性testとpolicy/parity testを再実行し、rollback自体を別のconsumer変更としてreviewする。公開済みpackageのunpublish、tag削除、force push、history rewriteには依存しない。

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

1. コーディネーターと専門タスクのID・ホストを記録し、全taskのcwdとGit top-levelが利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`そのものであることを確認する。Codex専用worktreeは作成・使用しない。
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
9. 新タスクが利用者repositoryへ直接接続し、repositoryから状態を復元し、割当先とコールバックIDを更新できたことを確認する。プロジェクトの承認方針、権限プロファイル、自動レビュー設定を使用する場合は、それらも確認する。
10. 変更なしコールバックと、新タスクによる最初の実ファイル限定ステージ・コミットを確認する。失敗時は旧タスクを維持し、重複割当を行わない。
11. Codexは旧taskのarchiveを実行・依頼せず、交代検証結果を利用者へ報告して待機する。利用者が旧taskをarchiveした後、必要に応じてアクティブ・アーカイブ済みを含む容量を再測定する。

アーカイブは利用者が行う状態またはUI上の操作であり、物理削除や保存容量の縮小を保証しません。Codexが所有するSQLite、WAL、セッション記録の直接削除や定常的な `VACUUM` は通常運用に含めません。

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
powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2
```

`governance/common-governance.md`、lock、renderer、managed validator、生成`AGENTS.md`は直接編集せず、承認済みのskill syncで更新します。project固有規則は`governance/project-rules.md`を更新し、rendererとvalidatorを上記の明示path引数で実行します。

上記は正規commandです。特にmanaged governance validatorの`-ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`を省略した短縮commandや、scriptのdefault project pathへ依存する呼出しを使用しません。

Project-owned文書・設定の検証:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2
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

- Codex専用local suiteはAuth、Firestore・Storage Rules、再構築Callable、UWB-04予約fixtureを含むUser lifecycle Callableのhandlerを確認する。Realtime Database Rules、外部サービスの自動回帰testは未整備である。
- 正式運用の監視、SLA、バックアップ保持期間、復旧目標は未確定。
- Stripe の本番 Secret、Webhook、プラン、キャンセル、従業員数制限の運用状況は環境ごとに確認が必要。
