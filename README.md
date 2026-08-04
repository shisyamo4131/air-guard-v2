# AirGuardV2

AirGuardV2 は、警備会社の取引先・現場・従業員・外注先・配置・稼働実績・勤怠・請求を一元管理する Web アプリケーションです。会社ごとにデータを分離するマルチテナント構成を採用し、現在は試験運用を行いながらアジャイルに開発しています。

## 現在の状態

- 成熟度: 試験運用中
- 開発方式: 試験運用から得た知見を反映するアジャイル開発
- フロントエンド: Nuxt 3、Vue 3、Vuetify、Pinia（CSR/PWA）
- バックエンド: Firebase Authentication、Firestore、Realtime Database、Storage、Cloud Functions、Hosting
- Cloud Functions ランタイム: Node.js 22
- 外部連携: Stripe、Firebase Cloud Messaging。勤怠データは freee 勤怠管理へのエクスポートを想定

## ドキュメント

- [`AGENTS.md`](AGENTS.md): Codex が従う作業規則
- [`docs/specification.md`](docs/specification.md): 現在確認されている仕様の唯一の正本
- [`docs/decisions/`](docs/decisions/README.md): 重要な設計・運用判断と理由
- [`CHANGELOG.md`](CHANGELOG.md): 利用者・仕様・運用に見える変更履歴
- [`docs/operations.md`](docs/operations.md): 開発、生成、デプロイ、障害復旧の手順
- [`docs/manual/`](docs/manual/index.md): 管理者向け画面マニュアル
- [`KNOWLEDGE.md`](KNOWLEDGE.md): Git、dayjs などの一般的な学習メモ
- [`INITIAL_PROMPT.md`](INITIAL_PROMPT.md): 新しい Codex タスクの開始用プロンプト

`DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/` は既存情報を保持する参考資料です。内容が競合する場合は `docs/specification.md` と承認済みの ADR を優先します。

## 開発

前提となる秘密情報や Firebase プロジェクト設定はリポジトリから取得できません。`.env` 系ファイルは適切な値を持つものをローカルで用意してください。

```powershell
npm install
npm run dev
```

ローカル向け設定を使い、LAN 内の端末から接続する場合:

```powershell
npm run local
```

静的生成:

```powershell
npm run generate:dev
npm run generate:prod
```

コマンドの意味、Firebase 環境の切り替え、デプロイ時の承認事項は [`docs/operations.md`](docs/operations.md) を参照してください。

## セキュリティ

- `.env`、秘密鍵、Stripe シークレット、Webhook シークレット、実際の個人情報や本番データを文書・Issue・ログへ転記しないでください。
- Firestore、Storage、Authentication、カスタムクレーム、Cloud Functions の変更はテナント分離と権限境界へ影響します。
- デプロイ、データ移行、削除、課金設定変更は、対象環境と影響範囲を確認し、人の明示的承認を得て実施します。
