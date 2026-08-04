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

開発環境:

```powershell
npm run dev
```

ローカル用設定でホストを公開する場合:

```powershell
npm run local
```

Firebase Emulator Suite は `firebase.json` で Auth、Functions、Firestore、Realtime Database、Storage、Hosting、Emulator UI を構成しています。起動前に使用プロジェクトと `.env.local` のエミュレーター設定を確認してください。

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

公開元でのバージョン作成・タグ push・Trusted Publishing の詳細は `AGENTS.md` に従います。ローカルから `npm publish` しません。

## 出力と成功確認

- Nuxt の生成物: `dist/`
- Cloud Functions のログ: Firebase Console または `npm run logs`（`functions/`）
- Emulator UI: `firebase.json` のポート設定に従う
- Hosting: 対象 Firebase プロジェクトの Hosting URL
- Stripe: Webhook 配送履歴、署名検証結果、Company の同期状態

成功はコマンド終了だけで判断せず、対象環境、ログ、データ、主要画面をユーザーが確認します。

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

- 自動テスト用 npm script はルートと `functions/` の `package.json` に定義されていない。
- 正式運用の監視、SLA、バックアップ保持期間、復旧目標は未確定。
- Stripe の本番 Secret、Webhook、プラン、キャンセル、従業員数制限の運用状況は環境ごとに確認が必要。
