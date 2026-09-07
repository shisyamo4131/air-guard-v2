# AirGuardV2 運用・開発手順

## 現在利用できる運用

- Nuxt 開発サーバーの起動
- Firebase Emulator Suite を使うローカル確認環境
- 開発・本番設定による静的生成
- Firebase Hosting、Functions、Firestore Rules/Indexes、Storage Rules、Realtime Database Rules のデプロイ
- メンテナンス状態とキルスイッチの切り替え
- Firestore PITR 7日保持と、承認済みrelease checkpoint内の整合snapshot

Devの静的生成、デプロイ、remote検証は、対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を含む利用者承認済みのbounded release checkpointとして実行します。Prod、Secret登録、新しいdata migration、破壊的repairは別の明示的承認と環境確認を必要とします。

Dev deployのCLI・trust・認証preflight、release分類、build、deploy、remote検証、停止・rollbackは[Dev環境deploy runbook](runbooks/dev-deployment.md)を正本とします。maintenanceを伴うmigration・repair・restoreは[maintenance・data change runbook](runbooks/maintenance-and-data-change.md)、UWB固有の初回cutoverは[ADR 0024](decisions/0024-dev-trial-deployment-and-migration-runbook.md)を追加で確認します。

## Verification Matrix

`governance/verification-policy.json`を機械可読の正本、下表と生成summaryを人向けの経路とします。変更前に該当classをすべて選び、混合変更はgateのunion、影響不明はcomprehensive fallbackを使用します。scaffold、governance migration、managed sync、common contract、project-wide permission・agent policy、release・deployはcomprehensive completionを維持します。

| Change class | Repository triggers | Iteration | Targeted regression | Completion | Release-only | 通常省略できる対象 |
|---|---|---|---|---|---|---|
| `documentation-only` | releaseの基準・対象・artifact・実行可否、手順、承認、rollback、製品挙動、remote状態を変えないprose・索引・link・完了後の履歴記録 | `diff-check` | `project-docs` | `project-docs`, `diff-check` | なし | application、Emulator、UI build、release |
| `ui-css-layout` | Vue表示、CSS、layout、accessibility、browser操作、利用者向けUI挙動 | `diff-check` | `domain-full`, `local-ui-build` | 同左 + `project-docs`, `diff-check` | 承認済みrelease時のgenerate | data migration、managed governance |
| `application-logic` | client、server、Functions、shared module、実行script。製品logicを変えないgovernance専用checker/fixtureはgovernance classへ分類 | `diff-check` | `domain-full` | `project-docs`, `domain-full`, `diff-check` | 承認済みrelease時のgenerate | governance negative、capacity、Emulator、UI build |
| `data-contract-schema-migration` | Firestore、Realtime Database、Storage、schema/package contract、migration、Rules、永続data互換 | `diff-check` | `domain-full`, `local-emulator-suite` | 同左 + `project-docs`, `diff-check` | 承認済みrelease時のgenerate | governance negative、capacity、UI build |
| `governance-permissions-agents` | common/project governance、policy、permission、approval、coordinator、agent、managed sync、生成AGENTS | `managed-governance`, `project-docs` | `project-docs-negative`, `capacity-regression` | comprehensive 5 gate | なし | なし |
| `build-release-deploy` | build・generate・package install/publish・Dev/Prod deploy・remote acceptanceの実行、release可否判断、またはrelease契約・基準・対象・artifact・手順の変更 | `diff-check` | `project-docs`, `domain-full` | comprehensive 5 gate | checkpointで承認されたEmulator、UI build、generate | なし |
| `project-guidance-metadata` | 記述的な案内・段階・進捗・metadata・link・履歴・文書構造。common契約、policy、権限、承認、安全、実行挙動の変更を含まない | `diff-check` | `project-docs` | `project-docs`, `diff-check` | なし | governance comprehensive、application、build、runtime |

必須runtimeはPowerShell 7（Core / `pwsh`）です。`runtimeProfiles`が対応範囲を宣言し、実際の成功証拠は各実行結果へ記録します。repository-owned gateは`-NoProfile`で実行し、`-ExecutionPolicy Bypass`、legacy `powershell.exe`、encoded commandを使用しません。governance checkerとそのfixtureの変更は`governance-permissions-agents`で分類し、製品logicへの影響がなければdomain/UI/Emulator/build gateは選びません。

<!-- BEGIN GENERATED VERIFICATION POLICY SUMMARY -->
- Root: schemaVersion=1.0; comprehensiveGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]; unknownImpactGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]
- RuntimeProfile: id=powershell-7; platform=windows; edition=Core; executable=pwsh; versionRule=minimum-major=7; required=True; supportStatus=supported
- Class: id=project-guidance-metadata; triggers=[Descriptive project guidance\, phase/progress\, metadata\, links/history\, or document-only structure with no common-contract\, policy\, permission\, approval\, safety\, or executable behavior change]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-docs]; completionGateIds=[project-docs,diff-check]; releaseOnlyGateIds=[]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,domain-full,local-emulator-suite,local-ui-build,generate-dev,generate-prod]; omissionRecord=Completion report or migration evidence
- Class: id=documentation-only; triggers=[Project-owned prose\, index\, link\, or post-completion historical record that does not alter a release baseline\, target\, artifact\, readiness decision\, procedure\, approval\, rollback\, product behavior\, or remote state]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-docs]; completionGateIds=[project-docs,diff-check]; releaseOnlyGateIds=[]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,domain-full,local-emulator-suite,local-ui-build,generate-dev,generate-prod]; omissionRecord=Completion report
- Class: id=ui-css-layout; triggers=[Vue component presentation\, CSS\, layout\, accessibility\, browser interaction\, or user-visible UI behavior]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[domain-full,local-ui-build]; completionGateIds=[project-docs,domain-full,local-ui-build,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,local-emulator-suite]; omissionRecord=Completion report or acceptance receipt
- Class: id=application-logic; triggers=[Client\, server\, Functions\, shared module\, or executable script behavior without a data-contract or release-boundary change\; governance-only checkers and fixtures that do not change product logic belong to governance-permissions-agents instead]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[domain-full]; completionGateIds=[project-docs,domain-full,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,local-emulator-suite,local-ui-build]; omissionRecord=Completion report
- Class: id=data-contract-schema-migration; triggers=[Firestore\, Realtime Database\, Storage\, schema\, package contract\, migration\, Rules\, or persisted-data compatibility]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[domain-full,local-emulator-suite]; completionGateIds=[project-docs,domain-full,local-emulator-suite,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,local-ui-build]; omissionRecord=Completion report or migration receipt
- Class: id=governance-permissions-agents; triggers=[Common or project governance\, verification policy\, permissions\, approval policy\, coordinator duties\, agents\, managed sync\, or generated AGENTS]; iterationGateIds=[managed-governance,project-docs]; targetedRegressionGateIds=[project-docs-negative,capacity-regression]; completionGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]; releaseOnlyGateIds=[]; omittableGateIds=[]; omissionRecord=Completion report or migration evidence
- Class: id=build-release-deploy; triggers=[Actual build\, static generation\, package installation or publication\, Dev or Prod deploy\, or remote acceptance execution\; release readiness decision\; or release contract\, baseline\, target\, artifact\, or procedure change]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-docs,domain-full]; completionGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]; releaseOnlyGateIds=[local-emulator-suite,local-ui-build,generate-dev,generate-prod]; omittableGateIds=[]; omissionRecord=Approved release checkpoint evidence or completion report
- Gate: id=diff-check; command=git diff --check; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Any later worktree edit]; evidenceDestination=Command report
- Gate: id=renderer-check; command=pwsh -NoProfile -File scripts/render-governance.ps1 -ProjectPath C:\\Users\\seven\\projects\\AirGuard\\air-guard-v2 -Check; stages=[iteration,targeted]; includes=[]; invalidatedBy=[Managed common\, governance lock\, renderer\, project rules\, verification policy\, or generated AGENTS change]; evidenceDestination=Command report or included managed-governance result
- Gate: id=managed-governance; command=pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\\Users\\seven\\projects\\AirGuard\\air-guard-v2; stages=[iteration,targeted,completion]; includes=[renderer-check]; invalidatedBy=[Managed common\, governance lock\, renderer\, validator\, project rules\, verification policy\, generated AGENTS\, or verification summary change]; evidenceDestination=Command report
- Gate: id=project-docs; command=pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\\Users\\seven\\projects\\AirGuard\\air-guard-v2; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Project Markdown\, TOML\, document routing\, verification policy\, or project document validator change]; evidenceDestination=Command report
- Gate: id=project-docs-negative; command=pwsh -NoProfile -File scripts/test-project-docs-check.ps1; stages=[targeted,completion]; includes=[]; invalidatedBy=[Project document validator\, its negative fixtures\, validator-required documentation route\, or verification-policy contract change]; evidenceDestination=Command report
- Gate: id=capacity-regression; command=pwsh -NoProfile -File scripts/test-codex-session-size.ps1; stages=[targeted,completion]; includes=[]; invalidatedBy=[Capacity aliases\, capacity runbook\, capacity measurement command or script\, or capacity regression fixture change]; evidenceDestination=Command report
- Gate: id=domain-full; command=node --test test/domain/*.test.mjs; stages=[targeted,completion]; includes=[]; invalidatedBy=[Application\, Functions\, Rules contract\, schema\, shared module\, or domain test change]; evidenceDestination=Command report
- Gate: id=local-emulator-suite; command=npm run test:local; stages=[targeted,completion,release]; includes=[]; invalidatedBy=[Functions\, Rules\, schema\, Emulator configuration\, test harness\, or affected application behavior change]; evidenceDestination=Checkpoint callback\, completion report\, or release evidence
- Gate: id=local-ui-build; command=npm run test:local:ui:build; stages=[targeted,completion,release]; includes=[]; invalidatedBy=[UI source\, client configuration\, dependencies\, build wrapper\, or affected application behavior change]; evidenceDestination=Checkpoint callback\, acceptance receipt\, or release evidence
- Gate: id=generate-dev; command=npm run generate:dev; stages=[release]; includes=[]; invalidatedBy=[Source\, dependency\, Dev environment mapping\, or release baseline change]; evidenceDestination=Approved Dev release evidence
- Gate: id=generate-prod; command=npm run generate:prod; stages=[release]; includes=[]; invalidatedBy=[Source\, dependency\, production environment mapping\, or release baseline change]; evidenceDestination=Approved Prod release evidence
<!-- END GENERATED VERIFICATION POLICY SUMMARY -->

### Gate Catalog and Inclusion

- completion comprehensive gateは`project-docs`、`project-docs-negative`、`capacity-regression`、`managed-governance`、`diff-check`です。
- `managed-governance`は`renderer-check`を内包します。子gateのnamed resultとexit statusを保持し、子失敗でnonzeroとなるため、completionでstandalone rendererを重複実行しません。
- applicationの直接影響を狭く確認できる場合は、policyの固定gateへ進む前に対象testをiterationまたはdiagnosticとして実行できます。最終選択、exact command、結果、exit statusはcompletion reportへ記録します。
- local UIの実利用者相当browser smokeと利用者最終UI acceptanceは、command gateとは別の受入れ証拠です。必要性はproject rulesと各runbookに従います。
- Schemas consumer preflightは[package release runbook](runbooks/package-release.md)と[ADR 0039](decisions/0039-evidence-bound-critical-identifiers.md)のcritical identifier gateです。対象identifierを当該turnで確定して実行し、固定値をpolicyへ推測しません。

### Evidence Validity

- success、passing count、completion evidenceはexit status 0を独立確認した後だけ記録します。
- 後続編集がJSONの`invalidatedBy`へ該当したgateはstaleです。失敗gateと失効gateを先に再実行し、影響しない証拠だけを継続利用できます。
- iteration、targeted、completion、release-onlyを混同しません。release-only gateと外部作用はpolicyへの記載では承認されず、environment、service、data、backup、rollback、停止条件を含む別の明示承認が必要です。
- 省略したgateは、選択class、非影響の根拠、記録先をcompletion report、acceptance receipt、migration receipt、release evidenceへ残します。
- 文書は実影響だけを更新します。仕様、ADR、roadmap、manual、operations、CHANGELOGを無関係な検証通過のためだけに変更しません。
- 完了後のreceiptは実行時点を固定した履歴証拠であり、現在のremote状態を表す文書へ書き換えません。索引は名称と正本linkだけを持ち、状態、進捗、日付、件数、commit、digestを複写しません。
- 製品再開案内は現在の製品作業・未決事項・次作業へのrouteだけを保持します。完了済みcheckpointの詳細はreceiptまたはGit履歴へ置き、handoffへ再掲しません。

## 準備

### 必要なもの

- Node.js。Cloud Functions の指定ランタイムは Node.js 22
- npm
- 対象 Firebase プロジェクトへアクセスできる Firebase CLI 認証
- 用途に応じた `.env.development`、`.env.local`、`.env`

依存関係のインストール前にはロックファイルと変更差分を確認します。証明書の問題がある環境では、検証を無効化せず、必要な PowerShell プロセス内だけで次を設定します。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npm install
```

## 作業別runbook

| 作業 | 正本 |
|---|---|
| 通常開発、UI error・loading、client policy | [開発workflow](runbooks/development-workflow.md) |
| local環境、Emulator、Codex専用test | [local Emulator検証](runbooks/local-emulator-testing.md) |
| Codex専用・利用者用local UI検証 | [local UI検証](runbooks/local-ui-testing.md) |
| User予約・claim等のmigration | [data migration](runbooks/data-migrations.md) |
| maintenanceを伴うmigration・repair・restore | [maintenance・data change](runbooks/maintenance-and-data-change.md) |
| Dev build・deploy・remote検証 | [Dev deploy](runbooks/dev-deployment.md) |
| 関連package更新・公開 | [package release](runbooks/package-release.md) |
| `容量チェック`、task/session容量確認 | [project coordination](runbooks/project-coordination.md) |
| Git統合、task loop、session handoff | [project coordination](runbooks/project-coordination.md) |
| Windows PC移行 | [Windows PC migration](runbooks/windows-pc-migration.md) |

`governance/project-rules.md`が参照するCodex専用demo projectの隔離条件は、[local Emulator検証](runbooks/local-emulator-testing.md)と[local UI検証](runbooks/local-ui-testing.md)を合わせて正本とする。package更新、Git統合、task lifecycleを含む正確なcommandと復旧手順も、上表の該当runbookへrouteする。

`容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`は、model token/context windowではなく現在taskの永続session JSONL容量を意味する。現在のtask IDを明示してproject-local scriptを実行し、並行taskがある場合に最新sessionを推測しない。task handoffは300 MiB、Codex全体は10 GiBの参考警告として分離し、詳細な出力・停止条件は[project coordination](runbooks/project-coordination.md)を正本とする。

## 静的生成とデプロイ

Devの静的生成、CLI・trust・認証preflight、release分類、deploy順序、remote検証、停止・rollbackは[Dev環境deploy runbook](runbooks/dev-deployment.md)を読む。Hostingを含むreleaseでは、maintenanceとremote変更より前に固定commitと実際のDev設定で`npm run generate:dev`を成功させる。`npm run deploy:dev`は生成、project切替、deployをまとめる外部作用commandであり、個別のbuild・deploy exit statusを必要とするrelease証拠には使用しない。

Prod生成は`npm run generate:prod`であるが、本runbookとbounded Dev release checkpointの承認対象外とし、Prod deployと合わせて別の明示承認を得る。

UWB初回導入のSystem maintenance、整合snapshot、全server境界、fresh create-only予約migration、client/Hosting、解除・受入れは[ADR 0024](decisions/0024-dev-trial-deployment-and-migration-runbook.md)を正本とする。project共通の静穏化、連続dry-run、snapshot、post-checkは[maintenance・data change runbook](runbooks/maintenance-and-data-change.md)を使うが、UWB固有のservice・data・順序をHosting-onlyや独立Functions等へ一般化しない。

## 出力と成功確認

- Nuxt の生成物: `dist/`
- Cloud Functions のログ: Firebase Console または `npm run logs`（`functions/`）
- Emulator UI: `firebase.json` のポート設定に従う
- Hosting: 対象 Firebase プロジェクトの Hosting URL
- Company legacy Stripe scaffold removal: 値非出力のdry-run件数・digest、対象外field不変、post-check 0件。外部Stripeは確認・変更しない

成功はコマンド終了だけで判断せず、対象環境、ログ、データ、主要画面をユーザーが確認します。

## ガバナンス文書の確認

Managed governanceの検証:

```powershell
pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2
```

`governance/common-governance.md`、lock、renderer、managed validator、生成`AGENTS.md`、lockに記録されたmanaged referenceは直接編集せず、明示されたgovernance作業の承認済みskill syncで更新します。project固有の横断規則は`governance/project-rules.md`と同indexが列挙する4つのproject-owned segmentを更新します。rendererはread-only checkであり、managed validatorが内包します。通常startupと利用者要求の交代は[project coordination](runbooks/project-coordination.md)、文書移行は[移行索引](migrations/README.md)を参照します。

上記は正規commandです。managed governance validatorの`-ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`を省略した短縮commandや、scriptのdefault project pathへ依存する呼出しを使用しません。standalone rendererは正規実行にせず、内包されたread-only checkを使用します。

Project-owned文書・設定の検証:

```powershell
pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2
```

相対MarkdownリンクとGitHub互換見出しアンカー、重要文書の索引到達性、ADR索引と本文の状態、ロードマップの重み・得点・無部分加点・索引進捗を確認します。Node.jsから正式なTOMLパーサーを使用し、`.codex/config.toml` と専門エージェントTOMLの構文、必須キー、型、名前、sandbox modeを確認します。アプリケーションのビルドや外部接続は行いません。

検証器自体の陰性試験:

```powershell
pwsh -NoProfile -File scripts/test-project-docs-check.ps1
```

## エラーと復旧

- 生成失敗: 最初のエラー、Node/npm バージョン、環境変数名、依存関係差分を確認する。
- Emulator 接続失敗: `NUXT_PUBLIC_FIREBASE_USE_EMULATOR`、ホスト、端末からの到達性、ポートを確認する。
- デプロイ失敗: 対象 alias、認証、権限、CLI 出力を確認し、失敗した限定操作だけを再実行する。
- Functions の部分失敗: 冪等性と重複実行の影響を確認してから再試行する。
- legacy Stripe removal失敗: 対象件数、backup、plan digest、状態変化、Rules/schema整合を確認し、write 0のまま停止する。
- PWA 更新問題: Service Worker、キャッシュヘッダー、登録状態を確認し、利用者データを失う一律削除を安易に案内しない。

デプロイ後の復旧は、原則として Git 上の既知の正常版を再生成・再デプロイします。データスキーマ変更を伴う場合は、コードだけを戻して安全かを先に確認します。

## バックアップと保持

- Dev Firestore `(default)`は2026-08-27にPITR有効・保持7日を確認した。PITRをrelease固有の整合snapshot、Storage・Authentication・外部serviceのbackup、復旧演習の代替にしない。
- Firestoreのスケジュールバックアップは既存資料に記載があるが、現在のschedule、保持、復元演習は未確認である。
- 旧CCBの`PrivateSettings`と`SettingAudits`はADR 0031で廃止され、主repositoryのmigration/restore plannerも2026-08-30に削除した。これらを対象にしたlogical backup/restoreを提供済みと案内しない。Admin SDKに残る`INCOMPLETE / EXCLUDED / UNVERIFIED / UNAVAILABLE`表示とfail-closed guardはhistorical artifactや未知pathを安全側へ止める独立保護であり、CCB-aware backup/restoreの提供を意味しない。
- データ移行前は、対象データと復旧手順を定め、必要なバックアップが取得済みであることを人が確認する。
- Storage、Authentication、外部serviceの状態は Firestore バックアップだけでは完全に復元できない。未同期Stripe scaffold撤去では外部Stripeを変更しない。
- 文書と仕様の履歴は Git で保持する。

## 秘密情報

- `.env` 系ファイルの値、Firebase Admin 資格情報、Stripe Secret、Webhook Secret をコミット・文書化しない。
- legacy Stripe scaffoldの撤去でStripe Secretを読取・登録・削除しない。将来外部serviceを導入する場合はSecret Manager等のserver-only管理を別設計する。
- ログや障害報告へ実際の個人情報、顧客情報、勤怠、請求、トークンを貼らない。

## 現在利用不可または要確認

- Codex専用UIの郵便番号自動検索は隔離対象として停止し、手入力を使う。専用Nuxt診断launcherは未隔離経路への迂回を防ぐため起動を拒否する。通常Devは変更しない。[専用UI契約](runbooks/local-ui-testing.md#専用uiの郵便番号隔離)と[実装・検証の適用状態](verification/customer-02-status-local.md)を参照。
- Codex専用local suiteはAuth、Firestore・Storage Rules、再構築Callable、UWB-04予約fixtureを含むUser lifecycle Callableのhandlerを確認する。Realtime Database Rules、外部サービスの自動回帰testは未整備である。
- 正式運用の監視、SLA、バックアップ保持期間、復旧目標は未確定。
- Stripe関連物は未同期scaffoldとして撤去済みで、現行運用機能ではない。将来のprovider、契約、料金、利用上限は未設計である。Dev実行の詳細は[immutable receipt](verification/stripe-05-dev-release.md)を参照する。
