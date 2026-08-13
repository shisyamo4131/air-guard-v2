# Operation・Schedule・Billing pages deep review

## メタデータ

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-012
- 最終確認日: 2026-08-11
- 対象: OperationResult 3、OperationSchedule 1、Billing 4、Arrangement 1の計9page
- 境界: 直接manager/data-layer/fetch契約だけを照合し、child内部、Rules/schema、PDF/CSV生成本文は再調査していない。

## route・権限・責務

| route | pageSettings | page責務・直接作用 |
| --- | --- | --- |
| `/operation-results/generator` | `site-operation-schedules:read` | 未確定Schedule購読、Generatorへcreate/LEAVED処理を委譲 |
| `/operation-results` | `operation-results:read` | 月次Result購読、Customer/Site filter、create/detail遷移 |
| `/operation-results/[id]` | `operation-results:read` | 基本、worker、稼働外売上、日報、developer duplicate、delete |
| `/operation-schedules` | `site-operation-schedules:read` | fetch rootを用意しSchedule managerへ全処理委譲 |
| `/arrangements-manager` | 同上 | 前日開始のdesktop 14日/mobile 4日をArrangement managerへ渡す |
| `/billings/operations` | `billings:read` | 月次OperationBilling、filter、create/detail遷移 |
| `/billings/operations/[id]` | `billings:read` | 概要、Agreement、請求明細、稼働外売上、worker、日報編集 |
| `/billings/customers` | `billings:read` | Customer billing indexへ一覧・状態・PDF等を委譲 |
| `/billings/customers/[id]` | `billings:read` | Billing集計値、入金予定日、embedded resultsを表示・編集 |

独自`definePageMeta`はなくglobal pageSettings判定に依存する。read permissionとcreate/update/delete/確定/請求編集をpage側で分離しない。正式な権限modelは暫定である。

## query・subscription・filter

OperationResult/OperationBilling一覧はJST当月を初期範囲にし、debounced from/toでremote購読する。Customer/Siteはcallbackでcache取得し、選択filterはclient側である。pageはloading/error/empty/retryを受け取らない。MonthSelectorへの`model-value`は`dateRange.from.value`を渡す一方、同repoの別pageは`dateRange.from`を渡しており、ref unwrap契約の経路差候補である。

Generatorは未確定Scheduleのsubscription結果をそのままchildへ渡す。Schedule pageはqueryを持たずmanagerへ委譲する。Arrangementは`useDisplay().mobile.value`をsetup時に一度だけ読み、resize後に4/14日範囲を切り替えない。

detail 3pageはroute paramをsetup時に固定し、param変更watch、not-found、loading/errorをpageで扱わない。OperationResult/Billing detailは関連masterをcallback取得する。Customer Billing detailはCustomer/Site cacheが未取得なら`loading...`を表示するが、error/not-foundとloadingを区別しない。

## create・edit・delete・duplicate・lock・status

- OperationResult一覧はplusでstandalone createでき、成功後detailへ移動する。Generator経路とは別である。
- Result detailは`isLocked`で基本activator、worker、article、deleteをdisableする。一方、developer duplicateとSecurityReportsManagerはlockでdisableされず、lockはdocument全操作のimmutable契約ではない。
- deleteは確認dialog後一覧へreplaceする。page transactionはなく、派生削除chainはFunctionsへ委譲する。
- developer duplicateはbutton自体にloading/disabledを渡さず、childの`set(doc)`へ委譲する。
- Billing operations一覧にもplus/createがあり、請求回復UIの実契約上は無効・不適切候補として既存FUT-0033で管理される。
- OperationBilling detailはResult lockと独立してAgreement・billing items・稼働外売上を編集する。workerはdisabled表示である。これはoperation lock中もbilling編集を許す承認済み意味と一致する。
- Customer Billing detailは`paymentDueDateAt`だけをAirItemManagerで更新し、billingDate以前をUIで禁止する。status/発行済み/paid/cancelledによるpage guard、理由・履歴はない。
- 9page自身にBilling status transition、payment記録、cancel/delete、PDF/CSV生成コードはない。child入口へ委譲される。

## transaction・loading・navigation

page層は複数document transactionを開始しない。GeneratorのResult/Schedule/Notification、Schedule/Arrangementの通知、Billing集計・lock、PDF/CSVはchild/composable/Functions契約である。Result detailのworker/articlesは独立`doc.update()`で、version compareはない。SecurityReportsManagerはResult/Billing lockとは別にStorage作用へ到達する。

page-level loading/error/retry/single-flightはない。月filter変更の古いresponse、route param再利用、create/update/delete/duplicate/期日編集の二重clickはpageで防止しない。成功時navigationはResult create/duplicate→detail、Result delete→一覧である。

## 矛盾・未使用候補・テスト

- read permissionだけでwrite UIへ到達する。
- Result lock alertは「編集できません」と断定するが、duplicateと日報操作は残る。
- OperationBilling一覧plus actionは回復flow文書で無効候補として確認済みである。
- 月selectorの`dateRange.from.value`は他pageのbindingと不一致候補である。
- Customer Billingの`totalAmount.toLocaleString() || "loading..."`は0も`"0"`となりfallbackしない。
- Arrangementのresponsive期間は初期判定のみでresize非追従。
- 9pageを直接対象とするroute/component testは静的検索で確認できなかった。

## 台帳対応・未確認範囲

FUT-0026/0027/0030/0031/0033/0045/0049/0050/0051/0070〜0074/0154へ統合する。新規FUT/CONFは追加しない。child manager、Rules/schema、PDF/CSV、通知、transaction runtime、実data、browser、Emulatorは未確認である。
