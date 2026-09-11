# Customer取引状態の表示・編集ロードマップ

- 状態: Completed
- 開始日: 2026-09-03
- 現在の進捗: 100%
- 部分加点: なし
- 完了条件: 状態表示・編集の設計、実装、自動test、Codex専用local UI、独立review、文書・Git統合、必要な利用者UI判断、別途承認するDev反映・Dev受入れを完了する。
- 正本: [現行仕様](../specification.md#取引先現場取極め)、[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)

## 今回の承認境界

利用者は工程を確認し、local実装・検証・review・文書・local commitまでの連続実施を承認した。Dev反映・受入れはマスタデータ管理の一連の改修後にまとめて行う。未実施のDevを成功として100%へ加点しない。作成・基本情報・支払条件の先行フェーズとは別の利用者価値として管理する。

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
- この完了済みcheckpoint当時のdeveloper owned filesは`customerOperations.js`、旧`useCustomerActions.js`、Customer基本editor/基本表示、CustomersDataTable、Customer一覧、Customer部分の`firestore.rules`だった。後続FGA-02-CUSTOMER-DIRECT-FIREMODEL-18で`useCustomerActions.js`と専用writerは撤去され、現行の通常保存境界はCustomer ManagerからFireModel／ClientAdapterへの直接委譲へ置き換わった。後続改修は現行Manager、`customerOperations.js`の入力field集合、FireModel接続を起点とし、この履歴上のowned file一覧を再利用しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| CS-01 設計・仕様・失敗/権限review | 15 | 15 | Completed | [設計・差分review](../verification/customer-02-status-local.md#設計差分review)、仕様・ADR、保存・表示契約 |
| CS-02 実装・自動回帰・Rules検証 | 35 | 35 | Completed | [自動test・command結果](../verification/customer-02-status-local.md#自動testcommand結果)、exact field保存とRules拒否境界 |
| CS-03 Codex local UI・最終review・統合 | 30 | 30 | Completed | [CONF-0146承認後の限定UI再試験・crash復旧・High最終review](../verification/customer-02-status-local.md#2026-09-04-conf-0146承認後の限定再試験とcrash復旧)とlocal統合 |
| CS-04 利用者判断・Dev反映・Dev受入れ | 20 | 20 | Completed | bounded Dev release後、会社管理者の編集・終了・復帰・状態別検索と、経理accountの閲覧・write導線非表示を確認した。[Dev受入れ結果](../implementation/master-dev-acceptance-plan.md#no10後のcustomeroutsourceremployee-dev受入れ結果) |

重み合計100。各マイルストーンの証拠がすべて揃った場合だけ加点する。CS-04までのDev反映・権限別受入れを完了した。

## 検証選択

影響classはUI、application logic、data contract/Rules、専用build。`governance/verification-policy.json`のunionとして、`project-docs`、`project-docs-negative`、`capacity-regression`、`managed-governance`（rendererを内包）、`diff-check`、`domain-full`、`local-emulator-suite`、`local-ui-build`を選ぶ。iterationは変更対象testに絞り、最終適用状態のgateを残す。`generate-dev`と`generate-prod`は未承認の別環境releaseなので実行しない。

local UIの正規command・準備・cleanupは[runbook](../runbooks/local-ui-testing.md)、Emulator隔離は[runbook](../runbooks/local-emulator-testing.md)に従う。承認された専用buildは`npm run test:local:ui:build`。UIの業務対象を非UI注入せず、Rules fixtureと可視操作の証拠を分ける。

## 復旧と互換性

既存の状態値・document形状を維持し、migrationは実施しない。local変更の復旧はreview済みcommitの安全なrevertで行い、他者変更や履歴を破壊しない。戻すと状態編集・表示切替が失われ、旧購読引数の不一致も復帰する。旧一覧の実表示は未確認であり、終了済みが必ず非表示だったとは断定しない。Dev未反映なので今回remote rollbackは不要。将来のdeployではclientとRulesの組合せと復旧対象を別checkpointで固定する。

## 次工程

状態操作の初回UIで発見したブラウザ直接郵便番号通信は、[CONF-0145](../implementation/pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint)の限定修正・自動test・独立review・専用buildで隔離した。2026-09-04に[CONF-0146](../implementation/pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外)の一時合成認証準備を使い、通常UIの作成・保存・reload・状態取消/終了/復帰/filter、backend補助確認、crash後cleanup、High最終reviewを完了した。CS-03完了で進捗80%とした。2026-09-07のbounded Dev release後、会社管理者の編集・終了・復帰・状態別検索と、経理accountの閲覧・write導線非表示を確認してCS-04を完了した。実行証拠は[local検証記録](../verification/customer-02-status-local.md)と[Dev受入れ結果](../implementation/master-dev-acceptance-plan.md#no10後のcustomeroutsourceremployee-dev受入れ結果)を参照する。Customer archive safetyのCAS-05は別roadmapで追跡する。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-09-03 | 15% | +15 | 仕様・表示保存契約を確定し、Highの独立設計・失敗経路・security reviewを統合した。実装・対象testは提出済みだが、最終回帰とlocal UIは未完了のためCS-02/03は加点しない。 |
| 2026-09-03 | 50% | +35 | 状態の基本編集・一覧切替・失敗経路補正を実装し、全domainと専用Emulatorの成功を確認した。local UI・最終文書gate・統合は未完了。 |
| 2026-09-04 | 80% | +30 | 専用UIの郵便番号通信隔離、fresh build、通常UIでの状態往復・reload・filter、crash後cleanup、High最終reviewを完了した。利用者UI判断とDev反映・受入れはCS-04に残す。 |
| 2026-09-07 | 100% | +20 | bounded Dev release後、会社管理者の基本情報編集・取引終了・復帰・状態別検索と、経理accountの一覧・検索・状態絞込み・詳細閲覧およびwrite導線非表示を確認し、CS-04を完了した。 |
