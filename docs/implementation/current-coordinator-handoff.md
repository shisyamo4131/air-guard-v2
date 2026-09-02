# Current coordinator handoff snapshot

- 状態: Current / PM-15継続。governance反映後、CustomerのDevテスト直前まで準備する
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- former coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local` / retired・product作業と割当なし。通常product callbackは送らない。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `e0b9aa92436fda83f0ff1b2e0cd75e137a504766`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `GOV-DEV-DATA-001`
- objective: 利用者が採用した[既存Dev documentの扱い](../../governance/project-rules.md#dev試用中の既存document)をproject規則とcurrent手順へ反映し、[ADR 0043](../decisions/0043-dev-trial-existing-document-handling.md)と次の作業を整合させる。
- approved scope: project-owned規則・関連文書の更新、同じcommon versionのmanaged sync、必要な検証、独立review、local commit。application・検査tool・Rules・package・Dev接続・data変更・build・deploy・pushは含めない。
- completion contract: 3条件と通常のDev試用loopの整合、comprehensive gates、review済みlocal commit、clean。完了後は同じtaskでCustomerのDevテスト直前まで準備する。
- work ownership: PM-15が文書・Git統合を管理し、既存reviewerがread-only最終確認を行う。developerは文書検証fixtureの不足3ファイルのcopyだけを修正した。application・Rules・検査toolは変更しない。
- verification: `project-docs`、`managed-governance`（`renderer-check`を含む）、`capacity-regression`はexit 0。`project-docs-negative`は既存receiptの参照先をfixtureへcopyしていなかったため初回exit 1となり、準備処理5行の修正後は21ケース・exit 0。最終文書状態で`project-docs`と`diff-check`を確認して統合する。application・Rules・schema・domain testは不変のためdomain/Emulator/UI/buildは今回のgovernance gateに含めない。

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

1. governance差分の検証・review・local commitを確定し、同じPM-15で製品準備を再開する。現在の担当へ今回の明示指示と正本を渡し、重複作業を防ぐ。
2. [Customer実装](customer-master.md)、[現行仕様](../specification.md)、[Dev runbook](../runbooks/dev-deployment.md)、[ADR 0043](../decisions/0043-dev-trial-existing-document-handling.md)を読み、変更差分と関連reader/writerから3条件を判断する。既存の形式不適合を未修復の証拠として保持し、件数だけからmigrationを要求しない。3条件へ該当するなら必要な対象の状態確認と変換を計画し、非該当なら通常操作を試すDev release案を準備する。
3. Dev案には`firestore.rules`とHosting（`dist/`）の対象、残る派生値のrisk、旧client併存、整合した反映順、rollback、通常の作成・編集・保存と拒否経路の確認をまとめる。実行対象commit・現在のremote revision・rollback先を推測で固定せず、接続・build・deploy・data操作の承認範囲を明示する。
4. Dev接続・テスト開始前で停止し、未確認のremote状態と次の実行単位を報告する。本変更でdataは変更しない。文書方針のrollbackは対象commitの安全なrevertまたはcorrective commitで行う。

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
