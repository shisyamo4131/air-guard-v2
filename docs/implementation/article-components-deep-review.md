# Article components deep review

## メタデータ

- 状態: 実装調査（file本文deep review）
- 対象checkpoint: SPEC-DEEP-016
- 最終確認日: 2026-08-11
- 対象: `components/Article/**`、`components/ArticleDetail/**`、`components/ArticleDetails/**`、`components/Articles/**`のexact 7 files
- 境界: 直接callerのArticle page、OperationResult/OperationBilling detail、Article/ArticleDetail schemaだけを照合した。Air manager/fetch internals、Rules実行、PDF/集約、runtimeは未確認。

## file別公開契約

| file | props / emits / responsibility | data・mutation | validation・error・accessibility |
| --- | --- | --- | --- |
| `Articles/Manager/index.vue` | docs、CRUD handlers、search、itemsPerPage、showCreate等を受け、AirArrayManagerとArticle iteratorを組立。`update:search` emit。 | default handlerはArticle create/update/deleteへ委譲。 | toolbarのcreate buttonは`showCreate`にかかわらず表示。loading/permission/error/single-flightは基底manager依存。 |
| `Articles/Iterator/index.vue` | articlesとshow flags、create/edit/detail emit。 | item選択はdata iteratorのselectへ委譲。 | `hideDefaultFooter` propを定義するがiteratorへ渡さず、`itemsPerPage` prop自体がない。ArticleCardの選択iconはbutton semanticsを持たない。 |
| `Article/Card/index.vue` | Article instanceとselect/edit/detail flags、3 click emits。 | なし。 | code/name/priceを表示。icon-only actionに明示labelなし。priceの0は正しく0表示。 |
| `Article/Autocomplete.vue` | label/item fields/returnObject、`update:model-value` emit。 | searchArticles/getArticleをAPI componentへ渡す。 | custom filterは常にtrue。loading/error/debounce/permissionはair autocomplete/fetch側へ委譲。 |
| `ArticleDetail/CustomInput/index.vue` | componentAttrs/updatePropertiesを受け、Article選択、snapshot price、quantity inputを結線。 | 選択時にgetArticleをawaitし、articleIdとlive master priceをセット。clear時はarticleId null/price 0。 | error catch、loading、選択世代チェックなし。先行requestが後続選択後に戻ると旧articleId/priceへ上書きし得る。tax/unit inputなし。 |
| `ArticleDetails/Manager/index.vue` | customInput/tablePropsとattrsをAirArrayManagerへ透過し、embedded ArticleDetail配列CRUDを管理。 | item-key=articleId、parent v-model/submitがOperationResultまたはOperationBilling documentを保存。 | create button以外のpermission/loading/error/duplicate handlingは基底managerへ委譲。 |
| `ArticleDetails/DataTable/index.vue` | itemsとattrsを受け、live Article code/nameとsnapshot price/quantity/amountを表示。 | price×quantityをlocal total。 | Article missing/archiveは`-`/`N/A`。tax/roundingなし。footerは5 headerに対してcolspan 5+total cellを出し、6列相当となる。 |

## price・quantity・tax・snapshot/live境界

- Article masterはcode/name/description/price/remarksだけで、unit/tax/taxRate/currency/statusを持たない。ArticleDetailはarticleId、snapshot price、quantityだけである。
- 選択時だけlive Article.priceをArticleDetailへcopyし、後続のprice/quantity編集はembedded snapshotを更新する。code/nameはDataTableとPDF側でlive masterを参照するため、改名/archive/欠損が過去表示へ遡及する。
- DataTableとlocal totalはprice×quantityをそのまま加算し、quantityの整数性、負price、tax、rounding、currencyを追加検証・表示しない。

## CRUD・caller・認可境界

- `/articles`がArticlesManagerの直接callerであり、`pages/operation-results/[id].vue`と`pages/billings/operations/[id].vue`がArticleDetailsManagerをembedded array編集に使う。各親の`doc.update()`が保存を行う。
- component層はrole/tenant/field allowlistを持たず、create/update/delete/archive、明細編集、過去結果lockの強制はpage/Rules/schema/server境界に委譲する。
- 一覧のsearchは親pageが空検索時updatedAt desc/limit 10、検索時code ascを選ぶ。ManagerのitemsPerPage=20はIteratorで未使用である。

## 矛盾・未使用候補

- `showCreate`はempty stateにだけ反映され、Manager toolbarのplusは常に表示する。
- Managerから渡す`itemsPerPage`と`hideDefaultFooter`はIteratorが実質使用せず、public prop契約と画面挙動が一致しない。
- ArticleDetailのdescriptionはquantityを正の整数とするがvalidatorは正数で小数を許す。Article/ArticleDetail required validatorの存在しない`REQUIRED_ERROR()`呼出しは既存FUT-0166の対象である。
- `CustomInput`の非同期選択はcatch/abort/最新選択照合を持たず、遅延responseで選択を巻き戻し得る。

## 将来要対応・要確認

- FUT-0121〜FUT-0123、FUT-0166へ本checkpointの権限、数値・税、live/snapshot、validatorの根拠を統合した。
- FUT-0170（manager/iterator/tableのprop・layout契約）とFUT-0171（非同期Article選択の世代/失敗処理）を追加した。
- 既存CONF-0100〜CONF-0102、CONF-0137に統合し、新規CONFは追加しない。

## 未確認範囲

- AirArrayManager/AirDataIterator/AirAutocompleteのvalidation、pagination、dialog、loading/error、selection semantics。
- fetch cache/searchの実query・abort、Rules/server/transaction、PDF/集約、runtime/keyboard、component test、実data。
