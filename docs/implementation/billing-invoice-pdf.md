# Billing請求書PDFの生成・表示・保存/ダウンロード契約の実装調査

## PDF/format/tax utility最終確認（SPEC-DEEP-045a/045b）

- pdfMake/VFSはmodule-scope singletonとして再利用され、生成物のschema/version/hashを保持しない。Customer/Site/Article/Companyのlive masterを再取得するため、同じBillingからの再生成結果はmaster更新で変化し得る。
- `formatNumber`/`formatCurrency`はIntlへ値を直接渡し、domain上のfinite/nonnegative/integerを保証しない。表示formatはvalidation境界ではない。
- app側`calculateTaxBreakdown`はtaxRateのnumber/NaNだけを拒否し、負数、1超、Infinityを許す。salesAmountは`|| 0`で取り出して加算するため、文字列混入時は数値合計でなく連結し得る。丸めは現在のprocess-global RoundSettingに依存する。

- 状態: 実装調査（振込先の完全性・口座名義・header長文配置をlocal改修済み、利用者最終UI acceptance待ち）
- 対象セグメント: SPEC-SEG-019、SPEC-DEEP-040 — 請求書PDFの生成・表示・保存/ダウンロード契約
- 最終確認日: 2026-08-30
- 根拠ファイル: CustomerBillings一覧のPDF action、`useCustomerBillingActions.js`、`useBillingPdf.js`、`createCompanyBankTransferPdfBlock.js`、`calculateTaxBreakdown.js`、format utility、NotoSansJP VFS、直接参照するBilling/Customer/Company/Site/Article field

## 入口・権限

- 2026-08-11に、現行PDFはpreview/draftとしdraft表示を付け、invoice-issued triggerと正式発行actionが実装されるまでは正式請求書と扱わない方針が確認された。
- 正式filenameはinvoice numberを主とし、共通helperでsanitize/truncateしたcustomer名を補助にする。正式発行ではCompany/Customer欠損を拒否し、Site/Article名を発行artifactへsnapshotする。draftだけ`DRAFT`・情報欠損表示付きplaceholderを許し、正式版は`N/A`や空宛名を許可しない。
- draft作成時はinitial master copy、正式発行時はfull snapshotを固定する。発行済み再printはsnapshotを使い、master変更やarchiveで内容を変えない。訂正はreason/history付きnew revisionとし、live master PDFはdraftだけに限定する。
- `/billings/customers` の各site Billing行に単票PDF button、customerId＋billingDate group headerに統合PDF buttonがある。
- pageSettingsの入口permissionは暫定 `billings:read` のみ。PDF専用permission、status条件、download監査はない。
- 単票は選択したBilling 1件、統合は一覧groupから取り出した複数Billingを渡す。group keyはcustomerId＋billingDateであるため、UI経路では同じ取引先・請求日のsite別Billingが統合対象となる。
- 生成composable自体は統合入力が同一customer/dateであることを検証せず、先頭BillingのcustomerとbillingDateを宛名・filenameへ使う。

## 入力データ

- BillingからbillingDateAt、paymentDueDateAt、subtotal、taxAmount、totalAmount、taxBreakdown、operationResultsを使う。
- 各OperationResultからdocId、siteId、dateAt、shiftType、statistics、sales original/adjusted、salesAmount、taxRate、articlesを使う。
- Customerからzipcode、prefName、city、address、building、nameを宛先・filenameへ使う。
- Company storeからzipcode、prefName、city、address、building、companyName、tel、bankName、branchName、accountType、accountNumber、accountHolder、invoiceNumberを発行者情報へ使う。振込先5 fieldは共有parserで完全性と値を検証する。
- Siteからname、siteNumber、Article masterからcode/nameを明細へ使う。
- 生成前にCustomer 1件、対象operationResultsのunique site、全articles masterをclient fetchする。Companyはlogin company storeの現在値を使う。

## 帳票field mapping

| 帳票項目 | 値源・fallback |
|---|---|
| 表題 | 固定「ご請求書」 |
| 宛先住所 | Customer zipcode/prefName/city/address/building。欠損文字列は空欄 |
| 宛名 | Customer.name＋「御中」 |
| 発行者 | Company住所、companyName、tel |
| 振込先 | 5 fieldすべてが有効な場合だけbank/branch/accountType/accountNumber/accountHolder。不完全・不正・未登録は全体を省略 |
| 振込手数料 | 固定文言「※お振込み手数料はご負担ください。」 |
| 適格請求書登録番号 | `T${company.invoiceNumber}`。未設定時も「登録番号: 」labelは表示 |
| 税抜・税・税込 | Billing computed値。統合は全Billingを再集計 |
| 税率別内訳 | taxRate、taxableAmount、taxAmount |
| 現場別請求 | siteId単位のOperationResult.salesAmount合計、Site name/siteNumber |
| 稼働明細 | 日付、DAYなら日勤・それ以外は夜勤、基本/資格、数量、単価、残業h/単価、金額 |
| 稼働外請求 | 日付、現場、Article code/name、数量、単価、price×quantity |
| page番号 | footer中央にcurrentPage / pageCount |

- 単票本文にはbillingDateAt、paymentDueDateAt、Billing status、請求書番号/管理番号を表示しない。billingDateはfilenameだけに使う。
- 統合PDFは各Billing明細の前に請求日と入金予定日を表示するが、headerは先頭Billing/Customerを使い、請求書番号・statusは表示しない。

## 集約・税値

- 統合1請求書では全明細を税率別に集約してからCompany丸め規則で税計算し、そのinvoice taxを正式値とする。site subtotalは表示用である。0行は省略し、将来の負数行は意味・理由を明示する。deprecation対象のadjustmentは除外し、正式利用前にaccountant/tax professionalの検証を要求する。
- 単票summaryはBilling.subtotal/taxAmount/totalAmount/taxBreakdownをそのまま表示する。
- 統合subtotalは各Billing.subtotal合計。税は全operationResultsをtaxRate別にまとめ、taxableAmount×taxRateへRoundSetting.applyを1回適用する。各Billing.taxAmount合計ではないため、site別に丸めた単票合計と統合税額が異なる可能性がある。
- totalはsubtotal＋統合taxAmount。adjustment.amountはBilling.subtotalへ含まれるが、taxBreakdown・現場別合計・稼働/稼働外明細には出ない。
- 現場別合計はsalesAmountを使うため稼働外売上も含む。稼働明細行の金額はregularAmount＋overtimeAmount、articleは別表へ出す。
- 基本/資格行はstatistics.quantity>0の場合だけ出す。0または負のquantityは行を出さないが、salesAmount/subtotalが0・負でもsummaryは通貨表示する。
- 残業分はovertimeWorkMinutes/60を小数2桁文字列にする。金額はIntl.NumberFormat ja-JP JPY、minimumFractionDigits=0でformatする。

## layout・file contract

- pdfmakeをclientでlazy importし、VFSへNotoSansJP Regular/Boldを登録する。italic/bolditalicも同font fileへmappingする。
- page sizeはA4、marginはleft/right 40、top/bottom 60、default font size 10。title 18、section 14、table header gray、detail table 9、footer 8。
- 宛先と発行者は通常flowの2 columnへ置き、発行者側は幅205、column gap 20、right alignとする。振込先は口座名義を含む3行を折返し可能にし、長い銀行名・支店名・口座名義の高さを後続本文の配置へ反映する。
- 現場別請求tableの後は常にpageBreak=afterで、稼働明細を次pageから開始する。統合は各2件目以降のBilling明細前にもpageBreak=beforeを入れる。
- detail tablesはheaderRows=1。pdfmake既定の自動改pageを使い、独自のrow splitting/keep-together制御はない。
- 単票filenameは `請求書_${customer.name}_${billingDate YYYYMMDD}.pdf`、統合は末尾 `_統合.pdf`。customer.nameのfilename不正文字・制御文字・長さをsanitizeしない。

## 生成・表示・保存flow

1. 一覧buttonがBillingまたはgroup Billingsをaction composableへ渡す。
2. global loading storeへ「Creating billing PDF」を追加する。
3. pdfmake/VFSを初回だけlazy initializeする。以後moduleをimportして共有VFSを使う。
4. Customer/Site/Articleをfetchし、Company storeと合わせてdocDefinitionを構築する。
5. `pdfMake.createPdf(docDefinition).download(fileName)` を呼ぶ。
6. success/failureにかかわらずloading keyをfinallyで削除する。

標準UIは`customerId_billingDate` groupKeyから統合対象を作るため同一Customer/dateとなる。一方、表示用CustomerBillings tableはBilling instanceをspreadしたplain objectをgroup actionへ渡し、生成関数自身はinstance型やgroup整合を検証しない。現行統合PDFはpropertyだけを読むためgroup経路の契約を満たすが、汎用生成APIの入力防御にはならない。row actionの`item` identityはAirDataTable内部契約が作業ツリーになく未確認である。buttonはloading中disabledにならず、連打で複数生成を開始できる。

- preview/open/print API、Blob返却、Storage upload、Firestore保存、server生成、外部送信はない。
- download完了callbackを待たず、download呼出し後にgenerate functionが完了する。生成物のhash、保存path、発行履歴、actor、時刻は記録しない。

## failure・security

- actionはerrorをcatchしてerrors store/loggerへ渡し、loadingを解除する。button自身のdisabled/多重生成guardはないため、global overlayがclickを遮断するかは未確認。
- 統合入力0件だけ明示errorにする。単票入力型、同一customer/date、Billing status、operationResults有無は検証しない。
- Customer fetch後にmasterが見つからない場合、customer.name等の参照でTypeErrorになり得る。Company未初期化も同様。Site欠損は「不明な現場」、Article欠損はcode「-」/name「N/A」で継続する。
- PDFにはcustomer住所・名称、company銀行口座・登録番号、請求金額・稼働日・現場が含まれる。暫定 `billings:read` の利用者はbrowserへdownloadできる。
- client downloadだけで永続保存・access expiration・download監査・透かし・暗号化はない。端末download後の管理はアプリから制御しない。
- filenameへcustomer.nameを直接含めるため、個人名を取引先名として使う場合はlocal filesystem上にも名称が残る。

## 仕様との一致

- Billing一覧の単票・customer/date単位の統合出力、複数site明細、日本語font、税率別内訳を実装している。
- Billing lifecycleは未確定であり、全statusから出力可能な現行挙動を「確定請求書だけ発行する」仕様とは扱わない。
- adjustmentと正式な支払・請求番号契約は未確定であり、表示欠落を確定意図とみなさない。
- adjustmentはOperationResultの稼働外売上ではなくBilling単位の運用丸め等を想定するが、現行fieldは未使用・deprecation候補である。将来再設計時に税・理由・監査・帳票表示を明示する。

## 矛盾・未使用候補

- 「請求書」だが単票本文に請求日、支払期日、請求書番号、statusがない。統合だけ請求日/入金予定日を表示する。
- 統合税は全site合算後に税率別丸めするため、Billing modelのsite別taxAmount合計と一致しない可能性がある。
- adjustmentは総額へ含まれるが、内訳・課税対象・現場合計に現れず、帳票内で差額理由を説明できない。
- site masterはfallback表示する一方、customer/company欠損はfallbackせず生成全体が失敗し得る。
- status/発行履歴を参照せず、DRAFT・PAID・CANCELLEDを同じ「ご請求書」として何度でもdownloadできる。
- headerの長い振込先は通常flowと折返しで後続本文とのoverlapを避ける。長い日本語値のPDF生成は自動render test済みだが、実際の利用環境での見た目は最終UI acceptance待ちである。

## 将来要対応

- 現行出力へdraft表示を追加し、将来の正式発行actionで一意番号、必須field、revision/actor/time/hash、同一再downloadと訂正版の区別、cancelled保持を実装する（FUT-0052、CONF-0038）。
- customer/company欠損、filename sanitation、入力group整合を検証し安全に失敗させる（FUT-0053）。
- 長い日本語住所・名称、大量明細、複数page、0/負数、adjustment、単票/統合税差をfixtureでrender確認する（FUT-0054）。
- deprecated adjustmentを正式請求書から除外し、既存data利用時のmigration/警告を設ける（FUT-0048、CONF-0034）。
- PDF download権限・監査を正式なbilling permissionへ分離する（FUT-0031、CONF-0019）。

## 要確認事項参照

- CONF-0019: PDFを含む請求閲覧・出力権限。
- CONF-0033: status別の発行・再発行・取消。
- CONF-0034: adjustmentの課税・帳票表示。
- CONF-0038: 回答済み。draft/正式発行、必須field、一意番号、artifact revision・監査・hash・cancel保持。
- CONF-0039: 回答済み。統合税、Company丸め、0/負数、adjustment除外、専門家検証。

## 未確認範囲

- 振込先の長い日本語値を含むPDF buffer生成はlocal自動test済み。実画面からのdownload、OS filename、印刷、free viewer互換性と利用者環境での最終レイアウトは未確認。
- pdfmakeの実行時version、browser memory、大量明細性能、global loading overlayの多重click遮断。
- PDF/税計算の下流、Storage、外部送信/会計API、実data・master欠損実態。

## Customer Billing application action追加確認（SPEC-DEEP-040）

- 単票PDF、統合PDF、CSVは各々global loadingを付けるが、errorをloggerへ記録してrethrowせず、callerへsuccess/failureを返さない。button側のsingle-flight/disabledがないため同時生成を開始できる。
- CSVは全Billingのembedded OperationResultをflat化し、Site master fetch後にbrowser exportへ渡す。master fetch errorは共通fetchで吸収され得て、欠損Siteを含む出力の成功/部分成功をactionが検査しない。
