# OperationResult一覧・詳細・汎用CSV出力（実装調査）

## CSV/service utility最終確認（SPEC-DEEP-045a/045b）

- CSVはmaster由来文字列をformula neutralizationせず出す。filenameは`new Date().toISOString()`のUTC日付であり、JST深夜帯には利用者の暦日とずれ得る。customer、billingDate、snapshot revisionはfilenameに含めない。
- `services/operation.initializeSecurityType`はnull itemのerror文生成時に`item.constructor`へ触れ、意図したinvalid-type errorより先にTypeErrorとなる。Site取得はtransaction外で、Site欠損時はwarningだけでUNSETを残してreturnする。

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-046、SPEC-DEEP-022、SPEC-DEEP-041
- 最終確認日: 2026-08-12
- 根拠ファイル: `pages/operation-results/index.vue`、`pages/operation-results/[id].vue`、直接OperationResult(s) components、`useDocuments`、`useDocument`、OperationResult handlers/duplicate、`useCustomerBillingActions`、`exportOperationResultsCsv.js`、`pageSettings.js`、OperationResults Rules、schemas `OperationResult.js`/`OperationResultDetail.js`
- 関連文書: `operation-result-generation.md`、`billing-access-and-manual-adjustment.md`、`billing-lifecycle-ui.md`、各派生sync文書、`data-management-composables.md`

## 入口・権限

OperationResult 3pageの公開契約とlock・duplicate・error境界のfile単位確認は[Operation・Schedule・Billing pages deep review](operation-schedule-billing-pages-deep-review.md)を、一覧DataTable/ManagerとBilling側component境界は[Billing / OperationResult components deep review](billing-operation-result-components-deep-review.md)を、単体OperationResult 14 componentsの基本・worker・Generator・duplicate契約は[OperationResult components deep review](operation-result-components-deep-review.md)を参照する。

| route / entry | pageSettings | 実在操作 |
| --- | --- | --- |
| `/operation-results` | `operation-results:read` | 月別一覧、取引先/現場filter、新規作成、詳細遷移 |
| `/operation-results/[id]` | `operation-results:read` | 基本情報、workers、稼働外売上、SecurityReportsの表示/編集、削除。developerのみ複製button表示 |
| 取引先請求一覧のgroup CSV button | billing route側の暫定権限 | group内Billingsの埋込みOperationResultをCSV download |

一覧・詳細はread permissionだけを要求するが、create/update/delete UIも同じroute内にある。追加のwrite/delete permission判定は直接componentsにない。Firestore Rulesは同一company claimの全認証Userまたはsuper-userへOperationResults全read/writeを許し、field、role、lockを強制しない。現在の権限設計が試作中という確認済み方針は`authorization-model.md`を参照する。

## query / data flow

### 一覧

1. 初期期間をAsia/Tokyoの当月初日〜末日にする。
2. debounced rangeから`dateAt >= from`、`dateAt <= to`の2条件で`OperationResult.subscribeDocs`する。明示orderBy、limit、cursorはない。
3. 各resultのsiteId/customerIdを`useFetch("OperationResults", true)`のcacheへfetchする。
4. `selectedCustomerId`と`selectedSiteId`をclient側でAND filterする。
5. tableは日付降順、勤務区分昇順をdefault sortとし、text searchを隠す。

月selectorがquery期間、CustomerSelect/SiteSelectがclient filterである。paginationは`air-data-table`の既定契約へ委ね、page側にserver paginationはない。取引先選択に応じた現場候補の連動filterは確認できない。Managerには元`docs`、tableには`filteredDocs`を渡すため、表示filterはtableだけに適用される。

### 詳細

route param `id`を固定docIdとして`OperationResult.subscribe`し、callbackでsite、employeeIds、outsourcerIds、articlesをcacheへfetchする。route id変更は同page instanceでreactive refとして扱わず、文字列をsetup時に取得する。not-found/loading/errorをpageが明示表示する処理はない。

## list / detail mapping

### 一覧表示

| 列 | 値源 / 表示 |
| --- | --- |
| 日付 | `item.date`、default降順 |
| 勤務区分 | `item.shiftType`をShiftTypeChip表示 |
| 現場 | cached Site.name。未取得時`...loading` |
| 取引先 | cached Site.customer.abbreviation。未取得時`...loading` |
| 稼働数 | `statistics.base.quantity + statistics.qualified.quantity` |
| lock | `isLocked`時にicon |

customerId、worker、時間、売上、請求状態は一覧列にない。空状態、loading/error、総件数のpage独自表示はなく、汎用table/data layerに委ねる。

DataTable自身はSite cacheをfetchせず、標準pageのsubscription callbackによる先行fetchを前提とする。未取得・取得失敗はともに`...loading`表示となり、standalone callerにはfetch契約が必要である。

### 詳細表示・編集

- 基本表示: 取引先、現場、現場code、日付、dayType/shiftType、start/end、規定実働/休憩、必要人数、資格要否、作業内容、備考。
- 基本編集: site、securityType、dateAt、dayType、shiftType、start/end、isStartNextDay、break/regulation minutes、requiredPersonnel、qualificationRequired、workDescription、remarks。取極めから定時を設定でき、site変更時にcached Site.securityTypeを反映する。
- workers: `doc.workers`をOperationResultDetail array managerで編集する。新規detailへ親のdate/site/shift/time/day-crossing/regulation/break defaultsを渡し、完了時`doc.update()`する。
- 稼働外売上: `doc.articles`をArticleDetailsManagerで編集し、完了時`doc.update()`する。
- 2026-08-11に、このOperationResult内の稼働外売上・ArticleDetailを、OperationResult自体がない手動請求を含む正規経路として使う方針が確認された。別Billing child manual-line modelは採用しない。
- SecurityReports: `schedule-id=doc.docId`としてmanagerを表示する。契約詳細は`security-report.md`。

## 操作

### create / update / delete

一覧のplusはAirArrayManagerのcreateへ進む。create/updateは`services/operation.js`のbefore処理後にmodel create/update、deleteはmodel deleteを呼ぶ。成功時createは詳細へ遷移する。

詳細の基本、workers、articlesは別々のupdate入口で、画面全体を一括transaction保存しない。別tab/Functions/請求操作とのrevision/preconditionはUIにない。削除は確認dialog後にmodel deleteし、完了eventで一覧へ戻る。削除後のFunctions chainは`operation-result-delete-chain`候補および既存sync/cleanup文書の境界であり、本segmentでは再読していない。

### lock

`doc.isLocked`ならwarningを表示し、基本編集、workers、articles、delete、duplicateをdisabledにする。schema `beforeUpdate/beforeDelete`も更新前・更新後のisLockedが両方trueなら拒否する。一方Rulesはlockを検証せず、`isLocked: true → false`を含む直接writeやschema guard迂回を拒否しない。lockの設定主体・請求との意味はBilling文書参照。

### duplicate

detailでは`auth.isDeveloper`だけにbuttonを表示する。source lockと日付未選択/処理中をguardし、1回に1日を選ぶ。同一日付も許可し、sourceを`toObject()`で複製、dateAtを選択日JST開始へ設定し、`siteOperationScheduleId=null`としてtransaction内createする。成功後は複製先詳細へreplaceする。失敗はlogger/errors storeへ渡してnullとなりdialogを自動closeしない。

## CSV contract

### 到達経路と対象

OperationResult一覧/詳細にCSV buttonはない。唯一の直接callerは取引先請求一覧のgroup headerである。選択groupのBillingsを`flatMap(billing.operationResults)`し、site cacheをfetchして同期的download utilityへ渡す。従ってCSVのsourceはlive OperationResults queryではなく、Billing documentへ埋め込まれたOperationResult dataである。group内の複数Billingに同一resultが含まれる場合のdedupeはない。

### 53列

| group | columns |
| --- | --- |
| ID | docId、customerId |
| site | siteId、siteCode、siteNumber（常に空の将来用列）、siteName |
| agreement | agreementDate=`operationResult.agreement?.date` |
| basic/time | date、attendanceDate、dayType、shiftType、startTime、endTime、breakMinutes、regulationWorkMinutes |
| quantity/overtime | baseQuantity、qualifiedQuantity、baseOvertimeMinutes、qualifiedOvertimeMinutes |
| status/adjustment flags | isLocked、useAdjusted（booleanは1/0） |
| adjustment inputs | base/qualifiedごとのquantity、overtime minutes、unit price、overtime unit price（8列） |
| original sales | base/qualifiedごとのunit price、quantity、overtime unit price、overtime minutes、total（10列） |
| adjusted sales | 同じ10列 |
| billing | billingDate、billingMonth、salesArticles、salesAmount |

worker/employee/outsourcer ID・氏名・資格/OJT明細は出力せず、集計数量だけを出す。一方、customer/site ID、site code/name、勤務日・時間、単価・数量・売上・請求月を含むため業務・請求情報である。

`startTime/endTime`はHH:mm文字列、`attendanceDate`は日跨ぎを反映した読み取り専用値だが、`isStartNextDay`と実datetime、worker別日跨ぎは列にない。そのためCSV単独では親定時のendが翌日かを一意に再構成できない。workersの実勤務ではなくOperationResult親の定時/集計値である。

### file contract

- header/rowはcomma区切り、CRLF。UTF-8 BOMを先頭へ付け、MIMEは`text/csv;charset=utf-8;`。
- comma、double quote、LFを含む値だけdouble quoteで囲み、内部quoteを二重化する。CR単独とspreadsheet formula prefix（`=`, `+`, `-`, `@`）は特別処理しない。
- null/undefinedは空文字、数値の多くは0 fallback。site cache欠損時code/nameは空。siteNumberは常に空。
- filenameはbrowser UTC基準の実行日を使う`operation_results_YYYY-MM-DD.csv`。対象customer、請求期間、billing group、生成時刻は含まない。
- Blob URLを作り、一時anchor click後に即revokeする。server保存、履歴、監査、再download identifierはない。

## state / error / security

一覧・詳細data layerはlive subscriptionをunmount時解除するが、pageへloading/error/not-found stateを返さない。fetch cache中はplaceholder、operation errorはmanager/logger/error storeへ委ねる。create/update/deleteの多重実行防止はAir managerの外部契約に依存し、page独自guardはない。workersとarticlesは個別updateのため、一方だけ成功する部分状態がある。

CSVはglobal loading keyをfinallyで外す。site fetchまたは生成errorはlogger/error storeへ渡し、利用者feedbackは共通layout契約に依存する。download前確認、件数、対象期間、個人/請求情報warning、監査はない。文字列先頭のformulaをescapeしないため、site name/code等がformula文字で始まる場合にspreadsheetで式として評価される候補がある。

## 他UIとの境界

SiteのCustomer変更は既存OperationResultへ自動伝播しない。将来のCustomer/Agreement再適用は空updateではなく対象選択型の専用操作とし、変更前後とBilling影響を表示し、発行済み請求書を除外して監査する方針である。

- Generatorは予定/通知からOperationResultを作る完了処理で、本一覧の手動createとは別入口。詳細は`operation-result-generation.md`。
- Billing UIはagreement、billingDate、adjustment、lock等の請求契約を扱う。本詳細は基本稼働、workers、articlesを扱うが、同じOperationResult documentを更新する。
- 汎用CSVは名称上OperationResult exportだが、入口はBilling groupで、Billing埋込みsnapshotを出す。Attendance/freee CSVとは列・日跨ぎ・対象が別である。
- Functions派生同期はdocument commit後の非同期境界で、画面のcreate/update/delete成功条件に含まれない。

## 矛盾・未使用候補

- pageSettingsはread permissionだけだがcreate/update/delete UIが同居し、Rulesも同社認証Userへ全writeを許す。
- OperationResult list/detailにCSV入口はなく、utility名と実際のBilling group export入口が一致しにくい。
- CSVの`siteNumber`は常に空、`agreementDate`の正式意味・consumer、`isStartNextDay`欠落は未確定。
- listのCustomer/Site filterはclient側だけで、server pagination/limit/searchなし。大量月次件数での性能は未確認。
- list managerは元docs、tableだけfilteredDocsを受ける。filter中create/delete等のmanager stateへの影響は外部component契約次第。
- Managerの`disable-submit`/`disable-delete`はitemの現在`isLocked`だけを評価し、処理開始後の別tab lock変更やversion preconditionを持たない。
- detailにnot-found/loading/error UIがなく、削除済み・不正ID時の表示/操作状態が不明瞭。
- developer duplicateは同一日を許し、全source dataを一transactionで複製するが、重複warning、duplicate provenance/sourceType、対象field allowlist、server側のdeveloper専用guardはない。
- Site変更時のsecurityType同期は変更時点のcacheだけを参照し、未取得なら以前の非UNSET値を残す。before handlerも非UNSET値を上書きしないため、選択Siteと保存securityTypeがずれる候補がある（FUT-0175）。

## 将来要対応

- FUT-0031へOperationResult一覧/詳細のread権限とwrite UI/Rulesの追加証拠を追記。
- FUT-0154: OperationResult CSVのformula、日跨ぎ、snapshot、列/filename契約を正式化する。

## 要確認事項

- CONF-0131: OperationResult CSVの正式consumer、source、列、日跨ぎ、formula対策、filename/監査契約。
- OperationResultの正式read/create/update/delete/duplicate actorは既存CONF-0111のauthorization全体判断へ統合し、新規重複項目を作らない。

## 未確認範囲

実CSV生成、Excel等へのimport、実data、UI/Emulator、Air manager/data table内部、Functions同期本文、Generator、OperationBilling、Attendance/freee CSVは未実行・未再調査。大量件数性能、同時tab、network failure、Rules runtime、CSV consumer、agreement.dateの業務意味は未確認である。

## domain duplicate追加確認（SPEC-DEEP-041）

- domain `duplicate`のpublic contractは複数日配列を受け付け、同日重複を除外しない。各instanceはrandom IDで同一transactionへ`set`されるため、同じ日を複数指定すると内容が重複した複数Resultを作成できる。
- `beforeCreate`はSiteをtransaction外で再fetchして現在のcustomer/agreementを適用する。複製元のhistorical agreement snapshotを保持せず、複製中のSite変更とも同一read境界にない。
- 現UIは1日入力だがpublic/programmatic callerの防御にはならない。source lockだけはdomain入口で拒否する。
