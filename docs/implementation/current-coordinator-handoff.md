# Current coordinator handoff snapshot

- 状態: Current / PM-16からPM-17への利用者指示による交代準備。activation確認まではPM-16がownerを維持する。
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-16 / task `01a06579-64d2-7931-a15d-30fc1fad2f79` / host `local`
- active callback and assignment destination: PM-16の上記task ID。交代中はproduct割当を停止し、subagentを使わない。
- pending coordinator: PM（AirGuardV2）-17。完全新規taskとして作成し、IDは作成結果とno-change receiptで確定する。fork・別worktreeは使わない。
- ownership: 利用者が2026-09-03に「タスク交代」を明示指示した。直前のGit報告ルール追加時の「交代不要」とは別の後続指示である。旧taskはarchive/deleteしない。
- coordination procedure: [project coordination](../runbooks/project-coordination.md)、[activation手順](../runbooks/coordinator-handoff-efficient-activation.md)

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/customer-status`
- pre-handoff HEAD: `fa55671ea9130e9e553ac4cbf88744b453e21331`
- activation baseline: 本snapshotの準備commit後のfull HEADをGitで取得し、新taskの初期messageへ渡す。本file自身を含むcommitの自己参照は作らない。
- expected upstream: none
- expected worktree registry: primary repository 1件。開始worktree clean、未統合差分なし。旧subagentへの未完了割当なし。
- remote: `origin`。現在値は[Git報告手順](../runbooks/project-coordination.md#git現在状態の報告)でlocalとremoteを分けて確認する。今回の引継ぎは既存originの対象ref読取りだけを許可し、fetch・push・merge・認証更新は行わない。接続不能なら未確認を明示する。
- common governance: `1.5.0` / SHA-256 `0a13fc03273030594e4355dc3ec29b62ee1abb350311761de77154817fcaf6ac`
- specification: `0.8.6`
- active instruction sources: root `AGENTS.md`、`governance/project-rules.md`、task-routed runbooks。
- permissions: primary workspaceへのwrite、`.git`は通常read-onlyで必要なlocal stage/commitは承認付き昇格、reviewは`auto_review`、networkはrestricted。新taskは実権限と`.codex/config.toml`を独立照合し、差があれば変更前に報告する。認証情報やCodex所有databaseを調査しない。
- Customerの適用commit・実行結果・cleanup・残存制約は[local検証記録](../verification/customer-02-status-local.md)を正とする。Git報告ルールの検証はpre-handoff HEADのcommit本文を参照する。

## Active checkpoint

- checkpoint: `PM16-PM17-HANDOFF`
- objective: 新taskのrepository再開・権限・callback・最初のfile限定commitを確認し、ownerを移管する。製品作業は同時に再開しない。
- owned files: `docs/implementation/current-coordinator-handoff.md`だけ。retiring側の準備とreplacement側のowner更新を直列に行う。
- forbidden scope: application、Rules、test、package、managed common/AGENTS、権限設定、data、build/runtime、Dev/Prod、fetch/push/main merge、他taskのarchive/delete、subagent起動。
- validation: project-docs、managed-governance（policyによりrenderer-checkを内包）、diff-check。正規commandと独立exitを記録する。source/validator/policy不変の他gateは再実行しない。製品仕様・data契約・roadmap進捗は不変更。
- completion contract: no-change receipt受領後だけsnapshot 1件のowner更新を許可する。replacementのstaged/committed blob一致、exact committed path、branch/HEAD/upstream、clean、primary-only worktreeをformerが独立確認してから移管完了とする。失敗時はPM-16を維持し、重複割当しない。
- rollback: 移管成立前の失敗では旧ownerを保持し、必要ならsnapshotだけをcorrective commitする。履歴書換え・他者差分破棄はしない。
- user work-session ending condition: 今回は移管確認と報告で終了し、新taskは利用者の次の指示を待つ。

## Open decisions and approvals

- 次の製品checkpointは`CUSTOMER-02-STATUS`。[確認済み仕様](../specification.md)、[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)、[工程・進捗](../roadmaps/customer-status.md)、[検証記録](../verification/customer-02-status-local.md)から再開する。状態は現在状況flagで、選択・関連現場/予定を制限せず、日時・原因等は追加しない。
- local実装・検証・review・文書・local統合は承認範囲内。Dev反映・受入れは延期。archive/restore、code一意性/検索拡張、請求/PDF全体、他マスタ・関連package変更、remote data/migrationは対象外。
- [CONF-0145](pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint): 専用UIの郵便番号通信遮断と限定再試験は承認済み。通常利用・Dev・Schemas・保存形式を変えない。
- [CONF-0146](pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外): 親による合成Authの一時設定まで含める担当例外は未回答。「再質問してください」や今回のタスク交代指示を承認に読み替えない。認証情報をprompt・文書・logでagent間に受け渡さない。
- Customerの設計/reviewはHigh、開発/修正はMedium、test/環境準備/cleanupはLow。旧taskでは子のbrowser接続不可・親の接続成功を確認し、画面テストだけ親が担当する例外は承認済み。非UI認証準備はCONF-0146で分ける。新taskの接続能力は再確認する。
- 「Functions Developer」別task利用案は取り下げ済み。割当しない。Norton申告の関連package内scriptは今回の実行対象ではなく原因未確定。検知回避・除外設定・再実行は行わない。
- 反省会一時メモは`.codex-test/customer-status-retrospective.md`、設計補助メモは`.codex-test/customer-status-security-design.md`。反省会と改善作業の両方が終了するまで削除しない。

## Next checkpoint

1. 新taskは最小restart集合と本snapshotを読み、`PM16-PM17-NOCHANGE`のreceiptをPM-16へ1回送る。変更・test・runtime起動・subagentなしで待機する。callback失敗時は自taskへ結果を残して停止し、反復送信しない。
2. PM-16が受領・照合後、`PM16-PM17-ACTIVATE`を指示する。新taskが本snapshotのactive owner・callback先・former task・現在checkpointを更新し、正規validatorと最初のfile限定stage/commitを実施する。
3. PM-16がreceiptとGitを独立確認してからownerをretireする。新taskは製品作業を始めず、利用者の次の指示を待つ。旧taskは利用者操作まで残す。
4. Customer再開指示後は上記正本とCONF-0146を確認し、必要な回答を得てから専用UIの認証準備・限定画面再試験へ進む。build前に実担当のin-app browser接続を確認する。別taskのbrowser handle・保存sessionが使えるとは仮定しない。
5. UI再試験は合成Customer 1件の7桁手入力・手動住所・保存/reload・状態取消/終了/復帰/filterに限定する。[local UI手順](../runbooks/local-ui-testing.md)でclean HEADの専用buildを行い、自身のprocess/生成物をcleanupする。旧taskのtab・専用process・生成物・log-backupはcleanup済み、反省会メモは保持済み。

## References

- [文書案内](../README.md)
- [引継ぎの判断](../decisions/0030-efficient-coordinator-handoff-activation.md)
- [検証policy](../../governance/verification-policy.json)
- [開発workflow](../runbooks/development-workflow.md)
- [local Emulator検証](../runbooks/local-emulator-testing.md)
- [検証証拠索引](../verification/README.md)
- [変更履歴](../../CHANGELOG.md)
