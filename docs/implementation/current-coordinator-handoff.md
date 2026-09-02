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

- checkpoint: `NEXT-PRODUCT-CHECKPOINT-SELECTION`
- objective: 次の改修・機能追加を、影響範囲を先に整理した一つの作業単位として開始する。
- approved scope: 未選択。利用者が次の対象を指定するまで、製品code、Rules、Functions、data、Dev/Prodを変更しない。
- completion contract: 次の対象について、現行挙動、変更内容、影響範囲、確認方法、外部作用の有無を整理してから実装へ進む。
- work ownership: PM（AirGuardV2）-14がcoordinatorを継続し、選択された作業だけを独立scopeへ分ける。

## Open decisions and approvals

- 文書・検証方針の是正は利用者承認済みで、このsnapshotを含むlocal commitに記録する。
- Git push、main merge、Dev/Prod deploy、remote/data操作、外部service変更は本checkpointの対象外。
- 新しい小規模Dev migration高速経路は作成しない。
- 次に着手する改修・機能追加の指定を待つ。

## Next checkpoint

1. 利用者へ文書・検証方針是正のlocal commitと確認結果を報告する。
2. 次の改修・機能追加が指定されたら、[文書案内](../README.md)から必要な正本だけを選ぶ。
3. 実装前に影響範囲と失敗経路を独立reviewし、実装中は対象確認、区切りの最後に選択済みの全体確認を行う。

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
