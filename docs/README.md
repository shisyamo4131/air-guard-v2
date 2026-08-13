# AirGuardV2 ドキュメント案内

- 状態: 運用中
- 最終確認日: 2026-08-10
- 役割: ナビゲーション。確認済み要件は `specification.md`、検証済み進捗は `roadmaps/` を正本とする。

## 作業の開始順序

1. ルートの `AGENTS.md` を読む。
2. `governance/project-rules.md` を読む。
3. 下表から作業種別を選び、必要最小限の文書を読む。
4. 関連するロードマップと ADR を確認する。
5. 変更前に、関連コード、ルール、設定、テスト、運用証拠を照合する。

## 作業別ルーティング

| 作業種別 | 必読文書 | 追加で確認する対象 |
|---|---|---|
| 仕様・機能変更 | [現行仕様](specification.md)、[正式運用ロードマップ](roadmaps/airguard-v2.md)、[ADR索引](decisions/README.md) | 関連コード、テスト、[画面マニュアル](manual/index.md) |
| 不具合調査・修正 | 現行仕様の関連節、関連 ADR | 実行経路、ログ、テスト、再現条件 |
| 認証・権限・テナント・Firebase Rules | 現行仕様の「テナントと認証」「セキュリティ」、ADR 0002・0005・0007 | `firestore.rules`、`storage.rules`、`database.rules.json`、Functions、Emulator テスト |
| 配置・稼働・勤怠・請求 | 現行仕様の該当業務規則、関連 ADR | `definitions/`、関連画面・モデル・Functions、画面マニュアル |
| ローカル検証・UI検証 | [運用・開発手順](operations.md)、ADR 0005・0006・0014 | `firebase.json`、`firebase.codex-test.json`、`.env` の変数名のみ、対象テスト |
| デプロイ・公開・移行 | [運用・開発手順](operations.md)、関連 ADR | 対象環境、復旧手順、バックアップ、明示的承認 |
| Codexによる長期作業・引継ぎ | [運用・開発手順](operations.md)のプロジェクト管理節、ADR 0011、[ロードマップ索引](roadmaps/README.md) | Git 状態、チェックポイント記録、タスクID・ホスト、コールバック経路 |
| 過去資料の照合 | 現行仕様、関連 ADR | `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/`（参考・履歴） |

## 文書の役割

| 文書 | 正本となる内容 |
|---|---|
| [現行仕様](specification.md) | 現在確認済みの要件と、分離された未決事項 |
| [ロードマップ](roadmaps/README.md) | 目標、残作業、完了条件、証拠に基づく進捗 |
| [ADR](decisions/README.md) | 重要判断の状態と理由 |
| [運用・開発手順](operations.md) | 実施可能、計画中、利用不可の運用と復旧手順 |
| [画面マニュアル](manual/index.md) | 管理者が利用する画面操作 |
| [実装調査索引](implementation/README.md) | コードから確認した実装事実、未確認範囲、将来対応、確認待ち事項。確認済み要件の正本ではない |
| [変更履歴](../CHANGELOG.md) | 利用者・仕様・セキュリティ・運用に見える変更 |
| `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/` | 参考・履歴。現行仕様と競合する場合は正本ではない |

## 文書更新の完了条件

- 重要文書を追加・改名・移動・廃止した場合、この案内または該当索引とリンクを同じ変更で更新する。
- 確認済み、未確認、提案、証拠、履歴を混同しない。
- ロードマップの進捗はリポジトリ、テスト、レビュー、環境受入れの証拠だけで加点する。
- `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1` で相対リンクと見出しアンカー、索引到達性、ADR 状態、ロードマップ重みと進捗、TOML 構文と必須型を確認する。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath .` でmanaged hash、生成`AGENTS.md`、direct-edit drift、size、project rulesを確認する。
