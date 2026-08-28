# CCB-02 Company data・package互換性調査

## メタデータ

- 状態: In progress（repository静的調査・技術契約確認完了、Dev実data照合は未完了）
- 改修コード: CCB（Company Configuration Boundary）
- 調査日: 2026-08-28
- 調査基準commit: `df31d311e9973384cbdb602729c9a8b542b6fc68`
- 現行仕様: [Company設定とtenant lifecycle](../specification.md#company設定とtenant-lifecycle)
- 主要判断: [ADR 0025](../decisions/0025-company-configuration-boundary.md)
- ロードマップ: [Company設定改修ロードマップ](../roadmaps/company-settings.md)
- 調査方法: client、Functions/Admin SDK、Firestore Rules/fixture、関連packageの4系統を独立したread-only調査として実施した。

この文書は実装事実と互換性を記録する。承認済み仕様の正本ではない。「承認済み技術契約」は2026-08-28に利用者が確認し、現行仕様・ADR・ロードマップへ反映した。

## 結論

CCBの新documentを現在のRules下で先に作成してはならない。`firestore.rules`のgeneric fallbackは、明示的な除外がない`Settings`、`PrivateSettings`、`SettingAudits`にも一致し、同じ会社の有効な本登録Userへ再帰read/writeを許可する。Firestore Rulesは複数matchのallowをOR評価するため、狭い個別matchを追加するだけではfallback allowを打ち消せない。

Company rootへ`status`や`schemaVersion`だけを先に追加することも安全ではない。現行Company modelは定義済みfieldだけをhydrateし、client/server adapterの`update()`はmodel全体を`transaction.set()`する。旧clientまたは旧Functionsが保存すると、未知のserver-owned fieldを落としてroot全体を置換する。

したがって、CCBは次の順序を崩せない。

1. additiveな共通schemaと旧新compatible readerを準備する。
2. Admin SDKのbackup・restore・maintenance・collection catalogを新pathへ対応させる。
3. Functionsの新規Company作成、operation別writer、tenant gateを未有効のまま準備する。
4. generic Rules fallbackから新pathを除外し、Settings、PrivateSettings、auditを全client denyにするpre-containment Rulesを先にdeployする。rootの旧updateはこの時点では維持する。
5. client deploy前に、Dev edition、deploy済みFunctions、operator tool、rootのfield名・`schemaVersion`・activation marker分布を値・秘密を出さないbounded read-only dry-runで確認する。
6. 新規Companyもrootをlegacy modeのまま作ってSettingsをstagingできるFunctionsと、専用activation marker未設定時はlegacy root、設定後はSettingsだけを読むcompatible clientをdeployする。
7. [maintenance・data change runbook](../runbooks/maintenance-and-data-change.md)に従い、maintenance開始、bounded quiet period、対象Function log確認、連続dry-run digest一致、整合snapshot/backup、create-only apply、同一dry-runとpost-checkを行う。
8. cutoverでは最終Rules・Functions・clientを有効化し、root client updateを拒否する。deploy済みFunctions、operator、Admin SDKを含む旧whole-document writerが0件である証拠を得た後にだけroot activation markerを設定する。
9. activation後もroot marker、Settings parity、拒否経路、旧writer 0件を再確認してからmaintenanceを解除する。

## 現行data shape

現行`@shisyamo4131/air-guard-v2-schemas` `2.4.2-dev.166`のCompanyは`Companies/{companyId}`一件へ次を保存する。

| 分類 | 現行field・default |
|---|---|
| profile | `companyName`、`companyNameKana`、`zipcode`、`prefCode`、`city`、`address`、`building`、`tel`、`fax`。任意値の多くは`null`。 |
| billing | `invoiceNumber`、`bankName`、`branchName`、`accountType`、`accountNumber`、`accountHolder`。`accountType`は`普通`。 |
| legacy・arrangement | `agreementsV2=[]`、`siteOrder=[]`、`scheduleOrder=[]`、`location=null`。order itemは`siteId`と`shiftType`を持つ。 |
| operations | `minuteInterval=15`、`roundSetting=ROUND`、`firstDayOfWeek=0`、`attendanceManagementMode=ACTUAL_DATE`。 |
| Stripe | `stripeCustomerId=null`、`subscription={id:null,status:null,currentPeriodEnd:null,employeeLimit:10}`。 |
| maintenance | `maintenanceMode=false`、`maintenanceReason=null`、`maintenanceStartAt=null`、`maintenanceStartedBy=null`。 |
| framework metadata | `docId`、`uid`、`createdAt`、`updatedAt`。computed accessorもenumerableで、`fullAddress`、`prefecture`、`hasBankInfo`、`isCompleteRequiredFields`がserializerへ混入し得る。geocoding converterは`geopoint`も生成する。 |

Company hydrateは未知fieldを捨て、serializerはenumerable own propertyを出力する。型、enum、unknown key、`minuteInterval`の整数・有限・範囲をschemaが厳格検査せず、現行の1〜30はUI属性に留まる。

## caller inventory

### client

- Company rootの取得と購読は`composables/application/auth/useAuthActions.js`の各1経路である。claimのcompany IDをdoc IDとして直接fetchし、singletonの`useCompanyStore`へlive反映する。
- profile、billing、operationsは`components/Company/Manager/index.vue`からCompany全体を保存する。
- Company既定取極めは`pages/settings/company.vue`、site/schedule orderは`useSiteShiftTypeOrderActions.js`からCompany全体を保存する。
- `useSiteOrderManager.js`にも旧siteOrder writerが4経路残るが、静的callerは確認できない。
- Company rootのclient create/list/delete/restoreの実callerはない。create/deleteはUIとapp subclassでも拒否している。
- 請求PDFはlive Companyの住所、名称、電話、invoice、bankを読む。`prefName`参照はCompanyの`prefecture` accessorと一致せず、issuer snapshotと長値renderは未実装である。
- `roundSetting`はprocess-globalなRoundSettingへ即時反映され、OperationResult、税計算、PDFへ到達する。既存結果のsnapshotはない。
- `attendanceManagementMode`は`ACTUAL_DATE`ならDailyAttendance、`OPERATION_DATE`ならDailyOperationsByEmployeeを表示する。両projectionの常時生成はclient callerだけでは証明できない。
- `minuteInterval`と`firstDayOfWeek`はprocess-global UI defaultへ反映される。account切替・未知値のfail-closedは未実装である。
- `subscription`はcustomer typeとcheckout表示、`maintenanceMode`はSystem maintenanceとのOR表示へ使われる。
- Company `agreementsV2`のSite側fallback consumerとCompany `location`の直接consumerは確認できない。geocodingはCompany保存時の暗黙side effectとして残る。

### Functions・operator

- `createAdminAccount`はCompany、初期User、email予約を同一Firestore transactionで作成し、commit後にAuth claimsを設定する。現行Company root全体を作るが、root status、Settings、PrivateSettingsは作らない。retryはrootの会社名・カナへ依存する。
- 公開Callableの共通identity resolverはcurrent Authとtokenを検査するが、Company rootの存在、ACTIVE/SUSPENDED/CLOSED、maintenanceを検査しない。
- scheduled、trigger、notification、derived sync、lifecycle reconcilerはCompany status・maintenance gateを持たない。maintenance中に継続すべきsecurity cleanupと、停止すべき通常business処理のmatrixも未実装である。
- Stripe moduleはproduction entryからexportされていない。sourceはrootの`stripeCustomerId`と`subscription`を更新するが、外部Customer作成、Company更新、Checkout Session作成がatomicではなく、idempotency・event順序・Company field名にも問題がある。CCBで再公開しない。
- 未公開geopoint migrationはCompany modelの全体updateを行うため、CCB後に使用するとunknown/server fieldを失い得る。
- Admin SDKはrootの会社名とmaintenance fieldを直接読み書きする。schemaの`maintenanceStartAt`に対してCLIは`maintenanceStartedAt`を使う。
- Admin SDKのbackup・restore・delete catalogには`Settings`、`PrivateSettings`、`SettingAudits`だけでなく既存nested collectionの一部も含まれない。CCB migration前に少なくとも新3 collectionとnested auditを再帰的・検証可能に扱う必要がある。

## Firestore Rulesとfixture

- root Companyは同社の有効な本登録Userならrole、field、schemaに関係なくupdateできる。client create/deleteだけが拒否済みである。
- `hasActiveRegisteredUser()`はCompany rootの存在とstatusを確認しない。root欠損でもUser subdocumentが残ればgeneric fallback経由のdescendant accessが成立し得る。
- profile/billing/operationsへappend-only auditを必須にする場合、client direct updateと非同期triggerでは設定更新とauditをatomicにできない。
- 現行合成seedはCompany root 2件を作るが、各rootは会社名、カナ、fixture markerだけである。schema default、legacy、unknown field、Settings、PrivateSettings、audit、migration conflictをfixtureしていない。
- 利用者用`saved-data`とbinary export bodyは調査対象にせず、値を読んでいない。Dev editionとDev Company実data分布もremote未接続のため未確認である。

## package互換性

| consumer | 現行実解決 |
|---|---|
| root app | air-firebase `2.3.1-dev.6`、client adapter `2.1.3-dev.10`、schemas exact `2.4.2-dev.166` |
| Functions | air-firebase `2.3.1-dev.6`、server adapter `2.2.1-dev.3`、schemas exact `2.4.2-dev.166` |
| Admin SDK | schemas `2.4.2-dev.162`。app/Functionsより古く、Companyに`attendanceManagementMode`がない。 |

推奨するpackage境界は次である。

- schemasへ旧Companyを維持したまま、CompanyRoot、各Settings、PrivateSettings、SettingAudit、legacy mappingの純粋なexact parser/normalizer/serializerをadditive exportする。
- AirFirebase base/client/server adapterは変更せず、CCBの高risk writeはAirGuardV2のoperation別transactionとAdmin SDKのraw Firestoreで明示的に行う。汎用FireModelへrevisionやpatchを追加して影響範囲を広げない。
- app、Functions、Admin SDKは同一の承認済みexact schemas versionへ揃える。range、古いAdmin SDK、local duplicate schemaを正本にしない。
- Admin SDK側の変更、schemas release・tag・publish、consumer installは別repository・外部作用であり、個別の利用者承認を必要とする。

## 承認済み技術契約

### 1. Company設定write方式

Company設定だけについて、次の4つの専用Callableを設け、clientのSettings create/update/deleteを拒否する。

- `updateCompanyProfile`
- `updateCompanyBilling`
- `updateCompanyOperations`
- `updateCompanyArrangement`

各Callableはcurrent Auth、claim、同社User、actor、Company ACTIVE、maintenance、exact input、expected revisionをtransaction内で再検査する。profile/billing/operationsは設定更新とmask済みaudit createを同一transactionに含める。arrangementはauditを作らず、siteOrderとscheduleOrderを変更field別permissionで検査する。

これは全collectionのCUDをFunctionsへ移す共通規則ではない。Company設定はaudit atomicity、list item検証、root/private containmentが同時に必要なための機能限定判断であり、Customer、Site、Employee、Outsourcerは各改修で改めて判断する。

確定actorは、profile/billing/operationsが会社管理者、siteOrderが`sites:write`、scheduleOrderが`site-operation-schedules:write`である。manager/controller/legal等のrole名を直接判定せず、既知presetから得たpermissionを使う。super-userと直接permission文字列をstrict actorへ含めない。

### 2. exact document共通規則

- rootと全documentの`schemaVersion`初期値をinteger `1`とする。clientの正本切替は`schemaVersion`単独で判定せず、既存値との衝突を事前dry-runした専用marker `configurationState=CCB_V1_ACTIVE`との両方が一致した場合だけ行う。
- client/providerが更新する設定は`revision`をinteger `1`から開始し、成功ごとにexactly `+1`する。
- `createdAt`、`createdBy`、`updatedAt`、`updatedBy`をserverが設定する。optional fieldは欠損とnullを混在させず、初期documentへ明示的な`null`または空配列を保存する。
- unknown field、computed accessor、frameworkの`docId/uid`、converterの`geopoint`をcanonical Settingsへ保存しない。
- pre-containment Rulesのdeploy後、新規signupはroot、profile、billing、operations、arrangement、entitlement projection、maintenance projection、両PrivateSettingsをUser・email予約と同じtransactionで作る。global cutoverまではrootをlegacy modeのまま維持する。既存tenantのbackfillも同じcomplete setをcreate-onlyで準備し、一部documentだけ存在する状態を成功扱いしない。
- `ACTUAL_DATE`は`LABOR_STANDARD`、`OPERATION_DATE`は`OPERATION_COUNT`へ決定的に写像する。欠損時だけ`LABOR_STANDARD`を補う。未知値は自動変換せずmigration conflictとする。
- legacy `agreementsV2`、`location/geopoint`、root subscription/maintenance、unknown fieldは初回migrationで削除しない。新Settingsへ必要値を写した後もcleanupは別承認migrationまでrootへ保持する。

### 3. cutoverとrollback

- compatible clientはrootの`schemaVersion=1`と`configurationState=CCB_V1_ACTIVE`の両方が一致しない間だけlegacy rootを読み、両方が一致した後はcompleteなSettings setだけを読む。client deploy前に全対象rootの同名field分布を確認する。個別document欠損、version不一致、invalid shapeをlegacyへsilent fallbackせずfail closedとする。
- create-only backfillはSettings/PrivateSettingsの不存在時createだけを許可し、既存targetのupdate/deleteとroot cleanupを行わない。分類は`eligibleCreate`、`alreadyEquivalent`、`targetConflict`、`invalidSource`、`unknownFieldReview`、`ambiguousMapping`、`rootMissingOrOrphan`、`editionUnverified`等に分ける。
- backfill中はrootをlegacy正本のまま維持する。全tenant parityが整ったmaintenance cutoverで最終Rules、Functions、clientを有効化し、root client updateを拒否する。remote Functions、operator、Admin SDKを含む旧whole-document writer 0件を確認してから、root schemaとactivation markerを最後に設定する。
- cutover後のrollback先は、旧whole-document writerではなく、Settingsを読めて新writeを停止できる既知のcompatible releaseとする。新Settingsやlegacy rootを推測削除せず、schemaVersionを戻さない。data apply後の旧client復帰が必要なら、Settingsからrootへの明示reverse planを別repairとして承認する。

## 未確認事項・完了条件

CCB-02は次が完了するまで10点を加点しない。

- root、各Settings、PrivateSettings、auditの完全なfield allowlist、型、長さ、enum、相関、Timestamp、mask形式の確定。
- Dev Firestore editionのremote再確認と、秘密・値を応答へ出さないbounded data-shape dry-run。
- Dev Companyごとのlegacy、unknown、旧enum、partial field、subscription/maintenance、target conflict件数とplan digestの確認。
- schemas/Admin SDKの変更範囲、version、publish/install/deploy順、backup/restore互換、rollback releaseの個別承認。
- generic Rules fallbackを先に閉じるreleaseと、全client/Functions/Admin SDK callerの回帰matrix確定。

## 2026-08-28 Dev read-only preflight

- checkpoint: `CCB-02-DEV-SHAPE-001`
- target: `air-guard-v2-dev`、Firestore `(default)`
- approved read: edition、deploy済みFunctions、operator tool、Company rootのfield名・型・分類件数・digest。値、company ID、個人情報、Stripe識別子、credentialは出力しない。
- local preflight: Node `v22.23.2`、Firebase CLI `15.28.1`、primary-only repository、HEAD `0eaca09e60f413c5a53f2156cb33c66f8282ec2e`、cleanを確認した。
- remote result: `npx -y firebase-tools@latest firestore:databases:list --project air-guard-v2-dev --json`は、Firebase CLI credential失効を理由にexit 1。remote認証attemptは発生したがdatabase APIへ到達せず、Firestore document read 0、data write 0で停止した。
- boundary: 別credential、gcloud、service account、Admin SDKへ迂回しない。Firebase CLI再認証後、同じ最初のcommandから再開する。

## 実施していないこと

- application code、Rules、test、fixture、package、Admin SDK、正本仕様の変更
- test、validator、build、Emulator、application/server/browser起動
- database API成功、Firestore document read、Dev実data取得、deploy、migration、backup、restore。networkはFirebase CLI認証失敗までのremote attemptだけを実施した。
- Git mutation
