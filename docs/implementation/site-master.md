# Site（現場）マスター実装調査

## メタデータ

- 状態: 改修中（SITE-02 local完了）
- 対象セグメント: SPEC-SEG-021、SPEC-DEEP-010、SPEC-DEEP-034、SPEC-DEEP-035
- 最終確認日: 2026-09-05
- 根拠ファイル: `pages/sites/index.vue`、`pages/sites/terminated.vue`、`pages/sites/[id].vue`、`components/Sites/**`、`components/Site/**`、`composables/fetch/useFetchSite.js`、`composables/dataLayers/site/useSitesTerminated.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Site.js`、直接参照するOperationResult/SiteOperationSchedule/Billing PDF箇所

## 入口・書込み権限

Page 3ファイルのroute、query/filter、終了・削除到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を参照する。

Site権限は`sites:read`/`sites:write`の2種とし、writeは作成、基本情報・Customer・Agreement変更、終了、再有効化、archiveを含む。SITE-02では、現在存在する作成・更新・終了経路を会社管理者またはstrict role preset由来の`sites:write`へ限定し、直接permission、未知role、non-admin super-user、temporary/disabled/他tenantをfail closedにした。再有効化と専用archiveはSITE-04/05まで未実装である。

| 入口 | 現行UI | pageSettings | Rules |
|---|---|---|---|
| `/sites` | ACTIVE一覧、詳細遷移。write actorだけ作成 | `sites:read` | 同一tenantの有効な本登録Userにread。strict write actorにcreate/update。delete拒否 |
| `/sites/[id]` | 閲覧・予定表示。write actorだけ基本情報・取引先・取極め更新と終了。削除入口なし | `sites:read` | 同上 |
| `/sites/terminated` | TERMINATEDを名称検索し詳細遷移。write入口はactorに応じて制御 | `sites:read` | 同上 |

client policyはcurrent Authとlive User stateを送信直前に再評価し、同一client module内のSite writeをsingle-flightにする。UI非表示だけに依存せず、Rulesも同じstrict actor境界を強制する。

## データ契約

- 保存先は会社prefix配下の`Sites/{docId}`。`useAutonumber=false`で、通常作成はFirestore生成ID。
- 必須: `name`、`nameKana`、`prefCode`、`city`、`address`、`securityType`、`status`。`customerId`未設定時は`customerName`が必要。
- 任意: `customerId`、`customerName`、`code`、`hasAbbreviation`、`abbreviation`、`zipcode`、`building`、`siteNumber`、工期開始/終了日、`location`、`remarks`、`agreementsV2`。
- `customer`はhiddenの埋込みCustomer。`customerId`を指定したcreate時と、customerId変更時にCustomerを取得して格納する。
- statusのdefaultは`ACTIVE`。値は`ACTIVE`（稼働中）と`TERMINATED`（終了）。
- 読み取り専用プロパティ: `fullAddress`、`prefecture`、`isTemporary`、`hasConstructionPeriod`、開始/終了日有無。ゲッター: `displayName`（略称使用時はabbreviation、その他はname）。
- `getValidAgreement`はshiftType一致を日付降順にし、指定日以前の最新`agreementsV2`を返す。該当なしはnull。
- 工期は両端がある場合に開始≦終了を相互validationする。片端だけも許容される。
- token検索fieldは`name`と`nameKana`。code、略称、取引先名、住所、現場番号は対象外。

## CRUD・validation

- 作成wizardは取引先名を入力してCustomer N-gram検索し、候補選択または取引先未設定の仮登録を許す。次に現場名、住所、警備種別、工期等を入力する。
- create時にcustomerIdとcustomerNameが両方なければ失敗する。customerIdがあれば同じ会社prefixのCustomer存在確認とCustomer埋込みを行う。
- customerId設定後は未設定へ戻せないが、別Customerへの変更は禁止されていない。変更時は埋込みcustomerを更新する。
- 基本情報更新は専用CustomInputでcode、名称、略称、住所、警備種別、現場番号、工期、備考を編集する。取引先はcustomerIdだけを別editorで変更する。
- 作成wizardは`hasAbbreviation/abbreviation/siteNumber/remarks`を入力しないが、作成後の基本編集では入力できる。
- code/name等の一意性validationはない。
- 汎用managerのcreate/update handlerは共通Site action経由で権限を再検査して実行する。Site managerのdelete handlerは拒否し、generic logical archiveへ到達させない。

## 検索・表示

- ACTIVE一覧はstatus queryをlive購読し、customerIdとsecurityTypeをclient filterする。テーブル初期sortはcode降順。
- 一覧表示はcode、`displayName`、live取得したCustomer略称、securityType、工期。
- TERMINATED一覧は検索文字列がある時だけN-gram検索し、status=TERMINATEDを追加する。空検索では0件。
- Site AutocompleteはN-gram検索にstatus constraintを付けないため、ACTIVE/TERMINATEDの両方が候補になり得る。
- TERMINATED詳細でもwrite actorには基本編集、取引先変更、取極め編集、再度の「稼働終了」buttonが表示される。再終了はschemaがエラーにし、再有効化経路は未実装である。read-only actorにはmaster write入口を表示しない。削除入口はactorにかかわらず表示しない。

## 参照関係・変更影響

- Customer所属は`customerId`と埋込み`customer`の二重保持。Customer master更新時は`onUpdateCustomer`が同じcustomerIdのSiteへ埋込みcustomerを伝播するが、複数batchはatomicでなくevent version guardもないため、一時的な不一致、部分失敗、古いeventの後着を収束させる保証はない。一覧はlive Customerを別取得する一方、詳細の取引先表示と取極めcutoff-dateは埋込みcustomerを使うため表示・処理時点が混在する。
- 2026-09-04に、現行sourceとCONF-0047に合わせて別Customerへの変更を許可する仕様を正本へ反映した。一度設定したcustomerIdを未設定へ戻す操作は引き続き提供せず、変更時は同じ会社に存在するCustomerを必須にする。既存OperationResult・BillingのcustomerIdは履歴snapshotとして自動変更しない。
- SiteOperationScheduleはsiteIdを保持し、作成/一部処理でSiteの存在と仮登録でないことを確認する。Site名等は直接snapshotしない。
- OperationResultは作成時またはgroup key変更時にSiteからcustomerIdと適用取極めを取り込み、その後は保存済み値を使う。SiteのCustomer・取極め変更が既存実績へ自動反映される契約ではない。
- Billing集計keyはcustomerId、siteId、billingDateを使う。請求書PDFは生成時にlive Siteを取得してSite名を表示し、欠損時は「不明な現場」とするため、Site名変更は過去Billingの再生成表示にも反映される。
- ADR 0052では、予定はlive Site、OperationResultは作成時snapshot、確定請求書はBilling revision snapshotを使うと確定した。現行OperationResultはSite名称・表示名・住所・警備種別・Customer表示情報をsnapshotせず、Billing PDFもlive Site名称を使うため、この方針はFUT-0064およびtransaction側の実績・請求・帳票改修で未実装である。legacy欠損値は現在値を過去値として推測backfillしない。
- schema上の削除guard対象はSiteOperationSchedules、OperationResults、ArrangementNotifications。AgreementはSite内配列として保存される。

## 削除・無効化

- `terminate()`はdoc読込済み、未TERMINATED、JST当日以降のSiteOperationScheduleが0件であることを確認してstatusを更新する。過去schedule、OperationResult、ArrangementNotification等は終了を妨げない。
- 終了後もwrite actorの詳細画面では通常編集がstatusで抑止されず、再有効化method/UIも未実装である。削除入口はSITE-02で除去した。TERMINATED固有制御はSITE-04で実装する。
- 確認済み方針ではTERMINATEDの通常master編集を制限する一方、終了済みChip・識別情報・確認付きで新規業務の選択候補へ残す。単発残工事はTERMINATEDのまま扱い、継続再開は同じCustomer、strict `sites:write`、reason、新工期を必須とする。Customer変更許可は別operationとして維持し、既存実績へ自動反映せず、Agreementも自動再有効化しない。archiveは誤登録・重複だけに限定し、専用Callable、全業務参照の同一transaction確認、全参照writerのlive Site存在barrierが揃うまで有効化しない。generic delete／restoreと物理delete、通常画面のrestoreは提供しない。SITE-02ではgeneric削除入口とclient archive writeを停止し、残る専用処理はFUT-0062・FUT-0063で未実装である。
- schema/common adapterには旧generic logical delete/restore実装が残るが、Site UI・Site managerからは到達せず、RulesはSite deleteと`Sites_archive` client CUDを拒否する。専用archiveはSITE-05まで利用できない。

## Rules・tenant境界

- `Companies/{companyId}/Sites/{docId}`は同一tenantの有効な本登録Userにreadを許可する。create/updateは会社管理者または既知のstrict role presetが`sites:write`を含む場合だけ許可し、直接permission、未知role、non-admin super-user、temporary/disabled/他tenantを拒否する。deleteは拒否する。
- Rulesはcreate時とcustomerId変更時に同一会社Customerの存在を検査し、設定済みcustomerIdのunsetを拒否する。operation別field、型・長さ、status transition、埋込みcustomerの一致はSITE-03以降の残件である。
- `Sites_archive`は同一tenantの有効な本登録Userによるreadを維持し、client create/update/deleteを拒否する。専用archive CallableのAdmin SDK write契約はSITE-05で実装する。
- tenant境界はcollection pathに依存し、document内companyIdはSite契約にない。

## Site components公開契約・状態・失敗境界（SPEC-DEEP-034）

| component | 公開契約 | 確認済み挙動・境界 |
| --- | --- | --- |
| `Site/Manager` | Site `doc`とcreate/update handlerを受け、AirItemManagerへ委譲 | CREATEだけ3-step CustomInputを使う。UPDATEはactivatorがexposeするcustom inputまたはschema入力へ委譲する。write可否・送信直前再検査・single-flightは共通Site actionで強制し、deleteは拒否する。status固有制御は未実装。 |
| `Site/CustomInput` | `componentAttrs`、`step`、3 steps、`handleGoToNext`をexpose | step 1でCustomer検索、step 2で候補選択、step 3でSite入力を行う。AirEditCardの最終stepは`handleGoToNext`を呼ばず直接submitするため、step 3のVForm validationは標準flowで到達しない。 |
| `Site/CustomInput/Base` | 15 fieldのcomponent attrsを入力へ展開 | code/name/address/security/construction/remarks等を表示するが、validation・保存はAir manager/schemaへ委譲する。 |
| `Site/Autocomplete` | creatable/label/itemTitle/itemValue/returnObject、model update | N-gram検索結果だけを表示する設定だがstatus constraintがなく、TERMINATEDも候補になる。creatable時はiconからSitesManagerを開く。API error、latest-request、permissionをこのwrapperは親へ伝えない。 |
| `Site/Select` | label/itemTitle/itemValueと全attrsをAirSelectへ透過 | 候補集合、status、permission、enum membershipはcaller責任である。 |
| `Site/Activator/Base` | Site、title、edit event、Base CustomInput expose | 常にedit iconを表示する。工期の片端だけがある場合も`${start} 〜 ${end}`を返すため、欠けた側が`null`文字列として表示される。 |
| `Site/Activator/Customer` | Site、title、edit event、customerId included key | temporary SiteはCustomer設定action、それ以外は埋込みCustomerを表示する。常にedit入口を持ち、許可されたCustomer変更をUIから開始できる。 |
| `Site/Card` | select/edit/detail flagsと3 click events | selectionはclickable iconで、明示button/accessible name/keyboard handlerを持たない。直接callerはSitesIteratorだけである。 |
| `Site/ListItem` | Vuetify item/rawまたはSiteを受ける | 新しいSite instanceへdeep watchでinitializeし、nameと埋込みCustomer略称を表示する。live Customerではなく埋込みsnapshotを使う。 |

- `Site/Card`は`Sites/Iterator`からだけ到達し、そのIteratorのroute上の使用は現在comment outされている。公開componentとしての外部/dynamic到達性は未確認であり、deadとは断定しない。
- CREATE wizardのCustomer候補選択は`CustomersIterator`へ依存する。既存reviewで同Iteratorがselection/v-modelを内部AirDataIteratorへ転送しないことを確認しており、候補選択が成立しない可能性がある。
- CREATE wizardの`AirPostalCode`は`update:address`をlistenせず、root appでもconsumerがない。現行flowは外部lookupを実行しても住所fieldへ反映しない。
- parentのsubscription更新はopen draftを上書きし得て、submit mutex、version、retry、canonical refreshはmanager packageにもSite wrapperにもない。
- 9 filesにはtenant、role、permission、actor、audit checkがない。表示・disabled・validationはRules/Functionsのauthorizationを代替しない。

## 矛盾・未使用候補

- Site.beforeUpdateと詳細UIが許可する別Customerへの変更は、2026-09-04に正本仕様へ反映した。既存OperationResult・Billingを自動移管しないsnapshot契約と、一度設定したcustomerIdを未設定へ戻さない現行境界を維持する。
- Customer master更新の伝播が部分失敗または順序逆転するとSite内の埋込みcustomerはstaleになり得て、一覧と詳細で参照するCustomer時点が異なる。
- TERMINATED SiteもAutocompleteで選択可能で、write actorの詳細では編集・再終了buttonが表示される。削除入口は除去済みで、TERMINATED固有の表示・再有効化は未実装である。
- restore APIが存在するlogical deleteなのに、UIは復元不能と断定する。
- create wizardで略称、現場番号、備考は入力できず、作成後編集が必要。
- create wizardの最終step validationは標準flowで呼ばれず、郵便番号lookup結果も住所へ反映されない。
- 基本情報cardの片側だけの工期表示は欠損側を`null`と表示する。
- deprecated `agreements` getter/setterと`getAgreement`が互換用に残る。

## 将来要対応

- FUT-0060: 完了。現在存在するSite master write経路をUI・送信直前policy・Rulesでstrict actorへ限定し、generic delete/archive入口を停止した。未実装の再有効化と専用archiveはFUT-0062/0063で同じactor境界を適用する。
- FUT-0061: Customer存在・tenant境界はRulesとschema経路へ導入済み。埋込みCustomer同期を順序・部分失敗安全にし、operation別writerとのparityを確認する。
- FUT-0062: ADR 0054のTERMINATED master編集制限、確認付き新規選択、単発残工事、strict actor・reason・新工期による再有効化を実装する。
- FUT-0063: ADR 0051に従い、誤登録・重複だけを対象とする専用archive Callable、全業務参照の同一transaction確認、全参照writerのlive Site存在barrier、監査・冪等性、generic delete／restore非到達を実装する。全barrierが揃うまでarchiveを有効化しない。
- FUT-0064: ADR 0052に従い、予定のlive Site、OperationResult作成時snapshot、Billing確定revision snapshot、legacy互換fallbackをtransaction側の承認済みcheckpointで実装する。
- FUT-0059: geocoding失敗・0座標の証拠へSiteを追記した。
- FUT-0170、FUT-0181、FUT-0182: 一覧選択、step validation、manager single-flight、postal/async入力の証拠へSite componentsを追記した。

## 要確認事項

- CONF-0046〜CONF-0050を`pending-confirmations.md`へ登録した。CONF-0048の新規選択不可は2026-09-05のCONF-0135でsupersedeした。CONF-0049・CONF-0050・CONF-0135の判断はADR 0051、ADR 0052、ADR 0054へ記録した。

## 未確認範囲

- Site配下のSchedule/Agreement編集内部、OperationResult/Billing同期内部、他のPDF・画面。
- 必要Firestore index、実データ、Emulator・ブラウザ動作、Vuetifyのvalidation/keyboard/runtime挙動。
- 既存stale埋込みCustomerの件数、TERMINATED/archived Siteの正式運用。

## Sites一覧wrapperの追加確認（SPEC-DEEP-035）

- `Sites/DataTable`は各rowの`customer`がない場合にCustomerを非同期取得する。`customerId`欠損でも`fetchCustomer(undefined)`を呼び、missing/失敗を画面へ区別せず`...loading`を残す。工期表示は環境localの`toLocaleDateString()`で、他のJST整形契約と統一されていない。
- `Sites/Iterator`は`hideDefaultFooter`を宣言するが内部`AirDataIterator`へ渡さず、selection用の`modelValue`、`selectStrategy`、`showSelect`はJSDocだけで公開propになっていない。現在の`/sites` routeにあるIterator利用はcomment outされている。
- `Sites/Manager`はAirArrayManagerへ作成を委譲するが、write可否・送信直前再検査・single-flightは共通Site actionで強制し、deleteは拒否する。status、step validation、stale array契約はFUT-0181、一覧prop不一致はFUT-0170へ統合する。
