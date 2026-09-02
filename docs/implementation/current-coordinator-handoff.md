# Current coordinator handoff snapshot

- 状態: Current / PM-14 active ownership
- 更新日: 2026-09-02
- active coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-14 task `01a05c75-bdfd-75e0-bcda-f167b8541bff`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `97700ddd03b3abfc7f5f189311c35cd9b0dc81f2`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `CUSTOMER-01A-LOCAL-ACCEPTANCE-001`
- state: completed; detailed results are in the [immutable receipt](../verification/customer-01a-local-acceptance.md).
- completed scope: [Customer実装](customer-master.md)と[受入れ証拠](../verification/customer-01a-local-acceptance.md)を正本とする。
- excluded scope: Dev反映、Dev data確認、終了・再有効化、archive・restore、App Check、全般的なrate limit、Prod、push。
- work ownership: PM（AirGuardV2）-14がcoordinatorとしてlocal実装commit `97700ddd03b3abfc7f5f189311c35cd9b0dc81f2`と受入れ証拠を統合した。

## Open decisions and approvals

- 文書・検証方針の是正は利用者承認済みで、このsnapshotを含むlocal commitに記録する。
- Git push、main merge、Dev/Prod deploy、remote/data操作、外部service変更は本checkpointの対象外。
- 新しい小規模Dev migration高速経路は作成しない。
- App Check・全般的なrate limit・Callable public invoker常時監視はProd公開前gateへ移し、Customerを次のCRUD見直し対象とする利用者判断を反映済み。
- CUSTOMER-01Aのlocal実装・自動検証・Codex専用local UI受入れは完了した。
- local UI受入れは[ADR 0042](../decisions/0042-risk-based-local-ui-acceptance.md)と[local UI検証runbook](../runbooks/local-ui-testing.md)を正本とする。本変更はその基準でlocal完了とし、Dev受入れは別checkpointとする。

## Next checkpoint

1. governance rule変更に伴う新しいcoordinator taskへの交代について利用者判断を得る。承認まではPM-14が所有権を維持し、新規assignmentを開始しない。
2. 交代後、CustomerのDev反映前に、実際のCustomerが26 field契約と互換かをread-onlyで確認するbounded checkpointを提示する。
3. Dev releaseは別承認とし、RulesとHostingの対象、rollback、Dev確認項目を一つのcheckpointにまとめる。

## References

- [文書案内](../README.md)
- [現行仕様](../specification.md)
- [ロードマップ索引](../roadmaps/README.md)
- [ADR索引](../decisions/README.md)
- [ADR 0041: 文書の単一正本と最終状態検証](../decisions/0041-single-source-documentation-and-final-validation.md)
- [開発workflow](../runbooks/development-workflow.md)
- [検証証拠索引](../verification/README.md)
- [CUSTOMER-01A local acceptance verification receipt](../verification/customer-01a-local-acceptance.md)
- [STRIPE-05 Dev release verification receipt](../verification/stripe-05-dev-release.md)
- [変更履歴](../../CHANGELOG.md)
