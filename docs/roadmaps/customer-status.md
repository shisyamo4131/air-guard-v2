# Customer取引状態の表示・編集ロードマップ

- 状態: In progress
- 開始日: 2026-09-03
- 現在の進捗: 50%
- 部分加点: なし
- 完了条件: 状態表示・編集の設計、実装、自動test、Codex専用local UI、独立review、文書・Git統合、必要な利用者UI判断、別途承認するDev反映・Dev受入れを完了する。
- 正本: [現行仕様](../specification.md#取引先現場取極め)、[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)

## 今回の承認境界

利用者は工程を確認し、local実装・検証・review・文書・local commitまでの連続実施を承認した。Dev受入れは後回し。未実施のDevを成功として100%へ加点しない。作成・基本情報・支払条件の先行フェーズとは別の利用者価値として管理する。

対象は取引状態の表示・編集とその保存・選択・関連処理の回帰だけ。archive・restore、code一意性・検索拡張、請求全体・PDF、他マスタ改修、package更新、Dev全件診断・migration、remote操作は対象外。

## 工程と担当

1. coordinator: obsoleteな状態制限の文書を正本へ揃える。
2. 設計High: UI・保存・購読・同期の契約、exact files、互換性・rollbackを確認する。
3. review High: 実現可能性、失敗経路、権限・tenant・Rulesを独立確認する。
4. developer Medium: 承認範囲のapplication/Rulesを実装する。tester Lowのtest file変更と所有範囲を分離する。
5. tester Low: 対象test、影響領域の回帰、必要なEmulator陰性testと修正後の再検証を行う。
6. UI tester Low: clean commitの専用build・generated serverで通常の可視操作を検証する。
7. review Highとcoordinator: 最終差分・結果をreviewし、必要な最終gateとlocal統合を行う。
8. coordinator: local完了・未検証・Dev待ち・利用者判断を区別して報告する。反省会用一時メモは反省会と改善完了まで保持する。

## 設計契約

- `UPDATE_BASIC`が`contractStatus`を所有し、既存の基本情報editorとClass schemaを使う。CREATE入力には追加せず、初期ACTIVEを維持する。支払条件とは別operationのまま。
- 状態だけの更新patchは`contractStatus`・既存`uid`・`updatedAt`。名前・住所・位置・支払条件・createdAtは変えず、終了日時・理由・専用履歴は追加しない。
- 状態の表示titleは既存Schemaの「契約中」「契約終了」を再利用する。一覧はACTIVE初期値、TERMINATED、全件の表示切替と行ごとの状態表示を提供する。これは管理一覧の絞込みであり、他documentのCustomer選択制限ではない。
- 一覧は既存adapterへの`subscribeDocs({ constraints })`を正しく使う。旧実装の配列渡しでは条件が届かない静的経路を確認したため、旧UIが実際にACTIVEだけ取得できていたとは断定しない。再購読時の解除・旧行初期化を回帰する。adapterの非同期listener error通知不足は今回の新規reader追加で補わず、残存制約として記録する。
- 基本editorのrollback待ち中に真正な外部値が届いたときは再読込へ進めるようにする。非同期準備後の送信直前に現在の権限と同operationの観測済み競合を再確認する。送信後の同時更新まで原子的に防ぐCAS/transactionは追加しない。
- 既存`onUpdateCustomer`による同社`Sites.customer`への投影同期は維持する。Site自身の状態・予定を自動終了しない。Codex専用Functions entrypointはこのtriggerをexportしないため、実handlerのmock隔離testと、Rules/画面試験を別の証拠として扱う。
- developerのowned filesは`customerOperations.js`、`useCustomerActions.js`、Customer基本editor/基本表示、CustomersDataTable、Customer一覧、Customer部分の`firestore.rules`。testと文書は他担当へ分離。writer・Functions・package・共通権限・archiveは変更しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| CS-01 設計・仕様・失敗/権限review | 15 | 15 | Completed | [設計・差分review](../verification/customer-02-status-local.md#設計差分review)、仕様・ADR、保存・表示契約 |
| CS-02 実装・自動回帰・Rules検証 | 35 | 35 | Completed | [自動test・command結果](../verification/customer-02-status-local.md#自動testcommand結果)、exact field保存とRules拒否境界 |
| CS-03 Codex local UI・最終review・統合 | 30 | 0 | In progress | 専用build・独立review・実装local commit済み。[親担当の可視UI検証へ進む](../verification/customer-02-status-local.md#証拠の分担)。UI・最終統合まで加点しない |
| CS-04 利用者判断・Dev反映・Dev受入れ | 20 | 0 | Deferred | 新UIの判断と、別承認のDev反映・権限別受入れ |

重み合計100。各マイルストーンの証拠がすべて揃った場合だけ加点する。今回のlocal工程の到達点はCS-03までであり、CS-04は後続とする。

## 検証選択

影響classはUI、application logic、data contract/Rules、専用build。`governance/verification-policy.json`のunionとして、`project-docs`、`project-docs-negative`、`capacity-regression`、`managed-governance`（rendererを内包）、`diff-check`、`domain-full`、`local-emulator-suite`、`local-ui-build`を選ぶ。iterationは変更対象testに絞り、最終適用状態のgateを残す。`generate-dev`と`generate-prod`は未承認の別環境releaseなので実行しない。

local UIの正規command・準備・cleanupは[runbook](../runbooks/local-ui-testing.md)、Emulator隔離は[runbook](../runbooks/local-emulator-testing.md)に従う。承認された専用buildは`npm run test:local:ui:build`。UIの業務対象を非UI注入せず、Rules fixtureと可視操作の証拠を分ける。

## 復旧と互換性

既存の状態値・document形状を維持し、migrationは実施しない。local変更の復旧はreview済みcommitの安全なrevertで行い、他者変更や履歴を破壊しない。戻すと状態編集・表示切替が失われ、旧購読引数の不一致も復帰する。旧一覧の実表示は未確認であり、終了済みが必ず非表示だったとは断定しない。Dev未反映なので今回remote rollbackは不要。将来のdeployではclientとRulesの組合せと復旧対象を別checkpointで固定する。

## 次工程

実装・全domain・専用Emulator・独立review・専用buildは成功しlocal commit済み。Low testerからin-app browserへ接続できず、親タスクだけ接続できたため、利用者は2026-09-03に画面テストに限る親担当を承認した。自動test・環境準備・後処理はLowを維持し、clean HEADの専用buildを再生成してlocal UI・後処理・最終統合へ進む。実行証拠は[local検証記録](../verification/customer-02-status-local.md)を参照。Customer全体の残改修は[製品ロードマップ](airguard-v2.md#次の作業)から別途扱う。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-09-03 | 15% | +15 | 仕様・表示保存契約を確定し、Highの独立設計・失敗経路・security reviewを統合した。実装・対象testは提出済みだが、最終回帰とlocal UIは未完了のためCS-02/03は加点しない。 |
| 2026-09-03 | 50% | +35 | 状態の基本編集・一覧切替・失敗経路補正を実装し、全domainと専用Emulatorの成功を確認した。local UI・最終文書gate・統合は未完了。 |
