# Dev環境deploy runbook

- 状態: Confirmed
- 最終確認日: 2026-08-27
- 対象: `air-guard-v2-dev`へのbuild、Firebase deploy、gcloud操作、remote検証
- 対象外: Prod、新しいdata migration、破壊的repair、未承認service・dataへの拡張
- 関連判断: [ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md)

## 目的と適用境界

Devは正式運用準備の完了前でも検証済み変更を積極的にdeploy・受入れする非本番試行環境である。実account・実dataを含むため、対象commit、Firebase project、service、data影響、backup、rollback、停止条件、検証を固定したbounded Dev release checkpointを先に承認する。同checkpoint内のbuild、deploy、remote検証はcommandごとの再承認を求めない。

すべてのDev deployへmaintenance、snapshot、migrationを適用しない。data contractまたはclient/server contractの整合cutoverが必要なreleaseだけが、それらを条件付きで使用する。新しいmigration、破壊的repair、対象service・data・期間の拡張、Prodは別承認とする。

## 2026-08-27に確認した実行環境

| 項目 | 確認済み経路 |
|---|---|
| Repository | `C:\Users\seven\projects\AirGuard\air-guard-v2`へ直接接続 |
| Firebase project | `air-guard-v2-dev`を全remote commandへ明示 |
| Firebase CLI | installed CLI `C:\Users\seven\AppData\Roaming\npm\firebase.cmd`、version 15.28.1 |
| Firebase/Node trust | 同じPowerShell processだけで`NODE_USE_SYSTEM_CA=1`を設定 |
| gcloud | system Python 3.12からpip同梱`truststore`をprocess内へ注入し、同一processでCloud SDKの`gcloud.py`を実行 |
| Firestore | `(default)`、`FIRESTORE_NATIVE`、`asia-northeast1`、PITR有効、保持`604800s` |

Firebase CLIとgcloudは異なるHTTP・trust経路を使う。Firebase CLIの成功をgcloudのtoken refresh成功の代用にせず、両方を独立確認する。

今回、Windows証明書storeから一時PEMをexportする経路、`CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE`、persistentな`core/custom_ca_certs_file`は成功経路として確認していないため標準手順にしない。TLS検証無効化、出所不明CA、無断certificate import/delete、access token・identity token本文の表示は禁止する。

## Release固定

remote接続前に次を独立commandで確認する。

```powershell
Get-Location
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
git worktree list --porcelain
```

release checkpointには次を記録する。

```text
release-id:
release-commit:
firebase-project: air-guard-v2-dev
services:
release-class:
data-impact:
local-validation:
build-command:
backup:
rollback:
stop-conditions:
remote-verification:
maintenance-required:
approved-migration-or-repair:
```

worktreeがdirty、HEAD不一致、primary repository以外のworktree、対象project・service・data影響が未確定の場合は停止する。未commit scriptや別commitのartifactをreleaseへ使用しない。

## CLIとtrustのpreflight

### Firebase CLI

CLIの存在とversionを先に確認する。存在して正常にversionを返す場合、TLS・token refresh・project・IAMの失敗をCLI未導入と決めつけて再installしない。

```powershell
$firebaseCli = "C:\Users\seven\AppData\Roaming\npm\firebase.cmd"
Test-Path -LiteralPath $firebaseCli
$env:NODE_USE_SYSTEM_CA = "1"
& $firebaseCli --version
```

remote到達確認は`--project air-guard-v2-dev`を付けた対象serviceのread-only commandで行う。JSONにruntime設定や秘密情報が含まれる可能性があるため、raw JSONをterminal、log、応答へ出さず、project、resource ID、状態、件数等のallowlist済みfieldだけを出力する。Firebase CLIがWindows user configstoreへアクセスするためにsandbox外processを必要とする場合、既存の承認・sandbox policyに従う。

`npx -y firebase-tools@latest`をrelease中に暗黙導入せず、checkpointへ記録したinstalled executableとversionを使用する。再installまたはversion変更は、実行file不存在、破損、またはversion固有問題の証拠がある場合に別の変更として扱う。

### gcloud

`NODE_USE_SYSTEM_CA`はgcloudのPython trustへ適用されない。2026-08-27に成功したread-only到達確認は次のprocess-scoped経路である。

```powershell
python -c "from pip._vendor import truststore; truststore.inject_into_ssl(); import runpy,sys; sys.argv=['gcloud','firestore','databases','describe','--project=air-guard-v2-dev','--database=(default)','--format=json(name,locationId,type,pointInTimeRecoveryEnablement,versionRetentionPeriod)']; runpy.run_path(r'C:\Users\seven\AppData\Local\Google\Cloud SDK\google-cloud-sdk\lib\gcloud.py',run_name='__main__')"
```

このcommandはWindows certificate storeを変更せず、truststore注入を当該Python processへ限定する。`pip._vendor.truststore`、Cloud SDK path、active credential、Dev projectへのtoken refreshを伴うread-only requestのいずれかが失敗した場合はremote変更前に停止する。`gcloud auth list`の表示だけをtoken refresh成功の証拠にしない。

gcloudを使うsnapshot等の変更commandは、同じtrust初期化方式と明示projectを使い、承認済みcheckpointの対象commandだけを実行する。汎用helperはまだ提供していないため、長いinline wrapperの変更や別commandへの一般化はreviewなしに行わない。

## Fail-fast診断

既知の成功経路を1回実行し、失敗したらrandom retry、再login、再install、環境変数の総当たりを行わず、最初に該当する層で停止する。

| 順序 | 分類 | 最初の確認 | 成功条件 | 禁止する誤判定 |
|---:|---|---|---|---|
| 1 | executable・version | exact path、version command | 記録済みCLIがexit 0 | TLS失敗を未導入と扱う |
| 2 | DNS・network・proxy | 最初のremote commandの接続error | 対象hostへ接続可能 | random retryで症状を消す |
| 3 | TLS・CA chain | certificate verification errorの有無 | 検証を無効化せずTLS成功 | 認証切れとして再loginする |
| 4 | credential読取り | CLIがcredential sourceを読めるか | 読取りerrorなし | token本文を表示する |
| 5 | token refresh | read-only API request | requestがexit 0 | active account表示だけで代用する |
| 6 | active account | 対象CLIのaccount metadata | 想定operator | account違いをIAM不足と扱う |
| 7 | target project | commandの明示projectと応答resource | `air-guard-v2-dev`一致 | default projectへ依存する |
| 8 | IAM | 対象APIのpermission response | read/deployに必要な権限あり | TLS・token失敗をIAMと扱う |
| 9 | API・service | 対象resourceのread-only確認 | service利用可能 | Prod確認をDevの代用にする |
| 10 | application・build | validator、test、release build | 対象artifact成立 | dev serverや別buildで代用する |

失敗層を解消した後は、その層のcommandから1回再確認する。別層の設定変更、persistent global設定、certificate import、login変更が必要なら、理由、影響、rollbackを提示して別承認を得る。

## Remote変更前の必須preflight

次がすべて成功するまでmaintenance、snapshot、deploy、migration、remote data変更を開始しない。

1. repository、branch、release commit、clean、primary-only worktreeを固定する。
2. Dev project、release class、対象service、data影響、backup、rollback、停止条件、検証を固定する。
3. Firebase CLI executable・version、Node trust、credential、Dev projectへのread-only到達を確認する。
4. gcloudを使用するreleaseでは、Python trust、token refresh、Dev projectへのread-only到達を確認する。
5. 対象serviceに必要な構文検査、validator、test、config検査を独立実行する。
6. client/Hostingを含む場合、固定commitの実際のDev設定で`npm run generate:dev`を独立実行する。
7. artifactのsource HEAD、Dev project、Emulator無効、必要file、tracked差分不在を確認する。
8. bounded Dev release checkpointの承認範囲と現在状態を再照合する。

Dev server、Chrome受入れ、Codex専用UI buildはHosting release artifactの代替ではない。deploy対象と同じbuild commandをremote変更前に完了させる。

`injectManifest`を使用する場合、Service Worker sourceに`self.__WB_MANIFEST`挿入点が存在し、現在のbuild toolが要求するsource contractをtestで固定する。`globPatterns: []`でも挿入点は必要である。2026-08-27のDev releaseでは、この不整合をmaintenance後に初めて検出したため、以後はrelease buildをpreflightへ移した。

## Release分類

| Release class | 必須preflight | 標準deploy順 | maintenance・backup |
|---|---|---|---|
| client/Hostingのみ | client test、`generate:dev`、artifact identity | Hosting | 通常不要。server contract非互換やdata影響がある場合は再分類 |
| Functionsのみ | syntax、対象Functions test、config・runtime確認 | Functions | 通常不要。既存dataを一括処理する場合はdata影響を再分類 |
| Rules・Indexesを含むserver境界 | Rules test、index/config検査、影響するclient確認 | Rules/Indexesと必要Functionsを整合単位でdeploy | 拒否強化だけで継続互換なら通常不要。write contract変更時はsnapshot・maintenanceを検討 |
| client/server contract同時変更 | client buildとserver test、旧新client互換性 | server先行、remote検証、同一artifactのclient | 非互換期間がある場合はmaintenance。data影響に応じてsnapshot |
| data migrationを含む | 固有dry-run、plan、digest、backup、post-check | server、fresh dry-run、apply、再dry-run、client | 原則maintenanceと整合snapshot。migration固有ADR・rollback必須 |
| 破壊的repair | exact対象、事前事後証拠、復旧、dry-run相当 | 承認された限定repairだけ | 別の明示承認。既存checkpointへ追加しない |

releaseが複数classへ該当する場合は最も強いdata・互換性境界を採用する。maintenanceはclient route制御であり、Rules、Functions、Admin SDK、scheduled処理、開始済みwriteを排他しない。

## Deployと検証

- 各必須commandは結果とexit statusを独立して記録する。診断batchや、後続成功が先行失敗を隠すchainを完了証拠にしない。
- Firebase commandには常に`--project air-guard-v2-dev`を明示する。`firebase use`による暗黙project選択をrelease identityの証拠にしない。
- Dev client生成は`npm run generate:dev`、生成物は`dist/`、Hosting deployはcheckpointで固定したinstalled Firebase CLIへ`deploy --project air-guard-v2-dev --only hosting --non-interactive`を渡す。生成とdeployを一つにする`npm run deploy:dev`は外部作用commandとして存在するが、buildとdeployの独立exit statusを必要とするrelease証拠には使用しない。
- client/server同時変更は原則serverを先行し、旧clientが残ってもserverが最終認可を維持することを確認してからclientをdeployする。
- Hostingはpreflightで確認した同一artifactをdeployし、配信中version、HTTP status、cache header、主要artifactの一致を確認する。
- Functionsは期待した公開集合、region、runtime、状態、scheduled job、ERROR logを確認する。raw configや秘密情報を出力しない。
- Web clientから呼ぶv2 Callableは、対応するCloud Run serviceごとに`roles/run.invoker`の`allUsers` bindingとbrowser originからのCORS preflightを確認する。Functionが`ACTIVE`であること、operator credential付きの`gcloud functions call`、originなしのserver-side request、Callable内部の未認証拒否だけではbrowser到達性の証拠にしない。bindingが欠落するとapplication codeへ到達する前の`OPTIONS`がHTTP 403となる。入口を公開してもCallable内部のFirebase ID token、actor、tenant、target検証を省略しない。
- Callableのinvoker欠落を修復する場合は、Dev project、exact service、`allUsers -> roles/run.invoker`、公開範囲、内部認証、rollbackとなるbinding削除を提示して明示承認を得る。修復後は変更commandとは別のread-only IAM取得、browser preflight、正常actor、未認証・権限不足actorの拒否を独立確認する。
- Rulesは正常経路と拒否経路を確認する。Storage Rulesに`firestore.get()`または`firestore.exists()`がある場合、StorageとFirestoreの連携許可、Firebase Storage service accountの`Firebase Rules Firestore Service Agent` role、正常Userと拒否対象Userのaccessを確認する。権限を推測で追加せず、初回prompt、付与済み状態、権限不足をdeploy結果として区別する。
- 共通Auth identity gateまたは再構築認可を使うFunctionsでは、実行service accountがFirebase Authentication Userを参照できることを確認する。正常actorと、Auth無効・claim不一致・User無効・他社指定等の拒否をFunctions logと画面結果で確認し、権限不足はfail closedとして扱う。
- Firestore tenant拒否のremote確認は、既存の利用者・協力会社tenantを無断使用せず、利用者承認済みの専用合成会社と正規ID tokenを使う。自社pathの陽性readと、別の合成会社IDに対するdocument read・collection listを分け、write拒否probeには`currentDocument.exists=true`等の存在必須preconditionを付け、Rules不備時も新規documentを作らない。credential、token、会社ID、UID、取得dataをfile、command line、log、callbackへ出さず、UI操作ではなくbackend assertionとして報告する。
- User/Auth lifecycleの非破壊remote確認は、会社管理者専用履歴pageの正常応答・空状態・page buttonと、本登録User削除確認の対象・理由・不可逆性を確認して取消し、対象User残存と履歴不変を再確認する。退職または本登録User物理削除を実行する場合は、明示した合成対象、data影響、復旧不能範囲、停止条件を別途承認する。
- maintenanceを使うreleaseは解除前にserver、data、client、log、主要正常・拒否経路を確認し、解除後は新しいbrowser sessionで受入れる。

## UWB固有cutover

UWB初回Dev導入は、client/server/data contractの同時変更と予約migrationを含むため、[ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md)のmaintenance cutoverを使用した。System maintenance、整合snapshot、UWB全server境界、fresh create-only予約migration、client/Hosting、maintenance中検証、解除・受入れを一体で行う。

この順序をHosting-only、独立Functions、互換なRules変更へ自動適用しない。別migrationへUWB予約migrationのplan、digest、create-only条件、rollbackを流用せず、migrationごとに別の承認済み契約を作る。

## 停止とrollback

- preflight失敗: remote変更を開始せず停止する。
- deploy開始後の失敗: 成功済みserviceと失敗service、remote revision、data変更有無を確認し、失敗した限定操作だけを再試行可能か判断する。
- maintenance中の必須check失敗: maintenanceを維持し、corrective releaseまたは証拠付きrepairを使う。
- migration部分失敗: 推測deleteや自動rollbackを行わず、再dry-runして現在状態を再計画する。
- rollback artifact: Git上の既知の正常commitから同じ環境設定で再生成する。別releaseの生成物を再利用しない。
- data contract変更後: codeだけを戻して安全かを確認し、追加documentや外部状態がbackup importだけでは消えないことを考慮する。

Prod、Git push、main merge、history rewrite、credential変更、persistent CA・gcloud設定、実data削除は本runbookの承認に含まれない。

## 証拠と完了報告

完了報告にはrelease ID、commit、project、service、release class、data影響、backup、各command/result/exit、remote operation・revision、migration件数、maintenance状態、artifact identity、remote検証、未確認事項、rollback状態、Git/worktree状態を含める。秘密情報、実account、個人・顧客・勤怠・請求data、token、raw runtime configは含めない。

process-scoped trust準備、safe-fieldだけを出すproject到達確認、artifact identity、cleanupを一つにするPowerShell helperは未実装である。helper追加は、exact command、対象file、秘密情報境界、network作用、cleanup、陰性testを別checkpointで承認・検証してから行う。
