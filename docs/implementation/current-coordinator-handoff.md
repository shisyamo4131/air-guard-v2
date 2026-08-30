# Current coordinator handoff snapshot

- 状態: Current / PM-10 active ownership
- 更新日: 2026-08-30
- active coordinator: PM（AirGuardV2）-10 / task `01a050b5-2ea4-7220-a4b3-4d4fa0213e63` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-10 task `01a050b5-2ea4-7220-a4b3-4d4fa0213e63`
- former coordinator: PM（AirGuardV2）-09 / task `01a0505c-6593-7571-9f4a-65a1e6cd14a3` / host `local` / retired after ownership activation and safe for user manual deletion。Codexはarchive/deleteしない。
- program coordinator: PM（SPG）-04 / task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)、[efficient handoff](../runbooks/coordinator-handoff-efficient-activation.md)、[ADR 0030](../decisions/0030-efficient-coordinator-handoff-activation.md)

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- activation baseline: `9042667a0e6265add0eddfb982a06265b6e91178`
- corrective rollback start baseline: `1629e9925159a8342e646faf3c875e31995dac75`
- corrective rollback implementation HEAD: `98595711cba758170442e9777ac5e992fee6d4ee`
- expected upstream: none
- expected worktree: clean
- expected worktree registry: primary repository 1件のみ。linked/task-specific/alternate worktreeは禁止。
- common governance: `1.4.0` / SHA-256 `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`
- generated `AGENTS.md`: 13,659 bytes。project上限内であることをactivation validatorで確認する。
- specification: `0.6.0`
- unintegrated work: 0。corrective rollbackは4つのlocal commitへ統合済みで、文書同期以外の未commit変更をhandoffしない。

## Confirmed product state

- AirGuardV2正式運用準備roadmapは10%。Company設定の旧巨大roadmap 10%はADR 0031でSupersededとなり、active進捗へ持ち越さない。
- CCBは2026-08-30にrestartした。目的はCompany全体を置換する保存を廃止し、operationが所有するexact fieldだけを更新することである。
- 一つの業務対象を一つのdocumentに保つことを既定とする。読取actor、保存・削除・復旧条件、増加し続ける量、具体的size、独立query、field updateで解消できない実測競合がある場合だけ分割する。writer権限、画面、責務名だけでは分割しない。
- 通常編集はreal-time listenerとlast-write-winsを既定とする。expected value、revision、transaction、idempotency、lock、ledgerは、権限・停止、削除、金銭、外部作用、複数resource、復旧困難なdata loss等の具体的被害があるoperationだけに限定する。
- Stripe、subscription、entitlement、employeeLimitは現段階のCompany構造とCCBから除外した。将来サブスクリプション機能の実装時に新規設計する。
- Devで確認済みのCompany rootは4件。正式release前で旧client継続利用を要しないため、backup・dry-run・短時間maintenance・全件変換・post-check・Dev受入れをbounded cutoverとして行える。実data操作は別の明示承認を必要とする。
- 旧CCBのruntime compatible reader、8-target migration planner/Emulator、SettingAudits restore planner、candidate Rulesと専用testは主repositoryからcorrective rollback済みである。Company Rulesは旧CCB直前blobへ戻しつつ、UWBとCompany client create/delete拒否を保持した。
- Schemas exact `2.4.2-dev.167`の公開artifactとAirGuardV2 consumer pin、Admin SDKのfail-closed guardは独立成果として保持した。Schemasをunpublishせず、関連repository、Dev、remote/dataは変更していない。

## Current checkpoint and next work

- no-change checkpoint: `NO-CHANGE-GOV16-AIRGUARDV2-PM10-001` COMPLETE。task `01a050b5-2ea4-7220-a4b3-4d4fa0213e63` / host `local`、direct repository、baseline HEAD、upstream none、clean、primary-only worktree、common governance `1.4.0`、specification `0.6.0`、managed `workspace-write` / `auto_review` / network restricted、最小restart sourceを確認し、PM-09がreceiptを受理した。
- ownership activation checkpoint: `GOV16-AIRGUARDV2-PM10-ACTIVATION-001`。本snapshot 1件だけのfile-scoped local commitでPM-10へcallbackとassignmentをretargetし、効率化runbookのvalidator・blob・commit gateを満たす。exact new HEADはactivation receiptへ記録する。
- completed product checkpoint: `CCB-RESTART-ROLLBACK-INVENTORY-001`と承認済みcorrective rollback。commit rangeの一括revertを使わず、compatible reader、audit planner、migration tooling、Rulesの4単位で実装・testを完了した。
- next product checkpoint: 新CCBのCompany whole-document replacement除去。現行writerをoperation別exact field updateへ置換し、real-time listenerとlast-write-winsを基本に、必要なactor・field allowlist・回帰testを対象fileごとに固定する。
- following active product roadmap: [Company legacy Stripe情報削除](../roadmaps/company-stripe-removal.md) 0%。whole-document replacement除去のreview済みbaseline後にSTRIPE-01へ接続する。

## Active source set

Replacement taskは最初に次だけを読む。不足・矛盾がある場合だけ履歴へ拡張する。

1. `AGENTS.md`
2. `governance/project-rules.md`
3. `docs/README.md`
4. `docs/runbooks/project-coordination.md`
5. 本snapshot
6. no-change後は`docs/specification.md`のCompany設定節、`docs/decisions/0031-proportional-data-boundary-and-change-safeguards.md`、`docs/roadmaps/company-stripe-removal.md`、`docs/implementation/company-settings.md`、`docs/implementation/company-configuration-compatibility.md`

旧`task-handoff-2026-08-14-user-led-governance.md`と旧Company roadmapはHistoricalであり、current snapshotに不足・矛盾がある場合だけ参照する。

## Permissions and approval boundaries

- managed `workspace-write`。taskから観測可能なworkspace rootのうち、AirGuardV2と明示された関連repositoryだけが書込候補であり、各checkpointのowned filesをさらに優先する。
- review policy: `auto_review`。networkはrestricted。sandbox外操作は明示された承認境界とreviewに従う。
- no-change checkpointではfile write、Git mutation、test、application/Emulator/server/browser、network、remote/data操作、subagent、push/main merge/deployを行わない。
- activationとcorrective rollbackの承認済みcheckpointは完了した。次のapplication変更はCompany whole-document replacement除去のfile ownership、test、rollbackを固定した別checkpointで行う。
- Schemas/Admin SDK、Dev、remote/data、network、push、main merge、Prodは別承認である。Dev migration/deployは対象commit、件数、backup、rollback、停止条件、post-check、受入れを固定した利用者承認を必要とする。
- former taskをCodexがarchive/deleteしない。ownership activation成功後、利用者がPM-09を手動削除できる。

## Current evidence contract

corrective rollbackでは各commitのexact pathと`git diff --check`を確認し、Rules source contractと隔離Codex Emulator harnessを成功させた。文書同期ではproject documentation validator、managed governance validator、renderer `-Check`、`git diff --check`を各独立commandで成功させ、branch/full HEAD、upstream none、clean、primary-only worktreeを確認する。capacity script、network、remote/data操作は実行しない。
