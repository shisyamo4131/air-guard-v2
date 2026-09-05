# Site（現場）マスター実装調査

## メタデータ

- 状態: 改修中（SITE-05 local実装済み・総合検証中）
- 対象セグメント: SPEC-SEG-021、SPEC-DEEP-010、SPEC-DEEP-034、SPEC-DEEP-035
- 最終確認日: 2026-09-05
- 根拠ファイル: `pages/sites/index.vue`、`pages/sites/terminated.vue`、`pages/sites/[id].vue`、`components/Sites/**`、`components/Site/**`、`composables/fetch/useFetchSite.js`、`composables/dataLayers/site/useSitesTerminated.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Site.js`、直接参照するOperationResult/SiteOperationSchedule/Billing PDF箇所

## 入口・書込み権限

Page 3ファイルのroute、query/filter、終了・削除到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を参照する。

Site権限は`sites:read`/`sites:write`の2種とし、writeは作成、基本情報・Customer・Agreement変更、終了、再有効化、archiveを含む。会社管理者またはstrict role preset由来の`sites:write`へ限定し、直接permission、未知role、non-admin super-user、temporary/disabled/他tenantをfail closedにする。SITE-04で終了・再有効化を専用Callableへ移し、SITE-05で誤登録・重複だけを対象とする専用`archiveSite` Callableを追加した。

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
- `customer`はhiddenの埋込みCustomer。`customerId`を指定したcreate時とcustomerId変更時に同じ会社のCustomerをtransaction内で取得し、exact 6 field（`docId`、`updatedAt`、`code`、`name`、`abbreviation`、`cutoffDate`）だけを格納する。基本情報更新もlegacyの広い埋込み値をこのprojectionへ収束させるが、取極め更新では触れない。
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
- SITE-04では非atomicな旧手動終了を専用Callableへ置換した。ACTIVE Siteだけを通常編集でき、TERMINATEDは終了済み表示と新規選択確認を経て単発予定に使用できる。継続再開はreasonと新工期を必須にし、現在のCustomer設定を変えない。read-only actorにはmaster write入口を表示せず、削除入口はactorにかかわらず表示しない。

## 参照関係・変更影響

- Customer所属は`customerId`と埋込み`customer`の二重保持。Customer master更新時は`onUpdateCustomer`が同じcustomerIdのSiteへexact 6-field projectionを伝播する。欠損・型不正・path ID不一致はSite query前にfail closedとする。一方、複数batchはatomicでなくevent version guardもないため、一時的な不一致、部分失敗、古いeventの後着を収束させる保証はない。一覧はlive Customerを別取得し、詳細の取引先表示と取極めcutoff-dateは埋込みprojectionを使うため表示・処理時点が混在する。
- 2026-09-04に、現行sourceとCONF-0047に合わせて別Customerへの変更を許可する仕様を正本へ反映した。一度設定したcustomerIdを未設定へ戻す操作は引き続き提供せず、変更時は同じ会社に存在するCustomerを必須にする。既存OperationResult・BillingのcustomerIdは履歴snapshotとして自動変更しない。
- SiteOperationScheduleはsiteIdを保持し、作成/一部処理でSiteの存在と仮登録でないことを確認する。Site名等は直接snapshotしない。
- OperationResultは作成時またはgroup key変更時にSiteからcustomerIdと適用取極めを取り込み、その後は保存済み値を使う。SiteのCustomer・取極め変更が既存実績へ自動反映される契約ではない。
- Billing集計keyはcustomerId、siteId、billingDateを使う。請求書PDFは生成時にlive Siteを取得してSite名を表示し、欠損時は「不明な現場」とするため、Site名変更は過去Billingの再生成表示にも反映される。
- ADR 0052では、予定はlive Site、OperationResultは作成時snapshot、確定請求書はBilling revision snapshotを使うと確定した。現行OperationResultはSite名称・表示名・住所・警備種別・Customer表示情報をsnapshotせず、Billing PDFもlive Site名称を使うため、この方針はFUT-0064およびtransaction側の実績・請求・帳票改修で未実装である。legacy欠損値は現在値を過去値として推測backfillしない。
- SITE-05の直接参照catalogは`SiteOperationSchedules`、`OperationResults`、`ArrangementNotifications`、`Billings`、`SiteEmployeeHistories`のexact 5 collectionである。`DailyAttendances`と`DailyOperationsByEmployee`の`siteId`はOperationResultから生成される下流snapshotで、live Siteを参照する業務documentではないため、archive時に変更せず直接参照catalogにも含めない。remote legacy dataが同じ生成経路を満たすことはSITE-09のpreflightまで未確認である。
- AgreementはSite内配列として保存される。

## 削除・無効化

- `terminateSite`はmaintenance、actor、ACTIVE、現在以降の予定、全未実績予定、Site revisionを一つのtransactionで再確認し、現在遷移metadataとともにTERMINATEDへ変更する。`reactivateSite`はTERMINATED、actor、maintenanceを再確認し、reasonと新工期を保存してACTIVEへ戻す。Customer未設定を含む現在値は変更しない。
- 自動終了はJST工期終了日の90日後から候補とし、bounded cursorで走査して各Siteをtransactionで再確認する。予定cleanupとは別scheduled Function・別失敗境界で、失敗はlog後に再throwする。legacy予定の必須field欠損有無はremote未確認で、SITE-09前の停止条件である。
- 確認済み方針ではTERMINATEDの通常master編集を制限する一方、終了済みChip・識別情報・確認付きで新規業務の選択候補へ残す。単発残工事はTERMINATEDのまま扱い、継続再開は同じCustomer、strict `sites:write`、reason、新工期を必須とする。Customer変更許可は別operationとして維持し、既存実績へ自動反映せず、Agreementも自動再有効化しない。終了・再有効化はSITE-04で実装済みである。
- SITE-05のarchiveはACTIVE／TERMINATEDを問わず誤登録・重複だけを対象にする。入力をexact `{siteId, reason, operationId}`へ限定し、現在のAuth、同社User、maintenance、strict actor、active Site、同ID archive、exact 5 collectionの直接参照を一つのtransactionで検査する。成功時はschema version付きの完全なSite snapshotとserver確定のactor・時刻・reason・operation IDをsame-ID `Sites_archive`へ作成してlive Siteを削除する。同じactor・reason・operation IDの再試行だけを冪等に扱い、異なる再試行、参照、同ID衝突、不正状態はwrite 0で拒否する。
- schema/common adapterには旧generic logical delete/restore実装が残るが、Site UI・Site managerからは到達せず、RulesはSite deleteと`Sites_archive` client CUDを拒否する。通常restoreと物理deleteの製品入口は提供しない。Site詳細のarchive確認画面はreasonを必須とし、Siteの通常更新・終了・再有効化と共通mutexで直列化する。不確実な通信失敗の再試行は同じoperation IDを維持する。

## Rules・tenant境界

- `Companies/{companyId}/Sites/{docId}`は同一tenantの有効な本登録Userにreadを許可する。create/updateはmaintenance offかつ会社管理者または既知のstrict role presetが`sites:write`を含む場合だけ許可し、直接permission、未知role、non-admin super-user、temporary/disabled/他tenantを拒否する。予定競合用revisionだけは同一tenantの予定writerがatomicに+1できる。deleteは拒否する。
- Rulesはexact 34-field create、operation別変更field、型・長さ、server metadata、派生fieldを検査する。create時とcustomerId変更時は同一会社Customerの存在とexact 6-field projectionを検査し、設定済みcustomerIdのunsetを拒否する。status transitionはclientから許可しない。予定作成は`operationResultId=null`とSite revisionの同時更新、実績化は整合するOperationResultとの同時更新だけを許可し、偽参照・置換・巻戻しを拒否する。
- `Sites_archive`は同一tenantの有効な本登録Userによるreadを維持し、client create/update/deleteを拒否する。同ID archiveが存在するSite createも拒否し、archive documentをtombstoneとして扱う。
- `OperationResults`、`Billings`、`ArrangementNotifications`、`SiteEmployeeHistories`はcreateまたは`siteId`変更時にlive Site存在を必須とする。既存documentのread、delete、`siteId`以外の互換更新は従来境界を維持する。`SiteOperationSchedules`はSITE-04で導入したSite revisionと同一transactionのguardを維持する。server側のBilling初期化とSiteEmployeeHistory再構築も同じatomic boundaryでlive Siteを検査する。
- tenant境界はcollection pathに依存し、document内companyIdはSite契約にない。

## Site components公開契約・状態・失敗境界（SPEC-DEEP-034）

| component | 公開契約 | 確認済み挙動・境界 |
| --- | --- | --- |
| `Site/Manager` | Site `doc`とcreate/update handlerを受け、AirItemManagerへ委譲 | CREATEだけ3-step CustomInputを使う。UPDATEはactivatorがexposeするcustom inputまたはschema入力へ委譲する。write可否・送信直前再検査・single-flightは共通Site actionで強制し、deleteは拒否する。ACTIVEだけを通常編集でき、TERMINATEDは専用再有効化操作へ誘導する。 |
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
- TERMINATED Siteは終了済みChip・取引先・code・住所を表示して候補に残し、選択またはpreset保存時の明示確認後に単発予定へ使用できる。確認は対象Schedule操作へ束縛し、成功・取消・unmountで破棄し、失敗後の明示再試行だけで維持する。通常編集は制限し、継続再開は専用操作を使う。削除入口は除去済みである。
- restore APIが存在するlogical deleteなのに、UIは復元不能と断定する。
- create wizardで略称、現場番号、備考は入力できず、作成後編集が必要。
- create wizardの最終step validationは標準flowで呼ばれず、郵便番号lookup結果も住所へ反映されない。
- 基本情報cardの片側だけの工期表示は欠損側を`null`と表示する。
- deprecated `agreements` getter/setterと`getAgreement`が互換用に残る。

## 将来要対応

- FUT-0060: 完了。現在存在するSite master write経路をUI・送信直前policy・Rulesでstrict actorへ限定し、generic delete/archive入口を停止した。再有効化はFUT-0062で同じactor境界を適用済みで、専用archiveはFUT-0063で適用する。
- FUT-0061: Customer存在・tenant境界はRulesとschema経路へ導入済み。埋込みCustomer同期を順序・部分失敗安全にし、operation別writerとのparityを確認する。
- FUT-0062: 完了。ADR 0054のTERMINATED master編集制限、確認付き新規選択、単発残工事、strict actor・reason・新工期による再有効化、予定競合guard、自動終了をlocal実装・検証した。
- FUT-0063: local実装済み・総合検証中。ADR 0051に従い、誤登録・重複だけを対象とする専用archive Callable、exact 5 collectionの同一transaction参照確認、直接参照writerのlive Site存在barrier、監査・冪等性、generic delete／restore非到達を実装した。remote shapeとlegacy下流snapshotはSITE-09 preflightまで未確認である。
- FUT-0064: ADR 0052に従い、予定のlive Site、OperationResult作成時snapshot、Billing確定revision snapshot、legacy互換fallbackをtransaction側の承認済みcheckpointで実装する。
- FUT-0059: geocoding失敗・0座標の証拠へSiteを追記した。
- FUT-0170、FUT-0181、FUT-0182: 一覧選択、step validation、manager single-flight、postal/async入力の証拠へSite componentsを追記した。

## 要確認事項

- CONF-0046〜CONF-0050を`pending-confirmations.md`へ登録した。CONF-0048の新規選択不可は2026-09-05のCONF-0135でsupersedeした。CONF-0049・CONF-0050・CONF-0135の判断はADR 0051、ADR 0052、ADR 0054へ記録した。

## 未確認範囲

- OperationResult/Billingのoperation別field・lock、他のPDF・画面。
- remote適用済みFirestore index、実データ、ブラウザ操作、Vuetifyのvalidation/keyboard/runtime挙動。
- 既存stale埋込みCustomerの件数、TERMINATED/archived Siteの正式運用。

## Sites一覧wrapperの追加確認（SPEC-DEEP-035）

- `Sites/DataTable`は各rowの`customer`がない場合にCustomerを非同期取得する。`customerId`欠損でも`fetchCustomer(undefined)`を呼び、missing/失敗を画面へ区別せず`...loading`を残す。工期表示は環境localの`toLocaleDateString()`で、他のJST整形契約と統一されていない。
- `Sites/Iterator`は`hideDefaultFooter`を宣言するが内部`AirDataIterator`へ渡さず、selection用の`modelValue`、`selectStrategy`、`showSelect`はJSDocだけで公開propになっていない。現在の`/sites` routeにあるIterator利用はcomment outされている。
- `Sites/Manager`はAirArrayManagerへ作成を委譲するが、write可否・送信直前再検査・single-flightは共通Site actionで強制し、deleteは拒否する。status、step validation、stale array契約はFUT-0181、一覧prop不一致はFUT-0170へ統合する。
