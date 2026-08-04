# 設計・プロダクト意思決定記録

重要な仕様・設計・運用判断を ADR（Architecture Decision Record）として残します。承認済み ADR は削除せず、変更する場合は新しい ADR で置き換え、元の ADR を Superseded にします。

## ステータス

- Proposed: 提案中
- Accepted: 承認済み
- Rejected: 不採用
- Superseded: 後続 ADR により置換済み

## 索引

| ID | 判断 | 状態 | 日付 |
|---|---|---|---|
| [0001](0001-governance-and-specification-source.md) | 仕様管理と正本 | Accepted | 2026-08-03 |
| [0002](0002-multitenant-firebase-architecture.md) | Firebase マルチテナント構成 | Accepted | 2026-08-03 |
| [0003](0003-operation-result-billing-integrity.md) | 稼働実績と請求の整合性 | Accepted | 2026-08-03 |
| [0004](0004-codex-verification-boundary.md) | Codex とユーザーの確認責務 | Superseded | 2026-08-03 |
| [0005](0005-multi-agent-and-emulator-testing.md) | マルチエージェント体制とEmulator検証 | Accepted | 2026-08-04 |
| [0006](0006-user-prepared-authenticated-browser-testing.md) | ユーザー準備済み認証画面によるUI検証 | Accepted | 2026-08-04 |
| [0007](0007-project-scoped-specialist-agents.md) | プロジェクト専用の専門エージェント構成 | Accepted | 2026-08-04 |

## 新しい ADR の形式

連番、短い英語ファイル名、判断を表す日本語タイトルを使用し、日付、状態、関連仕様、背景、決定、理由、代替案、影響、移行、再検討条件を記載します。
