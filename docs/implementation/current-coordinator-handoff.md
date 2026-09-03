# Current coordinator handoff snapshot

- 状態: Current / PM-15継続。Customer追加検証のreview完了・利用者との範囲合意待ち。マスタデータ管理の改修を先行
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- former coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local` / retired・product作業と割当なし。通常product callbackは送らない。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `281272410dbb09e477e1e9c898c39225ec9b683e`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `CUSTOMER-01E-TEST-SCOPE-REVIEW-001`
- objective: Customerの既存検証を再利用し、追加すべき検証と省略できる確認をreviewerと検討して利用者へ提示する。マスタデータ管理を先行する指示に反する次工程の記載を訂正する。
- approved scope: reviewerによるCustomer code/Rules/test/記録のread-only評価と、coordinatorによる進行順序・すり合わせ用提案の文書化。追加テストは利用者との範囲合意前に実行しない。新しい実装、Dev操作・data変更、deploy、他機能の検証は含めない。
- completion contract: 必要な追加検証、期待結果、actor・data・準備、既存証拠で省略できる項目、残る不確実性を区別した提案を提示する。検討結果を検証済み・承認済みと扱わない。
- work ownership: reviewerがread-only検討、PM-15が優先順位の訂正・提案整理・文書とGit統合を管理する。
- review result: [追加検証のすり合わせ案](customer-dev-release.md#追加検証のすり合わせ案)。reviewerはDevの閲覧専用・編集可能な非管理者の2種類を推奨。coordinatorはlocalの権限不足update拒否・他社get/list拒否の不足2境界を補う案も提示する。追加テストは未承認・未実施。実Devの直接拒否probeを省く場合の未確認事項も提案に明記した。
- local evidence: [CUSTOMER-01C local preparation](../verification/customer-01c-local-preparation.md)。artifactは証拠に記録したsource commitへ束縛し、本snapshot等の文書commitをbuild sourceとして扱わない。
- Dev evidence: [CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)。Rules・Hosting反映と座標付き保存不具合の修正を完了。Emulator113件、domain817件成功、security review完了。Devの正常作成・基本情報・支払条件、指定既存対象の備考復元、Site同期・Agreement初期締日を確認。合成Customer/Site/Billingの3件は削除・不存在確認済み。権限別remote試験は未実施。

## Open decisions and approvals

- 利用者は全件診断・一括修復を既定にしない方針と、Schemaの明らかな変更・他機能への明確な影響・その他確実に必要な場合の状態確認と必要なmigrationを採用し、governance反映と作業再開を指示した。規則の正本はproject rulesとする。
- 次の製品作業は[roadmapのCustomer次工程](../roadmaps/airguard-v2.md#次の作業)。追加の集計tool・ID別修復一覧・全件修復を一律の先行作業にする提案は取り下げる。既存tool・immutable receiptを削除・改変しない。
- 利用者はマスタデータ管理機能の改修を先に行うと再確認した。Customer直後に稼働実績管理へ移る提案は誤りとして訂正し、他マスタの対象・順序を利用者と合意する。今回の検討はCustomerに限定する。
- 利用者は必要時の診断でIDを収集することを許可したが、今回の方針採用で診断toolの作成・再読取りを自動実行しない。診断が必要になった時点で目的・対象・出力先を限定する。
- 利用者は今回をproject固有ルールの変更として「タスクの交代は必要なし」と明示した。GOV-DEV-DATA-001に限りこの指示を優先し、PM-15と現在の担当を継続する。一般のturnover規則は変更しない。
- 利用者はlocal準備後に「Devテスト開始」を指示し、利用停止不要、適当な検証用dataの作成と終了時削除、指定既存取引先での編集試験を承認した。試験住所・関連data・削除境界は[実行計画](customer-dev-release.md)へ固定する。以前の一度の全件Dev読取り承認は再利用しない。
- 利用者は今回のフェーズがCustomer管理であり請求書の確認は広すぎると指摘し、請求受入れを稼働実績管理改修後へ移した。停止指示前に作成した0円Billingも削除済み。PDFは未出力。フェーズごとにテスト範囲を事前合意し、追加時も確認するproject ruleの反映を承認した。
- 同じCustomer改修におけるproject固有ルール反映を継続し、この作業では利用者の既存のタスク交代不要指示に従う。common contract、managed AGENTS、Codex権限・agent設定は変更しない。以後の別作業のturnover免除へ一般化しない。
- Git push、main merge、Prod、対象外のremote/data変更は本checkpointの対象外。
- 新しい小規模Dev migration高速経路は作成しない。
- App Check・全般的なrate limit・Callable public invoker常時監視はProd公開前gateへ移し、Customerを次のCRUD見直し対象とする利用者判断を反映済み。
- CUSTOMER-01Aのlocal実装・自動検証・Codex専用local UI受入れは完了した。
- local UI受入れは[ADR 0042](../decisions/0042-risk-based-local-ui-acceptance.md)と[local UI検証runbook](../runbooks/local-ui-testing.md)を正本とする。本変更はその基準でlocal完了とし、Dev受入れは別checkpointとする。
- 報告は平易な日本語とし、作業単位ごとの所要時間と無駄な作業の有無を併記する。

## Next checkpoint

1. 文書化した案（Dev2種類＋local2境界）の対象/対象外・環境/actor/data・期待結果・完了条件を利用者とすり合わせる。採用後に実行計画の主要拒否scopeと省略理由を更新し、必要なaccountの準備方法を確定する。権限別remote試験の未実施を明記し、請求書確認をCustomerフェーズへ戻さない。
2. Customerの終了判断後もマスタデータ管理の改修を先に進める。次のマスタとそのテスト範囲は別途合意する。既に確認済みの会社管理者による通常保存とcleanupは再実行しない。

### 今回の検証選択

今回の変更は優先順位の訂正と合意前の検証案の文書化であり、追加のrelease承認・readiness・remote実行を成立させない。documentation-onlyとしてproject-docsとdiff-checkを選び、project rulesの文書検証指示に従いmanaged-governanceも確認する。code、Rules、既存検証結果、project rules、verification policyは変更しないため、domain・Emulator・UI・build・Dev、negative fixture・capacityを反復しない。

`powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`と`git diff --check`はこの最終snapshotを含めて独立実行し、結果をcoordinatorのcommand報告へ残す。Rules/製品codeは不変なのでEmulator113件・domain817件の成功証拠を再利用し、Dev生成・UI・remote試験を文書変更のために反復しない。managed AGENTS・common contract・verification policy・Codex権限設定は変更なし。

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
