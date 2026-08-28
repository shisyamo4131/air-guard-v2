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
- Stripe: Webhook 配送履歴、署名検証結果、Company の同期状態

成功はコマンド終了だけで判断せず、対象環境、ログ、データ、主要画面をユーザーが確認します。

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

- Dev Firestore `(default)`は2026-08-27にPITR有効・保持7日を確認した。PITRをrelease固有の整合snapshot、Storage・Authentication・外部serviceのbackup、復旧演習の代替にしない。
- Firestoreのスケジュールバックアップは既存資料に記載があるが、現在のschedule、保持、復元演習は未確認である。
- CCBの`PrivateSettings`は、保存先・暗号化・IAM・保持・redaction・環境間restore契約のない既存logical backupへ含めず、そのbackupを完全backupと呼ばない。Admin SDKで新規作成したverified format v1は`INCOMPLETE / PrivateSettings EXCLUDED`、sidecarのない旧local artifactまたは欠損・矛盾metadataはpayloadを開かず`INCOMPLETE / PrivateSettings UNVERIFIED`と表示する。当面はmanaged Firestore backup/PITRを復旧基盤とするが、PrivateSettings単独logical restoreと全system復旧を提供済みとは扱わない。
- CCBの`SettingAudits`を復元する場合は、専用経路で同一company・同一schema・同一document IDのcreateだけを許可する。既存同値はskip、異値は全体停止とし、update、delete、clear、generic merge restoreを禁止する。local-only pure plannerは合成artifactから候補計画を作るだけで、fileやFirestoreを読まず、applyも行わない。artifact真正性・保存・暗号化/IAM/保持、operational apply、復旧演習が完了するまでは利用不可である。
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
