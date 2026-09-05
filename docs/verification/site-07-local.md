# SITE-07 Codex専用local検証記録

## 対象と判定

- 対象: SITE-07 一覧・検索・UI整合
- 環境: Codex専用local。Dev、Prod、remote、実dataは未接続・未変更
- 影響分類: UI、application logic
- 判定: SITE-07の実装、自動test、独立reviewは完了。clean commitの専用UI buildと内蔵ブラウザ回帰はSITE-08で実施する

## 変更境界

- ACTIVE、TERMINATED、仮登録を独立表示し、Customer未設定時の不要なCustomer読取りを停止した。
- ACTIVE一覧はcurrent Authの会社配下、status=ACTIVEだけをSite専用listenerで購読し、初回loading、正常な0件、失敗、tenant切替、unmountを区別する。
- ACTIVE/TERMINATED一覧は20件単位とし、検索・filter変更時に1ページ目へ戻す。終了検索のclearを含む古い応答を破棄する。
- Autocompleteはstatusを限定せずACTIVEを先にし、TERMINATED確認取消時は元の確定値を保持する。検索・lookupの古い応答とunmount後の応答を反映しない。
- 郵便番号は既存の外部lookup isolation seamを再利用し、最新の7桁と変更されていない住所にだけ反映する。失敗・0件では原因を断定せず入力を保持する。
- 詳細のloading、error、not-found、route変更、listener cleanup、JSTの両端・片端工期、到達可能な操作のaccessible nameを整合した。

Rules、Functions、schema、Site writer、保存field、OperationResult、Billing、SiteOperationSchedule、ArrangementNotificationその他のdocument writeは変更していない。読取りはACTIVE一覧をgeneric Site model listenerから同じ会社・同じACTIVE条件のSite専用listenerへ置換し、Customer未設定Siteの`Customers/{undefined}`相当の不要な読取りを停止した。`SitesDataTable`を使うdashboardとCustomer詳細には状態・工期・accessible action表示が反映されるが、click itemと詳細遷移は維持する。

## 実測した自動検証

| Gate | Command | Result | Exit |
|---|---|---|---:|
| targeted | `node --test test/domain/site-ui-read-state.test.mjs test/domain/site-ui-presentation.test.mjs test/domain/site-postal-code-input.test.mjs test/domain/site-ui-source-contract.test.mjs test/domain/site-lifecycle-ui-source-contract.test.mjs` | 43 passed、0 failed | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1114 passed、0 failed | 0 |
| local-emulator-suite | `npm run test:local` | 166 passed、0 failed。loopback-only、saved data unchanged | 0 |

独立reviewで検出した終了検索clear後の古い結果復活、ACTIVE一覧の状態不足、郵便番号の断定的message、詳細actionの誤ったaccessible nameは修正・再検証した。Rules、Functions、schema、writer、非Site document writeへのscope creepは検出されなかった。

## 残存制約と次工程

- 現行共通Firestore adapterは購読開始後のlistener error callbackを公開しない。ACTIVE一覧はSite専用listenerで解消したが、詳細内のSite・予定・履歴の購読開始後エラーは既存制約として残る。初回error、not-found、route/unmount cleanupは対応済みである。
- `Site/Card`と`Sites/Iterator`は現行routeから到達しないため変更していない。現在到達できるSite操作だけをaccessible buttonへ変更した。
- SITE-08でclean commitの専用Local UI buildを行い、Site、dashboard、Customer詳細、予定、稼働実績、請求、配置通知を内蔵ブラウザで確認する。
- 配置通知と稼働実績には既存の広い権限経路がある可能性があるため、SITE-08では今回の回帰有無と既存権限仕様適合を別判定する。

