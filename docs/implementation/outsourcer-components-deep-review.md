# Outsourcer components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-033、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/Outsourcer/**`、`components/Outsourcers/**` の7ファイル
- 根拠: 対象7ファイル、直接callerの `pages/outsourcers/index.vue`、`components/Arrangements/WorkerSelector.vue`、`components/Worker/Tag/useIndex.js`、`components/OperationResult/Worker/CustomInput.vue`、既存の `outsourcer-master.md`
- 制約: schemas/adapter/Air component/Vuetify内部、Rules runtime、ブラウザ、実dataは再読・実行していない。直接callerと公開契約だけを確認した。

## コンポーネント/API表

| ファイル | 公開契約 / 責務 | 保存・失敗境界 |
| --- | --- | --- |
| `Outsourcers/Manager/index.vue` | `docs`、create/update/delete handler、search、footer/page size、`showCreate`を受けるArray Manager wrapper。`update:search`をemitする。 | default handlerは`item.create/update/delete`へ委譲。role/write guard、loading latch、rollback、error表示は持たない。toolbar plusは`showCreate`に関係なく表示する。 |
| `Outsourcers/Iterator/index.vue` | `outsourcers`と`showCreate/showDetail/showEdit`を受け、Cardのcreate/detail/edit/selectionをemitする。header/default slotを透過する。 | data query・永続化・permissionは持たない。`hideDefaultFooter`はpropとして消費するがrootへ渡さず、指定が失われる。 |
| `Outsourcer/Card/index.vue` | required `Outsourcer` instance、selection/detail/edit表示props、3 click emitを公開する会社表示card。 | code/name/nameKanaだけを表示。個人外注警備員、status、archive、保存、errorは扱わない。 |
| `Outsourcer/Autocomplete.vue` | creatable、label、item title/value、return object、`update:model-value`を公開するN-gram検索wrapper。 | `searchOutsourcers`/`getOutsourcer`へ検索を委譲。creatable時はManagerを内包する。status、loading/error/cancel、選択世代は下位fetch/Air componentへ委譲。 |
| `Outsourcer/Tag/index.vue` | Tag propsにrequired `docId`を加え、`click:remove`と複数slotを透過する。 | `useIndex`へfetch/label解決を委譲。削除・permission・保存は親責務。 |
| `Outsourcer/Tag/useIndex.js` | `docId` watchでfetchを起動し、cacheのdisplayNameをTag labelに変換する。 | missing/loading/errorを明示区別せずlabel undefinedをTagへ渡す。request世代/abort/cleanupはこのfileにない。 |
| `Outsourcer/ListItem/index.vue` | generic ListItemを`Outsourcer` instanceへinitializeし、displayNameまたは`N/A`をtitle表示する。 | fetch・保存・emitなし。静的callerは確認できず、現Autocompleteのdefault rendererはこのcomponentでなくEmployeeListItemを使う。 |

## 一覧・CRUD・状態の境界

1. `/outsourcers` pageはACTIVE条件の`useDocuments`結果をManagerへ渡し、Managerの`air-array-manager`が既定create/update/delete handlerを使う。Manager単体にはcreate/update/deleteの権限、status、archive、confirmation、error/retry契約がない。
2. Managerは`showCreate=false`でもtoolbar plusを表示する。Iteratorへ渡す`itemsPerPage`はundeclared attrとしてrootへfallthroughし得る一方、declared `hideDefaultFooter`はrootへbindされない。
3. Iteratorは各`item.raw`をCardに渡し、selectionを`select([item], !isSelected(item))`でAir iteratorへ委譲する。Cardの`Outsourcer` instance validator、detail/edit/selection表示はclient表示だけである。
4. Cardは会社名・かな・任意codeを表示するだけで、`contractStatus`、archive、個人外注警備員を表示しない。selection iconはnative buttonではなく、edit/detailもicon-only buttonで個別labelを設定しない。

## 外注会社・外注警備員・下流参照

- 7ファイルが扱う`Outsourcer`は会社masterである。Schedule/OperationResultの`isEmployee=false` workerはOutsourcer doc IDを使い、複数人を表すindexはこのUI/Tagでは個人IDとして解決されない。
- 配置画面はWorkerSelectorから`OutsourcerTag`を使い、OperationResult worker inputは`isEmployee`によりOutsourcerAutocompleteを選択する。どちらも会社名を候補/表示として使うため、同一外注会社内の個人をUIで区別・資格確認する契約はない。
- Tagはdoc IDからlive cacheを引く。archive・取得失敗・遅い応答の区別や、過去Schedule/Resultの会社名snapshotを表示する契約はこのcomponent群にない。

## Autocomplete・loading/error・stale response

- AutocompleteはN-gram検索結果だけを使うため`custom-filter`を常にtrueとし、過去queryをcomponent側でcacheしない。検索APIにstatus条件は渡さず、TERMINATED候補が返る可能性は既存調査どおりである。
- `creatable`はappend slotのplain `v-icon`からManagerのcreate flowを起動する。Managerの`create` listenerはArray Managerへのattribute fallthroughに依存し、対象file自身はcreate emitを宣言しない。
- Autocompleteはデフォルトitem rendererに`EmployeeListItem`を使用し、callerの`item` slotを透過しない。OutsourcerListItemはこの経路で使われない。
- TagはdocId変更ごとにfetchし、cacheの現値だけをlabelにする。loading/error/not-found、古いrequest、subscription/cache cleanupの扱いはadapter/Air component範囲であり未確認である。

## caller・未使用候補・accessibility

- Manager → Iterator → Cardは`/outsourcers` routeから到達する。AutocompleteはOperationResult worker custom inputから、TagはWorkerTagと配置WorkerSelectorから到達する。
- `Outsourcer/ListItem/index.vue`には静的caller/importを確認できない。Nuxt auto-registration・dynamic componentからの到達性は未確認のため、未使用と断定せずlegacy候補として扱う。
- Card selectionはclick-only `v-icon`、Autocomplete createはclick-only `v-icon`で、component固有のaccessible name、keyboard代替、focus returnを追加しない。Vuetify/Airの既定動作は未確認である。
- 対象7ファイルを直接名指しするunit/component testは静的検索で確認できなかった。

## 整合・将来要対応

- 外注先の会社masterのみというidentity、worker indexの限界は`FUT-0086`、読取permissionでCRUDできるUI/Rules差は`FUT-0085`、ACTIVE候補不統一とautocomplete renderer/一覧契約は`FUT-0088`・`FUT-0089`へ統合する。
- Managerの作成表示とIterator footer転送の公開API不一致は既存`FUT-0170`、icon-only操作は`FUT-0115`へ証拠追記する。
- `CONF-0070`〜`CONF-0073`の上位判断を維持し、新規FUT/CONFは追加しない。

## 未確認範囲

- AirArrayManager/AirDataIterator/AirAutocompleteApiのattrs、event、loading/error、focus、selectionの実装。
- Rulesの実評価、archive後のTag表示、同時編集・検索応答逆転、実dataの同名外注先/複数人運用。
- 外注警備員を個人として扱う正式要件、契約終了後の候補・訂正・過去表示policy。
