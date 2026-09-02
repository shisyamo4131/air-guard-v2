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
- checkpoint start baseline: `f9fc510a35c963cf81cb954c204d8a31e902b633`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean before this checkpoint; only the approved document/governance correction may be uncommitted during execution
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `CUSTOMER-DESIGN-AUDIT-001`
- objective: Customer masterの作成・更新・archiveについて、現行挙動、同一会社、permission、変更可能field、参照data、client writeとCallableの分担を整理する。
- approved scope: Customerの読み取り調査と改修checkpoint設計。製品code、Rules、Functions、test、data、Dev/Prodは、利用者が具体的な変更契約を承認するまで変更しない。
- completion contract: 画面・data flow、Rules・権限、関連testを独立確認し、現在すでに満たす要件、問題、変更案、影響、rollback、対象確認を利用者へ提示する。
- work ownership: PM（AirGuardV2）-14がcoordinatorを継続し、Customerのflow、security、test影響を非重複のread-only調査へ分ける。

## Open decisions and approvals

- 文書・検証方針の是正は利用者承認済みで、このsnapshotを含むlocal commitに記録する。
- Git push、main merge、Dev/Prod deploy、remote/data操作、外部service変更は本checkpointの対象外。
- 新しい小規模Dev migration高速経路は作成しない。
- App Check・全般的なrate limit・Callable public invoker常時監視はProd公開前gateへ移し、Customerを次のCRUD見直し対象とする利用者判断を反映済み。
- Customerの具体的な変更範囲は調査結果の提示後に利用者承認を得る。

## Next checkpoint

1. Customerの現行flow、Rules・権限、test影響を独立調査する。
2. 調査結果から一つの改修checkpointを設計し、変更内容、影響、rollback、確認方法を利用者へ提示する。
3. 利用者承認後に実装し、実装中は対象確認、区切りの最後に選択済みの全体確認を行う。

## References

- [文書案内](../README.md)
- [現行仕様](../specification.md)
- [ロードマップ索引](../roadmaps/README.md)
- [ADR索引](../decisions/README.md)
- [ADR 0041: 文書の単一正本と最終状態検証](../decisions/0041-single-source-documentation-and-final-validation.md)
- [開発workflow](../runbooks/development-workflow.md)
- [検証証拠索引](../verification/README.md)
- [STRIPE-05 Dev release verification receipt](../verification/stripe-05-dev-release.md)
- [変更履歴](../../CHANGELOG.md)
