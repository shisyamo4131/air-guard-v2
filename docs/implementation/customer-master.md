# Customer（取引先）マスター実装調査

## メタデータ

- 状態: CUSTOMER-01A local実装・受入れ完了 / Dev未反映
- 対象セグメント: SPEC-SEG-020、SPEC-DEEP-010、SPEC-DEEP-021
- 最終確認日: 2026-09-03
- 根拠ファイル: `pages/customers/index.vue`、`pages/customers/[id].vue`、`components/Customers/**`、`components/Customer/**`、`composables/fetch/useFetchCustomer.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Customer.js`、`air-guard-v2-schemas/src/mixins/GeocodableMixin.js`、`air-firebase-v2-client-adapter/index.js`
- local受入れ証拠: [CUSTOMER-01A local acceptance verification receipt](../verification/customer-01a-local-acceptance.md)

## 入口・暫定権限

Page 2ファイルのroute、購読、CRUD到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を、Customer componentの公開契約・Site作成からの候補選択境界は[Customer components deep review](customer-components-deep-review.md)を参照する。

2026-08-11に、Customer権限は`customers:read`/`customers:write`の2種を維持すると確認された。writeは作成・編集・支払条件・終了・archive・restoreを含み、archive/restoreは確認・監査付き、通常物理deleteは禁止とする。User向けpermission presetを設け、UI・Rules・Callableを同じ境界へ揃える。field分割は実需要が生じた場合だけ再検討する。

| 入口 | 実装 | UIの入口条件 | Rulesの境界 |
|---|---|---|---|
| 一覧・作成 | `/customers` | readで一覧、write actorだけ作成 | 同一会社read。作成は有効な本登録会社管理者または既知manager/legal |
| 詳細・更新 | `/customers/[id]` | readで詳細、write actorだけ基本・支払編集 | 同じactorと操作別fieldだけを許可。client deleteは拒否 |
| Autocomplete | `Customer/Autocomplete` | readで検索、write actorだけ作成 | 作成は一覧と同じ専用処理 |

Customerの製品経路は`AirItemManager`、`AirArrayManager`、`useBaseManager`を使用しない。一覧とAutocompleteは共有作成dialog、詳細は基本情報editorと支払条件editorを使用する。閲覧だけの利用者には作成・編集・archive入口を表示しない。

## データ契約

- 保存先は会社prefix配下の `Customers/{docId}`。doc IDは自動採番を使わず、通常の作成経路ではFirestore生成IDとなる。
- 必須: `name`、`abbreviation`、`nameKana`、`zipcode`、`prefCode`、`city`、`address`、`contractStatus`、`cutoffDate`、`paymentMonth`、`paymentDate`。
- 任意: `code`、`branchName`、`building`、`tel`、`fax`、`remarks`。`location` はhidden field。
- token検索対象は `name` と `nameKana`。`code`、略称、支店名、住所、電話番号はtokenFieldsに含まれない。
- 読み取り専用プロパティは `fullAddress` と `prefecture`。`fullAddress` は都道府県、市区町村、番地の結合で、建物名は含めない。
- statusは `ACTIVE` と `TERMINATED`。`logicalDelete=true` のため、削除は `Customers_archive/{docId}` へのコピーと元document削除を同一transactionで行う。
- `getPaymentDueDateAt(baseDate)` は締め基準月へ`paymentMonth`を加え、月末指定または指定日をJST基準で算出する。存在しない指定日は月末へ丸める。
- 住所変更時はgeocodingを試みる。関数未注入、検索失敗、例外時も保存処理を中止せず`location=null`で継続する。緯度または経度が0の場合はtruthy判定により座標なしとして扱われる。

## CRUD・validation

- 一覧とAutocompleteのplus buttonは共有作成dialogからCustomer専用application処理を呼ぶ。基本情報と支払条件も専用editorから同じ境界を呼び、UIからCustomer modelの`create/update/delete`を直接呼ばない。
- schema required validationはあるが、`code`、名称等の一意性確認はない。
- 詳細の基本編集は`code/name/branchName/abbreviation/nameKana/zipcode/prefCode/city/address/building/tel/fax/remarks`を対象とする。
- 支払条件編集は`cutoffDate/paymentMonth/paymentDate`を一括編集する。
- `contractStatus`は詳細に表示されるが編集対象に含まれず、TERMINATED化・再有効化の画面経路は確認できなかった。
- active Customerのclient deleteと`Customers_archive`のclient CUDはRulesで拒否する。archive・restoreの画面入口はなく、参照確認と監査を持つ後続の専用操作へ分離した。
- 更新は最新Customerへ実際に変更したoperation所有fieldを重ね、全体schemaを検査してから、実変更fieldと`uid`・server timestampだけを保存する。名称変更時は`tokenMap`、主要住所変更時は位置・表示住所の派生fieldを同時に部分保存する。
- editorはlive値とdraftを分け、同じoperation fieldの外部変更ではreloadを必須にする。自分の保留中反映と失敗後rollbackは外部競合から除外し、rollback待ち中のbutton・Enter再送を拒否する。

## Dev反映前の保存形式検査

`utils/customer/customerDocumentContract.js`が永続化する26項目の集合を持ち、`utils/customer/customerWriter.js`の作成時の抽出と共有する。writerの保存項目・更新処理と既存Rulesの許可挙動は維持している。

`scripts/check-customer-dev-compatibility.mjs`はconverterを通さずFirestoreの生の型を検査する。modelのdefaultによる欠損補完や、整数と小数の区別が失われる変換を行わない。認証、取得完了、想定path、上限、保存形式を検査し、値・ID・資格情報・data由来hashを出力せず固定理由の件数だけを集計する。書込み・修復機能は持たない。

対象範囲、明示command、接続前確認、上限、未検証表現の扱い、exit status、停止条件は[Dev runbookのCustomer事前検査](../runbooks/dev-deployment.md#customer保存形式のread-only事前検査)を正本とする。実行時点のDev件数・保存形式・認証と応答の確認結果は[CUSTOMER-01B検査証拠](../verification/customer-01b-dev-compatibility.md)を参照する。具体的な原因項目と、現在のedition・IAM設定全体は未確認である。

## 検索・表示

名称にhard unique制約は設けず正当な同名作成を許す。任意Customer codeだけtenant内uniqueとする。normalized name/kana/address/phoneの類似候補はwarningに留める。新規選択はACTIVE限定、historical referenceではTERMINATEDも表示し、再利用前にreactivateする。検索はcode/name/kana/phoneを対象とし、addressはprivacy/cost確認後に追加を検討する。類似検索のfeasibility/index/costは未検証である。

- 一覧は`contractStatus == ACTIVE`をlive購読し、初期sortは`code`降順。表示列はcode、name、fullAddressで、支店名と建物名を補助表示する。
- Autocompleteはname/nameKanaのN-gram検索、上限50件、5分cacheを使う。追加constraintを渡さないため、ACTIVE条件は付かず、TERMINATED Customerも検索結果になり得る。
- 詳細の関連Site一覧はACTIVEだけを表示する。一方、削除の参照確認はstatusを限定しないため、画面上に関連Siteが見えなくてもTERMINATED等のSiteがあれば削除は拒否される。

## 参照関係・変更影響

- draft作成時にinitial Customer copy、正式発行時にfull snapshotを固定する。発行済み再printはsnapshotを使い、master変更を反映しない。訂正はreason/history付きnew revisionとし、live Customer参照のPDFはdraftだけに限定する方針である。

- schema上の直接`hasMany`は`Sites.customerId`だけで、削除guardもSiteだけを対象とする。
- Billing作成時は現在のCustomer支払条件から`paymentDueDateAt`を算出してBillingへ保存する。その後のCustomer支払条件変更は既存Billingの期日を自動更新しない。
- Billingは`customerId`を保持するがCustomer名称・住所のsnapshotは持たない。請求書PDF生成時は現在のCustomer masterを取得するため、名称・住所変更は過去Billingの再生成PDFにも反映され、Customerがarchive済み等で取得不能なら生成失敗になり得る。
- Site、Agreement、OperationResult、Billing等の内部契約は本セグメントでは確認していない。

## 削除・無効化

- 契約終了・停止はTERMINATED、再開は`customers:write`によるACTIVE化とする。archiveは参照なし確認後の誤登録・重複だけに限定し、reason/actor/timeを保存する。通常User向けrestore・物理delete UIは設けない。
- archiveはUser向けrecycle binではない。運営者はUser依頼に応じ監査付きで削除情報を確認でき、restoreは通常UIから隔離した緊急contingencyだけとする。active同IDがあればoverwriteせず拒否し、保持要件が決まるまで自動purgeしない。

- `TERMINATED`は業務上の無効状態、logical deleteはarchive移動であり別機構である。
- 現在の画面ではstatus変更、archive、restore、物理deleteの経路を提供しない。
- archive collectionのreadは既存の同一会社境界を維持し、client create/update/deleteは全actorへ拒否する。

## Rules・tenant境界

- `Companies/{companyId}/Customers/{docId}` のcreate/updateは、確認済みcompany claim、同社User、有効・本登録、会社管理者または既知manager/legal、actor UID、server timestamp、完全なfield集合・型、操作別変更fieldを検査する。直接permission、未知role、会社管理者でないsuper-user、他社、仮登録、無効Userを拒否する。
- active delete、archive CUD、Companies配下の広いfallbackによるCustomer制約迂回を拒否する。
- path prefixがtenant境界である。異なるcompany pathへの通常ユーザーアクセスは拒否される。
- Rulesは`tokenMap`と位置情報の型・形・変更契機を検査するが、名称・住所から意味上正しい値を完全再計算できない。正規writerは派生値を生成するが、書込み権限者の直接改ざん余地はserver生成化まで残る。

## 矛盾・未使用候補

- `contractStatus`を表示し一覧はACTIVEに限定するが、status変更UIがない。
- AutocompleteはACTIVE制約がなく、一覧の対象条件と一致しない。
- archive/restoreは意図的に後続専用操作へ分離している。
- `CustomersIterator`は宣言コメントと異なり`modelValue`、`select-strategy`、`show-select`及び任意attrsを内部iteratorへforwardしない。Site作成wizardの既存Customer候補選択に渡すattrsが機能しないため、候補選択より取引先未設定継続だけが到達し得る。
- Site表示条件と削除guard条件が異なり、利用者には見えない参照で削除拒否となり得る。

## 将来要対応

- FUT-0055: read/write分離、preset、通常物理delete拒否はCUSTOMER-01Aで実装済み。終了・再有効化と、参照確認・監査を伴うarchive/緊急restoreを後続の専用操作として実装する。
- FUT-0056: 承認済みcode一意・類似warning・ACTIVE選択・TERMINATED履歴・検索fieldを実装し、feasibility/index/cost/privacyを検証する。
- FUT-0057: 承認済みTERMINATED/archive/運営者inspection・緊急restore境界を実装し、参照guard・保持を整備する。
- FUT-0058: draft initial copy、formal full snapshot、snapshot再print、revisionを実装する。
- FUT-0059: status編集経路とgeocodingのserver生成化・意味上の整合を修正・検証する。address編集経路はCUSTOMER-01Aで実装済み。

## 要確認事項

- CONF-0041〜CONF-0045を`pending-confirmations.md`に登録した。

## 未確認範囲

- 他masterに残る汎用Air manager内部の全validation・表示実装。
- Site/Agreement/Billing/PDFの内部処理、Dev・実データ上の参照件数、保存形式検査で検出した不適合の具体的原因、必要なindex、後続の終了・archive操作。
- `contractStatus`を別画面・管理手段・データ移行で変更する運用。
