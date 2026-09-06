# local Emulator検証runbook

- 状態: 運用中
- 最終確認日: 2026-08-28
- 役割: Firestore baseline、利用者用local環境、Codex専用Emulator test

## Firestore instance baseline

2026-08-27にFirebase CLI 15.28.1とgcloudの独立したread-only requestでDev環境を再確認した。

| 項目 | 確認値 |
|---|---|
| Firebase project | `air-guard-v2-dev`（`.firebaserc`の`default`・`dev` alias） |
| Database | `(default)` |
| Edition | `STANDARD` |
| Type | `FIRESTORE_NATIVE` |
| Location | `asia-northeast1` |
| Delete protection | `DELETE_PROTECTION_DISABLED` |
| Point-in-time recovery | `POINT_IN_TIME_RECOVERY_ENABLED`、保持`604800s`（7日） |

edition依存のFirestore実装またはreleaseを開始するときは、本baselineをDev環境deploy runbookのprocess-scoped trust経路で確認する。Firebase CLIとgcloudを独立したread-only requestで確認し、対象projectまたはdatabase構成が変更されている場合だけ値を更新する。

Prod環境`air-guard-v2`のdatabase editionと保護設定は未確認であり、deploy判断へ流用しない。

ローカル用設定でホストを公開する場合:

```powershell
npm run local
```

Firebase Emulator Suite は `firebase.json` で Auth、Functions、Firestore、Realtime Database、Storage、Hosting、Emulator UI を構成しています。起動前に使用プロジェクトと `.env.local` のエミュレーター設定を確認してください。

Firebase CLIはWindowsユーザーのglobal npm領域へ導入する。releaseではcheckpointへ記録したinstalled executableとversionを固定し、`npx -y firebase-tools@latest`による暗黙導入・更新を行わない。実行file不存在、破損、またはversion固有問題が確認された場合だけ、CLI更新をrelease本体と分離した変更として扱う。AirGuardV2のCodex専用Emulator scriptはglobal `firebase` commandを使用し、npm/npxのoffline cacheを実行前提にしない。CLI更新で回帰した場合は、直前に確認済みのversionへ戻して再検証する。

Windows上のFirebase CLIは`C:\Users\seven\.config\configstore\firebase-tools.json`を参照する。Codexのworkspace sandbox内ではこの参照が`EPERM`になることを確認済みであるため、Firebase CLIを起動するCodex専用Emulator suite（`npm run test:local`、専用seed、専用UI Emulatorを含む）は、既存のCodex専用demo data承認境界に基づき最初からsandbox外の承認済みprocessとして実行する。sandbox内で一度失敗させることを前提にしない。demo project、loopback bind、合成data、外部作用denyのpreflightは省略せず、network、利用者用local環境、Dev、Prod、remote service、実dataへ許可を広げない。

利用者が画面確認用のlocal環境を起動する場合は、利用者用の保存済みデータを読み込みます。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npx -y firebase-tools@latest emulators:start --import=./saved-data
```

- 明示的な指示なしに `--export-on-exit` を指定しない。
- CLIが未起動サービスから本番へ到達する可能性を警告した場合、対象コードとテスト操作を確認し、外部作用を排除できなければテストしない。
- FunctionsからStripe、メール、FCM、ジオコーディングなどの外部サービスを呼ぶ操作は、個別に隔離できることを確認する。

## Codex専用localテスト

Codexの自動テストは、利用者用`./saved-data`、通常の`firebase.json`、`.env.local`を変更しません。[ADR 0014](../decisions/0014-codex-dedicated-local-test-data.md)に従い、Git対象外の`.codex-test/saved-data`へ合成fixtureだけを保存します。

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

標準Harnessでは、runnerが子processの`AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS`を試験専用の合成tenant `codex-emp05-d-archive`だけへ固定する。親processの広い許可集合を結合・継承せず、終了時は成功・失敗とも元の有無と値へ戻す。Seedや他suiteでは子の許可設定を除去する。これはDのHTTP試験を再現するための専用設定で、製品の既定拒否、UI検証会社の許可、通常API公開を変更しない。

旧CCB pre-containment専用testとpackage scriptsは2026-08-30のcorrective rollbackで削除した。Company Rulesの現行回帰は通常の`npm run test:local`と`test/domain/firestore-rules-reservation-source-contract.test.mjs`を使用する。旧専用commandを実行手順として案内しない。

- 実行前にglobal `firebase` commandが利用可能であることを確認する。正式運用開始まではglobal CLIをlatestへ更新してよい。
- `--import=.codex-test/saved-data`を使い、`--export-on-exit`は指定しない。
- 実行前後に利用者用`./saved-data`と専用exportの指紋を比較し、変化した場合は失敗する。
- `.codex-test`が50 MiB以上なら警告し、100 MiB以上ならEmulator起動前に停止する。通常は20 MiB以下を目標とする。
- 一時ログと子スクリプトは`.codex-test/runtime`だけに作り、終了時にproject配下であることを確認して削除する。
- CodexのSQLite、WAL、セッション記録へテスト成果物を書かない。タスク容量は`check-codex-session-size.ps1`で別に監視する。
- `.codex-test/saved-data`、`.codex-test/ui-candidate`、`.codex-test/isolated-saved-data`、専用runtimeまたは通常のCodex専用test sessionにある合成dataの作成・変更・削除、予約migration、candidate acceptance・promotionは、操作ごとの利用者承認を必要としない。利用者用`./saved-data`、Dev、Prod、remote service、実dataは対象外とし、CodexまたはBrowserの上位安全policyが要求するaction-time confirmationは省略しない。
