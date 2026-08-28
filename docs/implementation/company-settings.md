# Company（自社情報・会社設定）（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-027、SPEC-DEEP-039a
- 最終確認日: 2026-08-27
- 根拠ファイル: `pages/settings/company.vue`、`components/Company/Manager/index.vue`、`components/Company/Activator/Base.vue`、`components/Company/Activator/Bank.vue`、`components/Company/Activator/Setting.vue`、`stores/useCompanyStore.js`、`stores/useSystemStore.js`、`composables/application/auth/useAuthActions.js`、`composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js`、`composables/pdf/useBillingPdf.js`、`functions/apis/createAdminAccount.js`、`functions/modules/stripe.js`、`utils/pageSettings.js`、`firestore.rules`、schemas `src/Company.js`、`src/mixins/GeocodableMixin.js`

## 入口・権限

- `/settings/company`はpageSettingsで`ADMIN` access policyを参照する。一般pageの互換規則により会社管理者とsuper-userを許可し、navigationも同じpolicyを使用する。
- 画面は基本情報、口座情報、設定情報、会社既定取極めを編集する。CompanyManagerは作成と削除をUIで拒否し、更新だけを直接`Company.update()`へ渡す。
- Rulesは`Companies/{companyDocId}`のread/updateを、claim companyId、Auth、同じtenantの有効な本登録Userが整合する場合に許可する。actor roleとfield ownershipの制約はない。client create/deleteは2026-08-27に拒否済みで、初期作成はFunctions/Admin SDKに限定した。
- UIのadmin制御は暫定入口で、server-side認可とは一致しない。

## データ契約

Companyはroot collection `Companies/{companyId}`に保存され、`usePrefix=false`、自動採番なし、logical deleteなしである。

| 分類 | fields・default・契約 |
|---|---|
| 会社名 | `companyName` required/最大20、`companyNameKana` required/最大40・カナ数値入力 |
| 住所・連絡 | `zipcode`、`prefCode`、`city`、`address`、`building`、`tel`、`fax`。初期作成時は任意 |
| 適格請求書 | `invoiceNumber`任意、最大13。画面/PDFが先頭に`T`を付ける |
| 振込先 | `bankName`最大20、`branchName`最大20、`accountType` default普通/普通・当座、`accountNumber`最大7、`accountHolder`最大50。すべてschema上は任意 |
| 既定取極め | `agreementsV2`（AgreementV2配列）。旧`agreements` getter/setterは警告して空配列/無処理 |
| 表示順 | hidden `siteOrder`、`scheduleOrder`（SiteOrder配列） |
| 位置 | hidden `location`。converterがlat/lngから`geopoint`を保存。`fullAddress`、`prefecture`は読み取り専用プロパティ |
| 運用設定 | `minuteInterval` default 15、UI min 1/max 30、`roundSetting` default ROUND、`firstDayOfWeek` default定数先頭、`attendanceManagementMode` default ACTUAL_DATE |
| Stripe | hidden `stripeCustomerId`、hidden `subscription`。defaultはid/status/currentPeriodEnd null、employeeLimit 10 |
| maintenance | hidden `maintenanceMode=false`、reason/startAt/startedBy null |

ゲッター`hasBankInfo`はbankName/branchName/accountNumber/accountHolderの全存在を判定し、accountTypeを条件に含めない。`isCompleteRequiredFields`は会社名・カナ・郵便番号・都道府県・市区町村・住所・電話の全存在を判定する。

## 作成・初期化

1. clientがFirebase Auth管理者accountを作成してverification emailを送る。
2. 認証済み`createAdminAccount`が会社名・カナ・表示名を検証する。
3. Firestore transactionでCompanyを自動doc IDで作成し、同じtransactionで`Companies/{companyId}/Users/{authUid}`をadmin Userとして作成する。
4. transaction後にAuth custom claimsへ`companyId`と`isSuperUser=false`を設定する。
5. login初期化時、claim companyIdをdoc IDとしてCompanyをfetchしlive購読する。

Company/User transactionとclaims設定はatomicではない。claims失敗時のpartial stateはSPEC-SEG-025のFUT-0081に記録済みである。

## 編集・validation

- 基本情報editorのincludedKeysは`companyName/companyNameKana/address/tel/fax/invoiceNumber`だけで、`zipcode/prefCode/city/building`を含まない。画面は`fullAddress`を表示するが、この入口から住所構成field全部を編集できない。
- 口座editorは5口座field、設定editorは4運用設定fieldだけを編集する。
- 既定取極めはAgreementsManagerが`agreementsV2`を変更し、完了時にCompany全体をupdateする。
- schemaのminuteInterval min/maxはcomponent attrsであり、Rulesは範囲を検証しない。他のenum、invoiceNumber、口座番号もRules/serverで形を強制しない。
- 住所変更時GeocodableMixinはgeocodeを試みる。関数未設定・失敗・座標欠損では例外を伝播せずlocationをnullにしてCompany更新を継続する。
- 更新にversion/preconditionはない。Company設定、取極め、表示順は`Company.update()`からdocument全体setへ進むため、古い画面が別機能やStripe/maintenanceの更新を上書きし得る。hydrate対象外の未知fieldは再保存時に失われる可能性もある。

## tenant identity

- Company doc IDがtenant IDで、Auth custom claim `companyId`、User.companyId、全subcollection prefixの基準となる。
- Company schema自身にcompanyId fieldはなく、identityはdoc path/docIdで表現する。
- clientはclaim companyIdのCompanyだけを取得・購読する。Rulesもroot Company doc IDとの一致をtenant境界にする。
- doc ID変更・tenant移転・会社統合・分割の実装経路はない。

## 下流参照・変更影響

- 請求書PDFは生成時に`companyStore.company`をlive参照し、会社名、住所、電話、invoiceNumber、振込先を帳票へ載せる。BillingへのCompany snapshotはこの経路で使用しないため、設定変更後の再生成は新しいCompany値になる。
- `roundSetting`は売上・税の端数設定として参照される境界、`attendanceManagementMode`と`firstDayOfWeek`は勤怠表示・定数導出の境界を持つ。
- `siteOrder/scheduleOrder`は配置・予定表示順にlive利用され、専用actionがCompanyをupdateする。
- `maintenanceMode`はSystem全体maintenanceとのORで現在会社のmaintenance判定にlive反映される。
- `subscription`からCompanyStoreの`customerType`を導出し、Stripe checkout画面がstatus/employeeLimit/currentPeriodEndを表示する。Stripe webhookがsubscriptionを更新し、checkout作成がstripeCustomerIdを更新する。
- Arrangement PDFはCompany storeを参照するが、具体的なfield mappingは本セグメントでは追跡していない。

## 停止・削除

- Company固有のstatus、停止、archive、delete guard、restore methodはない。
- UI CompanyManagerはcreate/deleteを拒否する。
- RulesはCompany rootのclient deleteを拒否する。server/operatorによる停止・decommission・repairとsubcollection保持は未確定であり、root欠損と子data残存の既存・部分失敗状態を検知・修復する契約もない。
- `maintenanceMode`は利用停止ではなくSystemStoreのmaintenance表示判定に使われるhidden fieldで、設定画面から編集できない。
- subscription終了はStripe側同期でsubscription内容をnull/employeeLimit 0へ更新する境界であり、Company削除やtenant停止は行わない。

## Rules・security

- 銀行口座、請求書番号、住所・電話は同一会社の有効な本登録User全員がRules上read/write可能である。
- hidden `stripeCustomerId/subscription/maintenance*`もRulesでserver-ownedに限定されず、clientがroot updateの一部として直接変更できる。
- Company create/deleteはclient拒否済みだが、必須field除去、invalid enum/number、siteOrder/agreementsV2改変をRulesで検証しない。
- Company docは多くのsubcollectionと認証claimのanchorであり、通常masterより削除・改変影響が大きい。

## 矛盾・未使用候補

- admin限定画面と、同一会社の有効な本登録User全員に対するroot全field update許可が不一致。
- 基本情報editorは`fullAddress`構成fieldのうちaddressだけを含み、zipcode/prefCode/city/buildingを編集対象に含めない一方、`isCompleteRequiredFields`はそれらを要求する。
- `Company.scheduleOrder.add`はimportされていない`ScheduleOrder`をnewしており、呼出し時ReferenceErrorとなる実装である。配列customClassはSiteOrderなので命名不一致でもある。
- hidden server-owned候補fieldと利用者編集fieldが同一document/全write Rulesに混在する。
- Company旧`agreements` accessorは常に空/無処理で残存する。

## 2026-08-27 横断再調査

- Company documentは会社プロフィールだけでなく、請求元・口座、丸め・勤怠方式、取極め、Site/Schedule表示順、maintenance、Stripe/subscription、tenant初期化を共有する。確認済みの現在影響は本実装調査、改修順と進捗は[Company設定改修ロードマップ](../roadmaps/company-settings.md)を参照する。
- 請求PDFはlive Company情報を参照し、`roundSetting`はprocess-global設定へ反映されるため、設定変更後の過去帳票・計算結果の再現性を保証できない。
- `attendanceManagementMode`は参照する勤怠data経路を切り替えるが、既存data migration、preview、発効時点は確認できない。`minuteInterval`と`firstDayOfWeek`は主にUI表示・選択肢へ作用する。
- `siteOrder`と`scheduleOrder`は配置・予定画面に利用される。専用write permission、revision、参照切れ修復はない。Company既定`agreementsV2`は設定入口を確認したが、Site取極めへfallbackする実consumerを静的調査で確認できず、manual記述と一致しない。
- maintenanceはclient routeの抑止であり排他lockではない。Admin SDKの`maintenanceStartedAt`等とCompany schemaのfield名にも差がある。
- Stripe moduleは現行Functions entryで公開停止中だが、同じrootにあるsubscription fieldはclient update/read可能である。再有効化前にserver ownership、price/origin allowlist、冪等性、event順序、tenant mapping、Employee上限強制が必要である。
- Firestore Rulesはdocument内のfieldをread時に隠せない。銀行、Stripe、maintenance等の閲覧者を狭める場合、subdocument分割またはserver projectionが必要になる。

## 2026-08-28 承認済みCCB目標（未実装）

以下は実装事実ではなく、[ADR 0025](../decisions/0025-company-configuration-boundary.md)と[現行仕様](../specification.md#company設定とtenant-lifecycle)へ確定した目標契約である。

- 改修コードを`CCB`とし、rootはserver-controlledの最小tenant anchor、設定は`Settings/profile`、`billing`、`operations`、`arrangement`へ分割する。entitlement/maintenanceはclient-safe `Settings` projectionとserver-only `PrivateSettings`を分け、collection数抑制は制約としない。
- profile/billing/operationsは会社管理者write、profile/billingは同社の有効な本登録User read、arrangementは配置・予定の既存permission actor writeとする。rootとclient-safe `Settings/entitlement`・`Settings/maintenance`はserver/providerだけがwriteし、必要なprojectionを同社Userがreadする。`PrivateSettings/entitlement`・`PrivateSettings/maintenance`はclient read/write不可とする。super-userはCompany設定actorに含めない。
- profile/billing/operationsはrevisionとmasked append-only auditを持つ。auditは会社管理者専用Callableだけで閲覧し、理由を必須にしない。arrangementは履歴なしの現在値・revisionとする。
- 会社名100文字、カナ200文字、invoice 13数字保存、完全入力時だけ有効なbank、signupと請求確定の別必須条件、長値を切り捨てない帳票を採用する。
- `attendanceManagementMode`は`attendanceSummaryMode`の`LABOR_STANDARD`/`OPERATION_COUNT`へ置換し、両projectionを常時生成して表示・navigationだけを切り替える。`roundSetting`はOperationResult作成時、issuer情報は請求確定時にsnapshotする。
- `agreementsV2`とCompany geocodingは廃止予定で、既存fieldの削除は別migrationとする。Site既定取極めはCustomer側の後続設計へ移す。
- lifecycleは`ACTIVE`/`SUSPENDED`/`CLOSED`とし、rootを通常削除しない。Company maintenanceは[project-wide quiet procedure](../runbooks/maintenance-and-data-change.md)へ接続する。
- Stripe本体とemployeeLimit実強制は正式release直前の別改修へ延期し、CCBはserver-owned entitlement隔離だけを行う。

現行code、Rules、Schemas、Admin SDK、実dataは上記へ未移行であり、CCB-02以降でDev edition、fixture、全caller、exact schema、互換reader、migration mappingを再確認する。

## 将来要対応

- FUT-0090〜FUT-0094を`future-actions.md`へ登録した。CCBの確定契約はFUT本文より現行仕様とADR 0025を優先する。

## 要確認事項

- CONF-0074〜CONF-0078は2026-08-28に回答済みである。maintenanceのCONF-0079〜0082も回答済み、StripeのCONF-0083〜0087は正式release直前まで明示保留とした。

## 未確認範囲

### SPEC-DEEP-020 addendum

- CompanyManager only type-checks `doc` as object, delegates update to `item.update(item)`, and relies on AirItemManager for loading/error/dirty/double-submit behavior. The three icon edit activators add no role/loading/disabled guard.
- Active Activators expose distinct included-key lists; hidden Company integration fields are not editor keys but remain in the same broadly writable document. The three legacy `Company/Table/*Info.vue` files have no static caller.
- SettingInfo's weekday display directly dereferences an indexed constant and has no unknown fallback, unlike the active Setting activator. Full component-level evidence is in [Company components deep review](company-components-deep-review.md).

### SPEC-DEEP-039a addendum

- company pluginはCompany変更ごとにVuetifyのprocess-global defaultsとschema `RoundSetting` global modeを直接更新する。`minuteInterval`が0/null/falsyなら全minuteを許し、負数・小数・NaNのfail-closed validationはない。これはpicker候補制御であって保存値・計算丸めの強制ではない。
- user pluginもAuth UserのtagSizeからVuetify global defaultsを更新する。logout/account切替時にdefaultへ明示resetするbranchはなく、次Userがtruthyな既知値を持たない場合は以前のsizeが残り得る。
- `useConstants`はCompany colorDefinitionsをlive computedへ反映するが、空文字colorは`||`でdefaultへ戻す。`DEFAULT_DEFINITIONS`とWEEK_COLORSを参照のまま公開し、callerによるprocess内mutationを防がない。enum allowlistやpersisted value validationは別途必要である。

- 実Company/Stripe/subscriptionデータ、外部geocoding、Rules/Emulator、同時更新の再現。
- Subscription/Stripe/Billing/税計算、PDF layout、maintenance middlewareの内部。
- Company停止・解約・法的保持・tenant移転の現行運用、provider repairのexact手順。
