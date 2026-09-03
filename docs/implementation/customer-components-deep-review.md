# Customer components deep review

## メタデータ

- 状態: Historical / 2026-08-11の詳細実装調査。現在のCRUD・状態表示/編集は[Customer master](customer-master.md)を参照
- 対象セグメント: SPEC-DEEP-021
- 最終確認日: 2026-08-11
- 根拠ファイル: `components/Customer/Autocomplete.vue`、`components/Customer/Select.vue`、`components/Customer/Activator/{Base,Payment}.vue`、`components/Customer/{Card,ListItem,Manager}/index.vue`、`components/Customers/{DataTable,Iterator,Manager}/index.vue`、直接callerの`pages/customers/{index,[id]}.vue`、`components/Site/{Manager,CustomInput}/index.vue`、`composables/{useBaseManager,fetch/useFetch}.js`、schemas `Customer.js`

## 対象と到達性

| component | 公開契約・主なcaller | 実装上の責務 |
| --- | --- | --- |
| `CustomerAutocomplete` | `v-model`、`creatable`、title/value/return-object設定。Site Manager | `useFetch("CustomerAutocomplete")`のCustomer検索・key取得を`air-autocomplete-api`へ接続し、任意でCustomer作成dialogを表示する。 |
| `CustomerSelect` | `air-select`のattrsと、title/value/label default | 選択UIの薄いwrapper。自身で取得・validation・emitを持たない。 |
| `CustomerActivatorBase` / `Payment` | Customer instance、`click:edit`、`includedKeys` expose。Customer detail | 基本情報又は締日・入金サイトを表示し、親managerに編集対象fieldを知らせる。 |
| `CustomerCard` / `ListItem` | Customer又はlist item、選択/編集/詳細emit。Iterator/Autocomplete | カードは名称・略称を、ListItemは略称だけを表示する。 |
| `CustomerManager` / `CustomersManager` | Customer/doc(s)、任意CRUD handler、全slot passthrough。Customer pages | `air-item-manager`/`air-array-manager`へdefaultのmodel CRUDを委譲する。 |
| `CustomersDataTable` | `air-data-table` attrs、sort default | code/name/address列と支店名・建物名の補助表示を与える。 |
| `CustomersIterator` | customers、showCreate/detail/edit、create/detail/edit emit。Site create wizard | `CustomerCard`とempty stateを描画する。 |

Nuxt auto-registration以外の静的callerはCustomer page群とSite Manager/CustomInputで確認した。`CustomerCard`と`CustomerListItem`はそれぞれIterator/Autocompleteのtemplateから利用される。対象10ファイルにテストファイルは見つからなかった。

## 検索・選択・作成の契約

- AutocompleteはN-gram検索を`searchCustomers(text, { returnAllCached: false })`で呼び、クライアント側filterを常にtrueにする。コメントどおり、候補の累積cacheを避けるため`cache-items`を指定せず、検索APIのcacheへ委ねる。
- `creatable`時のplusは`CustomersManager`のcreate eventをmodel valueへ変換する。`returnObject=false`なら`itemValue`（default `docId`）、trueならCustomer objectをemitする。
- このcomponent自身はACTIVE constraint、重複warning、permission、検索中/失敗表示、取消し、request順序の管理を持たない。検索側がエラーを空結果へ吸収する既存共通契約に従う。
- Site create wizardは名称検索後に`CustomersIterator`へ`componentAttrs.customerId`、`show-select`、`select-strategy="single"`を渡す。しかしIteratorはこれらattrs及び`modelValue`を内部`air-data-iterator`へ転送しない。従って現在のtemplateだけでは候補選択の設定・値の往復を成立させない。一方、候補なしの「取引先未設定」継続は明示的に許容される。

## 編集・削除・状態の境界

- Basic Activatorがexposeする編集fieldは`address`と`contractStatus`を含まない。Payment Activatorは`cutoffDate`、`paymentMonth`、`paymentDate`だけを公開する。いずれもedit iconを常時表示し、disabled/loading/permissionを自身で判定しない。
- Manager二種のdefault handlerは`item.create/update/delete`である。UIのdeleteは現行adapterのlogical archiveへ委譲するが、Customer detailは`hide-delete-btn`を与えた上で独自の削除確認slotから`toDelete()`へ到達させる。
- 調査時のCustomer pageにはACTIVE購読条件が記述され、Autocompleteはstatusを絞らなかった。ただし旧一覧は後にadapter引数不一致が判明し、実際のACTIVE限定取得は未確認。旧ACTIVE限定選択方針は[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)で置き換えた。現在の状態契約は[現行仕様](../specification.md#取引先現場取極め)、CRUD・削除境界の実装状況は[Customer master](customer-master.md)を参照する。

## 表示・個人/取引情報・アクセシビリティ

- DataTableは名称・住所（`fullAddress`/building）を、Base Activatorは住所・電話・FAX・remarksを表示する。Card/ListItem/Autocomplete標準itemは略称等の最小表示である。表示先のread権限は各caller及びFirestore Rulesに依存し、component単独にredactionはない。
- Base/Payment Activator、Cardのedit/detail/select、Autocomplete作成はicon-only操作で、明示的`aria-label`、keyboard補助、focus returnを提供しない。空値はBase/Paymentが`-`、ListItemが`N/A`、Cardがcodeだけ`---`を用い、名称・略称の欠損は統一されない。
- DataTableとIteratorはloading/error表示を実装せず親/air componentへ委ねる。`CustomersIterator`のempty stateはcreate eventを出すが、`showCreate`は子iteratorへのcreate制御ではない。

## 確認済み整合・矛盾・未使用候補

- `Customer` schemaのtokenFieldsがname/nameKanaだけである点、一覧のACTIVE条件記述とAutocomplete非限定の差、address/status編集欠落、archive restore UI未到達を当時記録した。現在の実装と、旧一覧条件の訂正は[Customer master](customer-master.md)を参照する。
- Iteratorコメントは「AirDataIteratorの全props」と`update:modelValue`を使用可能と説明するが、実装は`customers`、一部表示flag、3 click emit以外をforwardしない。このコメント/API不一致はSite createで直接到達する。
- `CustomersDataTable`の空`defineEmits([])`、`CustomerSelect`の自身の状態なし、`CustomerCard`の将来avatar commentは現時点のunused/stub候補であり、静的には削除可否を決められない。

## 将来要対応・要確認事項

- FUT-0055、FUT-0056、FUT-0057、FUT-0059、FUT-0113、FUT-0115、FUT-0170へ本reviewの根拠を統合した。
- 新しい利用者判断は追加しない。Customer CRUD、候補status、archive/restoreの方針はCONF-0041〜0045で回答済みであり、Iterator属性転送・stale response・accessible nameは実装修正/検証事項である。

## 未確認範囲

- `air-*` manager/iterator/autocompleteの内部prop forwarding、実browserでのvalidation、search race、dialog focus、Firestore Rules/adapterのruntime挙動。
- 実データのTERMINATED候補、権限別表示、network error、archive/restore、作成後のcache更新。
