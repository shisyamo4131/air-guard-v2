# OperationResultからBilling集計への同期契約の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-017 — OperationResultからBilling集計への同期契約
- 最終確認日: 2026-08-11
- 根拠ファイル: `functions/triggers/operationResult.js`、`functions/modules/billings/` のadd/remove/sync/utils、schemas `Billing.js`・`OperationBilling.js`・`OperationResult.js` の直接契約、`firestore.rules` のBillings match

## データ契約

- Billing保存先は `Companies/{companyId}/Billings/{customerId}_{siteId}_{billingDate}`。companyIdはpath prefix、customerId/siteId/billingDateは集計keyである。
- Billing fieldはcustomerId、siteId、billingDateAt、paymentDueDateAt、paymentRecords、status、operationResults、adjustment、remarksである。useAutonumber=false、logicalDelete=false。
- 新規BillingはCustomerを取得し、billingDateAtからCustomer.getPaymentDueDateAtで支払期日を算出し、status=DRAFTで初期化する。
- operationResultsにはOperationResult全体を埋め込む。operationResultIdsの保存field・逆引きqueryはない。
- billingDate/billingMonth、paymentDueDate/paymentDueMonthはJST文字列の読み取り専用プロパティである。
- subtotalは各OperationResult.salesAmount合計＋adjustment.amount。taxBreakdownは各resultのsalesAmount/taxRateを税率別集計し、adjustmentは含めない。taxAmountはcalculatedTaxAmount、totalAmountはsubtotal＋taxAmountである。
- summaryは各resultのdate/shift/dayType、useAdjustedに応じたoriginal/adjustedの基本・資格quantity/unitPrice/regular/overtime/total、salesAmount、remarksを返す。
- paymentRecordsとadjustmentはschema comment上で未実装/未使用である。
- adjustmentはBilling単位の運用丸め等を想定したfieldで、OperationResultの稼働外売上とは別である。ただし詳細仕様がなく未使用のため、既存data利用確認後のdeprecation候補とする。将来必要なら税・理由・監査・帳票表示を明示して再設計する。
- 正式な統合請求書では全明細を税率別集約してCompany丸め規則を適用したinvoice taxを正とし、deprecation対象の現行adjustmentは除外する方針である。現在の保存計算はこの将来契約を未実装である。
- OperationBillingはOperationResultを継承し、同じOperationResults collectionを使う編集viewであって、Billings集計documentではない。create/deleteを拒否し、lock中もupdate可能、toggleLockでOperationResult.isLockedを更新する。

## 対象判定と集計key

- OperationResult.isBillable=trueだけをBillingへ入れる。isBillableはbillingDateAt非nullかつcustomerIdありである。
- key生成にはcustomerId、siteId、billingDateの3値が全て必要で、欠損時はerrorをthrowする。
- 取極めなし等でisBillable=falseのOperationResult createはBilling処理をskipする。後日customer/billingDate等を設定してfalse→trueになると追加する。
- customerId、siteId、billingDateのいずれかが変わると別Billingへ移動する。勤務日、shift、数量、時間、従業員、単価、sales等だけの変更は同じkey内のembedded result置換となる。

## イベント別同期表

| OperationResult event/遷移 | Billing処理 | transaction |
|---|---|---|
| create・非請求 | skip | なし |
| create・請求対象 | keyをfetch。未作成ならCustomerから初期化してcreate、既存なら同IDを除去後push/update | なし |
| update false→false | skip | なし |
| update true→false | before keyから同IDを除去。残件update、0件delete | なし |
| update false→true | after keyへcreateまたは同ID置換追加 | なし |
| update true→true・key同一 | 同ID位置をafterへ置換。欠損ならpush、Billing自体がなければ再作成 | なし |
| update true→true・key変更 | before/after Billingを読み、旧から除去して残件update/0件delete、新へ同ID置換追加/create | old/newを単一Firestore transaction |
| delete・請求対象 | before keyから同IDを除去。残件update、0件delete。Billing不存在はwarnして成功終了 | なし |
| delete・非請求 | remove helperが無条件にkey生成し、billingDate等欠損でthrowし得る | なし（FUT-0046） |

## 検索・集計アルゴリズム

1. triggerがcreate/add、delete/remove、update/syncを呼び分ける。
2. updateはbefore/after isBillableを先に判定し、true側だけkeyを生成する。
3. 同一Billing内ではoperationResultsから同じdocIdを探して置換し、見つからなければ不整合修復として追加する。
4. addとkey移動先追加は同じdocIdをfilter後にpushし、通常retryの配列重複を抑える。
5. removeとkey移動元は同じdocIdを全件filterし、0件ならBillingを物理削除する。
6. Billingの読み取り専用集計値はoperationResultsを設定したinstanceから再計算され、保存時に列挙される。

- 旧配置先をoperationResultIdsで逆引きしない。beforeのcustomer/site/billingDateからkeyを再構成するため、既存stale配置や壊れたbeforeを探索しない。
- Customerは新規Billing初期化時だけ取得する。既存Billingへのresult追加・置換ではpaymentDueDateAtを再計算しない。

## transaction・再実行・並行性

- key移動だけはold/new Billingを同一transactionでread/writeし、移動の原子性を持つ。
- create、対象化、対象解除、delete、同一key更新はfetch後update/create/deleteをtransactionなしで行う。同じBillingへ並行eventが入るとlast write winsで他result追加・更新・削除を失う可能性がある（FUT-0047）。
- 同ID filter/置換により単一eventの逐次retryは重複しにくいが、transaction外の並行性は保証しない。
- key移動transaction内で新Billingが必要な場合、Customer fetchとpaymentDueDate計算はtransaction objectを渡さずに行うため、Customer変更との整合snapshotは保証しない。
- Billing同期はOperationResult triggerの最初の後続作用である。失敗すると後段のDailyAttendance等は実行されず、元OperationResultだけはcommit済みである（FUT-0030）。

## status・lock境界

- 2026-08-11に、DRAFTを含む現行statusは暫定であり、まずtriggerがdraftと請求済みを識別する契約を決める必要があると確認された。payment処理も未定義であり、status別再集計・revision案は承認済みではない。
- Billing.statusはDRAFT/CONFIRMED/PAID/CANCELLED。confirmはDRAFT→CONFIRMED、markAsPaidはCONFIRMED→PAIDだけを許す。
- Billing同期Functionsはstatusを一度も検査しない。CONFIRMED/PAID/CANCELLEDでもoperationResultsを置換・追加・除去し、0件ならBilling自体を削除できる（FUT-0045）。
- OperationResult.isLockedも集計Functionsの条件ではない。OperationBillingはlock中のOperationResult updateを明示的に許すため、その更新triggerはBillingへ再集計される。
- 「lock済み集計」という独立fieldはBillingにない。確定性をstatusで担保するか、OperationResult lockとどう連動するかは未確定（CONF-0033）。

## Rules境界

- Billings専用matchは同じcompanyId claimの認証Userまたはsuper-userへread/writeを全許可する。
- role、請求permission、status、operationResults、集計金額、customer/site/key、lockをfield単位で検査しない。
- Functions Admin SDKはRulesを迂回する。同社UserはclientからBilling集計自体を任意作成・更新・削除でき、Functions集計契約とstatus遷移を迂回できる。
- OperationBillingはOperationResults Rulesに従い、同社User writeが可能である。正式権限分割はCONF-0019に統合する。

## 仕様との一致

- 取極めなし実績を作成でき、後日個別設定でisBillableになった時にBillingへ追加する承認済み回復方針と一致する。
- customer/site/billingDate key移動はold/newをtransactionで処理する。
- 将来のSite Customer/Agreement再適用でOperationResultのkeyを変更する場合も、update triggerがBillingをold keyからnew keyへ移す。再適用前に発行済み請求書を除外し、空updateを隠れた再同期triggerにはしない方針である。
- 同じOperationResult IDを置換し、空集計を削除する契約を実装している。
- OperationResult詳細の基本・worker・article managerはそれぞれ独立してResult全体を`doc.update()`する。各成功writeがBilling同期triggerを起動するため、画面上の連続編集は一つの請求再計算transactionではなく、途中snapshotが順に同期対象となる。
- 手動取極め選択を適用日・勤務区分で強制制限しない方針はOperationResult側で決まり、Billingは結果のkey・salesを集計する。

## 矛盾・未使用候補

- 非請求OperationResultのcreate/updateはskipできるが、deleteだけisBillableを確認せずkey生成して失敗し得る。
- Billing status methodsは遷移を制限する一方、同期FunctionsとRulesは確定/支払済み/cancelled集計の変更を制限しない。
- transaction使用はkey移動だけで、より頻度の高い同一keyの並行追加・更新・削除はlost update候補である。
- paymentRecordsは未実装、adjustmentは未使用。adjustment.amountはsubtotalへ入るがtaxBreakdownへ入らない。
- code commentの一部はOperationBilling documentと呼ぶが、実際に集計するclass/pathはBilling/Billingsである。

## 仮説

- 支払済みBillingへ遅延triggerや手動OperationResult修正が入ると、確定済み請求額・内訳が利用者認識なしに変わる可能性がある。
- 同一keyへの同時確定が多い運用では、operationResults配列のlost updateとfull embeddedによるdocument容量上限へ到達し得る。
- adjustmentを非課税調整として扱う意図ならtaxBreakdown非算入は正しい可能性があるが、仕様根拠は未確認である。

## 将来要対応

- Billing status確定後の集計変更・削除規則を決めて強制する（FUT-0045、CONF-0033）。
- 非請求OperationResult deleteを安全にskipし、後続同期を止めない（FUT-0046）。
- 全add/remove/updateをtransaction化または別のatomic集約方式へ統一する（FUT-0047）。
- Billing full embeddedの容量・snapshot価値を日次集約と合わせて検証する（FUT-0038、CONF-0025）。
- client read/write権限を正式分割する（FUT-0031、CONF-0019）。

## 要確認事項参照

- CONF-0018: 後続trigger失敗の監視・再処理主体。
- CONF-0019: Billing/OperationResultの閲覧・調整・lock権限。
- CONF-0025: full OperationResult snapshotの保持価値。
- CONF-0033: Billing status確定後の再集計・削除規則。
- CONF-0034: adjustmentの課税・使用契約。

## 未確認範囲

- Emulatorでの並行create/update/delete、transaction retry、非請求delete、status別同期。
- 実データの重複/stale Billing、document容量、index、trigger retry・repair運用。
- 請求書PDF、税計算の下流詳細、UI、Attendance/DailyOperations/SiteEmployeeHistory。
