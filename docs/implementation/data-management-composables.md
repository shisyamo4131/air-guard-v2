# 汎用データ取得・管理コンポーザブル実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-032、SPEC-DEEP-039a、SPEC-DEEP-042、SPEC-DEEP-043、SPEC-DEEP-044
- 最終確認日: 2026-08-12
- 根拠ファイル: `composables/fetch/useFetch.js`、`useFetchBase.js`、`useFetchArticle.js`、`useFetchCustomer.js`、`useFetchEmployee.js`、`useFetchOutsourcer.js`、`useFetchSite.js`、`composables/useBaseManager.js`、`composables/useDocManager.js`、`package.json`、`package-lock.json`

## 対象一覧

| composable | 責務 |
|---|---|
| `useFetchBase` | FireModelの単一取得、N-gram検索、instance-local cache、同一IDのin-flight共有 |
| `useFetchArticle/Customer/Employee/Outsourcer/Site` | schema、ID候補、名称付きAPIを`useFetchBase`へ適用 |
| `useFetch` | 5種類のfetch composableをVue provide/injectでcomponent subtreeへ共有 |
| `useBaseManager` | AirItemManager/AirArrayManager向けloading・error event attrs、router/logger |
| `useDocManager` | deprecatedなAirItemManager wrapper。doc CRUD handler、component ref、削除後redirect |

`useItemManager`、`useArrayManager`というapp composableは存在しない。AirItemManager/AirArrayManagerはfile依存`air-vuetify-v3`のcomponentである。隔離worktree内にpackage実体はないが、承認済みprimary nested repositoryをUI-BASE/MANAGERS-001で精査済みであり、内部dialog/validation/disable/single-flight契約はそちらを正とする。

## 責務・API表

### useFetchBase

引数は`SchemaClass`、`entityName`、`idProperties=["docId"]`、`warnIfNotFound=true`、`searchCacheExpireMs=300000`。返却は`fetchItems`、`getItem`、`searchItems`、`cachedItems`、`cachedArray`、`pushItems`、`pushItem`、`isLoading`、`clearCache`、`clearSearchCache`。

`fetchItems`はstring/object/arrayから優先順ID propertyを抽出し、cache済みを省略、同一IDの進行中Promiseを共有し、`new SchemaClass().fetchDoc({docId})`を呼ぶ。`getItem`は取得後cacheから返す。`pushItem(s)`はschema instanceとdocId重複を検査する。

`searchItems`はsearch text、additionalConstraints、limit、forceRefresh、returnAllCachedを受け、`fetchDocs({constraints: searchText, options})`を呼ぶ。query cache keyはtextとconstraints/limitのJSONで、有効期限は呼出時にlazy cleanupする。defaultでは検索結果だけでなく全item cacheを返す。

### entity wrapper

各wrapperは`fetchX/getX/searchXs/cachedXs/cachedXsArray/pushXs/pushX/isLoading/clearCache`へrenameする。検索limit defaultは50。ID候補はArticle `articleId/docId`、Customer `customerId/docId`、Employee `employeeId/docId/workerId`、Outsourcer `outsourcerId/docId/workerId`、Site `siteId/docId`。baseの`clearSearchCache`はwrapperから公開されない。

### manager wrapper

`useBaseManager(name="useBaseManager")`は`attrs`、`isDev`、`isLoading`、`router`、`logger`を返す。attrsは`isLoading`、`onError`、`onError:clear`、`onUpdate:isLoading`をAir managerへ渡す。

`useDocManager(name, {doc, redirectPath=null})`は上記に加え、AirItemManager ref、modelValue、`handleCreate=item.create()`、`handleUpdate=item.update()`、`handleDelete=item.delete()`、delete後router.replace、`toCreate/toUpdate/toDelete`を返す。常にdeprecated warningを出す。

## データflow

`page useFetch(name,true)` → 5種類を新規生成・provide → child `useFetch(name)`がinject → ID取得/search → FireModel client adapterの`fetchDoc/fetchDocs` → instance-local cache → computed map/arrayを表示側が参照する。create/update/delete/archiveやrealtime subscribeはfetch基盤にない。

## provide / inject

keyは文字列`fetchArticleComposable`、`fetchCustomerComposable`、`fetchEmployeeComposable`、`fetchOutsourcerComposable`、`fetchSiteComposable`。`isOrigin=true`は親provideを無視して全て新規作成・provideする。false/defaultは親をinjectし、欠けた種類だけ新規作成して同じcomponentから子へprovideする。返却する各`isXComposableProvided`は親からinjectできた場合だけtrueで、originではfalseである。

AGENTS.mdの「pageで第2引数true、childでfalse/省略してinject」と一致する。ただしdata-layer composableにもtrue使用例があり、page限定という規則と実装利用に差がある。

## CRUD・validation

取得基盤はread/cacheのみ。schema CRUDを直接呼ぶのはdeprecated `useDocManager`のdefault handlerである。入力schema validation、duplicate、archive、lock、confirm、rollbackはAir managerまたはschemaへ委ね、`useBaseManager`自身は強制しない。

## loading・error・dialog

fetch errorはloggerへ記録してrejectせず、fetchItemsは完了、getItemはnull、searchItemsは空配列になる。not-foundも既定ではwarningである。`isLoading`は単一boolean。Manager errorはAir componentの`error` eventをloggerへ渡す。dialog、selection、submit disable、confirmationの内部契約は外部component source不在で未確認。

## lifecycle・cleanup

fetch基盤はsubscriptionを開始せず、unmount cleanupもない。cacheとin-flight Mapはcomposable instanceの寿命に従う。検索cacheはtimerで消さず、次のsearch時だけ期限切れを除去する。item cacheにはTTL/refresh/update/remove同期がなく、`clearCache`または新origin生成まで保持される。

## 直接依存

Vue ref/computed/provide/inject、Vue Router、logger/errors store/system store、schema FireModelの`fetchDoc/fetchDocs`、外部AirItemManager/AirArrayManager event contractに依存する。Auth/storeとclient adapter内部は本セグメントでは展開していない。

## 仕様との一致

- page origin / child injectの基本契約は実装と一致する。
- 同一IDの同一instance内並行fetchはPromise共有で重複を抑止する。
- subscribe/create/update/delete/archiveを提供する汎用data layerではなく、read cacheとmanager event adapterである。

## 矛盾・未使用候補

- `useFetch.js`の`../composables/useLogger`は実在しない`composables/composables/useLogger`を指す相対pathで、他fileの`../useLogger`と不一致。
- wrapperはbaseの`clearSearchCache`を返さないため、公開APIから検索cacheだけを明示clearできない。
- `useDocManager`はdeprecatedだが複数composableから使用される。
- `isLoading` booleanは異なるID/searchの並行処理数を表さない。
- errorを吸収するため、not-foundとpermission/network failureをcallerが返り値だけで区別できない。

## 将来要対応

FUT-0112〜FUT-0114を`future-actions.md`へ追加した。

## 要確認事項

CONF-0094〜CONF-0095を`pending-confirmations.md`へ追加した。

## 未確認範囲

AirItemManager/AirArrayManager package内部、個別業務manager、Auth/store、SSR実行test、build、Firestore/Emulator、client adapterの内部実装は未確認である。

## SPEC-DEEP-039a addendum

- `useBaseManager`はAir managerの単一boolean loadingとerror/error:clear eventをapp loggerへ橋渡しするだけで、disable、single-flight、rollback、actor/tenantを強制しない。`error:clear`は共有Errors storeのclearへ到達するため、別処理のerrorまで消し得る既知の共通UI境界を再確認した。
- `useDocManager`はdeprecated warningを常時出すが、Customer Billing、Operation Billing、Schedule複製から現役到達する。公開`toCreate/toUpdate/toDelete`はcomponent refへそのまま委譲し、schema CRUD以外のversion・permission・operation guardを追加しない。
- `useKatakanaFilter`は選択indexから正規表現を選び配列をfilterするだけで、欠損・非stringの読み仮、重複doc ID、actor/tenantを検査しない。直接callerのWorkerSelectorはwatch時にMapを再初期化せず、削除済みmasterのentryをcomponent寿命中保持するが、表示候補自体は現行propsをfilterする。

## 汎用data layer追加確認（SPEC-DEEP-042）

- `useDocument`はJSDocでreactive `docId`へ再購読すると説明するが、入口で`typeof docId === "string"`を要求してRefを拒否する。実装の`watchEffect`もstatic string以外の依存を読まない。現callerはsetup時のroute param文字列で成立するが、同一page instance内のroute変更には追従しない。
- `useDocuments`はsearch/optionsの初期shapeだけを検査し、購読中のloading/error/not-found/permission stateを返さない。短いsearchではunsubscribeし、空検索時だけ`fetchAllOnEmpty`で全件購読する。動的option/searchの不正値、async listener error、retryは公開契約外である。
- 単一/複数ともschema instanceのmutable live stateを返し、query revision、lastUpdated、request ownerを持たない。callbackからのmaster fetchはawait・cancel・失敗集約されず、一覧本体とcacheが別時点になり得る。
- `useActiveSites`は静的callerがなく、`useOperationBilling`は旧managerからだけ到達するlegacy候補である。`useCustomerBilling`は現行請求画面で到達するが、両単一Billing wrapperの不要なsystem-store参照と古いJSDocが残る。

## domain data layer追加確認（SPEC-DEEP-043）

- 退職Employee/終了Site検索はsearch変更ごとにsnapshot fetchを開始するが、loading/error、request generation、cancel、latest-only判定を持たない。遅い旧検索responseが新検索結果を上書きでき、失敗は直接rejectする。
- Employee range snapshotはACTIVE取得後にRESIGNEDを直列取得し、両方成功してからだけdocs/cacheを更新する。二queryの共通read timeはなく、range連続変更の世代管理もない。
- Outsourcer rangeはfrom/toをvalidation・watchするがqueryには使わず、期間変更ごとに全ACTIVE外注先を再購読する。過去期間でも現時点のACTIVEだけを返すため、名称上の期間契約と一致しない。
- OperationResult/Schedule等のrange layerはdocId Mapで重複を後勝ち除去し、Site/Employee/Outsourcer cache fetchをawaitしない。async listener errorとpartial cache stateはSPEC-DEEP-042のgeneric境界と同じである。

## master fetch/cache追加確認（SPEC-DEEP-044）

- `useFetchBase`は同一docIdの同時point fetchをPromise共有して重複排除する。一方、成功/失敗をcallerへ返さず、fetch error・not-foundはいずれもcache miss/nullへ畳み込む。
- item cacheは同一docIdが既にあるとpoint fetchも`pushItem(s)`も更新をskipする。明示TTL/revision/invalidationがなく、master変更・archive・権限変更後もcomponent/provider寿命中にstale instanceを返し得る。`clearCache`はitemだけを消しsearch cacheを残す。
- fetchとsearchは同じ単一`isLoading`を使う。異なるID/検索の並行処理で先に終わった処理がfalseへ戻し、残処理中も非loadingに見える。search自体のin-flight dedupe/latest-only/cancelもない。
- search cache keyはsearch text、constraints、limitだけで、actor/company/revisionを含まない。providerはcomponent tree内だが、認証/tenant切替時の一括clear契約はない。
