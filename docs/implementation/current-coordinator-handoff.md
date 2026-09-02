# Current coordinator handoff snapshot

- 状態: Current / PM-14 active ownership; PM-15への利用者指示による交代準備
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-14 task `01a05c75-bdfd-75e0-bcda-f167b8541bff`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- replacement coordinator: PM（AirGuardV2）-15。task IDは新規作成結果で確定し、変更なしcallbackの確認後に移管する。失敗時はPM-14を維持する。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `26ccfe6000596ced6f345dd0598d5f1fef15aa1a`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `PM15-HANDOFF-ACTIVATION-001`
- objective: 完全新規PM-15のprimary repository接続、権限、変更なしcallback、snapshotだけの最初のlocal commitを確認する。
- approved scope: 利用者の「タスクを交代し、新しいタスクに作業を開始させてください」に基づく交代と次項のlocal作業。交代工程で変更するfileは本snapshotだけ。subagent、application変更、Dev接続、build、deployを交代工程へ混在させない。
- completion contract: [効率化runbook](../runbooks/coordinator-handoff-efficient-activation.md)のactivation receiptと旧coordinatorの最小独立確認が一致した後、PM-15をactive ownerにする。
- work ownership: PM-14は新規product作業を止め、移管確認だけを行う。未統合差分なし。旧専門taskへの割当は終了し、新taskへ自動継続させない。

## Open decisions and approvals

- 利用者はPM-15への交代と新taskでの作業開始を指示した。直前に提示した`CUSTOMER-01B-PREFLIGHT-TOOL-001`のlocal確認用tool作成を次の開始範囲とし、Dev接続まで承認されたとは扱わない。
- Git push、main merge、Dev/Prod deploy、remote/data操作、外部service変更は本checkpointの対象外。
- 新しい小規模Dev migration高速経路は作成しない。
- App Check・全般的なrate limit・Callable public invoker常時監視はProd公開前gateへ移し、Customerを次のCRUD見直し対象とする利用者判断を反映済み。
- CUSTOMER-01Aのlocal実装・自動検証・Codex専用local UI受入れは完了した。
- local UI受入れは[ADR 0042](../decisions/0042-risk-based-local-ui-acceptance.md)と[local UI検証runbook](../runbooks/local-ui-testing.md)を正本とする。本変更はその基準でlocal完了とし、Dev受入れは別checkpointとする。
- 今回の交代理由は利用者の明示指示であり、project固有の受入れ基準変更やsession容量を理由とする交代ではない。
- 報告は平易な日本語とし、作業単位ごとの所要時間と無駄な作業の有無を併記する。

## Next checkpoint

1. 移管後に`CUSTOMER-01B-PREFLIGHT-TOOL-001`を開始する。必読は[Customer実装](customer-master.md)、[Dev接続・反映手順](../runbooks/dev-deployment.md)、[開発workflow](../runbooks/development-workflow.md)、現行Customer仕様と[検証policy](../../governance/verification-policy.json)。既存code・Rules・testを照合し、必要なskillを読む。
2. local変更範囲はCustomerの26項目定義と読み取り専用の生document検査、`utils/customer/customerWriter.js`での項目定義共用、新規`scripts/check-customer-dev-compatibility.mjs`、関連test、必要最小限の案内文書。画面・Rulesの許可挙動は変更しない。Rules不備を発見した場合は別途提示する。
3. checkerは書込み機能を持たず、値・ID・資格情報・data由来hashを出力しない。件数と不適合理由の集計だけを出す。接続先不一致、読み取り失敗、想定外path、不適合、不明な結果では成功にしない。現時点でDevの実件数・互換性は未確認であり、checkerも未実装である。
4. 直接影響するtestから開始し、最終状態で選択した検証を一度実行する。review済みfileだけをlocal commitし、pushしない。local変更のrollbackは対象commitの安全なrevertとし、外部dataへの影響はない。
5. tool完成後、Dev read-only実行の対象・command・停止条件を別承認として提示する。Dev反映も別承認とし、RulesとHostingの対象、反映順、rollback、Dev確認項目をまとめる。不適合発見後のmigration・repairへ進まない。

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
