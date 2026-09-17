# Customer（取引先）マスター実装調査

## メタデータ

- 状態: 作成・基本・支払条件の先行フェーズは[閉鎖記録](../verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)、状態表示・編集は[専用ロードマップ](../roadmaps/customer-status.md)、archive safetyは[専用ロードマップ](../roadmaps/customer-archive-safety.md)を参照。請求受入れは後続フェーズ
- 対象セグメント: SPEC-SEG-020、SPEC-DEEP-010、SPEC-DEEP-021
- 最終確認日: 2026-09-11
- 根拠ファイル: `pages/customers/index.vue`、`pages/customers/[id].vue`、`components/Customers/**`、`components/Customer/**`、`composables/fetch/useFetchCustomer.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Customer.js`、`air-guard-v2-schemas/src/mixins/GeocodableMixin.js`、`air-firebase-v2-client-adapter/index.js`
- local受入れ証拠: [CUSTOMER-01A local acceptance verification receipt](../verification/customer-01a-local-acceptance.md)
- archive local受入れ証拠: [Customer archive safety local acceptance verification receipt](../verification/customer-archive-local-acceptance.md)
- Dev試験・座標比較の修正・cleanup: [CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)
- Manager利用者Local証拠: [FGA-02 Customer Manager利用者Local検証記録](../verification/fga-02-customer-manager-user-local.md)
- Manager訂正後の利用者Local証拠: [FGA-02 Customer Manager訂正後の利用者Local検証記録](../verification/fga-02-customer-manager-correction-user-local.md)
- Manager訂正のDev証拠: [FGA-02 Customer Manager Dev反映・受入れ記録](../verification/fga-02-customer-manager-dev.md)
- Manager簡素化の最終Dev証拠: [FGA-02 Customer Manager簡素化 Dev反映・受入れ記録](../verification/fga-02-customer-manager-simplification-dev.md)

## 入口・UX権限

Page 2ファイルのroute、購読、CRUD到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を、Customer componentの公開契約・Site作成からの候補選択境界は[Customer components deep review](customer-components-deep-review.md)を参照する。

2026-08-11に採用したCustomerの通常CRUDに対する`customers:read`/`customers:write` server認可は、[ADR 0065](../decisions/0065-tenant-trust-normal-business-authorization.md)とFGA-02-RULES-01で置き換えた。UIの作成・編集・標準archive入口は既存のUX制御を維持するが、Rulesでは同一tenantの有効な本登録Userをroleによらず許可する。archiveは[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)改訂後の共通標準処理へ移行し、旧ADR 0046の専用認可・reason・監査envelopeはHistoricalとして扱う。緊急restoreは通常UIから隔離した将来操作であり、物理deleteも提供しない。

| 入口 | 実装 | UIの入口条件 | Rulesの境界 |
|---|---|---|---|
| 一覧・作成 | `/customers` | `customers:write`を持つactorだけDrawer表示・route到達。到達後は再判定しない | 同一会社の有効な本登録User。作成はactor UID一致と同ID archive不存在を必須にする |
| 詳細・更新・archive | `/customers/[id]` | 一覧と同じUX制御。到達後は再判定しない | 同一会社の有効な本登録User、maintenance停止、標準archiveのatomic pair。従属確認はSchema `hasMany` |
| Autocomplete | `Customer/Autocomplete` | callerが`creatable`を表示した場合に単数Managerで作成。Manager内ではpermissionを再判定しない | 作成は一覧と同じ通常Rules |

commit `79301b04ebaf5aab4898f1c122677780b11d9afc`では、一覧の行選択を`CustomersManager`／AirArrayManagerの`beforeEdit`へ渡し、詳細へ遷移してfalseを返すことで内部dialogを抑止する。`CustomersManager`は一覧Createと選択dispatchを所有し、`CustomerManager`を呼ばない。Autocompleteは配列を所有せず新規単一instanceを生成するため、[ADR 0069](../decisions/0069-domain-manager-editable-state-ownership.md)に従って`AirItemManager`を包む`CustomerManager`のCREATEを使用する。詳細の基本情報・支払条件・archiveは、同じ`CustomerManager`の標準操作へ接続する。通常data編集dialogは最大幅480pxとし、archiveの従属確認はCustomer Schemaの`hasMany`へ委譲する。

FGA-02-CUSTOMER-MANAGER-SIMPLIFY-17では、`CustomerManager`独自の`operation` prop、単一`open`関数、`editor` slot上書き、編集中だけ固定するsnapshotを撤去した。ACTIVATOR-21でactivatorはbase `AirItemManager`のslot propsをそのままpass-throughし、callerが`toCreate`または`toUpdate`を直接呼ぶ構成へさらに簡素化した。Customerのarchiveは詳細画面のarchive modeだけで`toDelete`へ接続し、一覧Managerや通常のCustomerManager利用では入口を提供しない。Customerの通常CREATE・UPDATEは標準契約へ委ね、既定editorのform validation、submit、mode管理と`useBaseManager`のerror・loading経路を利用する。

FGA-02-CUSTOMER-DIRECT-FIREMODEL-18では、両Managerの通常CREATE・UPDATEを編集対象Customer instanceの`create()`・`update()`へ直接接続した。ClientAdapterがvalidation、会社prefix、管理field、document全体writeを担うため、同じ処理を複製していた専用writerを撤去した。SCR-06ではarchiveも同じ標準Manager／Schema経路へ接続した。

過去のManager簡素化・FireModel直接接続・activator pass-throughのDev記録は履歴である。現行SCR-06では詳細READ・UPDATE・標準archive入口を接続したが、runtime・Dev受入れは未確認である。Autocomplete CREATEは到達可能な現行`creatable` callerがないため未確認である。

## データ契約

- 保存先は会社prefix配下の `Customers/{docId}`。doc IDは自動採番を使わず、通常の作成経路ではFirestore生成IDとなる。
- 必須: `name`、`abbreviation`、`nameKana`、`zipcode`、`prefCode`、`city`、`address`、`contractStatus`、`cutoffDate`、`paymentMonth`、`paymentDate`。
- 任意: `code`、`branchName`、`building`、`tel`、`fax`、`remarks`。`location` はhidden field。
- token検索対象は `name` と `nameKana`。`code`、略称、支店名、住所、電話番号はtokenFieldsに含まれない。
- 読み取り専用プロパティは `fullAddress` と `prefecture`。`fullAddress` は都道府県、市区町村、番地の結合で、建物名は含めない。
- statusは `ACTIVE` と `TERMINATED`。schemaの`logicalDelete=true`により標準adapterが`Customers_archive/{docId}`へraw copyしlive documentをdeleteする。Customerの旧専用Callable、参照barrier、確認画面はHistoricalであり、現行archiveは標準Manager／Schema `hasMany`へ委譲する。
- `getPaymentDueDateAt(baseDate)` は締め基準月へ`paymentMonth`を加え、月末指定または指定日をJST基準で算出する。存在しない指定日は月末へ丸める。
- 住所変更時はgeocodingを試みる。関数未注入、検索失敗、例外時も保存処理を中止せず`location=null`で継続する。緯度または経度が0の場合はtruthy判定により座標なしとして扱われる。

## CRUD・validation

- 現行HEADでは一覧のplus buttonは`CustomersManager`、Autocompleteのplus buttonは`CustomerManager`のCREATEからCustomer instanceの`create()`を呼ぶ。Autocompleteはbase Managerがcreate成功後に通知したCustomer instanceを`useFetch` cacheへ追加して選択する。選択前にlistenerを待たず、`useFetch` cacheは従属表示の補完に限り、変更可能なCustomerの正本にしない。一覧・詳細の表示正本はlistenerとする。現行routeにはAutocompleteの`creatable` callerがないため、このCreate経路はsource contractと自動testで確認済みだがruntime未確認である。
- schema required validationはあるが、`code`、名称等の一意性確認はない。
- 詳細の基本編集は`code/name/branchName/abbreviation/nameKana/zipcode/prefCode/city/address/building/tel/fax/contractStatus/remarks`を対象とする。
- 支払条件編集は`cutoffDate/paymentMonth/paymentDate`を一括編集する。
- `contractStatus`は基本情報editorで変更する。作成フォームには含めずACTIVEで作成する。詳細・一覧の状態表示はSchemaのtitleを使い、未知値は「不明」とする。
- active Customerの通常create/updateと標準archive deleteは、同一tenantの有効な本登録User、maintenance停止、actor UID、およびRulesのatomic archive境界に従う。archiveは標準Schemaの`hasMany`でSites参照を確認し、理由入力・専用Callable・監査envelope・client側role再検査は行わない。archive一覧とrestoreの画面入口はない。
- 通常作成・更新はCustomer document全体をdraftとし、ClientAdapterが`docId`、`uid`、client `Date`による`createdAt`・`updatedAt`、`beforeCreate`／`beforeUpdate`、全Schema validationを適用してtransaction内の`set`でdocument全体を置換する。名称・住所等の派生fieldも同じdocumentに再生成する。
- `CustomerManager`はlistener由来のCustomer instanceを`modelValue`へ直接渡す。編集中にlistenerが別のCustomer値を受信した場合も、base Managerの同期によりdraft全体が最新documentへ置き換わることを許容し、競合を理由とした拒否・警告・再読込要求は行わない。後にFirestore commitされたdocument全体を優先し、更新後の表示もlistener受信値を正本にする。Managerは通常保存のpermission・tenant・UIDを再判定せず、Rulesをserver境界とする。

## 必要時の保存形式検査

`utils/customer/customerDocumentContract.js`はRules契約test等でCustomerの26保存項目を確認する参照集合として残す。通常保存ではCustomer converterとClientAdapterがSchema validation、serialization、document全体writeを担い、Customer専用field抽出writerは置かない。FGA-02-RULES-01後の通常Customer Rulesはexact schema、型・長さ・状態を重複検査しない。同一tenantの有効Userが正規applicationを介さず不正形状を保存できるriskは、採用済みtenant信頼境界として明示的に受容している。

`scripts/check-customer-dev-compatibility.mjs`はconverterを通さずFirestoreの生の型を検査する。modelのdefaultによる欠損補完や、整数と小数の区別が失われる変換を行わない。認証、取得完了、想定path、上限、保存形式を検査し、値・ID・資格情報・data由来hashを出力せず固定理由の件数だけを集計する。書込み・修復機能は持たない。

対象範囲、明示command、接続前確認、上限、未検証表現の扱い、exit status、停止条件は[Customer互換性検査](../runbooks/dev-deployment/customer-compatibility.md)を正本とする。実行時点のDev件数・保存形式・認証と応答の確認結果は[CUSTOMER-01B検査証拠](../verification/customer-01b-dev-compatibility.md)を参照する。具体的な原因項目と、現在のedition・IAM設定全体は未確認である。

利用判断は[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)に従う。このtoolの実行・原因別拡張・ID別修復一覧はCustomerのDev反映の一律前提ではない。既存の実行証拠はそのまま保持し、次の作業は[roadmap](../roadmaps/airguard-v2.md#次の作業)を参照する。

3条件の具体的判定、対象service、切替・復旧、通常操作と下流確認の範囲は[Customer Dev反映・受入れ計画](customer-dev-release.md)を参照する。

## 検索・表示

名称にhard unique制約は設けず正当な同名作成を許す。任意Customer codeだけtenant内uniqueとする。normalized name/kana/address/phoneの類似候補はwarningに留める。状態による選択制限の旧方針は[現行仕様](../specification.md#取引先現場取極め)と[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)で置き換えた。検索はcode/name/kana/phoneを対象とし、addressはprivacy/cost確認後に追加を検討する。類似検索のfeasibility/index/costは未検証である。

- 一覧はACTIVEを初期表示条件とし、TERMINATED・全件へ切り替えられる。`subscribeDocs({ constraints })`でlive購読し、初期sortは`code`降順。表示列はcode、name、fullAddress、contractStatusで、支店名と建物名を補助表示する。旧配列引数ではadapterへ条件が届かなかった静的経路を修正した。
- Autocompleteはname/nameKanaのN-gram検索、上限50件、5分cacheを使う。追加constraintを渡さないため、ACTIVE条件は付かず、TERMINATED Customerも検索結果になり得る。
- 詳細の関連Site一覧はACTIVEだけを表示する。一方、削除の参照確認はstatusを限定しないため、画面上に関連Siteが見えなくてもTERMINATED等のSiteがあれば削除は拒否される。

## 参照関係・変更影響

- draft作成時にinitial Customer copy、正式発行時にfull snapshotを固定する。発行済み再printはsnapshotを使い、master変更を反映しない。訂正はreason/history付きnew revisionとし、live Customer参照のPDFはdraftだけに限定する方針である。

- schema上の直接`hasMany`は`Sites.customerId`だけを対象とし、標準Customer.deleteの従属確認を担う。Rulesは同一tenant・maintenance停止・raw same-ID archiveとlive deleteのatomic boundaryだけを検査し、OperationResults／Billingsをarchiveの従属検査へ重複追加しない。remoteの適用状態は未確認である。
- Billing作成時は現在のCustomer支払条件から`paymentDueDateAt`を算出してBillingへ保存する。その後のCustomer支払条件変更は既存Billingの期日を自動更新しない。
- Billingは`customerId`を保持するがCustomer名称・住所のsnapshotは持たない。請求書PDF生成時は現在のCustomer masterを取得するため、名称・住所変更は過去Billingの再生成PDFにも反映され、Customerがarchive済み等で取得不能なら生成失敗になり得る。
- Customer更新時の既存Functionは、`customerId`が一致するSiteの`customer`を同期する。ACTIVE限定ではない。Site経由の`cutoffDate`は新規Agreementの初期値へ、現在Customerの支払条件は新規Billingの期日へ流れる。Devの合成Siteで名称同期と新規Agreement初期締日を確認した。利用者指示により、請求機能の受入れは稼働実績管理改修後へ移し、今回の完了条件へ含めない。

## 削除・無効化

- 契約終了・停止はTERMINATED、再開は`customers:write`によるACTIVE化とする。archiveは標準CustomerManagerのdelete経路で行い、Schema `hasMany`の参照確認に委譲する。通常User向けrestore・物理delete UIは設けない。
- archiveはUser向けrecycle binではない。既存archiveは旧形式を含め保持し、復元・purgeは提供しない。SCR-06のruntime・Dev受入れは未確認である。
- 旧CAS-02〜05のexact actor、reason、versioned envelope、参照writer barrier、専用Callable、監査・冪等性の記述はHistoricalであり、現行Customer archive契約ではない。

- 取引状態の意味は[現行仕様](../specification.md#取引先現場取極め)を正とする。業務上の無効状態やlogical deleteと同一視しない。
- 状態変更は基本編集から提供する。archiveは標準CustomerManagerのdelete経路から提供する。archive一覧、restore・物理deleteの製品経路は提供しない。SCR-06のruntime・Dev受入れは未確認である。
- archive collectionはread/update/deleteを拒否し、createはraw同値のatomic pairだけをRulesで許可する。maintenance停止条件と同一tenant境界を維持する。

## Rules・tenant境界

- `Companies/{companyId}/Customers/{docId}` のread/create/updateは、確認済みcompany claim、同社User、有効・本登録を共通境界とする。create/updateは保存documentの`uid`と認証UIDの一致を追加で要求し、createは同ID archive tombstoneがあれば拒否する。通常CRUDでは会社管理者、role、permission、super-user区分、exact field集合、型、長さ、状態、時刻、操作別変更fieldをallow条件にしない。
- active delete、archive CUD、Companies配下の広いfallbackによるCustomer制約迂回を拒否する。
- path prefixがtenant境界である。異なるcompany pathへの通常ユーザーアクセスは拒否される。
- Rulesは`tokenMap`、位置情報、管理時刻を含むCustomer schemaを検査しない。正規writerはdocument全体を検証して派生値を生成するが、同一tenantの有効Userによる直接改ざん余地は残る。archive・物理delete・機微情報等の例外へこの許可を拡張しない。

## 矛盾・未使用候補

- 状態編集と一覧の状態切替は[専用ロードマップ](../roadmaps/customer-status.md)で検証する。Autocompleteが状態を絞らないことは現在の要件と一致する。
- 一覧の既存adapterは非同期listener errorを画面へ通知するcallbackを持たない。今回のfilterで新規readerを追加せず、この取得失敗表示の制約は後続課題として残す。
- archiveのCustomer詳細UIはCAS-04でlocal完了し、restore・運営者inspection・物理delete/purgeは別の将来仕様へ分離している。
- `CustomersIterator`は宣言コメントと異なり`modelValue`、`select-strategy`、`show-select`及び任意attrsを内部iteratorへforwardしない。Site作成wizardの既存Customer候補選択に渡すattrsが機能しないため、候補選択より取引先未設定継続だけが到達し得る。
- Site表示条件と削除guard条件が異なり、利用者には見えない参照で削除拒否となり得る。

## 将来要対応

- FUT-0055: read/write分離、preset、通常物理delete拒否はCUSTOMER-01Aで実装済み。状態変更は基本編集へ含め、参照確認・監査を伴うarchiveのCallable・barrier・画面入口はCAS-02/03/04でlocal実装・検証済み、緊急restoreは別の将来仕様とする。
- FUT-0056: code一意・類似warning・検索fieldを実装し、feasibility/index/cost/privacyを検証する。状態による選択制限は現行仕様へ揃え、旧ACTIVE限定方針を実装しない。
- FUT-0057: 承認済みarchiveのCallable・Rules・参照guard・Customer詳細UIはCAS-02/03/04でlocal実装・検証済み。CAS-05のDev反映・受入れ、運営者inspection・緊急restore・保持期間・purgeは別工程・別仕様として残す。
- FUT-0058: draft initial copy、formal full snapshot、snapshot再print、revisionを実装する。
- FUT-0059: status編集経路は[専用ロードマップ](../roadmaps/customer-status.md)で扱う。address編集経路はCUSTOMER-01Aで実装済み。geocodingのserver生成化・意味上の整合は今回へ含めない。

## 要確認事項

- CONF-0041〜CONF-0045を`pending-confirmations.md`に登録した。

## 未確認範囲

- 他masterに残る汎用Air manager内部の全validation・表示実装。CustomerのAutocomplete内Createの単数Manager化と、一覧行選択を`CustomersManager`の`beforeEdit`へ渡す詳細navigationは実装済みである。Autocomplete Createは現行routeから到達する`creatable` callerがなくruntime未確認であり、将来到達可能なcallerを追加する時点で確認する。
- Site/Agreement/Billing/PDFの内部処理、Dev・実データ上の参照件数、保存形式検査で検出した不適合の具体的原因、必要なindex。Customerの旧専用archiveは履歴であり、SCR-06で標準Class.deleteへ移行した。標準archiveのruntime・Dev受入れは未確認である。
- `contractStatus`を別画面・管理手段・データ移行で変更する運用。
