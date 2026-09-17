# Site（現場）マスター実装調査

## メタデータ

- 状態・適用証拠: [FGAロードマップ](../roadmaps/foundational-governance-alignment.md)と[FGA-03 Dev受入れ記録](../verification/fga-03-site-manager-lww-dev.md)を正とする。以下は通常保存と専用操作の実装記録であり、live remoteの再確認結果ではない。
- 対象セグメント: SPEC-SEG-021、SPEC-DEEP-010、SPEC-DEEP-034、SPEC-DEEP-035
- 最終確認日: 2026-09-16（SCR-07 prelocal実装への文書整合。Local／Dev受入れ未確認）
- 根拠ファイル: `pages/sites/index.vue`、`pages/sites/terminated.vue`、`pages/sites/[id].vue`、`components/Sites/**`、`components/Site/**`、`composables/dataLayers/site/useSiteUiReads.js`、`composables/domain/site/siteUiPresentation.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Site.js`、直接参照するOperationResult/SiteOperationSchedule/Billing PDF箇所

2026-09-14の現行訂正: [ADR 0074](../decisions/0074-transaction-parent-reference-independence.md)により、Site archiveの5トランザクション参照queryと、OperationResults／Billings／ArrangementNotifications／SiteEmployeeHistoriesのlive Site存在barrierを撤去した。以下のSITE-05参照保護記述は過去実装の記録であり、現在仕様として使用しない。

## 入口・書込み権限

### Current SCR-07（2026-09-16、prelocal・検証待ち）

Siteのarchiveは詳細画面の明示的な`SiteManager` DELETEモードから`Site.delete()`へ接続した。Schemaの`hasMany`（`SiteOperationSchedules.siteId`、`OperationResults.siteId`、`ArrangementNotifications.siteId`）による従属確認後、標準ClientAdapterがraw同ID archive作成とlive削除を同一transactionで行う。専用Callable、reason、監査envelope、Rules内の従属queryは現行経路に含めない。通常のSiteManager／SitesManagerは削除入口を提供せず、終了・再有効化のUPDATEは別経路として維持する。既存archiveは変換・削除しない。

Page 3ファイルのroute、query/filter、終了・削除到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を参照する。

Siteの通常writeは作成、基本情報・Customer・Agreement変更、手動終了、再有効化を含み、同じtenantの有効な認証済み本登録Userへrole、permission、会社管理者、super-user区分に依存せず許可する。確認済みemail、Auth UIDとUser `docId`、tenant claim・User所属tenant・path tenant、有効・本登録Userを共通境界とする。手動終了・再有効化は標準SiteManager／Site schemaの状態更新として保存し、状態変更理由・actor UID・時刻・工期・Customer不変と予定条件をschemaで検査する。自動終了はsystem Functionとして維持する。archiveは詳細画面の明示操作から標準`Site.delete()`へ接続する。

| 入口 | 現行UI | pageSettings | Rules |
|---|---|---|---|
| `/sites` | ACTIVE一覧、詳細遷移。通常writeのclient判定を満たすUserに作成入口 | `sites:read` | 同一tenantの有効な本登録Userにread/create/update。delete拒否 |
| `/sites/[id]` | 閲覧・予定表示。通常writeのclient判定を満たすUserに基本情報・取引先・取極め更新と終了。詳細画面にarchive入口 | `sites:read` | 同上。archiveはmaintenance off・同一tenantの有効な本登録Userによるatomic pairのみ |
| `/sites/terminated` | TERMINATEDを名称検索し詳細遷移。通常writeのclient判定を満たすUserに再有効化入口 | `sites:read` | 同上 |

通常のcreate/update/lifecycleとarchiveはbase Managerのinstance単位loading/errorを使い、archiveの従属確認と保存は標準Schema／ClientAdapterへ委譲する。通常writeとarchiveのRulesは同一tenantの有効な本登録User、actor UID、maintenance offを境界とする。

## データ契約

- 保存先は会社prefix配下の`Sites/{docId}`。`useAutonumber=false`で、通常作成はFirestore生成ID。
- 必須: `name`、`nameKana`、`prefCode`、`city`、`address`、`securityType`、`status`。`customerId`未設定時は`customerName`が必要。
- 任意: `customerId`、`customerName`、`code`、`hasAbbreviation`、`abbreviation`、`zipcode`、`building`、`siteNumber`、工期開始/終了日、`location`、`remarks`、`agreementsV2`。
- `customer`はhiddenの埋込みCustomer。通常createとCustomer変更時は、Site schemaが`customerId`に該当する同じ会社のCustomerを取得して格納する。application固有の項目数制限は設けない。取極め更新では触れない。
- statusのdefaultは`ACTIVE`。値は`ACTIVE`（稼働中）と`TERMINATED`（終了）。
- 読み取り専用プロパティ: `fullAddress`、`prefecture`、`isTemporary`、`hasConstructionPeriod`、開始/終了日有無。ゲッター: `displayName`（略称使用時はabbreviation、その他はname）。
- `getValidAgreement`はshiftType一致を日付降順にし、指定日以前の最新`agreementsV2`を返す。該当なしはnull。
- 工期は両端がある場合に開始≦終了を相互validationする。片端だけも許容される。
- token検索fieldは`name`と`nameKana`。code、略称、取引先名、住所、現場番号は対象外。

## CRUD・validation

- 現行作成dialogは`SiteManager`／`SitesManager`が共通Air Managerの3ステップ入力を使う。最初に取引先名を入力して候補を検索し、次に既存Customerを任意選択し、最後に郵便番号・住所、名称・略称、警備種別、現場番号、工期、備考等を入力する。候補がない場合や選択しない場合も、取引先名だけで仮登録できる。
- create時にcustomerIdとcustomerNameが両方なければ失敗する。customerIdがあれば同じ会社prefixのCustomer存在確認とCustomer埋込みを行う。
- customerId設定後は未設定へ戻せないが、別Customerへの変更は禁止されていない。変更時は埋込みcustomerを更新する。
- 通常更新は`SiteManager`へlistener由来のSite instanceを直接渡し、基本情報用または取引先用CustomInputを表示する。編集中にlistenerで新しいdocumentが届いた場合も共通Managerのdraftをdocument全体で置き換え、競合拒否や再読込要求を設けない。保存時は通常field全体を後から保存した内容で置き換える。
- 作成時から`hasAbbreviation/abbreviation/siteNumber/remarks`を入力でき、基本編集も同じfieldを扱う。
- code/name等の一意性validationはない。
- 単数`SiteManager`は既存またはその場の新規Siteを所有し、複数形`SitesManager`は一覧配列と行選択を所有する。一覧のUPDATE選択は`beforeEdit`から詳細へ遷移して一覧dialogを開かない。create/update handlerはSite modelの標準`create`／`update`を直接呼び、schema hook、validation、会社prefix、metadata、transaction保存を標準adapterへ委ねる。通常のSiteManager／SitesManagerはdelete入口を提供せず、詳細画面だけがarchive modeのSiteManagerで`delete()`を呼ぶ。
- 通常updateはdraftのSite document全体を後保存優先で保存する。取極めも現在のSiteへ編集後の配列を重ねて同じ通常`update()`を使う。終了・再有効化もSiteManagerの標準`update()`へ接続し、予定条件・状態metadata・Customer不変はSite schemaとRulesで保護する。archiveは詳細画面の明示的な標準delete入口として、通常編集とは操作モードを分ける。

## 検索・表示

- ACTIVE一覧はcurrent Userの会社配下かつstatus=ACTIVEのSite専用listenerを使い、初回loading、正常な0件、listener失敗を区別する。customerIdとsecurityTypeもFirestore queryの条件へ含め、updatedAt降順・同値時はdocument ID降順で最大20件を表示する。
- 一覧表示はcode、`displayName`、liveまたは埋込みCustomer名称、securityType、JST工期、status、Customer未設定時の仮登録Chip。customerId欠損時にCustomer読取りを行わない。
- TERMINATED一覧は、検索文字列がある時はN-gram検索へstatus=TERMINATEDを追加する。空検索ではstatus=TERMINATEDのうちupdatedAt降順・同値時はdocument ID降順で最近更新された最大20件を表示し、入力変更・clear後に古い応答を反映しない。loading、0件、失敗を区別する。
- Site AutocompleteはN-gram検索にstatus constraintを付けず、ACTIVEを先にしつつ検索関連順を維持する。検索・ID lookupの古い応答を破棄し、TERMINATED確認の取消時は直前の確定値を保持する。
- 詳細はroute ID変更時に購読を切替え、初回loading、取得失敗、not-foundを区別する。not-foundでは編集・終了・再有効化・archive等の操作UIを描画しない。購読開始後の非同期listener errorは現行共通adapterがerror callbackを公開しないため、既存の制約として残る。
- SITE-04の旧手動終了Callableは履歴・Git上の経路であり、現行の手動終了・再有効化はSiteManager／Site schemaの標準更新経路を使う。ACTIVE Siteだけを通常編集でき、TERMINATEDは終了済み表示と新規選択確認を経て単発予定に使用できる。継続再開はreasonと新工期を必須にし、現在のCustomer設定を変えない。read-only actorにはmaster write入口を表示せず、archive入口は詳細画面の標準delete操作として扱う。

## 参照関係・変更影響

- Customer所属は`customerId`と埋込み`customer`の二重保持。通常作成とCustomer変更時はSite schemaがCustomer snapshotを格納する。Customer master更新時の`onUpdateCustomer`は表示と取極め判定に必要な6項目を伝播する現行処理を維持するため、保存時点によって埋込みCustomerの項目集合は異なり得る。複数batchはatomicでなくevent version guardもないため、一時的な不一致、部分失敗、古いeventの後着を収束させる保証はない。一覧はlive Customerを別取得し、詳細の取引先表示と取極めcutoff-dateは埋込み値を使うため表示・処理時点が混在する。
- 2026-09-04に、現行sourceとCONF-0047に合わせて別Customerへの変更を許可する仕様を正本へ反映した。一度設定したcustomerIdを未設定へ戻す操作は引き続き提供せず、変更時は同じ会社に存在するCustomerを必須にする。既存OperationResult・BillingのcustomerIdは履歴snapshotとして自動変更しない。
- SiteOperationScheduleはsiteIdを保持し、作成/一部処理でSiteの存在と仮登録でないことを確認する。Site名等は直接snapshotしない。
- OperationResultは作成時またはgroup key変更時にSiteからcustomerIdと適用取極めを取り込み、その後は保存済み値を使う。SiteのCustomer・取極め変更が既存実績へ自動反映される契約ではない。
- Billing集計keyはcustomerId、siteId、billingDateを使う。請求書PDFは生成時にlive Siteを取得してSite名を表示し、欠損時は「不明な現場」とするため、Site名変更は過去Billingの再生成表示にも反映される。
- ADR 0052では、予定はlive Site、OperationResultは作成時snapshot、確定請求書はBilling revision snapshotを使うと確定した。現行OperationResultはSite名称・表示名・住所・警備種別・Customer表示情報をsnapshotせず、Billing PDFもlive Site名称を使うため、この方針はFUT-0064およびtransaction側の実績・請求・帳票改修で未実装である。legacy欠損値は現在値を過去値として推測backfillしない。
- SITE-05の直接参照catalogは`SiteOperationSchedules`、`OperationResults`、`ArrangementNotifications`、`Billings`、`SiteEmployeeHistories`のexact 5 collectionである。`DailyAttendances`と`DailyOperationsByEmployee`の`siteId`はOperationResultから生成される下流snapshotで、live Siteを参照する業務documentではないため、archive時に変更せず直接参照catalogにも含めない。SITE-09は合成Siteの参照なしarchiveを確認したが、remote legacy data全件が同じ生成経路を満たすことは検査していない。既存dataを使う後続機能で必要になった場合に別承認する。
- AgreementはSite内配列として保存される。

## 削除・無効化

- 手動終了・再有効化はSiteManagerの標準`update()`からSite schemaへ渡し、ACTIVE→TERMINATED／TERMINATED→ACTIVEの遷移、reason、actor UID、時刻、工期、Customer不変をschemaで検査する。終了時は現在以降の予定と未実績予定の存在を保存前に確認する。Customer未設定を含む現在値は変更しない。Functionsの手動Callableは公開経路から撤去した。
- 自動終了はJST工期終了日の90日後から候補とし、bounded cursorで走査して各Siteをtransactionで再確認する。予定cleanupとは別scheduled Function・別失敗境界で、失敗はlog後に再throwする。初回Dev releaseではFunctionを未公開としたため、legacy予定の必須field欠損有無はSITE-09の合成data受入れ対象外とした。公開前の別checkpointでremote確認する。
- 確認済み方針ではTERMINATEDの通常master編集を制限する一方、終了済みChip・識別情報・確認付きで新規業務の選択候補へ残す。単発残工事はTERMINATEDのまま扱い、継続再開は同じCustomer、同一tenantの有効な本登録User、reason、新工期を必須とする。roleは認可根拠にしない。Customer変更許可は別operationとして維持し、既存実績へ自動反映せず、Agreementも自動再有効化しない。SCR-03の手動状態変更は標準更新経路へ接続し、自動終了のsystem-only境界は維持する。
- 旧SITE-05の専用archive Callable、reason、operation ID、参照catalog検査、監査envelopeはHistoricalであり、現行経路ではない。
- 現行SCR-07ではSchemaのhasMany確認後、同ID raw archiveとlive削除を標準adapterへ委譲する。通常restoreと物理deleteの製品入口は提供しない。

## Rules・tenant境界

- SITE-08時点では、旧dataの欠損へ限定した互換検査と、通常Siteのexact field・型・長さ・派生値検査をRulesに置いていた。FGA-03の通常Rules簡素化で置換済み。適用証拠は冒頭の正本を参照する。
- `Companies/{companyId}/Sites/{docId}`は同一tenantの有効な本登録Userにreadを許可する。通常create/updateと標準archiveはmaintenance off、確認済みemail、canonical User `docId`、tenant claim・User所属tenant・path tenantの一致、有効・本登録Userを必須とし、role、permission、会社管理者、super-user区分をallow条件にしない。予定競合用revisionだけは同一tenantの予定writerがatomicに+1できる。通常一覧・通常編集からのdelete入口は提供しない。
- 通常Siteの必須field、型・長さ・enum、exact field集合、通常timestamp、派生値、埋込みCustomerのexact projectionは、Schemas packageと正規application writerが検査し、Rulesでは重複検査しない。Rulesはpathとdocument ID、actor UID、ACTIVE、Agreement、`scheduleRevision`、状態変更field、同一会社のlive Customer存在、Customer未設定への巻戻し禁止、`isTemporary`相関を保護する。予定作成は`operationResultId=null`とSite revisionの同時更新、実績化は整合するOperationResultとの同時更新だけを許可し、偽参照・置換・巻戻しを拒否する。
- 製品が提供するSite操作は正規application経路を前提とする。正規applicationを介さない同一tenant Userの直接requestでは通常fieldの不正値をRulesが拒否しないが、利用者判断により本phaseの対応対象にせず、archive形式やFunctionsは変更しない。この前提を変更する場合はRulesの通常field検査とarchive互換を同時に再検討する。
- `Sites_archive`はread/update/deleteを拒否し、同一tenantの有効な本登録Userによるraw同値createとlive deleteのatomic pairだけを許可する。同ID archiveが存在するSite createも拒否する。
- `OperationResults`、`Billings`、`ArrangementNotifications`、`SiteEmployeeHistories`はcreateまたは`siteId`変更時にlive Site存在を必須とする。既存documentのread、delete、`siteId`以外の互換更新は従来境界を維持する。`SiteOperationSchedules`はSITE-04で導入したSite revisionと同一transactionのguardを維持する。server側のBilling初期化とSiteEmployeeHistory再構築も同じatomic boundaryでlive Siteを検査する。
- tenant境界はcollection pathに依存し、document内companyIdはSite契約にない。

## Site components公開契約・状態・失敗境界（SPEC-DEEP-034）

| component | 公開契約 | 確認済み挙動・境界 |
| --- | --- | --- |
| `Site/Manager` | `modelValue`、`beforeEdit`、`customInput`、created/updated eventを受け、AirItemManagerへ委譲 | CREATEは3ステップの作成用CustomInput、UPDATEは基本情報用またはcaller指定CustomInputを使う。listener由来instanceを直接受け、標準`create`／`update`で保存し、deleteを拒否する。ACTIVEだけを通常編集でき、TERMINATEDは専用再有効化操作へ誘導する。 |
| `Sites/Manager` | Site配列、`beforeEdit`、`customInput`を受け、AirArrayManagerへ委譲 | 配列と行選択を所有し、一覧のUPDATEはcallerの`beforeEdit`で詳細遷移できる。CREATEは同じSite actionを使い、deleteを拒否する。 |
| `Site/CustomInput` | `componentAttrs`、`item`、`disabled`、`updateProperties`、`step` | 共通Managerの作成VForm内で、取引先名検索、既存Customerの任意選択、現場情報入力を3ステップで表示する。Customer未登録でも仮登録できる。 |
| `Site/CustomInput/Base` | 15 fieldのcomponent attrsを入力へ展開 | code/name/address/security/construction/remarks等を表示するが、validation・保存はAir manager/schemaへ委譲する。 |
| `Site/CustomInput/Customer` | Customer fieldのcomponent attrsと編集中Site | 別Customerへの変更を許可し、編集開始時にCustomer設定済みなら未設定へ戻す操作を表示しない。 |
| `Site/Editor/Agreements` | listener由来Siteを受け、編集後の`agreementsV2`を重ねたSite modelの通常`update()`を`AgreementsManager`へ接続 | 詳細画面内へ取極め一覧と追加・編集・複製buttonを直接表示し、選択した1件だけをdialogで編集する。document last-write-wins、0円確認、失敗後の入力保持、同一操作の二重送信防止を維持する。 |
| `Site/Autocomplete` | creatable/label/itemTitle/itemValue/returnObject、model update | status非限定でACTIVEを先に表示し、検索・lookupをlatest-onlyにする。TERMINATEDは確認し、取消・not-found・失敗では元の確定値を保持する。作成入口は通常Site writeのclient判定を満たすUserに表示する。 |
| `Site/Select` | label/itemTitle/itemValueと全attrsをAirSelectへ透過 | 候補集合、status、permission、enum membershipはcaller責任である。 |
| `Site/Activator/Base` | Site、title、edit event、Base CustomInput expose | callerが許可した時だけaccessible name付きedit buttonを表示し、JSTで両端・開始のみ・終了のみ・未設定の工期を区別する。 |
| `Site/Activator/Customer` | Site、title、edit event、customerId included key | temporary SiteはCustomer設定action、それ以外は埋込みCustomerを表示する。常にedit入口を持ち、許可されたCustomer変更をUIから開始できる。 |
| `Site/Card` | select/edit/detail flagsと3 click events | selectionはclickable iconで、明示button/accessible name/keyboard handlerを持たない。直接callerはSitesIteratorだけである。 |
| `Site/ListItem` | Vuetify item/rawまたはSiteを受ける | 新しいSite instanceへdeep watchでinitializeし、status/仮登録Chip、名称、Customer fallback、code、住所、JST工期を表示する。 |

- `Site/Card`は`Sites/Iterator`からだけ到達し、そのIteratorのroute上の使用は現在comment outされている。公開componentとしての外部/dynamic到達性は未確認であり、deadとは断定しない。
- 現行作成dialogは履歴で確認した`CustomersIterator`の3-step経路を共通Manager内で使用する。旧専用`Site/CreateDialog`は不要なため削除した。
- Site専用郵便番号inputは既存の外部lookup utilityを再利用し、7桁入力時の最新応答だけを住所へ反映する。検索中に郵便番号または住所が変わった場合、失敗・0件、unmount時は既存入力を変更しない。外部utilityが通信失敗と0件をどちらもnullに畳むため、画面文言も原因を断定しない。
- 通常作成・更新は共通Air Managerのdraft、VForm、dialog、listener同期を使い、document単位last-write-winsとする。取極めは詳細画面内に一覧と追加・編集・複製buttonを直接表示し、選択した1件だけをdialogで編集する。専用Callableや競合拒否は使わず、現在のSiteへ編集後の配列を重ねて通常`update()`で保存する。0円確認、失敗後の入力保持、同一操作の二重送信防止は維持する。
- SITE-08で予定・実績フォームの取極め定時読込みをprovider cache依存から明示company/Site IDの取得へ変更した。予定のpreset警備種別も取得完了後に反映する。既存Site read access guardを再利用し、tenant・uid・アクセス取消、unmount、Site/date/shift変更、取得前後の手入力、A→B→Aで古い応答を破棄する。操作別writerと保存shapeは変更しない。
- 9 filesにはtenant、role、permission、actor、audit checkがない。表示・disabled・validationはRules/Functionsのauthorizationを代替しない。

## 矛盾・未使用候補

- Site.beforeUpdateと詳細UIが許可する別Customerへの変更は、2026-09-04に正本仕様へ反映した。既存OperationResult・Billingを自動移管しないsnapshot契約と、一度設定したcustomerIdを未設定へ戻さない現行境界を維持する。
- Customer master更新の伝播が部分失敗または順序逆転するとSite内の埋込みcustomerはstaleになり得て、一覧と詳細で参照するCustomer時点が異なる。
- TERMINATED Siteは終了済みChip・取引先・code・住所を表示して候補に残し、選択またはpreset保存時の明示確認後に単発予定へ使用できる。確認は対象Schedule操作へ束縛し、成功・取消・unmountで破棄し、失敗後の明示再試行だけで維持する。通常編集は制限し、継続再開は専用操作を使う。archive入口は詳細画面に限り、標準delete操作として提供する。
- restore APIが存在するlogical deleteなのに、UIは復元不能と断定する。
- 現行の共通Manager作成dialogは3-step componentで取引先未登録の仮登録、略称・現場番号・備考、stepごとのVForm validation、郵便番号反映を扱う。旧専用作成dialogは削除した。
- 基本情報cardと一覧は、片側だけの工期を欠損側の`null`文字列なしで表示する。
- deprecated `agreements` getter/setterと`getAgreement`が互換用に残る。

## 将来要対応

- FUT-0060: SITE-03時点のstrict actor設計と、FGA-03で通常writeをtenant-trustへ置換した履歴。現行SCR-07ではarchiveも同一tenantの有効な本登録Userによる標準delete境界へ移行した。
- FUT-0061: Customer存在・tenant境界はRulesとschema経路へ導入済み。埋込みCustomer同期を順序・部分失敗安全にし、operation別writerとのparityを確認する。
- FUT-0062: 完了。ADR 0054のTERMINATED master編集制限、確認付き新規選択、単発残工事、reason・新工期による再有効化、予定競合guard、自動終了を実装・検証した。FGA-03で手動終了・再有効化のactorはtenant-trustへ置換し、専用transactionと自動終了のsystem-only境界は維持した。
- FUT-0063: 旧SITE-05の記録。現行SCR-07では専用Callable・監査envelope・exact 5 collection参照検査を再利用しない。
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
- `Sites/Manager`はAirArrayManagerへ作成を委譲し、Site modelの標準`create`／`update`で通常保存する。deleteは拒否する。status、step validation、stale array契約はFUT-0181、一覧prop不一致はFUT-0170へ統合する。
