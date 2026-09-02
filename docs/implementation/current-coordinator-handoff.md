# Current coordinator handoff snapshot

- 状態: Current / PM-15 active ownership; Customerの追加診断案を確認待ち
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- former coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local` / retired・product作業と割当なし。通常product callbackは送らない。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `547405672440e30bdd22114db890cb115e392473`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `CUSTOMER-01B-DEV-READONLY-001`
- objective: 承認済みの保存形式検査を一度実行し、結果と未確認事項を記録する。実行証拠は[CUSTOMER-01B検査証拠](../verification/customer-01b-dev-compatibility.md)を正本とする。
- approved scope: 固定commitの既存toolによる一度のDev read-only実行、結果の独立review、必要な文書とreview済みfileのlocal commit。対象・上限・commandは[Dev runbookのCustomer事前検査](../runbooks/dev-deployment.md#customer保存形式のread-only事前検査)の範囲。追加読取り・tool改修・修復・build・deploy・pushは含めない。
- completion contract: 実行結果とexit statusの確認、機密値を含まない証拠記録、選択した文書・comprehensive gate、独立review、local commit、次の未承認scopeの提示。
- work ownership: PM-15が実行・文書・Git統合を管理し、reviewerが結果の解釈と診断案を独立確認する。PM-14と旧専門taskへの重複割当は行わない。

## Open decisions and approvals

- 利用者の「進めてください」は、直前に提示した固定commit・全階層Customers・一度のDev読取り検査への承認として適用した。実行済みの承認を再試行・追加読取り・修復へ流用しない。
- Git push、main merge、Dev/Prod deploy、追加のremote/data操作、外部service変更は本checkpointの対象外。
- 新しい小規模Dev migration高速経路は作成しない。
- App Check・全般的なrate limit・Callable public invoker常時監視はProd公開前gateへ移し、Customerを次のCRUD見直し対象とする利用者判断を反映済み。
- CUSTOMER-01Aのlocal実装・自動検証・Codex専用local UI受入れは完了した。
- local UI受入れは[ADR 0042](../decisions/0042-risk-based-local-ui-acceptance.md)と[local UI検証runbook](../runbooks/local-ui-testing.md)を正本とする。本変更はその基準でlocal完了とし、Dev受入れは別checkpointとする。
- 今回の交代理由は利用者の明示指示であり、project固有の受入れ基準変更やsession容量を理由とする交代ではない。
- 報告は平易な日本語とし、作業単位ごとの所要時間と無駄な作業の有無を併記する。

## Next checkpoint

1. 提案・未承認: 既知26項目と固定理由だけを出力キーにし、欠損・型不一致・文字数超過のdocument件数、および余分な項目があるdocument件数だけを集計するlocal診断拡張を提示する。欠損を型不一致へ重複計上しない。値・ID・未知の項目名・data由来hashは出力しない。合成testと独立reviewで確かめる。
2. local改修を承認・完了した後も、Dev再読取りは改修commit・同じ対象・上限・停止条件を固定して別承認を得る。今回の集計から原因項目、欠損補完値、修復方針を推測して固定しない。実資格情報・OAuth・応答の実行証拠と、未確認のedition・IAM設定全体を区別する。
3. Dev反映も別承認とする。互換性結果と派生値の残存risk、旧client併存を確認し、`firestore.rules`とHosting（`dist/`）の対象、server/clientの整合した反映順、rollback対象、Devの正常・拒否・保存再表示確認を一つのbounded releaseへまとめる。現在のremote revisionとrollback先を未確認のまま固定しない。不適合発見後のmigration・repairへ自動的に進まない。
4. 今回の検査によるdata変更はなく、data rollbackは不要。追加tool改修のrollbackは対象commitの安全なrevertを候補とする。

## References

- [文書案内](../README.md)
- [現行仕様](../specification.md)
- [ロードマップ索引](../roadmaps/README.md)
- [ADR索引](../decisions/README.md)
- [ADR 0041: 文書の単一正本と最終状態検証](../decisions/0041-single-source-documentation-and-final-validation.md)
- [開発workflow](../runbooks/development-workflow.md)
- [検証証拠索引](../verification/README.md)
- [CUSTOMER-01A local acceptance verification receipt](../verification/customer-01a-local-acceptance.md)
- [CUSTOMER-01B Dev compatibility verification receipt](../verification/customer-01b-dev-compatibility.md)
- [STRIPE-05 Dev release verification receipt](../verification/stripe-05-dev-release.md)
- [変更履歴](../../CHANGELOG.md)
