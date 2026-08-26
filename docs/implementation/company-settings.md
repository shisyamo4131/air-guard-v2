# Company（自社情報・会社設定）（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-027、SPEC-DEEP-039a
- 最終確認日: 2026-08-12
- 根拠ファイル: `pages/settings/company.vue`、`components/Company/Manager/index.vue`、`components/Company/Activator/Base.vue`、`components/Company/Activator/Bank.vue`、`components/Company/Activator/Setting.vue`、`stores/useCompanyStore.js`、`stores/useSystemStore.js`、`composables/application/auth/useAuthActions.js`、`composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js`、`composables/pdf/useBillingPdf.js`、`functions/apis/createAdminAccount.js`、`functions/modules/stripe.js`、`utils/pageSettings.js`、`firestore.rules`、schemas `src/Company.js`、`src/mixins/GeocodableMixin.js`

## 入口・権限

- `/settings/company`はpageSettingsで`ADMIN` access policyを参照する。一般pageの互換規則により会社管理者とsuper-userを許可し、navigationも同じpolicyを使用する。
- 画面は基本情報、口座情報、設定情報、会社既定取極めを編集する。CompanyManagerは作成と削除をUIで拒否し、更新だけを直接`Company.update()`へ渡す。
- Rulesは`Companies/{companyDocId}`の全read/writeを、claim companyIdがdoc IDと一致する認証Userまたはsuper-userへ許可する。admin、field ownership、delete制約はない。
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
- 更新にversion/preconditionはなく、設定画面・並び順・Stripe webhook等の同時更新はfield単位updateか全体updateの実装差により競合し得る。

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
- RulesはCompany rootのdeleteを禁止しない。同一会社Userによる直接deleteが可能で、subcollectionは自動cascadeされないため、tenant root欠損と子data残存が併存し得る。
- `maintenanceMode`は利用停止ではなくSystemStoreのmaintenance表示判定に使われるhidden fieldで、設定画面から編集できない。
- subscription終了はStripe側同期でsubscription内容をnull/employeeLimit 0へ更新する境界であり、Company削除やtenant停止は行わない。

## Rules・security

- 銀行口座、請求書番号、住所・電話は同一会社の全認証UserがRules上read/write可能である。
- hidden `stripeCustomerId/subscription/maintenance*`もRulesでserver-ownedに限定されず、clientが直接変更できる。
- Company delete、必須field除去、invalid enum/number、siteOrder/agreementsV2改変もRulesで検証しない。
- Company docは多くのsubcollectionと認証claimのanchorであり、通常masterより削除・改変影響が大きい。

## 矛盾・未使用候補

- admin限定画面と、同一会社User全write/delete Rulesが不一致。
- 基本情報editorは`fullAddress`構成fieldのうちaddressだけを含み、zipcode/prefCode/city/buildingを編集対象に含めない一方、`isCompleteRequiredFields`はそれらを要求する。
- `Company.scheduleOrder.add`はimportされていない`ScheduleOrder`をnewしており、呼出し時ReferenceErrorとなる実装である。配列customClassはSiteOrderなので命名不一致でもある。
- hidden server-owned候補fieldと利用者編集fieldが同一document/全write Rulesに混在する。
- Company旧`agreements` accessorは常に空/無処理で残存する。

## 将来要対応

- FUT-0090〜FUT-0094を`future-actions.md`へ登録した。

## 要確認事項

- CONF-0074〜CONF-0078を`pending-confirmations.md`へ登録した。

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
- Company停止・解約・法的保持・tenant移転の運用、super-user修復手順。
