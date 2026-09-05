# Site（現場）マスター実装調査

## メタデータ

- 状態: 改修中（SITE-08ブラウザ回帰追加確認中）
- 対象セグメント: SPEC-SEG-021、SPEC-DEEP-010、SPEC-DEEP-034、SPEC-DEEP-035
- 最終確認日: 2026-09-05
- 根拠ファイル: `pages/sites/index.vue`、`pages/sites/terminated.vue`、`pages/sites/[id].vue`、`components/Sites/**`、`components/Site/**`、`composables/dataLayers/site/useSiteUiReads.js`、`composables/domain/site/siteUiPresentation.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Site.js`、直接参照するOperationResult/SiteOperationSchedule/Billing PDF箇所

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

- 現行作成dialogは単一VFormで、取引先名またはCustomer候補、郵便番号・住所、名称・略称、警備種別、現場番号、工期、備考等を入力し、submit前とwriter送信時にvalidationする。Customer未選択の仮登録も許す。
- create時にcustomerIdとcustomerNameが両方なければ失敗する。customerIdがあれば同じ会社prefixのCustomer存在確認とCustomer埋込みを行う。
- customerId設定後は未設定へ戻せないが、別Customerへの変更は禁止されていない。変更時は埋込みcustomerを更新する。
- 基本情報更新は専用CustomInputでcode、名称、略称、住所、警備種別、現場番号、工期、備考を編集する。取引先はcustomerIdだけを別editorで変更する。
- 作成時から`hasAbbreviation/abbreviation/siteNumber/remarks`を入力でき、基本編集も同じfieldを扱う。
- code/name等の一意性validationはない。
- 汎用managerのcreate/update handlerは共通Site action経由で権限を再検査して実行する。Site managerのdelete handlerは拒否し、generic logical archiveへ到達させない。

## 検索・表示

- ACTIVE一覧はcurrent Userの会社配下かつstatus=ACTIVEのSite専用listenerを使い、初回loading、正常な0件、listener失敗を区別する。customerIdとsecurityTypeはclient filterし、表示は20件単位で、条件変更時に1ページ目へ戻る。
- 一覧表示はcode、`displayName`、liveまたは埋込みCustomer名称、securityType、JST工期、status、Customer未設定時の仮登録Chip。customerId欠損時にCustomer読取りを行わない。
- TERMINATED一覧は検索文字列がある時だけN-gram検索し、status=TERMINATEDを追加する。空検索では0件とし、入力変更・clear後に古い応答を反映しない。loading、0件、失敗を区別する。
- Site AutocompleteはN-gram検索にstatus constraintを付けず、ACTIVEを先にしつつ検索関連順を維持する。検索・ID lookupの古い応答を破棄し、TERMINATED確認の取消時は直前の確定値を保持する。
- 詳細はroute ID変更時に購読を切替え、初回loading、取得失敗、not-foundを区別する。not-foundでは編集・終了・再有効化・archive等の操作UIを描画しない。購読開始後の非同期listener errorは現行共通adapterがerror callbackを公開しないため、既存の制約として残る。
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
| `Site/CustomInput` | `componentAttrs`、`step`、3 steps、`handleGoToNext`をexpose | legacy componentとして残るが、現行`/sites`の作成routeからは到達しない。現行作成は`Site/CreateDialog`の単一VFormとoperation writerを使う。 |
| `Site/CustomInput/Base` | 15 fieldのcomponent attrsを入力へ展開 | code/name/address/security/construction/remarks等を表示するが、validation・保存はAir manager/schemaへ委譲する。 |
| `Site/Autocomplete` | creatable/label/itemTitle/itemValue/returnObject、model update | status非限定でACTIVEを先に表示し、検索・lookupをlatest-onlyにする。TERMINATEDは確認し、取消・not-found・失敗では元の確定値を保持する。作成入口はstrict write actorだけに表示する。 |
| `Site/Select` | label/itemTitle/itemValueと全attrsをAirSelectへ透過 | 候補集合、status、permission、enum membershipはcaller責任である。 |
| `Site/Activator/Base` | Site、title、edit event、Base CustomInput expose | callerが許可した時だけaccessible name付きedit buttonを表示し、JSTで両端・開始のみ・終了のみ・未設定の工期を区別する。 |
| `Site/Activator/Customer` | Site、title、edit event、customerId included key | temporary SiteはCustomer設定action、それ以外は埋込みCustomerを表示する。常にedit入口を持ち、許可されたCustomer変更をUIから開始できる。 |
| `Site/Card` | select/edit/detail flagsと3 click events | selectionはclickable iconで、明示button/accessible name/keyboard handlerを持たない。直接callerはSitesIteratorだけである。 |
| `Site/ListItem` | Vuetify item/rawまたはSiteを受ける | 新しいSite instanceへdeep watchでinitializeし、status/仮登録Chip、名称、Customer fallback、code、住所、JST工期を表示する。 |

- `Site/Card`は`Sites/Iterator`からだけ到達し、そのIteratorのroute上の使用は現在comment outされている。公開componentとしての外部/dynamic到達性は未確認であり、deadとは断定しない。
- 現行作成dialogのCustomer候補は`CustomerAutocomplete`を使い、旧`CustomersIterator`の3-step経路は到達しない。
- Site専用郵便番号inputは既存の外部lookup utilityを再利用し、7桁入力時の最新応答だけを住所へ反映する。検索中に郵便番号または住所が変わった場合、失敗・0件、unmount時は既存入力を変更しない。外部utilityが通信失敗と0件をどちらもnullに畳むため、画面文言も原因を断定しない。
- 現行operation editorは独立draft、同一field競合、single-flight、失敗後の入力保持を実装済みである。
- 9 filesにはtenant、role、permission、actor、audit checkがない。表示・disabled・validationはRules/Functionsのauthorizationを代替しない。

## 矛盾・未使用候補

- Site.beforeUpdateと詳細UIが許可する別Customerへの変更は、2026-09-04に正本仕様へ反映した。既存OperationResult・Billingを自動移管しないsnapshot契約と、一度設定したcustomerIdを未設定へ戻さない現行境界を維持する。
- Customer master更新の伝播が部分失敗または順序逆転するとSite内の埋込みcustomerはstaleになり得て、一覧と詳細で参照するCustomer時点が異なる。
- TERMINATED Siteは終了済みChip・取引先・code・住所を表示して候補に残し、選択またはpreset保存時の明示確認後に単発予定へ使用できる。確認は対象Schedule操作へ束縛し、成功・取消・unmountで破棄し、失敗後の明示再試行だけで維持する。通常編集は制限し、継続再開は専用操作を使う。削除入口は除去済みである。
- restore APIが存在するlogical deleteなのに、UIは復元不能と断定する。
- legacy `Site/CustomInput`の3-step componentは残るが現行作成routeから到達しない。現行作成dialogは略称・現場番号・備考、VForm validation、郵便番号反映を扱う。
- 基本情報cardと一覧は、片側だけの工期を欠損側の`null`文字列なしで表示する。
- deprecated `agreements` getter/setterと`getAgreement`が互換用に残る。

## 将来要対応

- FUT-0060: 完了。現在存在するSite master write経路をUI・送信直前policy・Rulesでstrict actorへ限定し、generic delete/archive入口を停止した。再有効化はFUT-0062で同じactor境界を適用済みで、専用archiveはFUT-0063で適用する。
- FUT-0061: Customer存在・tenant境界はRulesとschema経路へ導入済み。埋込みCustomer同期を順序・部分失敗安全にし、operation別writerとのparityを確認する。
- FUT-0062: 完了。ADR 0054のTERMINATED master編集制限、確認付き新規選択、単発残工事、strict actor・reason・新工期による再有効化、予定競合guard、自動終了をlocal実装・検証した。
- FUT-0063: local完了。ADR 0051に従い、誤登録・重複だけを対象とする専用archive Callable、exact 5 collectionの同一transaction参照確認、直接参照writerのlive Site存在barrier、監査・冪等性、generic delete／restore非到達を実装した。remote shapeとlegacy下流snapshotはSITE-09 preflightまで未確認である。
- FUT-0064: ADR 0052に従い、予定のlive Site、OperationResult作成時snapshot、Billing確定revision snapshot、legacy互換fallbackをtransaction側の承認済みcheckpointで実装する。
- FUT-0059: geocoding失敗・0座標の証拠へSiteを追記した。
- FUT-0170、FUT-0181、FUT-0182: Site側はSITE-07で一覧選択、現行作成VForm、single-flight、postal/async入力、到達可能なkeyboard操作を実装・検証した。legacy非到達componentと共通package全体は変更していない。

## 要確認事項

- CONF-0046〜CONF-0050を`pending-confirmations.md`へ登録した。CONF-0048の新規選択不可は2026-09-05のCONF-0135でsupersedeした。CONF-0049・CONF-0050・CONF-0135の判断はADR 0051、ADR 0052、ADR 0054へ記録した。

## 未確認範囲

- OperationResult/Billingのoperation別field・lock、他のPDF・画面。
- remote適用済みFirestore index、実データ、Dev/remoteブラウザ操作。Codex専用localのbrowser確認済み範囲と残作業は[SITE-08検証記録](../verification/site-08-local.md)を正とする。
- 既存stale埋込みCustomerの件数、TERMINATED/archived Siteの正式運用。

## Sites一覧wrapperの追加確認（SPEC-DEEP-035）

- `Sites/DataTable`はcustomerIdがあるrowだけCustomerを非同期取得し、live、埋込み、仮登録、取得不能を異なるfallbackで表示する。工期はJST固定で両端・片端・未設定を区別し、actionはbutton semanticsと「現場詳細を表示」のaccessible nameを持つ。このwrapperはdashboardとCustomer詳細にも使われるが、click payloadと遷移契約は変更していない。
- `Sites/Iterator`は`hideDefaultFooter`を宣言するが内部`AirDataIterator`へ渡さず、selection用の`modelValue`、`selectStrategy`、`showSelect`はJSDocだけで公開propになっていない。現在の`/sites` routeにあるIterator利用はcomment outされている。
- `Sites/Manager`はAirArrayManagerへ作成を委譲するが、write可否・送信直前再検査・single-flightは共通Site actionで強制し、deleteは拒否する。status、step validation、stale array契約はFUT-0181、一覧prop不一致はFUT-0170へ統合する。
