# Current coordinator handoff snapshot

- 状態: Current / PM-15 active ownership; Customer local tool実装・検証済み、Dev read-only実行は別承認待ち
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-15 / task `01a06437-1ef9-7150-b3c0-c611f09d48e0` / host `local`
- program coordinator: PM（SPG）-05 / task `01a05be0-9996-7361-a6d6-e7062e4eee41` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- former coordinator: PM（AirGuardV2）-14 / task `01a05c75-bdfd-75e0-bcda-f167b8541bff` / host `local` / retired・product作業と割当なし。通常product callbackは送らない。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `ce45faf17a9cfea27e370e538476391ddfb17219`
- current integrated revision: Gitの現在HEADを確認する。本snapshot自身を含むcommit hashは文書へ自己参照で固定しない。
- expected upstream: none
- expected worktree: clean after coordinator integration
- expected worktree registry: primary repository 1件のみ
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`

## Active checkpoint

- checkpoint: `CUSTOMER-01B-PREFLIGHT-TOOL-001`
- objective: Customerのlocal確認用toolを作成・検証し、Dev read-only実行の別承認に必要な対象・command・停止条件を提示する。
- approved scope: 共有26項目定義、生document検査、writerの項目定義共用、関連testと必要な案内文書、review済みfileのlocal commit。画面・Rulesの許可挙動、package、Dev・network・remote data・build・deploy・pushは対象外。
- completion contract: local実装・選択した検証・独立review・local commitと、次項の別承認事項の提示。実装の正本は[Customer実装](customer-master.md)、実行・停止手順は[Dev runbookのCustomer事前検査](../runbooks/dev-deployment.md#customer保存形式のread-only事前検査)。
- work ownership: PM-15が管理し、developerの限定差分とreviewを受け入れて統合する。PM-14と旧専門taskへの重複割当は行わない。

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

1. [Dev runbookのCustomer事前検査](../runbooks/dev-deployment.md#customer保存形式のread-only事前検査)にある固定commit・全階層Customers読取範囲・command・上限・停止条件について利用者承認を得た場合だけ、Dev read-only実行へ進む。必読は同runbook、[Customer実装](customer-master.md)、現行Customer仕様と[検証policy](../../governance/verification-policy.json)。
2. Devの実件数・互換性、実資格情報・OAuth・実REST応答、現在のedition・IAMは未確認。local合成testや実装完了をその証拠にしない。取得不能、想定外path、不適合、未検証のUnicode・GeoPoint表現、上限超過では停止し、data破損や互換を推測しない。
3. Dev反映も別承認とする。互換性結果と派生値の残存risk、旧client併存を確認し、`firestore.rules`とHosting（`dist/`）の対象、server/clientの整合した反映順、rollback対象、Devの正常・拒否・保存再表示確認を一つのbounded releaseへまとめる。現在のremote revisionとrollback先を未確認のまま固定しない。不適合発見後のmigration・repairへ自動的に進まない。
4. local tool変更のrollbackは対象commitの安全なrevertとし、外部dataへの影響はない。

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
