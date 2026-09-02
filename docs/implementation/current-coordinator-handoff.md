# Current coordinator handoff snapshot

- 状態: Current / PM-15継続。CustomerのDevテスト直前までのlocal準備
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- former coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local` / retired・product作業と割当なし。通常product callbackは送らない。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `eb020e76332fc6d06a46949da92c27280d97bc6c`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `CUSTOMER-01C-LOCAL-PREP-001`
- objective: [Customer Dev反映・受入れ計画](customer-dev-release.md)に3条件の具体的判断、反映範囲、切替・復旧、通常操作と関連機能の確認を固定する。
- approved scope: 利用者のDevテスト直前までの進行指示に基づくlocal調査・必要な修正・検証・Dev向け静的生成・review・文書・local commit。Dev接続・remoteテスト・maintenance操作・deploy・実data変更・pushは含めない。
- completion contract: 必要なlocal検証、review済みcommit、clean、Dev設定の生成物照合を終え、Dev実行前で停止する。
- work ownership: PM-15が文書・build/artifact・Git統合、developerが発見済みService Worker設定未注入の限定修正と直接test、reviewerが修正review、securityがrelease計画のread-only確認を担当する。

## Open decisions and approvals

- 利用者は全件診断・一括修復を既定にしない方針と、Schemaの明らかな変更・他機能への明確な影響・その他確実に必要な場合の状態確認と必要なmigrationを採用し、governance反映と作業再開を指示した。規則の正本はproject rulesとする。
- 次の製品作業は[roadmapのCustomer次工程](../roadmaps/airguard-v2.md#次の作業)。追加の集計tool・ID別修復一覧・全件修復を一律の先行作業にする提案は取り下げる。既存tool・immutable receiptを削除・改変しない。
- 利用者は必要時の診断でIDを収集することを許可したが、今回の方針採用で診断toolの作成・再読取りを自動実行しない。診断が必要になった時点で目的・対象・出力先を限定する。
- 利用者は今回をproject固有ルールの変更として「タスクの交代は必要なし」と明示した。GOV-DEV-DATA-001に限りこの指示を優先し、PM-15と現在の担当を継続する。一般のturnover規則は変更しない。
- 利用者は「Dev環境でのテストに入る直前まで」の作業を指示した。local調査・必要な準備を完了し、Dev接続・remoteテスト開始前で止める。deploy・実data修復を黙示の承認に含めない。
- Git push、main merge、Dev/Prod deploy、追加のremote/data操作、外部service変更は本checkpointの対象外。以前の一度のDev読取り承認を再利用しない。
- 新しい小規模Dev migration高速経路は作成しない。
- App Check・全般的なrate limit・Callable public invoker常時監視はProd公開前gateへ移し、Customerを次のCRUD見直し対象とする利用者判断を反映済み。
- CUSTOMER-01Aのlocal実装・自動検証・Codex専用local UI受入れは完了した。
- local UI受入れは[ADR 0042](../decisions/0042-risk-based-local-ui-acceptance.md)と[local UI検証runbook](../runbooks/local-ui-testing.md)を正本とする。本変更はその基準でlocal完了とし、Dev受入れは別checkpointとする。
- 報告は平易な日本語とし、作業単位ごとの所要時間と無駄な作業の有無を併記する。

## Next checkpoint

1. 発見したService Worker設定未注入の修正を検証・review・統合し、固定HEADのDev生成物を再確認する。
2. 利用者のDev実行指示後、[Customer Dev反映・受入れ計画](customer-dev-release.md)と[Dev runbook](../runbooks/dev-deployment.md)に沿い、現在のremote状態、実行対象commit・artifact、切替対象と時間、rollback、試験対象・関連Siteへの同期を固定した一つのbounded releaseを進める。
3. RulesとHostingの反映後、通常Customer操作と条件2の関連機能を確認する。未確認状態を成功扱いせず、不具合が出たID・field・経路を限定して修正する。全件再診断・一括修復は自動追加しない。

## References

- [文書案内](../README.md)
- [現行仕様](../specification.md)
- [ロードマップ索引](../roadmaps/README.md)
- [ADR索引](../decisions/README.md)
- [ADR 0041: 文書の単一正本と最終状態検証](../decisions/0041-single-source-documentation-and-final-validation.md)
- [ADR 0043: Dev試用中の既存document](../decisions/0043-dev-trial-existing-document-handling.md)
- [開発workflow](../runbooks/development-workflow.md)
- [検証証拠索引](../verification/README.md)
- [CUSTOMER-01A local acceptance verification receipt](../verification/customer-01a-local-acceptance.md)
- [CUSTOMER-01B Dev compatibility verification receipt](../verification/customer-01b-dev-compatibility.md)
- [STRIPE-05 Dev release verification receipt](../verification/stripe-05-dev-release.md)
- [変更履歴](../../CHANGELOG.md)
