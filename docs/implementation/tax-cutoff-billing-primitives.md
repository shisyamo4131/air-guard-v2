# Tax・CutoffDate・Billing計算primitive実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-055
- 最終確認日: 2026-08-11
- 根拠ファイル: schemas `Tax.js`、`utils/CutoffDate.js`、`RoundSetting.js`、`OperationResult.js`、`Billing.js`、`Customer.js`、`AgreementV2.js`、Functions `modules/billings/utils.js`、app `utils/billings/calculateTaxBreakdown.js`、billing PDF/group summaryと直接関連文書

## 税率源・課税対象

`Tax`は日付文字列と次の固定税率履歴だけを持つ。

| 適用開始日 | rate |
| --- | --- |
| 1989-04-01 | 3% |
| 1997-04-01 | 5% |
| 2014-04-01 | 8% |
| 2019-10-01 | 10% |

`OperationResult.taxRate`は実績の`date`を`Tax.getRate`へ渡し、開始日文字列以下の最新rateを返す。税率は保存snapshotではなく読み取り専用プロパティとして再計算される。税率表より前の日付ではthrowする。dateの型・formatをTax自身は検証せず文字列比較するため、invalid/非ISO値の結果は入力に依存する。

課税対象はOperationResultの`salesAmount`全体である。通常/資格、基本/残業、稼働外売上Articleを同じ稼働日税率で扱う。Articleごとのtax category/rate、軽減税率flag、非課税、不課税、税込価格flagはない。税率履歴の8%は過去年月用であり、同日の10%/8%混在を表現できない。

## 税抜・税込・端数順序

- OperationResultの単価と`salesAmount`は税抜として扱われる。
- Billing `subtotal`は各OperationResult salesAmount合計に`adjustment.amount`を加える。
- Billing `taxBreakdown`はadjustmentを除き、OperationResultをtaxRate別に合算して`taxableAmount × taxRate`を計算する。
- 各税率groupの税額へCompany RoundSettingを整数精度で1回適用し、group税額合計を`taxAmount`とする。
- `totalAmount = subtotal + taxAmount`で税込総額となる。

OperationResult salesAmount自体は既に基本/残業・通常/資格の部分丸めと最終丸めを受けるため、税計算はraw売上ではなく丸め済み税抜額を入力にする。RoundSettingのclient/server差は`rounding-and-time-calculation.md`のとおりである。

0 salesAmountは0課税対象としてgroupへ入り得る。負salesAmountもTax計算は拒否せずgroup taxableAmountを減額し、負税額をRoundSettingの数学方向で丸める。`Tax.calculateBreakdown`は負taxRateだけ拒否するが、1超などの上限はない。app側同名utilityは負taxRateさえ明示拒否せず、number/NaNだけを検証する。

## adjustment・Article

- Article明細は`price × quantity`を稼働外売上としてOperationResult salesAmountへ含め、OperationResult日付の単一税率で課税される。Article masterにtax category/rate/unitの正式契約はない。
- Billing adjustmentはsubtotalとtotalへ入るがtaxBreakdownへ入らないため、実装上は非課税差額のように働く。しかしdescription、税区分、帳票明細を持たず、未使用・deprecation候補である。
- CONF-0034の回答どおり、将来のBilling調整は税・理由・監査・表示を明示して再設計し、OperationResult稼働外売上と混同しない。

## 単票・統合請求書

単一Billing modelは同一site/billingDateのoperationResultsだけで税率groupを作り、site内group単位で丸める。統合PDF/group summaryは複数Billingの全OperationResultを再度税率別に合算してから丸めるため、各単票taxAmount合計と異なり得る。CONF-0039では統合invoiceの再集約税額を正式値とし、site subtotalは表示用とする方針が承認済みである。

PDFはBilling/OperationResult getterをlive評価するdraft/previewで、正式発行snapshotは未実装である。Company roundSettingやTax固定表、OperationResult再hydrationの変化で再生成値が変わり得る。

## CutoffDate契約

締日候補は5、10、15、20、25、0（月末）で、Agreement/Customer fieldのdefaultは月末である。

`calculateBillingDateAt`は入力Dateを「JST日付を表すUTC instant」として+9時間し、UTC getterで年月日を読む。当月締日以前なら当月締日、超過なら翌月締日を返し、JST 00:00を表すUTC instantへ-9時間する。月末はUTCで翌月0日を使うため閏年・月日数を反映する。

`calculateBillingPeriod`も同じ変換で、対象日が締日以前なら前月締日翌日から当月締日、超過なら当月締日翌日から翌月締日を返す。periodLabelは締日の属する`YYYY-MM`である。直接利用検索では定義外のconsumerを確認できず、未使用API候補である。

`isValidCutoffDate`は`Object.values(VALUES)`（定義object配列）へnumberを`includes`するため、0/5/10/15/20/25を渡してもfalseとなる。直接callerは確認できない。計算関数はこのvalidatorを呼ばず、未知値、文字列、NaN、invalid Dateを拒否しない。未知日数はJavaScript Dateのrolloverを起こし得る。

## OperationResult・Billing・支払期日flow

1. Agreement snapshotのcutoffDateまたはOperationResult dateAt変更時、`refreshBillingDateAt`が締日Dateを保存する。agreementなし、dateAtなし、cutoffDateが0以外でfalsyならnullとなる。
2. Billing keyはcustomerId、siteId、format済みbillingDateで作る。
3. Billing新規作成時、Functionsはlive Customerを取得し、billingDateAtへCustomer `paymentMonth`を加え、`paymentDate`（締日候補と同じ日選択、0=月末）でpaymentDueDateAtを保存する。
4. 指定支払日が対象月に存在しなければ月末へclampする。

支払期日はBilling作成時snapshotで、Customer条件変更後に既存Billingを自動更新しない。UIは発行前境界の手動編集を持つ。CONF-0036では将来invoice-issued前は請求担当が編集、発行後は理由・履歴付き、paid/cancelledは不変、Customer変更は将来defaultだけとする暫定方針が回答済みである。

paymentMonth/paymentDateの型・範囲をCustomer methodは検証しない。負month、非整数、巨大値、invalid base DateではDate normalizationまたはinvalid Dateを返し得る。JST固定+9/-9でDSTは扱わないが、日本時間用途にはDSTがない。

## snapshot・live・client/server差

| 値 | 境界 |
| --- | --- |
| Agreement cutoffDate | OperationResult埋込みAgreement snapshotからbillingDateAtを保存 |
| OperationResult taxRate | 保存せず、dateとschema固定税率表からlive再計算 |
| Customer payment terms | Billing作成時にlive CustomerからpaymentDueDateAtへsnapshot |
| Billing operationResults | Billing内埋込みsnapshotをgetterがhydrateして再計算 |
| RoundSetting | Company live設定をclient globalへ設定。Functionsはdefault差の候補 |
| PDF tax | 生成時に埋込みOperationResultと現在processのRoundSettingで再計算 |

税率表はclient/serverで同じschema packageを使うが、package version差とRoundSetting初期化差は未検証である。

## 矛盾・未使用候補

- `CutoffDate.isValidCutoffDate`は許可値でもfalseとなり、直接callerもない。
- CutoffDate計算、Customer支払期日、Tax.getRateはinvalid inputを十分検証しない。
- schema Taxとapp `calculateTaxBreakdown`でtaxRate validationが異なる。
- Article単位の税区分、同日軽減税率、非課税、税込入力は表現できない。
- adjustmentはsubtotalだけへ入り、税/帳票明細から外れる。
- Billing modelのsite別税と統合PDF税は丸め単位が違う。

## 将来要対応

- FUT-0162: Tax/CutoffDate/payment termのvalidationとsnapshot/versionを統一する。
- FUT-0160/CONF-0134: RoundSettingのclient/server・適用単位を確定する。
- FUT-0048/CONF-0034: adjustmentは既存利用確認後deprecateし、必要なら再設計する。
- CONF-0039: 統合税率別再集約を正式invoice税とする回答済み方針を維持する。

## 要確認事項参照

- 税率category、税込/税抜、負数、丸め・snapshotの上位判断はCONF-0134へ証拠を追記し、新規CONFは作らない。
- 支払期日変更境界はCONF-0036、adjustmentはCONF-0034、統合税はCONF-0039で回答済みである。
- codeで解消した事項: 税率はOperationResult日付の固定履歴表、Articleも同率、adjustmentは税対象外、Customer支払条件はBilling作成時snapshotである。

## 未確認範囲

- runtimeでのinvalid/境界日、月末、閏年、負paymentMonth、client/server package version差。
- 実請求data、adjustment利用、軽減/非課税需要、税務専門家検証。
- 正式発行snapshot/migration、税率改定時のpackage更新・過去再現運用。
