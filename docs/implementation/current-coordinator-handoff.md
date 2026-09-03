# Current coordinator handoff snapshot

- 状態: Current / PM-15継続。Customer今回フェーズ終了。次のマスタとテスト範囲の合意待ち
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

- checkpoint: `CUSTOMER-01E-SPLIT-TEST-001`
- objective: 承認済みDev2種類・local2境界を2タスクで検証し、PMが結果を統合報告する。
- approved scope: 最終追加承認は文書fixture修正とフェーズ閉鎖だけ。先行する[追加検証計画](customer-dev-release.md#追加検証のすり合わせ案)のCustomer検証とcleanup。NG事項の修正、製品code・Rules変更、deploy、請求書等の他機能検証は行わない。
- completion contract: 両担当のOK・NG・未実施、再現条件・実測・exit status、試験data復元/削除と残存事項を統合報告する。未実施を成功と扱わず、NG修正へ続行しない。
- work ownership: PM-15はDevのChrome操作と文書・Git統合。「Local環境テスト」task `01a0650c-501d-7bf0-8569-d3a87f798750` / localは専用Emulatorと`test/local/codex-local-harness.test.mjs`の不足テスト追加・実行だけ。変更なしcallback後に実行割当。PMとlocal担当は同じprimaryを使い、branch切替・重複file編集を行わない。
- current preparation: [local分担検証記録](../verification/customer-01e-local-test.md)と[Dev権限別検証記録](../verification/customer-01e-dev-test.md)へ結果を固定した。local担当は停止中。Devの検証用Customerは削除済み。利用者が作成・切替を担当したaccountは[台帳](customer-dev-release.md#dev検証用アカウント台帳)へ記録し維持した。Codexによる製品修正はない。
- local evidence: [CUSTOMER-01C local preparation](../verification/customer-01c-local-preparation.md)。artifactは証拠に記録したsource commitへ束縛し、本snapshot等の文書commitをbuild sourceとして扱わない。
- Dev evidence: 会社管理者の既存確認は[CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)、今回の権限別UI確認は[CUSTOMER-01E実行記録](../verification/customer-01e-dev-test.md)を参照。実Devの直接拒否probeは対象外。

## Open decisions and approvals

- 今後のDev試験dataの保持は[account台帳の追加指示](customer-dev-release.md#dev検証用アカウント台帳)を正とし、従来の終了時削除指示より優先する。

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

1. Customerの[閉鎖記録](../verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)を参照。local手順書の記載差は後続運用課題として保持する。今回の追加修正はない。
2. Customerの終了判断後もマスタデータ管理の改修を先に進める。次のマスタとそのテスト範囲は別途合意する。既に確認済みの会社管理者による通常保存とcleanupは再実行しない。

### 今回の検証選択

今回の選択は承認済みremote acceptanceとlocal不足テスト追加。remote acceptanceのbuild-release-deploy classによりcomprehensive 5 gateを選び、local担当はCustomer対象と必要なlocal回帰を実行する。製品code・Rules・設定を変更しないためdomain817件の証拠は再利用する。build・generate・再deploy・請求機能の試験は含めない。

選択した各gateのcommand・結果・exit statusは最終command報告へ残す。local不足テストは担当taskの出力と差分をPMが照合し、同じsuiteをPMが重複実行しない。managed AGENTS・common contract・verification policy・Codex権限設定は変更なし。

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
