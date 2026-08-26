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
| [0006](0006-user-prepared-authenticated-browser-testing.md) | ユーザー準備済み認証画面によるUI検証 | Superseded | 2026-08-04 |
| [0007](0007-project-scoped-specialist-agents.md) | プロジェクト専用の専門エージェント構成 | Superseded | 2026-08-04 |
| [0008](0008-consecutive-work-warning.md) | 配置管理の連勤判定と注意喚起 | Accepted | 2026-08-04 |
| [0009](0009-arrangement-daily-summary.md) | 配置管理の日別稼働・配置・状態集計 | Superseded | 2026-08-05 |
| [0010](0010-notification-preferred-effective-worker-values.md) | 配置通知を優先する作業員実効値と人員集計 | Accepted | 2026-08-05 |
| [0011](0011-roadmap-and-codex-session-lifecycle.md) | ロードマップとCodexセッションライフサイクル | Accepted | 2026-08-10 |
| [0012](0012-feature-branch-acceptance-and-related-repositories.md) | 機能ブランチ受入れと関連リポジトリ境界 | Accepted | 2026-08-10 |
| [0013](0013-managed-governance-reconstruction.md) | Managed governance再構築 | Accepted | 2026-08-11 |
| [0014](0014-codex-dedicated-local-test-data.md) | Codex専用localテストデータとloopback隔離 | Accepted | 2026-08-12 |
| [0015](0015-user-led-implementation-and-codex-assurance.md) | 利用者主導実装とCodexによる設計・検証・文書・Git管理 | Accepted | 2026-08-14 |
| [0016](0016-firemodel-crud-boundary.md) | FireModel CRUDの利用境界 | Accepted | 2026-08-15 |
| [0017](0017-callable-auth-identity-gate.md) | Callableの共通Auth identity gate | Accepted | 2026-08-16 |
| [0018](0018-user-provisioning-and-employee-link-boundary.md) | User provisioningとEmployee紐付け境界 | Accepted | 2026-08-16 |
| [0019](0019-client-operation-policy-composable-boundary.md) | Client操作policyとcomposable境界 | Accepted | 2026-08-17 |
| [0020](0020-employee-retirement-user-offboarding-and-reinstatement.md) | Employee退職・単独User削除・誤退職訂正境界 | Accepted | 2026-08-24 |
| [0021](0021-codex-in-app-browser-ui-testing.md) | Codexインアプリブラウザによるlocal UI検証 | Accepted | 2026-08-25 |
| [0022](0022-shared-role-preset-catalog-consumer-adoption.md) | 共有role preset catalogのconsumer導入 | Accepted | 2026-08-26 |

## 新しい ADR の形式

連番、短い英語ファイル名、判断を表す日本語タイトルを使用し、日付、状態、関連仕様、背景、決定、理由、代替案、影響、移行、再検討条件を記載します。
