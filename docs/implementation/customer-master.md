# Customer（取引先）マスター実装調査

## メタデータ

- 状態: 作成・基本・支払条件の先行フェーズは[閉鎖記録](../verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)、状態表示・編集は[専用ロードマップ](../roadmaps/customer-status.md)、archive safetyは[専用ロードマップ](../roadmaps/customer-archive-safety.md)を参照。請求受入れは後続フェーズ
- 対象セグメント: SPEC-SEG-020、SPEC-DEEP-010、SPEC-DEEP-021
- 最終確認日: 2026-09-09
- 根拠ファイル: `pages/customers/index.vue`、`pages/customers/[id].vue`、`components/Customers/**`、`components/Customer/**`、`composables/fetch/useFetchCustomer.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Customer.js`、`air-guard-v2-schemas/src/mixins/GeocodableMixin.js`、`air-firebase-v2-client-adapter/index.js`
- local受入れ証拠: [CUSTOMER-01A local acceptance verification receipt](../verification/customer-01a-local-acceptance.md)
- archive local受入れ証拠: [Customer archive safety local acceptance verification receipt](../verification/customer-archive-local-acceptance.md)
- Dev試験・座標比較の修正・cleanup: [CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)

## 入口・暫定権限

Page 2ファイルのroute、購読、CRUD到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を、Customer componentの公開契約・Site作成からの候補選択境界は[Customer components deep review](customer-components-deep-review.md)を参照する。

2026-08-11に採用したCustomerの通常CRUDに対する`customers:read`/`customers:write` server認可は、[ADR 0065](../decisions/0065-tenant-trust-normal-business-authorization.md)とFGA-02-RULES-01で置き換えた。UIの作成・編集入口は既存のUX制御を維持するが、Rulesでは同一tenantの有効な本登録Userをroleによらず許可する。archiveはこの置換の例外であり、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)の専用認可を維持する。緊急restoreは通常UIから隔離した将来の運営者専用操作として別仕様・別認可を必要とし、物理deleteも提供しない。field分割は実需要が生じた場合だけ再検討する。

| 入口 | 実装 | UIの入口条件 | Rulesの境界 |
|---|---|---|---|
| 一覧・作成 | `/customers` | readで一覧、write actorだけ作成 | 同一会社の有効な本登録User。作成はactor UID一致と同ID archive不存在を必須にする |
| 詳細・更新 | `/customers/[id]` | readで詳細、write actorだけ基本・支払編集 | 同一会社の有効な本登録Userとactor UID一致。client deleteは拒否 |
| Autocomplete | `Customer/Autocomplete` | readで検索、write actorだけ作成 | 作成は一覧と同じ専用処理 |

Customerの製品経路は`AirItemManager`、`AirArrayManager`、`useBaseManager`を使用しない。一覧とAutocompleteは共有作成dialog、詳細は基本情報editorと支払条件editorを使用する。閲覧だけの利用者には作成・編集・archive入口を表示しない。

## データ契約

- 保存先は会社prefix配下の `Customers/{docId}`。doc IDは自動採番を使わず、通常の作成経路ではFirestore生成IDとなる。
- 必須: `name`、`abbreviation`、`nameKana`、`zipcode`、`prefCode`、`city`、`address`、`contractStatus`、`cutoffDate`、`paymentMonth`、`paymentDate`。
- 任意: `code`、`branchName`、`building`、`tel`、`fax`、`remarks`。`location` はhidden field。
- token検索対象は `name` と `nameKana`。`code`、略称、支店名、住所、電話番号はtokenFieldsに含まれない。
- 読み取り専用プロパティは `fullAddress` と `prefecture`。`fullAddress` は都道府県、市区町村、番地の結合で、建物名は含めない。
- statusは `ACTIVE` と `TERMINATED`。schemaの`logicalDelete=true`とgeneric adapterには`Customers_archive/{docId}`へのcopy/deleteがあるが、製品のCustomer archiveには使用しない。[Customer archive safety](customer-archive-safety.md)を正とする専用Callable、参照barrier、Customer詳細の確認画面入口はCAS-02/03/04で実装し、CAS-05でDev反映・受入れ済みである。
- `getPaymentDueDateAt(baseDate)` は締め基準月へ`paymentMonth`を加え、月末指定または指定日をJST基準で算出する。存在しない指定日は月末へ丸める。
- 住所変更時はgeocodingを試みる。関数未注入、検索失敗、例外時も保存処理を中止せず`location=null`で継続する。緯度または経度が0の場合はtruthy判定により座標なしとして扱われる。

## CRUD・validation

- 一覧とAutocompleteのplus buttonは共有作成dialogからCustomer専用application処理を呼ぶ。基本情報と支払条件も専用editorから同じ境界を呼び、UIからCustomer modelの`create/update/delete`を直接呼ばない。
- schema required validationはあるが、`code`、名称等の一意性確認はない。
- 詳細の基本編集は`code/name/branchName/abbreviation/nameKana/zipcode/prefCode/city/address/building/tel/fax/contractStatus/remarks`を対象とする。
- 支払条件編集は`cutoffDate/paymentMonth/paymentDate`を一括編集する。
- `contractStatus`は基本情報editorで変更する。作成フォームには含めずACTIVEで作成する。詳細・一覧の状態表示はSchemaのtitleを使い、未知値は「不明」とする。
- active Customerのclient deleteと`Customers_archive`のclient read/CUDはRulesで拒否する。参照確認、監査、同ID tombstoneを持つ専用archive Callableと参照writer barrierはCAS-02/03、権限制御・理由・single-flight・安全なerror表示を持つ確認画面入口はCAS-04で実装し、CAS-05でDev反映・受入れ済みである。archive一覧とrestoreの画面入口はない。
- 更新は最新Customerへ実際に変更したoperation所有fieldを重ね、全体schemaを検査してから、実変更fieldと`uid`・server timestampだけを保存する。名称変更時は`tokenMap`、主要住所変更時は位置・表示住所の派生fieldを同時に部分保存する。
- editorはlive値とdraftを分け、同じoperation fieldの外部変更ではreloadを必須にする。自分の保留中反映と失敗後rollbackは外部競合から除外し、rollback待ち中のbutton・Enter再送を拒否する。基本editorではrollback待ちに真正な外部値が届いたら待ちを解除して再読込できる。applicationは非同期準備後にも権限・identityと観測済み同operation競合を再確認する。送信後の同時更新を原子的に防ぐ仕組みではない。

## 必要時の保存形式検査

`utils/customer/customerDocumentContract.js`が永続化する26項目の集合を持ち、`utils/customer/customerWriter.js`の作成時の抽出と共有する。このexact schemaと型・長さ・状態・派生値はSchemas packageと正規application writerの責務であり、FGA-02-RULES-01後の通常Customer Rulesは重複検査しない。同一tenantの有効Userが正規applicationを介さず不正形状を保存できるriskは、採用済みtenant信頼境界として明示的に受容している。

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

- schema上の直接`hasMany`とgeneric削除guardは`Sites.customerId`だけを対象とする。専用archive Callableはactual参照catalogとしてSites、OperationResults、Billingsをstatus限定なしで確認し、CAS-03 RulesとBilling server writerは3 collectionのcustomerId新規設定・変更へactive Customer document存在guardを適用する。これらはCAS-05でDev反映・受入れ済みである。
- Billing作成時は現在のCustomer支払条件から`paymentDueDateAt`を算出してBillingへ保存する。その後のCustomer支払条件変更は既存Billingの期日を自動更新しない。
- Billingは`customerId`を保持するがCustomer名称・住所のsnapshotは持たない。請求書PDF生成時は現在のCustomer masterを取得するため、名称・住所変更は過去Billingの再生成PDFにも反映され、Customerがarchive済み等で取得不能なら生成失敗になり得る。
- Customer更新時の既存Functionは、`customerId`が一致するSiteの`customer`を同期する。ACTIVE限定ではない。Site経由の`cutoffDate`は新規Agreementの初期値へ、現在Customerの支払条件は新規Billingの期日へ流れる。Devの合成Siteで名称同期と新規Agreement初期締日を確認した。利用者指示により、請求機能の受入れは稼働実績管理改修後へ移し、今回の完了条件へ含めない。

## 削除・無効化

- 契約終了・停止はTERMINATED、再開は`customers:write`によるACTIVE化とする。archiveは参照なし確認後の誤登録・重複だけに限定し、reason/actor/timeを保存する。通常User向けrestore・物理delete UIは設けない。
- archiveはUser向けrecycle binではない。運営者はUser依頼に応じ監査付きで削除情報を確認でき、restoreは通常UIから隔離した緊急contingencyだけとする。active同IDがあればoverwriteせず拒否し、保持要件が決まるまで自動purgeしない。
- archiveのexact actor、input、transaction、versioned envelope、参照writer barrier、client非公開、idempotency、rollbackは[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)と[実装設計](customer-archive-safety.md)で確定した。追加lock collectionは作らず、archive documentをsame-ID tombstoneとして使う。Callable・監査・冪等性はCAS-02、Rules・参照writer barrier・関連testはCAS-03、Customer詳細UIとlocal画面受入れはCAS-04で完了し、CAS-05でDev反映・受入れ済みである。

- 取引状態の意味は[現行仕様](../specification.md#取引先現場取極め)を正とする。業務上の無効状態やlogical deleteと同一視しない。
- 状態変更は基本編集から提供する。archiveは専用Callableとwrite actor限定の確認画面経路を実装し、CAS-05でDev反映・受入れ済みである。archive一覧、restore・物理deleteの製品経路は提供しない。
- archive collectionのclient read/create/update/deleteはCAS-03 Rulesで全actorへ拒否し、CAS-05でDev反映・受入れ済みである。

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

- 他masterに残る汎用Air manager内部の全validation・表示実装。
- Site/Agreement/Billing/PDFの内部処理、Dev・実データ上の参照件数、保存形式検査で検出した不適合の具体的原因、必要なindex、archiveのDev反映・受入れ。専用local FunctionsはCustomer同期triggerをexportせず、mock隔離testとremote trigger実行を区別する。
- `contractStatus`を別画面・管理手段・データ移行で変更する運用。
