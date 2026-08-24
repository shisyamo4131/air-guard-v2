# Article（品目）マスター実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-035、SPEC-DEEP-010
- 最終確認日: 2026-08-11（SPEC-DEEP-016でArticle component本文を再確認）
- 根拠ファイル: `pages/articles/index.vue`、`components/Articles/Manager`、`Articles/Iterator`、`Article/Card`、`Article/Autocomplete.vue`、`ArticleDetails/Manager`、`ArticleDetails/DataTable`、`ArticleDetail/CustomInput`、`composables/fetch/useFetchArticle.js`、`composables/dataLayers/useDocuments.js`、schemas `Article.js`・`ArticleDetail.js`・`OperationResult.js`、`firestore.rules`、client adapter delete/restore、`composables/pdf/useBillingPdf.js`

## 入口・権限

Page 1ファイルのroute、query、CRUD到達性、状態・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を参照する。

`/articles`の「商品管理」pageだけがmaster一覧/CRUD入口で、pageSettingsは`DEVELOPER` access policy、navigation trueである。UIはsearch、追加、card編集をAirArrayManagerへ渡す。独立詳細routeはない。

Firestore Rulesは`Companies/{companyId}/Articles/{docId}`と`Articles_archive/{docId}`について、同一company claimの全認証Userまたはsuper-userへread/writeを包括許可する。UIのdeveloper限定と実write許可は一致せず、UI roleはsecurity boundaryではない。

## データ契約

Articleは「稼働外で計上すべき売上」の品目masterであり、無線機利用料・指名料等を想定する。

2026-08-11に、OperationResult内の稼働外売上・ArticleDetailを手動請求の正規経路として利用し、別Billing child manual-line modelは採用しない方針が確認された。課税区分等の不足fieldは実務に合わせて将来追加する。

| field | 契約 |
|---|---|
| path | `Companies/{companyId}/Articles/{docId}`、自動採番なし |
| `code` | 任意の商品コード、token検索対象 |
| `name` | 必須、最大50、token検索対象 |
| `description` | 任意の商品説明 |
| `price` | 必須number、default 0。NaN/非numberを拒否するが負数を拒否しない |
| `remarks` | 任意備考 |
| delete | `logicalDelete=true`、archive collectionへ同ID/同dataを移動 |

unit、tax/taxRate、rate、status/active、currency、適用期間、読み取り専用業務property/getterはArticleにない。

## CRUD・validation

AirArrayManager default handlerは`create(item)`、`update(item)`、`delete(item)`を呼ぶ。deleteはclient adapter transactionでchild有無を検査し、logical delete時はsourceを`Articles_archive`へsetしてactive documentをdeleteする。restore APIはadapterにあるが、Article archive一覧/復元UIは確認できない。

name/price以外の必須、code/name重複、code形式、負数、上限、小数桁、税区分をschemaは強制しない。Rulesにもfield/type/value/変更field validationはない。create/update時の具体的dialog validationと二重submitは外部AirArrayManager内部のため未確認。

## 検索・状態

pageは空検索時にupdatedAt desc/limit 10のsubscription、検索時はN-gram constraintsとcode ascを使う。UI managerへ`items-per-page=20`を渡すため、空検索では取得10件に対し表示page size 20となる。検索はcode/name token。カードはcode/name/priceを表示し、empty stateから作成できる。

Article固有statusはなく、active collectionに存在するかarchiveへ移動したかだけが状態境界である。archive検索・終了一覧・restoreはUIにない。Managerの`showCreate`はempty stateにだけ反映されtoolbarのcreate buttonは常に表示し、`itemsPerPage`/`hideDefaultFooter`はIteratorが実質使用しない。詳細は[Article components deep review](article-components-deep-review.md)を参照する。

## 請求参照・snapshot

OperationResultの`articles[]`は埋込みArticleDetailで、`articleId`、`price`、`quantity`だけを保存する。品目選択時にlive Article.priceを初期値としてcopyし、実績ごとにprice/quantityを上書きできる。

一覧と請求書PDFはcode/nameを`articleId`からlive Article master取得し、price/quantityはArticleDetail snapshotを使う。master欠損・archive後はcode `-`、name `N/A`で継続し、金額はsnapshot price×quantityを維持する。したがってmasterのname/code変更は過去表示/PDFへ遡及し、price変更は既存明細額へ遡及しない。

## 削除・archive

ArticleへのOperationResult参照はsubcollectionではなく埋込みIDのため、generic `hasChild`が逆参照を検出する直接根拠はない。参照中でもarchive可能な候補があり、その後のlive lookupはactive collectionから取得できずplaceholderとなる。archive dataと参照実績の保持期間、復元、同ID再作成競合は未決定である。

## Rules・tenant

pathのcompanyIdとAuth claim一致によるtenant分離はあるが、developer/請求担当/create/update/deleteの操作別権限はない。archiveも同じ包括writeで、任意clientが直接restore相当writeやarchive改変を行える。field validation、immutable docId/code、参照guardはRulesにない。

## Failure・concurrency

一覧subscriptionはquery変更時に再購読しunmountでunsubscribeする。Article create/update/deleteは個別document transaction/version preconditionをUIから指定せず、同時編集は後勝ち候補である。logical deleteのarchive setとactive deleteは同一transactionだが、OperationResult逆参照検査とはatomicでない。Autocomplete取得errorは共通fetch基盤で吸収され、選択時はprice 0へfallbackし得る。

## 矛盾・未使用候補

- UI pageはdeveloper限定だがRulesは同一会社User全員に全CRUDを許す。
- ArticleDetailの説明はquantityを正の整数とするがvalidatorは`>0`だけで、小数を許す。
- master priceとArticleDetail priceは負数を拒否せず、負額の正式用途は未確認。
- 商品masterにunit/tax/statusがなく、請求側でそれらをArticle単位に表現できない。
- empty時query limit 10とiterator items-per-page 20が不一致。
- archive/restore UIがなく、logical delete後の過去明細名はN/Aとなる。
- Article選択の非同期responseは選択世代・abort・error処理を持たず、遅延した先行選択が後続のarticleId/priceを上書きし得る。DataTable footerはheader 5列に対して6列相当を出力する。

## 将来要対応

FUT-0121〜FUT-0123、FUT-0166、FUT-0170、FUT-0171を`future-actions.md`へ追加・更新した。

## 要確認事項

CONF-0100〜CONF-0102を`pending-confirmations.md`へ追加した。

## 未確認範囲

AirArrayManager内部、Billing集約/税計算/PDF全体、OperationResult CRUD本文、実データ、remote Rules、実browser、archive運用は未確認である。
