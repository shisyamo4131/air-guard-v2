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

現在のsuiteは専用seed、Authサインインに加え、Firestore・Storage Rulesについてverified email、正常な会社claim、tenant path、有効な本登録User、恒久的なsuper-user bypass拒否を検証します。Companies本体、名前付きsubcollection、未定義descendant、SecurityReportIndexes・StripeDataの個別操作制約と、SecurityReportsのupload、list、metadata、download URL、byte download、deleteを確認します。さらに、Functions Emulatorを起動せず、正式な`functions/apis/index.js`から公開する10 Callableを読み込み、内部helperが非公開であることを確認します。再構築、全会社メール重複確認、signup用メール利用可否に加え、仮登録検索、管理者会社作成、一般User本登録・有効化・無効化・管理者移譲の入口guardを検証し、管理者会社作成はCompany、User、custom claimsの成功時整合と再実行も確認します。合計67件です。Realtime Database Rules、画像圧縮、Vue画面、実端末FCM、外部API、未確認CallableのFunctions transport、Authentication削除triggerのevent transportは未対象です。追加のFunctionsテストでは、外部作用をモックまたはfail-closedで隔離する変更案を提示し、別途承認を得ます。

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

認証後の画面操作が必要な場合は、Emulator専用アカウントを使用します。必要なアカウントがなければ、用途と権限を示してユーザーへ作成を依頼します。

### Codexのブラウザ操作に関する現在の制約

CodexのインアプリブラウザとChrome拡張による操作のどちらからもNuxtローカルサーバーの画面は取得できますが、現在の環境ではCodexがAuth Emulatorの `127.0.0.1:9099` へ直接接続してサインインを自動化する経路が、ブラウザ操作レイヤーで `ERR_BLOCKED_BY_CLIENT` として遮断されます。

認証後のUIテストは、次の準備をユーザーが行った後、Codexがサインイン済みChromeタブを引き継ぐ方式とします。

1. `--import=./saved-data` を付けてFirebase Emulatorを起動する。
2. `.env.local` を使ってローカルサーバーを起動する。
3. Chrome拡張が有効なプロファイルでChromeを起動する。
4. Emulator専用アカウントでサインインし、必要に応じてテスト対象画面まで移動する。
5. 画面の準備が完了したことをCodexへ伝える。

Codexは既存タブを引き継いだ後、SPAローディングテンプレートの表示を即時エラーとみなさず、画面遷移の完了または明確なタイムアウトまで待機します。データ作成・更新・削除を伴う操作は、ユーザーがテスト内容として明示的に許可した範囲だけで行います。テスト終了時はユーザーが起動したEmulator、ローカルサーバー、ChromeをCodex側から停止しません。

同一オリジンプロキシ、専用E2Eブラウザ、危険なChrome起動オプションなど、ユーザーの通常環境を変更する回避策は採用しません。将来、Chrome操作レイヤーからAuth Emulatorへ安全に直接接続できるようになった場合は、この条件を再検討します。

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
