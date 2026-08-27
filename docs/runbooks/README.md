# AirGuardV2 Runbook索引

- 状態: 運用中
- 最終確認日: 2026-08-27
- 役割: 作業種別ごとに必要な実行手順だけを選ぶための索引

## 正本runbook

| 作業 | 状態 | 必読文書 | 追加で確認する対象 |
|---|---|---|---|
| Dev環境へのbuild・deploy・remote検証 | Confirmed | [Dev deploy runbook](dev-deployment.md) | 対象serviceの設定・test、関連ADR、承認済みrelease checkpoint |

## 読み方

- `docs/README.md`で作業種別を選び、この索引または直接指定されたrunbookだけを読む。
- runbookは実行順序、停止条件、rollback、証拠を扱う。確認済み要件は`docs/specification.md`、重要判断は`docs/decisions/`、進捗は`docs/roadmaps/`を正本とする。
- UWBのような特定機能のmigration・cutover条件はproject共通runbookへ一般化せず、関連ADRとmigration固有手順を追加で読む。
- 未検証commandをConfirmed手順へ追加しない。成功経路が変わった場合は、実測したcommand、exit status、対象環境、rollbackを確認してから更新する。

## 今後の分割候補

`docs/operations.md`にはlocal Emulator・UI検証、Git統合、Codex task lifecycle、Windows PC移行が残っている。これらは意味を失わないrule inventoryとzero-unmapped確認を行う別checkpointで、必要に応じて個別runbookへ分割する。今回のDev deploy正本化では移動しない。
