# AirGuardV2 ドキュメント案内

- 状態: 運用中
- 最終確認日: 2026-08-30
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
| 利用者実装の設計・差分review | [現行仕様](specification.md)、[ADR 0015](decisions/0015-user-led-implementation-and-codex-assurance.md)、[開発workflow](runbooks/development-workflow.md) | 利用者の対象差分、関連test、rollback、roadmap |
| 不具合調査・修正 | 現行仕様の関連節、関連 ADR | 実行経路、ログ、テスト、再現条件 |
| Firestore data設計・Rules・Company CCB | 現行仕様の関連節、[ADR 0031](decisions/0031-proportional-data-boundary-and-change-safeguards.md)、[開発workflow](runbooks/development-workflow.md) | 全reader/writer、exact field update、Rules、migration、rollback、対象環境・件数・停止条件 |
| 認証・権限・テナント・Firebase Rules | 現行仕様の「テナントと認証」「セキュリティ」、ADR 0002・0005・0007・0031 | `firestore.rules`、`storage.rules`、`database.rules.json`、Functions、Emulator テスト |
| 配置・稼働・勤怠・請求 | 現行仕様の該当業務規則、関連 ADR | `definitions/`、関連画面・モデル・Functions、画面マニュアル |
| local Emulator・backend検証 | [local Emulator検証](runbooks/local-emulator-testing.md)、ADR 0005・0014 | `firebase.json`、`firebase.codex-test.json`、`.env`の変数名のみ、対象test |
| local UI・browser受入れ | [local UI検証](runbooks/local-ui-testing.md)、ADR 0006・0014 | 対象画面・manual、Emulator・server、browser操作境界 |
| data migration | [data migration](runbooks/data-migrations.md)、関連ADR | target、dry-run、apply、post-check、backup、rollback、明示的承認 |
| maintenanceを伴うmigration・repair・restore | [maintenance・data change](runbooks/maintenance-and-data-change.md)、関連ADR | normal stop、quiet period、監視Function、連続dry-run、snapshot、rollback、明示的承認 |
| Devデプロイ・公開・remote検証 | [Dev deploy runbook](runbooks/dev-deployment.md)、[ADR 0024](decisions/0024-dev-trial-deployment-and-migration-runbook.md) | 対象serviceの設定・test、release checkpoint、機能・migration固有ADR、backup、rollback、明示的承認 |
| Prodデプロイ・公開・移行 | [運用・開発手順](operations.md)、関連ADR | 対象環境、復旧手順、バックアップ、Prod操作の個別承認 |
| 関連package更新・公開 | [package release](runbooks/package-release.md) | package repository、互換性、version、tag・push・公開承認 |
| `容量チェック` / `タスク容量確認` / `セッション容量確認` / `session size / handoff threshold確認` | [project coordination](runbooks/project-coordination.md) | `scripts/check-codex-session-size.ps1`、現在のtask ID。最新sessionの推測禁止 |
| Codexによる長期作業・引継ぎ | [project coordination](runbooks/project-coordination.md)、ADR 0011、[ADR 0032](decisions/0032-required-specialist-subagent-routing.md)、[ロードマップ索引](roadmaps/README.md) | Git状態、checkpoint、task ID・host、callback経路、独立scopeの専門task routing |
| coordinator交代・再開 | [project coordination](runbooks/project-coordination.md)、[current snapshot](implementation/current-coordinator-handoff.md)、[ADR 0030](decisions/0030-efficient-coordinator-handoff-activation.md) | 効率化手順は2026-08-30 activation baselineから発効。旧handoffは履歴参照のみ |
| Windows PC移行 | [Windows PC migration](runbooks/windows-pc-migration.md) | backup・restore対象、Git bundle、local data、restore checkpoint |
| 過去資料の照合 | 現行仕様、関連 ADR | `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/`（参考・履歴） |

## 文書の役割

| 文書 | 正本となる内容 |
|---|---|
| [現行仕様](specification.md) | 現在確認済みの要件と、分離された未決事項 |
| [ロードマップ](roadmaps/README.md) | 目標、残作業、完了条件、証拠に基づく進捗 |
| [ADR](decisions/README.md) | 重要判断の状態と理由 |
| [運用・開発手順](operations.md) | 共通準備、runbook routing、出力、障害復旧、backup、秘密情報 |
| [Runbook索引](runbooks/README.md) | 作業種別ごとに選ぶ実行・停止・rollback手順 |
| [画面マニュアル](manual/index.md) | 管理者が利用する画面操作 |
| [実装調査索引](implementation/README.md) | コードから確認した実装事実、未確認範囲、将来対応、確認待ち事項。確認済み要件の正本ではない |
| [変更履歴](../CHANGELOG.md) | 利用者・仕様・セキュリティ・運用に見える変更 |
| `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/` | 参考・履歴。現行仕様と競合する場合は正本ではない |

## 文書更新の完了条件

- 重要文書を追加・改名・移動・廃止した場合、この案内または該当索引とリンクを同じ変更で更新する。
- 確認済み、未確認、提案、証拠、履歴を混同しない。
- ロードマップの進捗はリポジトリ、テスト、レビュー、環境受入れの証拠だけで加点する。
- `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` で相対リンクと見出しアンカー、索引到達性、ADR 状態、ロードマップ重みと進捗、TOML 構文と必須型を確認する。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` でmanaged hash、生成`AGENTS.md`、direct-edit drift、size、project rulesを確認する。
- 必須validator、test、build、lint、migration checkは各commandの結果とexit statusを独立して確認する。まとめる場合は検証済みのfail-fastまたはaggregate runnerだけを使い、後続成功が先行失敗を隠す`;`等のchainやdiagnostic batchを完了証拠にしない。
