# CUSTOMER-01E Dev権限別検証記録

- 状態: 合意したDev2種類の確認成功・cleanup済み。閉鎖時の追加検証は末尾参照
- 実施日: 2026-09-03 JST
- Checkpoint: `CUSTOMER-01E-SPLIT-TEST-001`
- 計画・account台帳: [Customer Dev検証](../implementation/customer-dev-release.md)
- local結果: [local分担検証記録](customer-01e-local-test.md)

利用者はアカウント整備による一時停止後、Dev検証の再開を指示し、Chromeのアカウント切替を自身で担当するとした。NG事項の修正は禁止。account台帳のセットアップは利用者申告であり、UID・claims・User設定はこのUI試験で直接取得していない。

## manager専用アカウント

利用者へ台帳のmanager専用アカウントへの切替を依頼し、「OKです」との返答後にChromeを観測した（03:44 UTC時点の確認）。

- 期待: 取引先一覧へ到達でき、検証用Customerの作成、備考の保存・再表示・復元を実施できる。
- 実際: navigationにダッシュボードだけが表示され、取引先menuがない。既知のDev `/customers/` URLを初期navigationとして開いても、最終URLは`/dashboard`となり、一覧を表示できない。
- 判定: 一覧到達NG。Customer作成・備考保存・復元は前提未達で未実施。
- 原因: 未確定。アカウントへの役割付与状態・画面側判定のどちらが原因かを断定しない。
- 操作: DOM/ARIAとtab URLの観測、初期URL openのみ。役割変更・製品修正・Rules変更・deployは行っていない。

accountantへ切替を依頼し、managerの状態は修正せず保持した。今回のDev Customer作成・変更・削除は0件で、Codexが作ったcleanup対象はまだない。

### 利用者による原因確認と設定修正

利用者はaccountantへの切替完了とともに、managerの前回到達NGはアカウント作成時の権限設定漏れであり、設定は修正済みと連絡した。前回観測を成功へ書き換えず、利用者が確認した試験accountの準備不備として区別する。Codexは役割設定や製品を修正していない。修正後のmanager動作は再確認待ち。

## accountant専用アカウント

利用者の切替完了後、可視の「取引先管理」を開き、「取引先一覧」linkをクリックして一覧へ到達した。

- 一覧への通常menu経由の到達: OK。
- 作成入口の非表示: OK。
- 一覧は「データはありません。」、0件表示。実際の保存data不存在や読取成功を、この空表示だけから断定しない。
- 詳細閲覧・詳細内の基本情報/支払条件編集、削除/archive入口の非表示: 対象Customerが表示されていないため未実施。

修正後managerへ切替を依頼し、検証用Customerの作成・保存を先に行う。accountantの詳細確認はその後に行う。ここまでのDev業務data変更はない。

## 修正後managerでの実行

利用者の切替完了後、通常menuから取引先一覧へ到達し、作成buttonが表示された。検証用Customerを通常dialogから登録し、一覧の1件表示と詳細を確認した。

| 項目 | 検証用の値 |
|---|---|
| Customer ID | `j4UDm9qlzLIa8fTWlKF8`（作成後の詳細URLで確認） |
| 名称 / code | `検証Customer0903E` / `TEST01E` |
| 略称 / カナ | `検証0903E` / `ケンショウ` |
| 住所 | 計画済みの東京都新宿区西新宿2丁目8番1号 |
| 支払条件 | 作成formの既定値（月末締め・翌月月末） |

備考を空欄から`manager保存確認0903`へ変更し保存、詳細を再読込して反映を確認した。その後通常editorで空欄へ復元し保存、再読込して空欄を確認した。入力は可視controlへのclickと一文字ずつのtyping、復元は通常の全選択・Backspaceを使用した。名称・住所・支払条件の追加編集、関連Site/Billing作成、製品・Rules修正は行っていない。

managerの作成・備考保存・再表示・復元はOK。この時点では検証用Customer1件がcleanup対象として残っており、accountant確認後の削除を予定していた。

## 作成済みCustomerのaccountant確認とcleanup

manager確認後に利用者がaccountantへ切替。通常menuで一覧を開き、同じ検証用Customerの1件表示と閲覧iconを確認した。最初のクリック直後はdashboard表示が残ったため、可視linkをもう一度クリックして一覧へ到達した。原因は未特定で、恒常的な遷移不具合とは断定しない。

閲覧iconから同じIDの詳細へ到達し、名称・住所・空欄へ復元済みの備考・既定支払条件を確認した。作成、基本情報編集、支払条件編集、削除/archiveの入口は非表示。可視textareaのDOMをread-onlyで観測し、備考欄の`readOnly=true`も確認した。UI非表示を実Devの直接write拒否証拠とは扱わない。

終了時にAdminによる対象限定の後片付けを行った。初回は補助commandの略称field名を`abbr`としていたため対象照合段階でexit 1（`849629`）、書込みはなかった。実sourceの`abbreviation`を確認して同じ対象を再照合した。これは後片付けcommandの誤りであり、製品修正・data repairではない。

名称・code・略称・ACTIVE・備考空欄、同じ会社の参照Site/Billing各0件、subcollectionなしを確認し、取得時updateTimeを条件に1件削除した。削除後の独立readで不存在を確認、exit 0（`003ceb`）。Chromeでも一覧へ戻り0件表示を確認した。検証用Customer残存0、検証用Site/Billing作成0、account変更/削除0。利用者が用意したaccountは維持した。

## 統合結果と残存事項

cleanup後、利用者から今回のaccountに紐づく会社と配下dataを今後のDevテスト用として保持する指示を受けた。今後の扱いは[account台帳](../implementation/customer-dev-release.md#dev検証用アカウント台帳)を正とする。上記Customer1件は指示前に削除済みであり、会社とaccountは削除していない。

- Dev: managerの作成・備考保存/再表示/復元、accountantの一覧/詳細閲覧と編集入口非表示はOK。
- local: [別taskの実行記録](customer-01e-local-test.md)にあるCustomer9件・全suite115件は成功。PMによる重複実行なし。
- 初回manager到達NGは、利用者が確認・修正したaccountの権限設定漏れ。修正後の再確認は上記の範囲で成功。Codexは製品・Rulesを修正していない。
- 分担検証終了時点では文書negative fixtureのlink解決NG（local記録参照）とlocal手順書の記載差を未修正として報告した。その後の限定修正は末尾参照。
- 実Devの他社アクセス・権限不足write・delete/archive直接拒否、請求書発行は合意済みの対象外。

Devの再開後観測は03:44 UTCから03:55:58 UTCのcleanup確認まで（利用者の切替待ちを含む）。UI操作だけの正確な所要時間は未計測。製品の重複全件試験は行わず、account設定漏れの再確認と補助cleanup commandの再実行が追加作業となった。

## 利用者承認によるフェーズ閉鎖

利用者は文書検証のリンク解決エラーだけを修正し、Customerの今回フェーズを閉じるよう指示した（2026-09-03）。`scripts/test-project-docs-check.ps1`のfixtureコピー対象へ、実在する`test/local/codex-local-harness.test.mjs`を追加した。リンク削除やvalidatorの判定緩和は行っていない。testerが修正しPMが1行差分をreviewした。

- `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1`: 21ケース成功、exit 0（担当の完了出力 `9d2a12`）。valid baselineとリンク切れの拒否をともに確認。
- `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1`: 7 checks成功、exit 0（PM出力 `4f008b`）。
- 文書・managed governance・差分の最終commandと独立exit statusは閉鎖時のcommand報告に残す。

変更はfixture準備と分担テスト・結果記録の統合だけ。製品・Rules・設定に変更がないためdomain817件、local115件、Dev操作の既存証拠を再利用し、build・再deploy・Dev再試験は行わない。仕様・data contract・ADR・manualの契約変更はなく、managed governance・権限設定・task交代も不要。

Customerの合意したフェーズの終了を記録する。請求書発行、実Devの直接拒否probe、将来機能は今回の完了範囲外のまま。local手順書の記載差は後続運用課題として保持し、今回修正していない。次のマスタの対象とテスト範囲は別途合意する。
