# Current coordinator handoff snapshot

- 状態: Current / 専用UI通信隔離の実装・自動test・build成功、合成認証準備の担当確認待ち
- 更新日: 2026-09-03
- active coordinator: PM（AirGuardV2）-16 / task `01a06579-64d2-7931-a15d-30fc1fad2f79` / host `local`
- active callback and assignment destination: このタスク。subagent callbackはprimary `/root`へ返す。
- ownership: 利用者が2026-09-03に現在のタスクをCustomerフェーズの担当として記録し、旧タスクへの作業割当なしで進めることを明示承認した。本更新は古いowner記録の訂正であり、governance・権限変更や新規task作成ではない。
- coordination procedure: [project coordination](../runbooks/project-coordination.md)
- former coordinator: PM（AirGuardV2）-15。今回の割当・callback先には使用しない。archive/deleteしない。

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- checkpoint start branch: `codex/dev-user-reservation-migration`
- checkpoint start baseline: `cfa23595b37f2709131caab6f2a4be03713a8f95`
- Customer implementation branch: `codex/customer-status`
- implementation/test integrated commit and successful UI build source: `cc562f2ed8b22502986556ab0799ce2d721c646e`
- UI observation source: `2c05c912eaae1d2ba1cb4a22696567586666b6c1`。専用build成功・対象UI操作成功。ただし外部郵便番号通信の隔離未達によりlocal受入れ完了とはしない。
- postal isolation integrated/build source: `6ed23fc664b8988149bf4a6ca6183263b14936c6`。適用状態と検証の区別は[local検証記録](../verification/customer-02-status-local.md)を正とする。
- current integrated revision and branch: Gitの現在HEADとbranchを確認する。本snapshot自身を含むcommit hashを自己参照で固定しない。
- expected upstream: none
- expected worktree registry: primary repository 1件のみ。別worktreeは使わない。
- common governance: `1.5.0`
- active instruction sources: root `AGENTS.md` and `governance/project-rules.md`
- 開始時に保持していた現タスク自身の先行文書差分は上記実装commitへ統合済み。他者の差分は含まない。今回の再開用文書整理はcoordinator所有であり、引継ぎ時のHEAD・clean状態はGitで再確認する。

## Active checkpoint

- checkpoint: `CUSTOMER-02-STATUS`
- objective: Customerの現在の取引状態を表示・編集できるようにし、local実装・検証・review・文書・Git統合までを進める。Dev受入れは別途。
- source of truth: [現行仕様](../specification.md)、[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)、[工程・進捗](../roadmaps/customer-status.md)。完了済みの作成・基本・支払編集と今回の状態編集を区別する。
- approved scope: 取引状態の表示・編集、変更fieldだけの保存、Customer一覧から対象へ到達する導線、状態によってCustomer選択や関連現場・予定へ制限を加えないことの回帰検証。
- forbidden scope: archive・restore、code一意制約や検索拡張、請求・PDF全体、関連package変更、全件Dev診断・migration、Dev・Prod・remote操作、push・main merge。
- delivery sequence: 仕様整合 → 設計と独立review → 実装と自動test → Codex専用local UI → 最終review・検証・文書・local commit。新しい利用者判断は勝手に確定しない。
- role ownership: coordinatorは文書・設計契約・Git。application/Rulesはdeveloper、testは明示した範囲のtester。設計・reviewはHigh、開発・修正はMedium、testはLow。独立scopeを並列化し、初回は変更なしcallbackを確認する。
- completion contract: exact files・差分、検証command/result/exit、review所見、local UIと非UI証拠の区別、未検証・承認待ち、cleanup、worktreeを報告する。Dev受入れとCustomer全残作業の完了は主張しない。

## Open decisions and approvals

- 利用者は取引終了を単なる現在状態flagと確定した。日時・理由・特別履歴を追加しない。関連現場・予定の存在で変更を拒否せず、状態だけを理由に選択・編集を制限しない。削除・archiveの安全条件とは別扱い。
- 利用者は提示済み工程の開始とlocal完了までの連続実施を承認した。Dev受入れを後回しにする指示は、Dev反映・受入れ成功の意味ではない。
- 「Functions Developer」別タスク利用案は取り下げ済み。割当しない。
- 反省会用の効率改善事項は一時メモへ記録する。反省会と改善作業が終了した時点で削除し、恒久仕様へ混在させない。
- 新しい画面・操作の利用者判断が必要な範囲は[ADR 0042](../decisions/0042-risk-based-local-ui-acceptance.md)に従って残す。既存の内部改修で条件を満たす範囲はCodex local証拠で完了できる。
- 可視UI担当: Low testerは正規in-app browserへ接続不可。親タスクでは接続成功し、利用者は2026-09-03に画面テストに限り親が担当する推論レベル指定の例外を明示承認した。自動test・専用環境準備・後処理はLowを維持する。Dev・利用者Chromeへの切替、新task作成、恒久role/governance変更へ許可を拡張しない。
- [CONF-0145](pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint): 専用UIの郵便番号browser直接通信を止める限定修正・再試験は追加承認済み。利用者の一時保留回答は直後の明示承認で置換された。Customer対象操作は成功したが、通信境界未達をHigh security reviewで確認したため、通常利用・Dev・Schema・関連packageを変えない最小案を設計・実装する。

- [CONF-0146](pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外): 再試験で保存済み合成sessionを再利用できず、一時認証準備と通常UI入力を親が同一memory内で扱う限定例外を確認中。既存の画面テスト限定承認を非UI設定へ自動拡張しない。

## Next checkpoint

1. 成功済み証拠と再利用・失効判定は[local検証記録](../verification/customer-02-status-local.md)を正とする。追加隔離の実装・自動test・High再review・clean専用buildは完了したが、画面再試験は未完了。
2. CONF-0146の回答を得て認証準備の担当を固定する。未回答のまま親による非UI一時設定や、agent間のcredential受け渡しを行わない。
3. 再開時はclean HEADの専用buildと準備をLowが行い、承認された認証準備の後、親が合成Customer 1件の7桁手入力・手動住所・保存/reload・状態取消/終了/復帰/filterを通常UIで再試験する。既存in-app browser bindingを再利用し、閉じたtabだけ新規取得する。利用者Chromeへ切り替えない。
4. 親tab・今回の専用process・生成物・log-backupはcleanup済み。CS-03は再試験まで加点しない。進捗とDev・利用者判断は[ロードマップ](../roadmaps/customer-status.md)を正とする。
5. 反省会一時メモは`.codex-test/customer-status-retrospective.md`、設計補助メモは`.codex-test/customer-status-security-design.md`。両方とも今回の生成物cleanup対象外。

## References

- [文書案内](../README.md)
- [開発workflow](../runbooks/development-workflow.md)
- [検証policy](../../governance/verification-policy.json)
- [local Emulator検証](../runbooks/local-emulator-testing.md)
- [local UI検証](../runbooks/local-ui-testing.md)
- [検証証拠索引](../verification/README.md)
- [変更履歴](../../CHANGELOG.md)
