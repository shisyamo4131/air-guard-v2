# Billing / OperationResult components deep review

## メタデータ

- 状態: 詳細実装調査
- 対象セグメント: SPEC-DEEP-022
- 最終確認日: 2026-08-11
- 根拠ファイル: `components/CustomerBillings/{DataTable,Index,Manager}/**`、`components/OperationBillings/{DataTable,Manager}/index.vue`、`components/OperationResults/{DataTable,Manager}/index.vue`、直接callerのBilling/OperationResult一覧3 page、直接handler/action/data layer、schemas `Billing.js`・`OperationBilling.js`・`OperationResult.js`

## 対象8ファイルと公開契約

| component | props / emits / caller | 責務とside effect |
| --- | --- | --- |
| `CustomerBillingsDataTable` | `items`、group/sort設定。edit、単票PDF、統合PDF、CSV emit。Customer Billing Index | Billingへlive Customer/Site cacheとgroup表示値を付け、取引先＋請求日でgroup化する。自身はdownloadせず親actionへ通知する。 |
| `GroupSummaryRow` | `billings`、`isOpen`、toggle emit | 実績件数、subtotal、全group明細を税率別に再集約したtax/totalを表示する。 |
| `CustomerBillingsIndex` | attrs passthrough。Customer Billing page | 当月rangeを購読し、manager/table、編集遷移、PDF/CSV application actionを結線する。 |
| `CustomerBillingsManager` | Billing配列、差替可能なCRUD handler | AirArrayManagerへBilling schemaを渡す。default create/update/deleteは全てthrowする。 |
| `OperationBillingsDataTable` | sort設定、table attrs/slots。Operation Billing page | OperationBillingの日付・shift・Site/Customer・売上・請求月、請求不可/lock iconを表示する。 |
| `OperationBillingsManager` | OperationBilling instance配列 | create/deleteをthrowし、updateだけ`item.update()`へ委譲する。lock中も更新可能なschema契約を利用する。 |
| `OperationResultsDataTable` | sort設定、table attrs/slots。OperationResult page | 日付・shift・Site/Customer・基本＋資格稼働数・lock iconを表示する。 |
| `OperationResultsManager` | instance配列、custom input、差替可能なCRUD handler | service前処理付きOperationResult CRUDをAirArrayManagerへ委譲し、`isLocked`時のsubmit/deleteをUIでdisableする。 |

8ファイルを全文確認し、直接component testは見つからなかった。Nuxt auto-registrationによるcallerは上表の3 pageと各component treeで確認した。

## Customer Billing group・金額・出力

- Billing購読は`billingDateAt`のinclusive当月rangeで、data layerがdocIdで重複排除し、各docのCustomer/Siteをfetchする。table側もitemsのdeep watchから同じcache取得を要求する。
- tableはBilling instanceをspreadした表示用plain objectへCustomer、Site、`customerId_billingDate` groupKeyを加える。Billingのsubtotal/tax/total等はenumerableな読み取り専用プロパティなのでspread時点の値が入る。embedded OperationResult配列は同じ参照である。
- group actionはVuetify group itemの`raw`からこの表示用plain objectをPDF/CSV actionへ渡す。現行action/PDFはinstance methodや`instanceof`を要求せずpropertyだけを読むため、このgroup経路ではplain objectでも契約を満たす。row actionが受け取る`item`をAirDataTableがrawへ正規化するかはpackage実体不在で未確認であり、将来下流がinstance methodを要求する場合も型保証はない。
- group summaryのsubtotalは各Billing subtotal（未使用adjustmentを含み得る）を合算する。taxは各Billing taxAmountの合計ではなく、全embedded OperationResultを税率別にまとめた後に`RoundSetting.apply`する。統合PDFも同じ再集約であり相互に一致するが、行ごとのtaxAmount/totalAmount合計とは端数差が生じ得る。
- 標準UIの統合PDF/CSV入力はgroupKeyにより同一customerId・billingDateへ限定される。汎用`generateConsolidatedBillingPdf`自身は同一Customer/dateを検証しないため、UI以外のcallerに対する防御にはならない。
- statusは一覧に表示せず、単票PDF/統合PDF/CSV buttonもstatus、permission、processingをcomponent内で検査しない。actionはglobal loading keyを追加するがbuttonへdisabledを戻さないため、連打で複数download処理を並行起動できる。

## OperationBilling編集・lock

- OperationBillingはOperationResultを継承して同じcollectionを使い、create/deleteをmodelとmanagerの二重で拒否する。一方、一覧pageはplusを常時表示して`toCreate()`を呼ぶため、必ず失敗する入口が実在する。
- manager updateはCustomInputでSite、日付、day/shift、時刻、日跨ぎ、休憩・規定時間、必要人数、資格要否、説明・備考等を編集し、`item.update()`へ委譲する。取極め・請求調整の詳細page操作は別componentである。
- schema `_shouldCheckLock()`はfalseを返すため、`isLocked=true`でもOperationBilling updateを許す。これはlockをcontrollerの稼働編集停止として請求編集を許す確認済み方針と一致する。
- table自身はcached Siteを読むだけでfetchしない。標準pageの`useDocuments` callbackがsite/customerをfetchするため成立するが、standalone利用ではcache注入/先行fetchが必要で、未取得・errorをどちらも`...loading`と表示する。

## OperationResult一覧・CRUD・lock

- 標準pageがdateAt rangeで購読し、Site/Customer cacheを先行取得する。tableは日付、shift、Site/customer、`statistics.base.quantity + qualified.quantity`、lockを表示し、売上・請求status・worker詳細は表示しない。
- Managerのcreate/updateは`services/operation.js`前処理後にmodel書込み、deleteはmodel deleteである。追加permission、version、二重送信guardはcomponentにない。
- `disable-submit`/`disable-delete`は対象itemの現在`isLocked`だけを見る。通常OperationResultはschema側もlock中update/deleteを拒否するが、Rulesはlockを強制しない。作成中item、別tab更新、handler実行開始後のlock変化にはcomponent固有preconditionがない。
- 「Customer未設定なら確定buttonを無効にすべき」というcommentは未実装で、非同期disableを基底managerが扱えないと記す。現行schemaは`customerId` requiredで、create前にSiteから同期するため保存時validationへ委ねる。

## permission・error・concurrency・accessibility

- 3 routeはread permissionだけでcreate/update/PDF/CSVへ到達し、8 componentsはいずれもrole/permissionを再検査しない。Firestore Rulesのserver enforcement差は既存認可文書の範囲である。
- manager error/loadingは`useBaseManager`からAir managerへ渡す単一boolean/loggerに依存する。PDF/CSVはglobal loadingとcatch/finallyを持つが、download successの監査、button別latch、取消しはない。
- Group toggleはicon-only buttonに明示title/aria-labelがない。他のBilling action iconにはtitle/aria-labelがある。空/error/loading表示はAir table又はparentへ委譲する。
- Billing/OperationResultの同時更新・Functions集計・lock toggleの競合をこれらcomponent自身は調停しない。Customer Billingは表示用copy、Operation系はlive instanceをmanagerへ渡すというidentity差がある。

## 矛盾・未使用・comment mismatch

- OperationBilling managerがcreateを拒否するのに一覧toolbarはplusを表示する。既存FUT-0033の到達可能な不整合を再確認した。
- Customer Billingのstatus非表示・全status出力、group再集約税とsite別tax合計差、OperationResult/OperationBillingのread permission内write到達は既存文書と一致し、承認済みlifecycleの実装完了を意味しない。
- `OperationResultsDataTable`の空`defineEmits([])`、旧`useOperationBillingsManager.js`への現行page callerなしはdead/legacy候補である。後者は対象8ファイル外の直接検索事実であり、本reviewだけで削除可否は決めない。

## 将来要対応・要確認事項

- FUT-0031、FUT-0033、FUT-0052、FUT-0053、FUT-0054、FUT-0115、FUT-0117、FUT-0154へ根拠を統合した。
- 新規CONFは追加しない。正式permission、invoice-issued/status、税・PDF、CSV consumerは既存CONF-0019、CONF-0033、CONF-0038〜0040、CONF-0131で追跡する。

## 未確認範囲

- AirArrayManager/AirDataTable package内部のaction列生成、submit latch、error/empty表示、slot item identity。
- runtime/UI/Emulator、PDF/CSV生成物、Rules enforcement、同時click/tab、実dataの税端数・欠損master。
- OperationBilling CustomInput以降の取極め・調整詳細、Functions集計本文、PDF layout本文は既存文書を参照し再精査していない。
