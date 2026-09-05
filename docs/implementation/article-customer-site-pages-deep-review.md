# Article・Customer・Site pages deep review

## メタデータ

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-010
- 最終確認日: 2026-08-11
- 対象: `pages/articles/**`、`pages/customers/**`、`pages/sites/**`の6ファイル
- 境界: 直接manager/data composableの公開契約だけを照合し、child本文・schema内部・runtimeは再調査していない。

## route・権限・公開契約

| route / file | pageSettings | query・表示 | 操作・遷移 |
| --- | --- | --- | --- |
| `/articles` / `pages/articles/index.vue` | `developer`、navigationあり | 空検索は`updatedAt desc`・limit 10、検索時はcode asc。manager側page size 20 | Article create/update/delete。独立詳細routeなし |
| `/customers` / `pages/customers/index.vue` | `customers:read` | ACTIVE全件をrealtime購読し、searchはDataTableへ渡すclient filter | plusでcreate、row updateは`/customers/{id}`へ遷移 |
| `/customers/[id]` | `customers:read` | Customer単体と同CustomerのACTIVE Site全件を購読 | 基本・支払条件update、Site詳細遷移、Customer delete後`/customers`へreplace |
| `/sites` / `pages/sites/index.vue` | `sites:read` | ACTIVE全件を購読。text searchとsecurityType/customerIdをclient filter | create後detailへ遷移、row updateもdetailへ遷移 |
| `/sites/terminated` | `sites:read` | search非空時だけTERMINATEDをremote検索。manager page size 20 | detail遷移 |
| `/sites/[id]` | `sites:read` | Site単体、指定月Schedule、SiteEmployeeHistoryを取得・購読 | 基本/Customer/Agreement更新、Schedule管理、terminate、delete、関連表示 |

6ページはいずれも`definePageMeta`を持たず、global middlewareがroute pathとpageSettingsを照合する。Articleだけdeveloper role、Customer/Siteはread permissionである。page側にはwrite permission、status、actorによるbutton/handler guardがなく、managerへdefault CRUDを渡すため、UI表示権限と更新到達性が分離されていない。

## list・query・pagination

### Article

`useDocuments("Article")`へsearch/optionsを渡し、空検索を全件取得可能として購読する。空検索limitは10なのにmanagerの`items-per-page`は20であり、UI paginationは取得上限を拡張しない。検索時はquery limitを明示せず、code ascとなる。page自身はloading/error/emptyを受け取らず、表示はmanager/data-layerに委ねる。

### Customer

`Customer.subscribeDocs`をACTIVE constraintだけで開始し、order/limit/paginationを指定しない。全ACTIVE Customerをmemoryへ保持し、DataTableのsearchでclient filterする。unmountで単一instanceをunsubscribeする。create/update/deleteのloading/error/validationはAirArrayManagerへ委ね、page固有feedbackはない。

詳細はroute paramをsetup時に一度だけ取得し、CustomerとACTIVE Siteを別subscriptionで開始する。関連Site callbackは`useFetch` cacheへSiteを渡すが、表示自体はsubscription docsである。route param変更watch、not-found、loading/error、Customer取得失敗とSite取得失敗の分離はない。

### Site

ACTIVE全件を購読し、各Site callbackでCustomerを取得する。securityType/customer filterはcomputed、text searchはDataTableへ渡す。Customer cache取得は一覧件数に応じた追加readになり得る。filter dialogは`v-confirm-edit`のproxyへ編集中値を持ち、save/cancelで閉じるが、close iconはproxy確定処理を明示せずdialogだけ閉じる。

TERMINATED検索はsearch watcherから非同期`fetchDocs`を呼ぶ。空検索は即0件、非空はstatus constraintを加える。loading/error/cancel/request sequenceがなく、連続入力の応答逆転で古い結果が後から上書きし得る。検索値は初期nullだがmanagerのsearch prop型はstring defaultである。

Site詳細はroute paramをsetup時に固定し、`useDocument`でSite、月範囲の`useDocuments`でSchedule、専用data layerでSiteEmployeeHistoryを取得する。Schedule queryはdebounced rangeを使うがmanagerへ渡す`date-at`は即時`dateRange.from`である。履歴表示sortはEmployee kana、欠損Employeeは空文字、render keyはarray indexである。route param変更watch、not-found、page-level loading/errorはない。

## CRUD・archive・terminate・restore

- Articleはmanager defaultの`create/update/delete`を直接使用する。archive/restore routeはない。
- Customer一覧はcreate、詳細は2種類のupdateとdeleteを提供する。delete前dialogはあるが、TERMINATED変更/reactivate/archive inspection/restore UIはない。
- Site一覧はcreate、詳細はupdate/Agreement update/Schedule操作/terminate/deleteを提供する。terminateは確認alert付きで成功後一覧へ戻る。
- `/sites/[id]`はACTIVE/TERMINATEDでtemplateを分岐しないため、TERMINATED Siteにもupdate、Agreement、Schedule、terminate、deleteを表示する。再terminateはmodel側errorに依存する。
- Customer/Site delete dialogは利用者向けに「削除」と表現する。実処理はlogical archiveだが、Siteは「復元できない」と明記する。通常User restore UIがない承認済み運用とは概ね一致する一方、運営者の緊急restore境界やarchive auditはpageにない。
- pageはarchive collectionを直接読まず、restore handlerも公開しない。

## navigation・side effect・状態管理

- Customer/Site create後は詳細へ、delete/terminate後は一覧へ遷移する。Articleは同一page内dialog操作である。
- Customer詳細のSite row、Site一覧/終了一覧のrowはdetail routeへ移動する。
- Site詳細は同一pageからSite、Agreement、Scheduleという複数document作用を起動するが、page横断transaction、共通lock、dirty navigation guardはない。
- 一覧購読とdetail購読はunmount cleanupまたはdata composable lifecycleへ依存する。Customer/Site手書きsubscriptionは明示unsubscribeするが、pageはsubscribe errorをcatchしない。
- create/update/delete/terminate中の二重実行、button disabled、page-level loading/errorは確認できず、直接managerの契約に依存する。

## 矛盾・未使用候補・テスト

- Customer/Siteのread permissionだけでmutation UIへ到達し、承認済みread/write二分モデルを未実装である。
- TERMINATED Siteの通常master編集を制限しつつ終了表示・確認付きで新規業務へ選択可能にするADR 0054の方針に対し、detailは全編集・Schedule・terminate・delete UIを区別なく表示する。
- Articleの取得limit 10と表示page size 20が一致しない。
- CustomersManager commentは「詳細画面をまだ有していない」とするが、`/customers/[id]`が実在する。
- Sites pageの旧Iteratorはcomment outされ、現routeから未到達である。
- 6 pageを直接対象とするunit/component/route testは静的検索で確認できなかった。

## 既存台帳との対応

- Article: FUT-0121〜0123。特にlimit/page size、archive参照、正式権限。
- Customer: FUT-0055〜0057。read/write分離、status/archive、検索・選択規則。
- Site: FUT-0060〜0063。read/write分離、TERMINATED表示、archive/restore、終了検索race/error。
- 既存CONFは承認済み方針または残存上位判断であり、6ページの実装事実だけで新たに解消しない。新規CONFは追加しない。

## 未確認範囲

Air manager内部の全validation/disabled/loading/error、Firestore Rules/schema再読、必要index、実データ量、runtime route reuse、browser responsive/accessibility、Emulatorは未確認である。
