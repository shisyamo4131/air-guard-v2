# RoundSetting・時間計算の実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-053
- 最終確認日: 2026-08-11
- 根拠ファイル: schemas `RoundSetting.js`、`Company.js`、`OperationResult.js`、`Tax.js`、`DailyOperationByEmployee.js`、app `plugins/10.company-settings.client.js`、`useSetRegularTime.js`、Company設定UI、OperationResult/SiteOperationSchedule custom input、`calculateTaxBreakdown.js`、billing PDF/summary、OperationResult CSV、`pages/test/round-setting-test.vue`、`utils/pageSettings.js`

## 保存場所・初期化・種類

Companyの`roundSetting`に`FLOOR`（切り捨て）、`ROUND`（四捨五入）、`CEIL`（切り上げ）の文字列を保存する。defaultは`ROUND`で、Company設定画面の運用設定から編集・表示できる。schema fieldはselect候補を提供するが、Rulesは値を検証せず、Company rootを同一会社の全認証Userまたはsuper-userへwrite許可する。

client pluginはCompany storeをwatchし、Company未取得または値がfalsyなら`ROUND`、それ以外は`RoundSetting.set(company.roundSetting)`を呼ぶ。`set`は未知値をthrowするため、truthyな不正値ではpluginのwatchEffectが例外となる。設定はclassのprocess-global static `_mode`で、documentや計算結果へmodeをsnapshotしない。

`round(value, mode, precision=0)`は`value * 10^precision`へ`Math.floor`、`Math.round`、`Math.ceil`を適用し元へ戻す。numberかつ非NaNだけを許し、Infinity、極端なprecision、浮動小数誤差は別途制限しない。default precisionは整数単位である。

負数では数学関数の方向をそのまま使うため、例として-1.2はFLOOR=-2、ROUND=-1、CEIL=-1となる。「金額の絶対値を切り捨てる」処理ではない。0は全modeで0となる。

## 適用箇所と順序

| 対象 | RoundSetting適用 | 実装順序 |
| --- | --- | --- |
| 通常/資格の基本売上 | あり | quantity × unitPriceを整数丸め |
| 通常/資格の残業売上 | あり | overtimeMinutes × overtimeUnitPrice ÷ 60を整数丸め |
| category total | 追加丸めなし | 丸め済み基本 + 丸め済み残業 |
| OperationResult `salesArticles` | 単独ではなし | 各price × quantityを小数のまま合計 |
| OperationResult `salesAmount` | あり | 4区分の丸め済みtotal + 未丸めsalesArticlesを再度整数丸め |
| 税 | あり | 税率別にsalesAmountを合計 → rateを乗算 → 税率groupごとに整数丸め |
| Billing/PDF合計 | 間接利用 | 丸め済みOperationResult salesAmountと税率別taxAmountを合算 |
| CSV | 間接利用 | OperationResultのsalesAmountを出力し再丸めしない |
| 勤務・休憩・残業minutes | なし | datetime差、break、regulationWorkMinutesから分単位集計 |
| 時間請求quantity | なし | 対象minutes（設定によりbreak加算）÷60。小数quantityのまま単価乗算時に金額を丸める |
| DailyOperationByEmployee amount | Company設定を使わない | `Math.round(regularAmount + overtimeAmount)`を固定使用 |

元値とadjusted値は同じ金額丸め順を使う。同じ総額でも、基本/残業、通常/資格の分割ごとに先に丸めるため、「全raw金額を合計して1回丸める」結果と異なり得る。さらに`RoundSetting` modeはOperationResult保存fieldではないため、Company設定変更後にgetterを再評価すると過去documentの表示・集計値が変わり得る。

## 時間・日跨ぎ・timezone

`useSetRegularTime`という名称のcomposableは丸め処理ではない。site/date/shiftTypeから有効なAgreementを取得し、開始、終了、翌日開始flag、休憩minutes、規定実働minutesを予定または実績inputへコピーするだけである。値がない場合はwarningを表示する。

勤務時間はOperationResult系のstartAt/endAt、日跨ぎflag、breakMinutes、regulationWorkMinutesからminutesで算出される。RoundSetting、Company `minuteInterval`はこの算出へ直接使われない。`minuteInterval`はtime pickerの選択刻みであり、保存済み時刻や計算値のrounding ruleではない。日跨ぎ・timezoneの後にRoundSettingをかける時間経路は検索上存在しない。

## client・Functions・帳票・CSVの差

- clientはCompany購読によりstatic modeを設定するため、OperationResult getter、billing summary、PDF税計算は現在Companyのmodeを利用する。
- Functions配下に`RoundSetting.set`またはCompany `roundSetting`の直接参照はなく、schema processのdefault `ROUND`のままOperationResult/DailyOperation getterを評価し得る。CompanyがFLOOR/CEILの場合、clientとserver派生集計が同一入力で異なる可能性がある。
- DailyOperationByEmployeeの金額集約は`Math.round`固定で、Company modeを直接使わない。
- PDFと請求group summaryはapp utilityで全OperationResultを税率別集約後にRoundSettingを適用する。これはCONF-0039の承認済み税集約方針と一致する。
- OperationResult CSV/freee勤怠CSV/AttendanceにはRoundSettingの直接参照がない。汎用OperationResult CSVは既に算出された`salesAmount`を出す。

## test route・UI到達性

`/test/round-setting-test`はNuxt pageとして存在し、pageSettingsの`DEVELOPER` access policy付きnavigationに登録される。environmentによるroute除外やproduction guardは直接確認できず、production bundleにも含まれる候補である。画面はbuttonでbrowser内の手製test関数を実行するが、自動test suiteではない。

test画面は`new RoundSetting()`へ`operationResultSales`と`operationResultTax`をbindするが、現行classにそれらのinstance field/validationはない。JSDocの`@props`とも不一致で、実装は単一static modeだけである。画面の操作でglobal modeを変更でき、Company pluginの次回watchEffectまでは同じtabの業務計算へ影響し得る。

## 矛盾・未使用候補

- `RoundSetting` JSDoc/test UIの売上用・税用個別propertyは実装されていない。
- `useSetRegularTime`は時間丸めではなく取極め値copyであり、名称から誤解しやすい。
- serverはCompany modeを設定せず、DailyOperationByEmployeeは固定`Math.round`を使うため、client/Functions間のmode統一がない。
- Company設定は単一modeだが、売上各部分、最終salesAmount、税へ重ねて適用される。
- developer test routeにproduction除外がない。

## 将来要対応

- FUT-0160: RoundSettingをtenant別・経路共通の明示引数へし、過去値の再計算境界と二重丸めを確定する。
- CONF-0134: 売上・税・時間・負数・過去実績に対する正式な丸め単位と適用時点を決定する。
- CONF-0039: 統合請求書の税率別集約後丸めは回答済みであり、その範囲は変更しない。

## 要確認事項参照

- `CONF-0134`へ、金額category別/最終、時間quantity、負数、Company変更時、client/server同一性を統合した。
- codeで解消した事項: `useSetRegularTime`はRoundSettingを利用せず、時間・休憩・残業minutesに会社丸め設定は適用されない。RoundSettingは売上と税の整数丸めに直接使われる。

## 未確認範囲

- runtimeでのplugin例外、Functions cold/warm instance間static state、Firestore converterの再評価時点。
- 実Company設定別のclient/Functions/PDF/CSV比較、負数・Infinity・大数・浮動小数境界。
- test routeのproduction deploy成果物、developer role配布状況、実利用履歴。
- 正式な会計・労務上の丸め規則と移行方法。
