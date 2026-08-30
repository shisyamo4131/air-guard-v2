# Current coordinator handoff snapshot

- 状態: Current / activation baseline prepared
- 更新日: 2026-08-30
- former coordinator: PM（AirGuardV2）-09 / task `01a0505c-6593-7571-9f4a-65a1e6cd14a3` / host `local`
- replacement coordinator: PM（AirGuardV2）-10 / task IDはbaseline commit後の完全新規task作成時に割り当て、最初のfile限定commitで本snapshotへ確定する / host `local`
- callback destination until ownership activation: PM（AirGuardV2）-09 task `01a0505c-6593-7571-9f4a-65a1e6cd14a3`
- program coordinator: PM（SPG）-04 / task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)、[efficient handoff](../runbooks/coordinator-handoff-efficient-activation.md)、[ADR 0030](../decisions/0030-efficient-coordinator-handoff-activation.md)

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- activation baseline: 本snapshotを含むlocal commit。exact full SHAはreplacement task初期messageで指定し、no-change receiptのHEADと一致させる。
- expected upstream: none
- expected worktree: clean
- expected worktree registry: primary repository 1件のみ。linked/task-specific/alternate worktreeは禁止。
- common governance: `1.4.0` / SHA-256 `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`
- generated `AGENTS.md`: 13,659 bytes。project上限内であることをactivation validatorで確認する。
- specification: `0.6.0`
- unintegrated work: 0。application、Rules、package、migration、remote/dataの未commit変更をhandoffしない。

## Confirmed product state

- AirGuardV2正式運用準備roadmapは10%。Company設定の旧巨大roadmap 10%はADR 0031でSupersededとなり、active進捗へ持ち越さない。
- CCBは2026-08-30にrestartした。目的はCompany全体を置換する保存を廃止し、operationが所有するexact fieldだけを更新することである。
- 一つの業務対象を一つのdocumentに保つことを既定とする。読取actor、保存・削除・復旧条件、増加し続ける量、具体的size、独立query、field updateで解消できない実測競合がある場合だけ分割する。writer権限、画面、責務名だけでは分割しない。
- 通常編集はreal-time listenerとlast-write-winsを既定とする。expected value、revision、transaction、idempotency、lock、ledgerは、権限・停止、削除、金銭、外部作用、複数resource、復旧困難なdata loss等の具体的被害があるoperationだけに限定する。
- Stripe、subscription、entitlement、employeeLimitは現段階のCompany構造とCCBから除外した。将来サブスクリプション機能の実装時に新規設計する。
- Devで確認済みのCompany rootは4件。正式release前で旧client継続利用を要しないため、backup・dry-run・短時間maintenance・全件変換・post-check・Dev受入れをbounded cutoverとして行える。実data操作は別の明示承認を必要とする。
- 旧CCBで作成した8 target、PrivateSettings、SettingAudits、runtime compatible reader、migration/restore planner、candidate Rules、Schemas consumer、Admin SDK guardはrollback inventory対象である。UWB、Company create/delete拒否等の独立security改善、公開済みSchemas `.167` artifactを推測で戻さない。

## Current checkpoint and next work

- first replacement checkpoint: `NO-CHANGE-GOV16-AIRGUARDV2-PM10-001`。direct repository、baseline、instruction sources、permissions、no files/diff/testsをbounded callbackでPM-09へ1回通知して待機する。
- first real file checkpoint after receipt: `GOV16-AIRGUARDV2-PM10-ACTIVATION-001`。本snapshot 1件だけへactual PM-10 task ID、host、active ownership、baseline/HEADを記録し、効率化runbookのvalidator・blob・commit gateを満たす。
- next product checkpoint after ownership activation: `CCB-RESTART-ROLLBACK-INVENTORY-001`。read-onlyで旧CCBのexact commits/files、依存、保持対象、rollback対象、test、関連Schemas/Admin SDK影響を確定する。commit rangeを一括revertせず、review済みcorrective rollback planを作る。
- first active product roadmap: [Company legacy Stripe情報削除](../roadmaps/company-stripe-removal.md) 0%。rollback baseline確定後にSTRIPE-01から開始する。

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
- activation checkpointは本snapshot 1件のlocal edit/stage/commitと指定validatorだけを許可する。
- application、`firestore.rules`、test、package、Schemas/Admin SDK、migration、Dev、remote/data、network、push、main merge、Prodは別checkpoint。Dev migration/deployは対象commit、件数、backup、rollback、停止条件、post-check、受入れを固定した利用者承認を必要とする。
- former taskをCodexがarchive/deleteしない。ownership activation成功後、利用者がPM-09を手動削除できる。

## Activation evidence contract

このbaselineではproject documentation validator、managed governance validator、renderer `-Check`、`git diff --check`を各独立commandで成功させ、exact committed paths、branch/full HEAD、upstream none、clean、primary-only worktreeを確認する。application test、capacity script、network、remote/data操作は実行しない。
