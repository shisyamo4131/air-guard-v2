# Dev deployの認証とWindows環境

- 状態: Confirmed
- 最終確認日: 2026-09-09
- 役割: GitHub Actions標準経路が使えない場合のlocal Firebase CLI認証とWindows固有のtrust経路
- 対象: `air-guard-v2-dev`

## 適用条件

標準のDev deployは[GitHub Actions手順](github-actions.md)を使う。利用者PCの`firebase login`や保存済みサービスアカウント鍵は前提にしない。この文書はActions障害の原因調査、またはcommit・service・実行者を固定して別承認されたlocal fallbackに限って使う。

認証失敗を理由に自動でlocal fallbackへ切り替えない。Actionsの失敗点を確定し、再実行またはfallbackのどちらを採用するか決める。

## Local認証の基本方針

Firebase CLIはdeployを実行する道具であり、`firebase login`は認証方法の一つにすぎない。このPCにはDevサービスアカウント鍵とFirebase CLIに保存済みの利用者accountがある。どちらをlocal fallbackに使うかは、対象serviceの権限と鍵へ広い権限を持たせる影響を踏まえて決定する。

同じ`firebase deploy`でも、利用者accountとサービスアカウントはFirebase上の別の実行者であり、権限も別である。利用者が通常のPowerShellで実行すると保存済みの利用者loginが選ばれ、本文の一時設定を使うとサービスアカウントに固定される。release checkpointには実行者と認証経路を記録する。

サービスアカウント認証が成功しても、すべてのserviceへのdeploy権限があるとは限らない。2026-09-09の[preflight記録](../../verification/dev-service-account-preflight.md)では次の結果だった。

| 対象 | サービスアカウントのdry-run | 現在の判断 |
|---|---|---|
| Hosting | 成功 | dry-run範囲は利用可能。実deployの成功までは保証しない |
| Functions | 失敗 | 少なくとも実行service accountを使用する権限が不足 |
| Firestore Rules | 失敗 | Rules検査権限が不足 |
| Firestore Indexes | 失敗 | Indexes操作権限が不足 |
| Storage Rules | 失敗 | Rules検査権限が不足 |
| Realtime Database Rules | 成功 | dry-run範囲は利用可能。実deployの成功までは保証しない |

同じ6対象を保存済みの利用者accountでdry-runした結果はすべて成功した。この記録は保存済みlocalサービスアカウントの結果であり、GitHub Actions専用アカウントの能力を示さない。現在のlocalサービスアカウントを全service共通のdeploy実行者とは扱わない。対象serviceのdry-runが失敗するreleaseは、必要なIAM権限を別途承認して付与するか、利用者accountを実行者として固定するまで開始しない。dry-run成功も実際の書込み権限を完全には保証しないため、初回実deployは対象を限定し、結果とrollbackを記録する。

## 実行者の選択

| 経路 | 利用条件 | 特徴 |
|---|---|---|
| サービスアカウント | 本文の一時設定を使い、対象serviceのpreflightが成功 | Codexや機械実行で利用者loginに依存しない。現在は一部serviceの権限不足 |
| 利用者account | 利用者loginと対象serviceの権限を確認 | 利用者がFirebase CLIを直接実行できる。loginの失効時は再認証が必要 |

どちらもFirebase CLI、明示したDev project、`--only`で限定したservice、同じ固定artifactを使う。違いはFirebase側から見た実行者だけであり、利用者が同じサービスアカウント設定を使って実行するならCodex実行との認証上の違いはない。

| 用語 | この手順での意味 |
|---|---|
| `AIRGUARD_DEV_CREDENTIAL_PATH` | Devサービスアカウント鍵の保存場所を、安全にFirebase CLIへ渡すためのproject独自環境変数 |
| `GOOGLE_APPLICATION_CREDENTIALS` | Googleのtoolが鍵の保存場所を認識するための標準環境変数 |
| Firebase CLI | Hosting、Functions、Rules等を`firebase.json`に従ってdeployする実行手段 |
| `firebase login` | 利用者accountをFirebase CLIへ保存する任意の代替認証 |

サービスアカウント鍵はrepository、文書、応答、log、永続的な追加設定へ複写しない。path、秘密鍵、token、account emailを表示しない。`FIREBASE_TOKEN`と`--token`は使わない。

## サービスアカウント認証の準備

releaseごとに新しいPowerShell processを使う。現在のprocessへ安全に渡されている`AIRGUARD_DEV_CREDENTIAL_PATH`を、UserまたはMachine scopeから読み直して上書きしない。

次の検査は値を表示せず、設定、通常file、JSON、credential種別、Dev project一致だけを確認する。

```powershell
$credentialPath = $env:AIRGUARD_DEV_CREDENTIAL_PATH
if ([string]::IsNullOrWhiteSpace($credentialPath)) { throw "Dev credential is not configured." }
if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) { throw "Dev credential file is unavailable." }
$credentialItem = Get-Item -LiteralPath $credentialPath -Force
if (($credentialItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Dev credential must be a regular file." }
$credential = Get-Content -LiteralPath $credentialPath -Raw | ConvertFrom-Json
if ($credential.type -ne "service_account") { throw "Dev credential type is invalid." }
if ($credential.project_id -ne "air-guard-v2-dev") { throw "Dev credential project is invalid." }
if ([string]::IsNullOrWhiteSpace($credential.client_email) -or [string]::IsNullOrWhiteSpace($credential.private_key)) { throw "Dev credential is incomplete." }
```

Firebase CLIには次のprocess内だけで鍵の場所を渡す。

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = $credentialPath
Remove-Item Env:FIREBASE_TOKEN -ErrorAction SilentlyContinue
```

Firebase CLIは保存済みの利用者loginを先に選ぶことがある。サービスアカウント経路を混在させないため、一時的なFirebase CLI設定領域を作り、このrelease processだけで使う。

```powershell
$firebaseConfigHome = Join-Path ([IO.Path]::GetTempPath()) ("airguard-firebase-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $firebaseConfigHome -ErrorAction Stop | Out-Null
$env:XDG_CONFIG_HOME = $firebaseConfigHome
```

## Firebase CLIとread-only preflight

2026-09-09時点で確認済みの実行fileは`C:\Users\seven\AppData\Roaming\npm\firebase.cmd`、versionは`15.28.1`である。release checkpointには実際に使うpathとversionを記録する。

```powershell
$firebaseCli = "C:\Users\seven\AppData\Roaming\npm\firebase.cmd"
if (-not (Test-Path -LiteralPath $firebaseCli -PathType Leaf)) { throw "Firebase CLI is unavailable." }
$env:NODE_USE_SYSTEM_CA = "1"
& $firebaseCli --version
if ($LASTEXITCODE -ne 0) { throw "Firebase CLI version check failed." }
```

対象serviceのread-only commandへ`--project air-guard-v2-dev`を明示し、token refresh、project到達、必要なread権限を実要求で確認する。account一覧や設定表示だけでは代用しない。raw JSONを表示せず、project一致、resource ID、状態、件数など許可した項目だけを記録する。

Rulesを含むreleaseでは、実変更前に次のdry-runを独立実行できる。dry-runはdeploy権限のすべてや実反映の成功を保証しない。

```powershell
& $firebaseCli deploy --project air-guard-v2-dev --only firestore:rules --dry-run --non-interactive
if ($LASTEXITCODE -ne 0) { throw "Firestore Rules dry-run failed." }
```

認証失敗時は、別の実行者やgcloud・RESTの直接deployへ自動で切り替えない。鍵の読取り、token取得、対象project、IAM、APIの順に失敗箇所を確定し、credentialや権限の変更が必要なら停止する。

## 一時設定のcleanup

Firebase CLIの最後のcommandが終了したら、同じPowerShell processで一時環境変数と設定領域を削除する。削除前に対象がOSの一時directory内であることを確認する。

```powershell
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
Remove-Item Env:XDG_CONFIG_HOME -ErrorAction SilentlyContinue
Remove-Variable credential, credentialItem, credentialPath -ErrorAction SilentlyContinue
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$configHome = [IO.Path]::GetFullPath($firebaseConfigHome)
if (-not $configHome.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "Unexpected Firebase config path." }
Remove-Item -LiteralPath $configHome -Recurse -Force
```

## gcloudを使う場合のWindows trust

gcloudはFirebase CLI deployの代替ではない。snapshot、Firestore metadata確認など、release checkpointでgcloudの使用を固定した場合だけ本節を使う。

このPCでは、system Pythonからpip同梱`truststore`を当該processだけへ注入し、Cloud SDKの`gcloud.py`を実行する経路が確認されている。`NODE_USE_SYSTEM_CA`はgcloudのPython通信には適用されない。

```powershell
python -c "from pip._vendor import truststore; truststore.inject_into_ssl(); import runpy,sys; sys.argv=['gcloud','firestore','databases','describe','--project=air-guard-v2-dev','--database=(default)','--format=json(name,locationId,type,pointInTimeRecoveryEnablement,versionRetentionPeriod)']; runpy.run_path(r'C:\Users\seven\AppData\Local\Google\Cloud SDK\google-cloud-sdk\lib\gcloud.py',run_name='__main__')"
```

Firebase CLIの成功をgcloudの成功の代用にせず、gcloudを使う場合だけ独立確認する。TLS検証無効化、出所不明CA、certificateのimport・delete、persistentなCA設定、token本文の表示は行わない。

この経路を確認した過去の実行結果は[Company設定互換性記録](../../implementation/company-configuration-compatibility.md)を参照する。
