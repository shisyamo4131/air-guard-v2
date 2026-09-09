# AirGuardV2 ドキュメント案内

- 役割: ナビゲーション。確認済み要件は `specification.md`、検証済み進捗は `roadmaps/` を正本とする。

## 作業の開始順序

[必須の読取り順](../governance/project-rules.md#必須の読取り順)を済ませ、下表から作業種別に対応する正本と追加確認対象を選ぶ。Git状態・scope・承認・次作業の照合は[通常startup](runbooks/project-coordination.md#通常startup)に従う。

## 作業別ルーティング

| 作業種別 | 必読文書 | 追加で確認する対象 |
|---|---|---|
| archive・物理削除・住所と座標 | [共通データ仕様](specification.md#共通データ仕様)、[ADR 0060](decisions/0060-common-archive-purge-and-address-contract.md) | [archive実装差・設計](implementation/archive-restore.md)、[住所・座標実装差](implementation/address-geocoding.md)、対象masterの固有条件とroadmap |
| 仕様・機能変更 | [現行仕様](specification.md)、[正式運用ロードマップ](roadmaps/airguard-v2.md)、[ADR索引](decisions/README.md) | 関連コード、テスト、[画面マニュアル](manual/index.md) |
| 承認済みcheckpointのCodex実装・risk-based UI受入れ | [現行仕様](specification.md)、[ADR 0034](decisions/0034-codex-bounded-implementation-and-user-ui-acceptance.md)、[ADR 0042](decisions/0042-risk-based-local-ui-acceptance.md)、[開発workflow](runbooks/development-workflow.md) | 現行挙動、承認済みboundary、関連code・Rules・test、rollback、roadmap、local UI省略条件、別途必要な環境受入れ |
| 不具合調査・修正 | 現行仕様の関連節、関連 ADR | 実行経路、ログ、テスト、再現条件 |
| 機能改修時の既存Dev document | [project rulesの3条件](project-rules/development-and-data.md#dev試用中の既存document)、[開発workflow](runbooks/development-workflow.md)、[ADR 0043](decisions/0043-dev-trial-existing-document-handling.md) | Schema差分、影響するreader/writer、他機能への確定した影響。必要な状態確認・migrationだけをDev runbookへroute |
| Firestore data設計・Rules・Company CCB | 現行仕様の関連節、[ADR 0031](decisions/0031-proportional-data-boundary-and-change-safeguards.md)、[開発workflow](runbooks/development-workflow.md) | 全reader/writer、exact field update、Rules、migration、rollback、対象環境・件数・停止条件 |
| 認証・権限・テナント・Firebase Rules | 現行仕様の「テナントと認証」「セキュリティ」、ADR 0002・0005・0007・0031 | `firestore.rules`、`storage.rules`、`database.rules.json`、Functions、Emulator テスト |
| 配置・稼働・勤怠・請求 | 現行仕様の該当業務規則、関連 ADR | `definitions/`、関連画面・モデル・Functions、画面マニュアル |
| local Emulator・backend検証 | [local Emulator検証](runbooks/local-emulator-testing.md)、ADR 0005・0014 | `firebase.json`、`firebase.codex-test.json`、`.env`の変数名のみ、対象test |
| local UI・browser受入れ | [local UI検証](runbooks/local-ui-testing.md)、ADR 0006・0014 | 対象画面・manual、Emulator・server、browser操作境界 |
| data migration（local / Dev、小規模を含む） | [data migration](runbooks/data-migrations.md)、関連ADR | Devを含む場合は[Dev deploy runbook](runbooks/dev-deployment.md)も必読。target、dry-run、apply、post-check、maintenance・復旧手段の個別判断、明示的承認 |
| maintenanceを伴うmigration・repair・restore | [maintenance・data change](runbooks/maintenance-and-data-change.md)、関連ADR | normal stop、quiet period、監視Function、連続dry-run、snapshot、rollback、明示的承認 |
| Devデプロイ・公開・remote検証 | [Dev deploy runbook](runbooks/dev-deployment.md)、[ADR 0024](decisions/0024-dev-trial-deployment-and-migration-runbook.md) | migrationを含む場合は[data migration](runbooks/data-migrations.md)も必読。対象serviceの設定・test、release checkpoint、固有ADR、復旧、明示的承認 |
| Prodデプロイ・公開・移行 | [運用・開発手順](operations.md)、関連ADR | 対象環境、復旧手順、バックアップ、Prod操作の個別承認 |
| 関連package更新・公開、critical identifier確認 | [package release](runbooks/package-release.md)、[ADR 0039](decisions/0039-evidence-bound-critical-identifiers.md) | source/tag manifest、release evidence、consumer manifest/lock、`scripts/check-schemas-package-adoption.ps1`、network・公開承認 |
| 検証方針の選択・移行・実測比較 | [運用・開発手順のVerification Matrix](operations.md#verification-matrix)、[検証policy](../governance/verification-policy.json)、[ADR 0040](decisions/0040-impact-based-staged-verification.md)、[検証証拠索引](verification/README.md) | change class、stage、gate ID・exact command、includes、invalidatedBy、pre/post JSON、coverage・failure-detection equivalence |
| 文書追加・更新・役割整理 | [Documentation and verification rules](project-rules/documentation-and-verification.md)、[ADR 0041](decisions/0041-single-source-documentation-and-final-validation.md)、この文書の「文書の役割」 | 変更する事実の正本、既存複製、索引到達性、履歴または実行証拠の保存先 |
| project rule・agent・governance是正 | [project rules index](../governance/project-rules.md)、[Documentation and verification rules](project-rules/documentation-and-verification.md)、[ADR 0049](decisions/0049-project-rule-routing-and-checkpoint-closeout.md) | managed common・生成AGENTS・lock記録済みmanaged referenceは直接編集しない。既存policyのcomprehensive gateを使う |
| `容量チェック` / `タスク容量確認` / `セッション容量確認` / `session size / handoff threshold確認` | [project coordination](runbooks/project-coordination.md) | `scripts/check-codex-session-size.ps1`、現在のtask ID。最新sessionの推測禁止 |
| Codexによる長期作業・引継ぎ | [project coordination](runbooks/project-coordination.md)、[ADR 0011](decisions/0011-roadmap-and-codex-session-lifecycle.md)、[ADR 0032](decisions/0032-required-specialist-subagent-routing.md)、[ADR 0045](decisions/0045-governance-3-normal-startup.md)、[ADR 0047](decisions/0047-subagent-parallel-coordinator-external-ui.md)、[ロードマップ索引](roadmaps/README.md) | 通常delegation・並列化・coordinator直轄操作・容量・roadmap規則を参照。0011/0032の旧交代条件は0045により履歴として扱う |
| taskの通常起動・利用者要求の交代 | [project coordination](runbooks/project-coordination.md)、[製品再開案内](implementation/current-coordinator-handoff.md)、[ADR 0045](decisions/0045-governance-3-normal-startup.md) | primary Git状態、製品の未決事項・承認・次作業 |
| 明示されたgovernance移行・文書整理 | [移行索引](migrations/README.md)、[文書移行契約](../references/document-migration-contract.md)、[Task Replacement](../references/task-turnover-contract.md) | source-bound plan、意味保存review、検証policy。日常startupではinstalled skillを読まない |
| 過去資料の照合 | 現行仕様、関連 ADR | `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/`（参考・履歴） |

## 文書の役割

| 文書 | 正本となる内容 |
|---|---|
| [現行仕様](specification.md) | 現在確認済みの要件と、分離された未決事項 |
| [ロードマップ](roadmaps/README.md) | 目標、残作業、完了条件、証拠に基づく進捗 |
| [ADR](decisions/README.md) | 重要判断の状態と理由 |
| [Project rules index](../governance/project-rules.md) | 常時境界と、AirGuardV2固有rule segmentへの必読route |
| `project-rules/**` | coordinator/Git、development/data、environment/approval、documentation/verificationの分割されたproject固有規則 |
| [運用・開発手順](operations.md) | 共通準備、runbook routing、出力、障害復旧、backup、秘密情報 |
| [Runbook索引](runbooks/README.md) | 作業種別ごとに選ぶ実行・停止・rollback手順 |
| [画面マニュアル](manual/index.md) | 管理者が利用する画面操作 |
| [実装調査索引](implementation/README.md) | コードから確認した実装事実、未確認範囲、将来対応、確認待ち事項。確認済み要件の正本ではない |
| [検証証拠索引](verification/README.md) | 特定実行のimmutable receipt、機械可読raw evidence、比較証拠 |
| [検証policy](../governance/verification-policy.json) | 変更class、stage、gate ID・exact command、includes、evidence invalidation、comprehensive fallbackの機械可読正本 |
| [変更履歴](../CHANGELOG.md) | 利用者・仕様・セキュリティ・運用に見える変更 |
| `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/` | 参考・履歴。現行仕様と競合する場合は正本ではない |

変化する現在値は上表で定めた一つの正本だけに置く。索引は正本へ到達するためのリンク中心の案内とし、リンク先の進捗、状態、件数、commit、現在の受入れ結果を複写しない。特定実行の詳細は[検証証拠索引](verification/README.md)からimmutable receiptへ辿り、runbookやcurrent handoffへ複写しない。

## 文書更新の完了条件

- 変更する事実の正本を一つ選び、既存の複製を検索して削除または正本へのリンクへ置換する。「要約」は値の短縮版ではなく、正本へ到達する索引として書く。
- 製品再開案内には現在の製品作業・未決事項・承認・次作業と正本へのlinkだけを置く。task ownerや交代状態を保存せず、完了履歴と実測結果はGit、roadmap、ADR、verification receiptへ置く。
- runbookには再利用可能な手順だけを置き、特定releaseの結果はimmutable verification receiptへ置く。
- 索引更新、checkpoint完了、検証選択・実行結果の扱いは[Documentation and verification rules](project-rules/documentation-and-verification.md)に従う。exact commandと検証対象は[検証policy](../governance/verification-policy.json)と[ガバナンス文書の確認](operations.md#ガバナンス文書の確認)、進捗の加点条件は[Gitと報告](project-rules/coordination-and-git.md#gitと報告)を参照する。

<!-- BEGIN MANAGED DOCUMENT MIGRATION INDEX -->

<!-- END MANAGED DOCUMENT MIGRATION INDEX -->
