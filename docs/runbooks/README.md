# AirGuardV2 Runbook索引

- 状態: 運用中
- 最終確認日: 2026-09-02
- 役割: 作業種別ごとに必要な実行手順だけを選ぶための索引

## 正本runbook

| 作業 | 状態 | 必読文書 | 追加で確認する対象 |
|---|---|---|---|
| 通常開発、利用者実装review、UI error・loading・client policy | Confirmed | [開発workflow](development-workflow.md) | 現行仕様、関連ADR、対象code・test |
| local環境、Emulator、Codex専用backend test | Confirmed | [local Emulator検証](local-emulator-testing.md) | ADR 0005・0014、Firebase設定、対象test |
| Codex専用・利用者用local UI受入れ | Confirmed | [local UI検証](local-ui-testing.md) | ADR 0006・0014、対象画面・manual、browser境界 |
| data migration（local / Dev、小規模を含む） | Confirmed | [data migration](data-migrations.md) | Devを含む場合は[Dev deploy runbook](dev-deployment.md)も必読。migration固有ADR・script、target、maintenance・復旧手段の個別判断、承認 |
| maintenanceを伴うmigration・repair・restore | Confirmed policy / gates pending | [maintenance・data change](maintenance-and-data-change.md) | 対象data、quiet period、監視Function、snapshot、rollback、承認 |
| Dev環境へのbuild・deploy・remote検証 | Confirmed | [Dev deploy runbook](dev-deployment.md) | migrationを含む場合は[data migration](data-migrations.md)も必読。対象serviceの設定・test、関連ADR、承認済みrelease checkpoint |
| 関連packageのconsumer更新・公開 | Confirmed | [package release](package-release.md) | package repository、互換性、version、公開承認 |
| Git統合、task loop、`容量チェック`・task/session容量、session handoff | Confirmed | [project coordination](project-coordination.md) | roadmap、checkpoint、current task ID・host、Git状態、capacity script |
| task起動・利用者要求の交代 | Confirmed | [project coordination](project-coordination.md) | 通常startup、primary Git状態、製品再開案内 |
| 旧coordinator交代手順の照合 | Historical | [handoff効率化](coordinator-handoff-efficient-activation.md) | 当時の手順と判断の参照。現在の起動には適用しない |
| Windows PC移行 | Confirmed | [Windows PC migration](windows-pc-migration.md) | backup媒体、Git bundle、local data、restore checkpoint |

## 読み方

- `docs/README.md`で作業種別を選び、この索引または直接指定されたrunbookだけを読む。
- runbookは実行順序、停止条件、rollback、証拠を扱う。確認済み要件は`docs/specification.md`、重要判断は`docs/decisions/`、進捗は`docs/roadmaps/`を正本とする。
- UWBのような特定機能のmigration・cutover条件はproject共通runbookへ一般化せず、関連ADRと[data migration](data-migrations.md)を追加で読む。
- 未検証commandをConfirmed手順へ追加しない。成功経路が変わった場合は、実測したcommand、exit status、対象環境、rollbackを確認してから更新する。
