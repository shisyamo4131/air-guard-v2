# 設計・プロダクト意思決定記録

この索引は判断の正本へ移動するための案内です。状態、日付、現在値は各ADR本文を参照し、ここへ複写しません。

## 索引

| ID | 判断 |
|---|---|
| [0001](0001-governance-and-specification-source.md) | 仕様管理と正本 |
| [0002](0002-multitenant-firebase-architecture.md) | Firebase マルチテナント構成 |
| [0003](0003-operation-result-billing-integrity.md) | 稼働実績と請求の整合性 |
| [0004](0004-codex-verification-boundary.md) | Codex とユーザーの確認責務 |
| [0005](0005-multi-agent-and-emulator-testing.md) | マルチエージェント体制とEmulator検証 |
| [0006](0006-user-prepared-authenticated-browser-testing.md) | ユーザー準備済み認証画面によるUI検証 |
| [0007](0007-project-scoped-specialist-agents.md) | プロジェクト専用の専門エージェント構成 |
| [0008](0008-consecutive-work-warning.md) | 配置管理の連勤判定と注意喚起 |
| [0009](0009-arrangement-daily-summary.md) | 配置管理の日別稼働・配置・状態集計 |
| [0010](0010-notification-preferred-effective-worker-values.md) | 配置通知を優先する作業員実効値と人員集計 |
| [0011](0011-roadmap-and-codex-session-lifecycle.md) | ロードマップとCodexセッションライフサイクル |
| [0012](0012-feature-branch-acceptance-and-related-repositories.md) | 機能ブランチ受入れと関連リポジトリ境界 |
| [0013](0013-managed-governance-reconstruction.md) | Managed governance再構築 |
| [0014](0014-codex-dedicated-local-test-data.md) | Codex専用localテストデータとloopback隔離 |
| [0015](0015-user-led-implementation-and-codex-assurance.md) | 利用者主導実装とCodexによる設計・検証・文書・Git管理 |
| [0016](0016-firemodel-crud-boundary.md) | FireModel CRUDの利用境界 |
| [0017](0017-callable-auth-identity-gate.md) | Callableの共通Auth identity gate |
| [0018](0018-user-provisioning-and-employee-link-boundary.md) | User provisioningとEmployee紐付け境界 |
| [0019](0019-client-operation-policy-composable-boundary.md) | Client操作policyとcomposable境界 |
| [0020](0020-employee-retirement-user-offboarding-and-reinstatement.md) | Employee退職・単独User削除・誤退職訂正境界 |
| [0021](0021-codex-in-app-browser-ui-testing.md) | Codexインアプリブラウザによるlocal UI検証 |
| [0022](0022-shared-role-preset-catalog-consumer-adoption.md) | 共有role preset catalogのconsumer導入 |
| [0023](0023-authentication-mutation-concurrency-boundary.md) | 認証状態変更の局所的な競合制御 |
| [0024](0024-dev-trial-deployment-and-migration-runbook.md) | Dev試行環境の積極的deployとmaintenance migration標準手順 |
| [0025](0025-company-configuration-boundary.md) | Company Configuration Boundaryとtenant lifecycle |
| [0026](0026-maintenance-quiescence-and-data-change.md) | project-wide maintenance静穏化とdata change境界 |
| [0027](0027-codex-session-capacity-routing.md) | Codex task/session容量の明示routingと測定境界 |
| [0028](0028-ccb-parity-backup-audit-restore.md) | CCB canonical parity・PrivateSettings backup・SettingAudits restore境界 |
| [0029](0029-firestore-rules-compatible-crud-cutover.md) | Firestore Rules互換CRUD先行と段階的閉鎖 |
| [0030](0030-efficient-coordinator-handoff-activation.md) | 次回コーディネーター交代で発効する効率化手順 |
| [0031](0031-proportional-data-boundary-and-change-safeguards.md) | 必要十分なデータ境界・競合制御・cutover |
| [0032](0032-required-specialist-subagent-routing.md) | 独立scopeへの専門subagent利用とCheckpoint限定禁止 |
| [0033](0033-company-bank-transfer-update-boundary.md) | Company振込先の専用更新・読取境界 |
| [0034](0034-codex-bounded-implementation-and-user-ui-acceptance.md) | 承認済み境界でのCodex実装と利用者最終UI受入れ |
| [0035](0035-company-display-order-update-boundary.md) | Company表示順の専用更新・権限境界 |
| [0036](0036-terminated-site-display-order-visibility.md) | 終了済み現場を表示順へ残す判断 |
| [0037](0037-superuser-company-admin-display-order.md) | SuperUser兼会社管理者の自社表示順更新 |
| [0038](0038-legacy-stripe-scaffold-removal.md) | 未同期Stripe scaffoldの完全撤去 |
| [0039](0039-evidence-bound-critical-identifiers.md) | Critical identifierの正本照合とSchemas consumer preflight |
| [0040](0040-impact-based-staged-verification.md) | 影響分類に基づく段階的検証 |
| [0041](0041-single-source-documentation-and-final-validation.md) | 文書の単一正本と最終状態検証 |
| [0042](0042-risk-based-local-ui-acceptance.md) | generated UIと変更riskに応じたlocal受入れ分担 |
| [0043](0043-dev-trial-existing-document-handling.md) | Dev試用中の既存documentと条件付き状態確認・移行 |
| [0044](0044-customer-status-as-descriptive-flag.md) | Customerの取引状態を状況表示フラグとして扱う |
| [0045](0045-governance-3-normal-startup.md) | Governance 3と通常startupへの移行 |
| [0046](0046-customer-archive-reference-barrier.md) | Customer archiveの参照barrierと監査境界 |
| [0047](0047-subagent-parallel-coordinator-external-ui.md) | 専門subagentの原則利用・並列実行とcoordinator直轄操作 |
| [0048](0048-site-customer-change-and-historical-snapshots.md) | SiteのCustomer変更許可と既存実績snapshot |

## 新しい ADR の形式

連番、短い英語ファイル名、判断を表す日本語タイトルを使用します。日付、状態、関連仕様、背景、決定、理由、代替案、影響、互換性、移行、rollback、検証、再検討条件はADR本文だけに記録します。
