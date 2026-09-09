# Dev環境deploy runbook

- 状態: Confirmed
- 最終確認日: 2026-09-03
- 対象: `air-guard-v2-dev`へのbuild、Firebase deploy、gcloud操作、remote検証
- 対象外: Prod、新しいdata migration、破壊的repair、未承認service・dataへの拡張
- 関連判断: [ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md)

## 目的と適用境界

Devは正式運用準備の完了前でも検証済み変更を積極的にdeploy・受入れする非本番試行環境である。実account・実dataを含むため、対象commit、Firebase project、service、data影響、backup、rollback、停止条件、検証を固定したbounded Dev release checkpointを先に承認する。同checkpoint内のbuild、deploy、remote検証はcommandごとの再承認を求めない。

製品挙動を変える変更は、固定commitのdeploy済みartifactと対象service・Dev設定・remote認証・通信・権限・対象dataとの結合を本runbookで確認し、対象範囲の成功を最終受入れとする。Codex専用Localと利用者環境LocalはDev前の手戻り抑制用であり、両方またはいずれかの完了をDev反映の一律条件にしない。関連する変更はreview可能で境界の明確なrelease単位へまとめ、微小な編集ごとにdeploy・受入れを繰り返さない。

Dev受入れはcheckpointに固定した画面・actor・service・data経路だけを保証する。Prod固有状態、未確認経路、全利用者・全dataへの一般化は行わない。対象経路の失敗または必要なremote確認の未実施が残る場合は完了とせず、原因に対応する自動検証またはLocalだけへ戻って修正し、固定commitを再deployして対象範囲を再確認する。

すべてのDev deployへmaintenance、snapshot、migrationを適用しない。data contractまたはclient/server contractの整合cutoverが必要なreleaseだけが、それらを条件付きで使用する。新しいmigration、破壊的repair、対象service・data・期間の拡張、Prodは別承認とする。

maintenanceを使うreleaseは、[maintenance・data change runbook](maintenance-and-data-change.md)でnormal stop、quiet period、監視Function、連続dry-run、整合snapshot、post-checkを固定する。maintenanceは排他lockではなく、logだけを実行中処理不存在の証拠にしない。

## 機能改修時の既存Dev document

必要性の判断は[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)を正本とする。通常の機能改修では、変更箇所の検証後にDevへ反映し、実際の作成・編集・保存で得た不具合を修正する。全件診断・一括修復をreleaseの一律前提にしない。

releaseの`data-impact`には、変更差分と関連reader/writerから判断した該当条件・具体的根拠と、状態確認・migrationの要否を簡潔に記録する。非該当を示すためだけのremote全件走査や新しい診断toolは要求しない。該当する場合は影響範囲の状態確認を行い、必要な変換は[data migration runbook](data-migrations.md)へrouteする。条件に該当するか不明な場合は、そのfieldと利用経路に絞って確認する。

既存の形式不適合が見つかっていても、件数だけで全件修復へ移らない。通常画面での修正または実際に失敗する処理の修正を選び、他機能への確定した影響や画面では扱えない問題には必要な対処を行う。必要な状態確認の未完了を成功と扱わず、未確認のまま影響なしと記録しない。

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

Dev service accountを利用者から安全に受け渡す場合は、利用者levelの`AIRGUARD_DEV_CREDENTIAL_PATH`について、設定有無、参照先が既存JSON fileであること、JSONの`type`と`project_id`が対象Dev projectに一致することだけを確認する。pathと内容は表示しない。確認したprocess内だけで`GOOGLE_APPLICATION_CREDENTIALS`へ渡し、repository、応答、log、永続設定へ複写しない。

Dev server、Chrome受入れ、Codex専用UI buildはHosting release artifactの代替ではない。deploy対象と同じbuild commandをremote変更前に完了させる。

`injectManifest`を使用する場合、Service Worker sourceに`self.__WB_MANIFEST`挿入点が存在し、現在のbuild toolが要求するsource contractをtestで固定する。`globPatterns: []`でも挿入点は必要である。2026-08-27のDev releaseでは、この不整合をmaintenance後に初めて検出したため、以後はrelease buildをpreflightへ移した。

## Release分類

| Release class | 必須preflight | 標準deploy順 | maintenance・backup |
|---|---|---|---|
| client/Hostingのみ | client test、`generate:dev`、artifact identity | Hosting | 通常不要。server contract非互換やdata影響がある場合は再分類 |
| Functionsのみ | syntax、対象Functions test、config・runtime確認 | Functions | 通常不要。既存dataを一括処理する場合はdata影響を再分類 |
| Rules・Indexesを含むserver境界 | Rules test、index/config検査、影響するclient確認 | Rules/Indexesと必要Functionsを整合単位でdeploy | 拒否強化だけで継続互換なら通常不要。write contract変更時はsnapshot・maintenanceを検討 |
| client/server contract同時変更 | client buildとserver test、旧新client互換性 | server先行、remote検証、同一artifactのclient | 非互換期間がある場合はmaintenance。data影響に応じてsnapshot |
| data migrationを含む | 固有dry-run、plan、digest、backupまたはsnapshot、post-check | server、fresh dry-run、apply、再dry-run、client | 原則maintenanceと整合snapshot。writer不存在・互換なfield限定変更等を固有ADRで確認できる場合はmaintenanceを省略できる |
| 破壊的repair | exact対象、事前事後証拠、復旧、dry-run相当 | 承認された限定repairだけ | 別の明示承認。既存checkpointへ追加しない |

releaseが複数classへ該当する場合は最も強いdata・互換性境界を採用する。maintenanceはclient route制御であり、Rules、Functions、Admin SDK、scheduled処理、開始済みwriteを排他しない。

data migrationを含むreleaseは、ここへdry-run・apply・post-checkを複写せず、[小規模Dev migrationの共通手順](data-migrations.md#小規模dev-migrationの共通手順)とmigration固有節・ADRを合わせて読む。

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

## Customer保存形式のread-only事前検査

`scripts/check-customer-dev-compatibility.mjs`はCustomerの保存形式を検査する専用toolである。本節は必要性が確認された場合の実行手順であり、毎回のDev反映前gateではない。適用判断は[機能改修時の既存Dev document](#機能改修時の既存dev-document)に従う。localの合成応答testとDev実行を区別し、Dev実行には対象commit・読取範囲・上限を固定した別承認を必要とする。実装状況と未確認範囲は[Customer実装](../implementation/customer-master.md)を参照する。

- 対象はDev project `air-guard-v2-dev`、database `(default)`。database rootから全階層の`Customers` collectionを読み、`Companies/{companyId}/Customers/{docId}`だけを正常pathとして受け入れる。同名collectionが別階層にある場合も応答を受け取るため、この範囲まで読取り承認へ含める。
- ACTIVEとTERMINATEDの両方を検査する。`Customers_archive`、Company本文、Users、他のcollectionは対象外。company別の値・ID・内訳は出力しない。
- converterやmodel生成による補完を行わず、Firestoreの生の型で26項目の有無、余分な項目、型、長さ、状態、支払条件、住所と座標の相関を確認する。これは既存保存形式の検査であり、actor権限・Userのtenant拒否・新規作成時のserver timestamp条件・検索や住所情報の意味上の正しさを証明しない。
- 更新・削除・migration・repair・backup・raw data export機能を持たない。認証とFirestoreへの固定requestだけを使用する。OAuthの`datastore` scopeやservice account自体のIAM権限がread-onlyであるという意味ではない。

承認後、primary repositoryの固定commit・clean状態を確認してから、同じPowerShell process内で準備する。資格情報は利用者levelに設定された既存pathからprocessへ渡すだけとし、値・内容を表示しない。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
$env:AIRGUARD_DEV_CREDENTIAL_PATH = [Environment]::GetEnvironmentVariable("AIRGUARD_DEV_CREDENTIAL_PATH", "User")
```

検査commandは独立実行してexit statusを確認する。

```powershell
node scripts/check-customer-dev-compatibility.mjs --read-only --project air-guard-v2-dev --database '(default)'
```

接続前に固定ローカルdriveと通常file・資格情報の型・Dev projectとservice account・RSA鍵を検査し、ADCやmetadata認証へfallbackしない。drive種別の確認はfileアクセス前に行い、network drive・不明な種別・symlink・junctionを拒否する。Emulator、接続先override、TLS検証無効化、未知の引数、不一致は停止する。資格情報の`project_id`とemailの照合はlocal整合確認であり、実際の鍵とaccountの対応・IAMはremote応答で別に確認する。

上限は1000件、OAuth開始から応答bodyの読取り完了まで30秒、Firestore応答16 MiB、token応答と資格情報fileは各64 KiBとする。queryは上限+1件を要求し、1001件目があれば全件確認済みにしない。`--max-documents`と`--timeout-ms`は上限を下げる場合だけ使用できる。上限超過・失敗・不明な応答を成功にしない。出力は固定の状態、件数、不適合理由の集計に限定し、値・ID・資格情報・data由来hash・raw errorを出さない。

| exit | 状態 | 意味 |
|---:|---|---|
| 0 | compatible | 取得完了かつ対象documentの保存形式検査がすべて適合 |
| 2 | incompatible | 取得完了、不適合または未検証の表現を含むdocumentあり |
| 1 | blocked | 引数・環境・資格情報・通信・応答・上限等により検査を確定できない |

補助平面文字・単独surrogateのRules文字数判定、およびGeoPointの省略されたゼロ座標は、このtoolでは互換性未確認として非成功にする。`unicode-unverified`や`wire-unverified`をdata破損と断定せず、現行Rulesとの照合方法を別途確認する。

不適合または取得未完了なら検査成功とは扱わず、その実行を終了する。同じ処理の無条件再試行、対象・上限拡大、修復へ進まない。完全な0件結果と取得不能を区別し、0件でも想定した業務範囲と一致するかを確認する。結果だけでrelease全体の可否を決めず、必要な状態確認として選択した目的の達成と[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)を照合する。toolはdataを変更しないためdata rollbackは不要で、local実装の取消しは対象commitの安全なrevertで行う。

Dev反映は検査とは別のbounded release checkpointとする。既知のdata影響、残る派生値改ざんrisk、旧client併存、必要なRules回帰・Dev build、Firestore RulesとHostingの対象・反映順・rollback・Dev確認項目を固定してから承認を得る。候補Rulesとの形式不適合だけを理由にmigrationを必須にせず、3条件で必要と判定した状態確認・変換を行う。通常操作の不具合は再現して該当経路を修正する。

## UWB固有cutover

UWB初回Dev導入は、client/server/data contractの同時変更と予約migrationを含むため、[ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md)のmaintenance cutoverを使用した。System maintenance、整合snapshot、UWB全server境界、fresh create-only予約migration、client/Hosting、maintenance中検証、解除・受入れを一体で行う。

この順序をHosting-only、独立Functions、互換なRules変更へ自動適用しない。別migrationへUWB予約migrationのplan、digest、create-only条件、rollbackを流用せず、migrationごとに別の承認済み契約を作る。

## legacy Stripe scaffold固有cutover

STRIPE-05は、Stripe未使用・外部からの更新経路なし、現行client・Functionsに旧field writerなし、Company rootと`StripeData`のclient write拒否、旧2 fieldだけの冪等な削除を確認済みである。このためmaintenance、quiet period、外部Stripeのinventory・前後確認、migration固有backup・旧field復元を行わない。Rules・Functions・Hostingを先行反映し、UWBと同じFirestore全体snapshot、fresh dry-run、4 Company・内部`StripeData` 0の停止条件、1 transactionの旧2 field削除、post-check、clean再実行の順とする。全体snapshotは対象外dataを変更した重大事故の別承認repair候補であり、通常rollbackや自動restoreには使用しない。

snapshot command完了後にreceipt parserだけが失敗した場合、同じexportを再実行しない。対象prefixのmetadata objectと対応operationをread-onlyで一意に照合し、完了・errorなしを確認する。metadataまたはoperationを一意に照合できない場合は、重複snapshotを作らず停止する。

この手順を使用した実行結果は[STRIPE-05 Dev release verification receipt](../verification/stripe-05-dev-release.md)を参照する。本runbookへ実測件数、digest、commit、受入れ結果を複写しない。

## 停止とrollback

- preflight失敗: remote変更を開始せず停止する。
- deploy開始後の失敗: 成功済みserviceと失敗service、remote revision、data変更有無を確認し、失敗した限定操作だけを再試行可能か判断する。
- maintenance中の必須check失敗: maintenanceを維持し、corrective releaseまたは証拠付きrepairを使う。
- migration部分失敗: 推測deleteや自動rollbackを行わず、再dry-runして現在状態を再計画する。
- rollback artifact: Git上の既知の正常commitから同じ環境設定で再生成する。別releaseの生成物を再利用しない。
- data contract変更後: codeだけを戻して安全かを確認し、追加documentや外部状態がbackup importだけでは消えないことを考慮する。

Prod、Git push、main merge、history rewrite、credential変更、persistent CA・gcloud設定、実data削除は本runbookの承認に含まれない。

## 証拠と完了報告

完了報告にはrelease ID、commit、project、service、release class、data影響、backup、各command/result/exit、remote operation・revision、migration件数、maintenance状態、artifact identity、remote検証、今回受け入れた範囲、未確認事項、rollback状態、Git/worktree状態を含める。選択したCodex専用Local・利用者環境Localと各証明事項、または省略理由も記録する。秘密情報、実account、個人・顧客・勤怠・請求data、token、raw runtime configは含めない。

process-scoped trust準備、safe-fieldだけを出すproject到達確認、artifact identity、cleanupを一つにするPowerShell helperは未実装である。helper追加は、exact command、対象file、秘密情報境界、network作用、cleanup、陰性testを別checkpointで承認・検証してから行う。
