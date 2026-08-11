# Customer（取引先）マスター実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-020、SPEC-DEEP-010、SPEC-DEEP-021
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/customers/index.vue`、`pages/customers/[id].vue`、`components/Customers/**`、`components/Customer/**`、`composables/fetch/useFetchCustomer.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Customer.js`、`air-guard-v2-schemas/src/mixins/GeocodableMixin.js`、`air-firebase-v2-client-adapter/index.js`

## 入口・暫定権限

Page 2ファイルのroute、購読、CRUD到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を、Customer componentの公開契約・Site作成からの候補選択境界は[Customer components deep review](customer-components-deep-review.md)を参照する。

2026-08-11に、Customer権限は`customers:read`/`customers:write`の2種を維持すると確認された。writeは作成・編集・支払条件・終了・archive・restoreを含み、archive/restoreは確認・監査付き、通常物理deleteは禁止とする。User向けpermission presetを設け、UI・Rules・Callableを同じ境界へ揃える。field分割は実需要が生じた場合だけ再検討する。

| 入口 | 実装 | UIの入口条件 | Rulesの境界 |
|---|---|---|---|
| 一覧・作成 | `/customers` | `customers:read` | 同一会社の認証ユーザーまたはsuper-userは全read/write |
| 詳細・更新・削除 | `/customers/[id]` | `customers:read` | 同上。field、role、permission別の制限なし |
| Autocomplete | `Customer/Autocomplete` | 呼出し元依存 | 同上 |

`customers:read` は暫定的なページ表示条件であり、画面内の作成・更新・削除を分離しない。Rulesも同一会社ユーザーに全書込みを許すため、正式なCRUD権限仕様とは扱わない。

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

- 一覧のplus buttonは汎用array managerの`Customer.create(item)`を呼ぶ。更新はitem managerの`Customer.update(item)`、削除は`Customer.delete(item)`を呼ぶ。
- schema required validationはあるが、`code`、名称等の一意性確認はない。
- 詳細の基本編集は`code/name/branchName/abbreviation/nameKana/zipcode/prefCode/city/building/tel/fax/remarks`を対象とする。必須の`address`は表示されるが編集対象から欠落している。
- 支払条件編集は`cutoffDate/paymentMonth/paymentDate`を一括編集する。
- `contractStatus`は詳細に表示されるが編集対象に含まれず、TERMINATED化・再有効化の画面経路は確認できなかった。
- 削除前に`Customer.hasMany`で関連Siteを検索し、1件でもあれば拒否する。検索はtransaction外の`getDocs`であり、確認後にSiteが追加される競合余地はadapter自身のコメントにも明記されている。
- archiveからのrestore APIはadapterにあるが、Customer画面から呼ぶ経路は確認できなかった。

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
- 現在の画面ではstatus変更経路がなく、論理削除だけが到達可能。削除確認dialog後、成功時に一覧へ戻る。
- archive collectionにも同一会社ユーザー/super-userの全read/write Ruleがある。UI restore、保持期間、参照中masterの扱いは未確定。

## Rules・tenant境界

- `Companies/{companyId}/Customers/{docId}` と `_archive` は、認証ユーザーのcompanyIdがpathと一致するかsuper-userであれば全read/writeできる。
- document内companyId、許可field、status transition、参照整合、権限claimはRulesで検証しない。
- path prefixがtenant境界である。異なるcompany pathへの通常ユーザーアクセスは拒否される。

## 矛盾・未使用候補

- 必須`address`が詳細編集includedKeysから欠落し、既存取引先の番地を同画面で訂正できない。
- `contractStatus`を表示し一覧はACTIVEに限定するが、status変更UIがない。
- AutocompleteはACTIVE制約がなく、一覧の対象条件と一致しない。
- archive restore APIはあるがCustomer UIから未到達。
- `CustomersIterator`は宣言コメントと異なり`modelValue`、`select-strategy`、`show-select`及び任意attrsを内部iteratorへforwardしない。Site作成wizardの既存Customer候補選択に渡すattrsが機能しないため、候補選択より取引先未設定継続だけが到達し得る。
- Site表示条件と削除guard条件が異なり、利用者には見えない参照で削除拒否となり得る。

## 将来要対応

- FUT-0055: 承認済みread/write権限、preset、archive/restore監査、物理delete拒否をUI・Rules・Callableへ実装する。
- FUT-0056: 承認済みcode一意・類似warning・ACTIVE選択・TERMINATED履歴・検索fieldを実装し、feasibility/index/cost/privacyを検証する。
- FUT-0057: 承認済みTERMINATED/archive/運営者inspection・緊急restore境界を実装し、参照guard・保持を整備する。
- FUT-0058: draft initial copy、formal full snapshot、snapshot再print、revisionを実装する。
- FUT-0059: address/status編集経路とgeocoding境界を修正・検証する。

## 要確認事項

- CONF-0041〜CONF-0045を`pending-confirmations.md`に登録した。

## 未確認範囲

- 汎用Air manager内部の全validation・表示実装。
- Site/Agreement/Billing/PDFの内部処理、実データ上の参照件数、index、Emulator/ブラウザ動作。
- `contractStatus`を別画面・管理手段・データ移行で変更する運用。
