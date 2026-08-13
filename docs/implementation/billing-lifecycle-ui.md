# Billing請求書の画面操作・状態遷移・ロック契約の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-018、SPEC-DEEP-022、SPEC-DEEP-039a、SPEC-DEEP-042
- 最終確認日: 2026-08-12
- 根拠ファイル: `utils/pageSettings.js`、`pages/billings/customers/`、`components/CustomerBillings/`、Billing data layer/manager/handler、OperationBilling詳細page・manager・lock button/composable、schemas `Billing.js`・`OperationBilling.js`、Billings/OperationResults Rules

## 入口・権限

Billing 4pageの公開契約とcreate/edit/lock/status・error境界のfile単位確認は[Operation・Schedule・Billing pages deep review](operation-schedule-billing-pages-deep-review.md)を、CustomerBilling/OperationBilling/OperationResult一覧componentsの公開契約は[Billing / OperationResult components deep review](billing-operation-result-components-deep-review.md)を、OperationBilling詳細10componentの入力・lock・保存結線は[OperationBilling components deep review](operation-billing-components-deep-review.md)を参照する。

- `/billings/customers` は取引先請求一覧、`/billings/customers/[id]` はBilling詳細で、どちらもpageSettings上 `billings:read` だけを要求する。
- `/billings/operations` と詳細も `billings:read` で、Billingへ埋め込まれる元OperationResultをOperationBillingとして調整・lockする。
- 現在のpermissionは試作中の暫定実装であり、正式な閲覧・編集・確定・支払権限とは扱わない（CONF-0019）。
- RulesはBillingsとOperationResultsの両方について、同じcompanyId claimの任意認証Userまたはsuper-userへread/writeを全許可する。

## 一覧抽出・詳細表示

- 一覧の初期期間は現在月の月初から月末。Billing.billingDateAtをinclusive rangeでlive subscribeする。
- subscribe結果はdocIdのMapで重複排除する。一覧はbillingDateAt降順、customerId＋billingDate単位でgroup化し、group内にsite別Billingを表示する。
- 行は請求日、現場、実績数、subtotal、taxAmount、totalAmount、入金予定日を表示する。status、paymentRecords、lock状態は一覧列にない。
- 行actionは詳細・編集への遷移と単票PDF、group actionはCSVと統合PDFである。status/permission/processingをbutton自身は検査せず、global loading中も明示disabledにならない。
- group summaryのsubtotalは各Billing subtotal合計、taxは全embedded OperationResultを税率別に再集約後に丸める。統合PDFと一致するが、site別rowのtaxAmount/totalAmount合計とは端数差が生じ得る。
- Billing詳細は取引先、現場、請求日、subtotal、taxAmount、totalAmount、paymentDueDateAt、embedded operationResultsの日付・基本/資格数量・salesAmountを表示する。
- detail data layerはroute docIdのBillingをonMountedでsubscribeし、unmountでunsubscribeする。

## 状態遷移表

現行のDRAFT/CONFIRMED/PAID/CANCELLEDは暫定実装である。2026-08-11時点では、まずtriggerがdraftと請求済みを識別する契約を決める必要があり、payment処理も未定義である。以下の表を承認済みlifecycleとは扱わない。

| 現在status | schema methodで可能 | 画面上の操作 | Functions/Rulesの実効境界 |
|---|---|---|---|
| DRAFT | `confirm()` でCONFIRMED | confirm button/handlerなし。status表示もなし | 同期Functions・同社clientとも全field更新可能 |
| CONFIRMED | `markAsPaid()` でPAID | 支払確定button/handlerなし。status表示もなし | 同期Functionsは再集計・空Billing削除可能 |
| PAID | 専用遷移methodなし | 支払取消・訂正UIなし | 同期Functions/Rulesによる直接変更を妨げない |
| CANCELLED | schema定数のみ。cancel methodなし | 取消UIなし | 同期Functions/Rulesによる直接変更を妨げない |

- repository検索でBilling.confirm、markAsPaid、STATUS.CANCELLEDを呼ぶfrontend実装は確認できなかった。
- schema methodはDRAFT→CONFIRMEDとCONFIRMED→PAIDだけをinstance内で検査する。Rulesはmethod利用を強制せず、status文字列allowlistや遷移前後を検査しない。
- CANCELLEDへ入るmethod、CANCELLEDから戻すmethod、請求削除・取消手続き、status別画面制御は未実装である（FUT-0045、FUT-0049、CONF-0033）。

## 編集・保存契約

- Billing詳細で直接編集できる確認済みfieldはpaymentDueDateAtだけである。allowed-datesはbillingDateAt以上を要求する。
- AirItemManagerへuseDocManagerのhandleUpdate=`item.update()`を渡すため、保存はBilling documentのclient updateで、transaction/version preconditionはない。
- statusに応じたdisabled/read-only条件はなく、DRAFT/CONFIRMED/PAID/CANCELLEDのどれでも同じpaymentDueDateAt編集UIへ到達する。
- CustomerBillingsManagerのarray create/update/delete handlerは全てthrowする。詳細側managerもcreate/deleteをthrowしhideDeleteBtn=trueだが、paymentDueDateAt updateだけはuseDocManager経路で許可する。
- paymentDueDateAt以外のremarks、adjustment、status、paymentRecordsを編集する画面は確認できない。
- 2026-08-11の暫定方針では、将来のinvoice-issued trigger前だけ請求担当者がpaymentDueDateAtを編集できる。発行後はbefore/after/reason/actor/time履歴付き変更のみ、paid/cancelledはimmutableとし、`billings:read`単独では許可しない。Customer条件変更は将来defaultだけに使い、既存Billingを自動変更しない。現行statusではなく将来の発行境界を使う。

## lock・payment・cancel・delete

### lock

- Billing集計document自体にlock fieldはない。
- 請求画面のlockはOperationBilling、すなわち元OperationResult.isLockedをtoggleする。buttonは状態に応じてlock/unlock文言を出し、確認dialogなしで即時実行する。
- toggleLockはlocal instanceのisLockedを先に反転し、`update()`する。errorはlogger/errors storeへ渡すがlocal値をrollbackしない（FUT-0050）。
- button handlerはglobal loading entryを追加・finallyで削除する。button自身のdisabled/processing guardはなく、overlayが実際に多重clickを遮断するかは未確認。
- OperationBillingは `_shouldCheckLock=false` のため、lock中でも請求画面からagreement、請求日、調整数量/単価、稼働外売上等をupdateできる。lockは請求編集を凍結するものではない。
- 2026-08-13に、このscopeと権限境界が補足確定された。`isLocked`は`operation-billings:write`を持つUserが、請求調整を後続の管制側更新から保護するために設定・解除する管制側編集lockである。lock中は`operation-results:write`による稼働編集・削除を止め、`operation-billings:write`によるOperationBillingの請求編集を許可する。請求確定、承認済み、全体immutableを意味せず、追加承認や理由入力UIを要求しない。最終更新者・日時には現行の`uid`・`updatedAt`を使い、変更前後の永続履歴collectionは現時点で追加しない。invoice-issued後のBilling lifecycleは別契約である。

### payment

- Billing.paymentRecordsはschemaに空配列で存在するがcomment上未実装で、一覧・詳細に入金記録の追加/編集/削除UIはない。
- 入金予定日paymentDueDateAtだけを編集できる。実入金日・金額・方法・部分入金・消込・PAIDへの自動遷移は実装されていない（FUT-0049、CONF-0035）。

### cancel/delete

- CANCELLED status定数はあるがcancel methodとUI handlerはない。
- Billing client delete UIはmanagerで非表示・handler拒否。FunctionsはoperationResultsが0件になるとstatusに関係なくBillingを物理deleteする。
- OperationBilling create/deleteもmodelとmanagerで拒否し、元OperationResult経路で管理する。

## 失敗・多重実行・同時編集

- Billing詳細のpaymentDueDateAt updateに、このpage固有のtry/catch、成功message、失敗rollback、二重送信guardはない。AirItemManager共通挙動はpackage実体が作業ツリーになく未確認である。
- lock buttonはtry/catch/finallyとglobal loadingを持つが、失敗時local rollbackと確認dialogがない。
- Billing detailのpaymentDueDateAt client updateとFunctionsのoperationResults再集計は同じdocumentへの非transaction updateで競合し得る。双方がfull document updateするadapter契約の場合、後勝ちで相手のfieldを戻す可能性がある（FUT-0051）。
- 複数tab/UserによるpaymentDueDateAt同時編集にversion checkはなくlast write winsである。
- OperationBilling lock toggleもread-modify-writeで、同時toggleは期待する最終値を保証しない。buttonは値を明示指定せずlocal反転値を保存する。
- Billing aggregation Functionsとのstatus競合はFUT-0045、同一key集計のlost updateはFUT-0047で扱う。

## Rules境界

- pageSettingsは `billings:read` だけだが、UIはBilling paymentDueDateAtとOperationResultの請求field/lockをupdateする。
- Billings/OperationResults Rulesは同社認証Userの全read/writeを許し、`billings:read` claim、write権限、field allowlist、status、lock、tenant field整合を検査しない。
- 直接SDK writeでは画面にないBilling create/delete/status/paymentRecords/adjustment変更、OperationResult lock迂回が可能である。
- 正式なread/write/lock/status権限はCONF-0019、status lifecycleはCONF-0033へ統合する。

## 仕様との一致

- 現在のbillings権限は暫定実装で正式分割が必要というユーザー回答と一致する。
- OperationBillingは元OperationResultを編集し、BillingはFunctions集計documentという責務分離はmodel/managerに現れている。
- 取極めなし実績を後から個別設定し請求対象化する操作はOperationBilling側にあり、Billing詳細は集計結果と入金予定日を扱う。
- Billingの確定・支払・取消・payment記録について承認済み仕様はなく、schema定数/methodを確定workflowとは扱わない。

## 矛盾・未使用候補

- Billing statusとconfirm/markAsPaid methodは存在するがfrontendから未参照で、一覧・詳細にもstatusを表示しない。
- CANCELLEDは定数だけで遷移method/UIがない。paymentRecordsもfieldだけで未実装である。
- CustomerBillings array managerへcreate/update/deleteを拒否するhandlerを渡す一方、詳細ではpaymentDueDateAtだけgeneric updateできる。許可fieldはRulesで強制されない。
- 「lock」は管制側の稼働編集・削除を止めるもので、Billing確定status、承認、請求画面内編集停止とは連動しない。この意味と、請求担当者が設定・解除できることをUIへ明示する必要がある。
- paymentDueDateAtはBilling集計作成時のCustomer条件から算出されるが、detailで直接変更でき、変更理由・actor・履歴を保存しない。
- OperationBilling managerはcreateを拒否する一方、一覧pageはplusを表示して`toCreate()`へ到達させるため、必ず失敗する操作が残る。

## 将来要対応

- Billing status表示と確定・支払・取消・訂正workflowを仕様化・実装し、Functions/Rulesと一致させる（FUT-0045、FUT-0049、CONF-0033）。
- paymentRecordsまたは別modelによる入金・部分入金・消込・監査を決める（FUT-0049、CONF-0035）。
- lock toggleの失敗rollback・多重実行・同時toggleを安全にする（FUT-0050）。
- Billing client編集とaggregation Functionsの同時更新をfield ownership/transaction/versionで保護し、発行前後・paid/cancelled・履歴・権限を強制する（FUT-0051、CONF-0036）。
- 暫定 `billings:read` とRules全writeを正式権限へ分離する（FUT-0031、CONF-0019）。

## 要確認事項参照

- CONF-0019: Billing/OperationResultの閲覧・編集権限。lock scope自体はCONF-0037で回答済み。
- CONF-0037: 回答済み。管制側編集lockとして現行scopeを維持し、`operation-billings:write`によるOperationBilling編集とlock設定・解除を許可する。理由入力・承認・新規履歴collectionは要求しない。
- CONF-0033: status別の再集計・削除・訂正・再発行。
- CONF-0035: 支払記録・部分入金・PAID判定。
- CONF-0036: 回答済み。invoice-issued前後、履歴、paid/cancelled immutable、Customer default、権限の暫定方針。

## 未確認範囲

- AirItemManager package内部のdialog loading、submit disable、error表示、rollback挙動。
- 認証済みUI/Emulatorでのstatus別表示、double click、同時tab、Rules直接write。
- PDF生成、税計算式、aggregation Functions内部、外部会計連携、Customer詳細。

## SPEC-DEEP-039a addendum

- `useCustomerBillingManager`は唯一のcallerであるBilling詳細pageへ`attrs`とmaster cacheを返し、create/deleteを同期throw、updateをdeprecated `useDocManager`経由のfull Billing updateへ委譲する。status・permission・version・single-flightは追加しない。
- 同composableが返す`info` computedは唯一のcallerから未使用で、評価時には未importの`OperationBilling`とBillingにない`dateAt/dayType/shiftType/startTime/endTime/workDescription/agreement`を参照する。現行pageではlazy computedのため発火しないが、再利用すると例外または別modelの誤表示になるlatent contractである。
- doc全体のdeep changeでCustomer/Site fetchを呼ぶ。master未取得・permission failureは表示上`loading...`へ畳み込まれ、Billing保存失敗のrollback/refetchはmanager共通境界に委ねられる。

## Billing data layer追加確認（SPEC-DEEP-042）

- range layerはbillingDateAt範囲をlive購読し、docId重複をMapで後勝ち除去する。Customer/Site cache fetchはcallbackからawaitせず、失敗・完了を一覧stateへ返さない。
- subscription開始の同期throwだけをcatchし、Firebase listenerの後続error channelは登録しない。range validationはtry外なのでwatch中のinvalid Date/rangeは未処理例外となる。
- `useCustomerBilling`はstatic docIdをmounted時に購読するがloading/error/not-foundを返さない。旧`useOperationBilling`はlegacy manager以外に現行callerがない。
