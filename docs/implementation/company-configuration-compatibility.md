# CCB-02 Company data・package互換性調査

## メタデータ

- 状態: In progress（repository静的調査・技術契約・Dev read-only data-shape照合・exact schema v1確定、local package/Admin/parity設計案作成済み。Schemas契約は別project taskへ移管済み。staging actor/backup/audit/delete境界、Dev残存2 tenantの用途とmigration対象性は未確定）
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
4. generic Rules fallbackから新pathを除外し、Settings、PrivateSettings、auditを全client denyにするpre-containment Rulesを先にdeployする。rootの旧business field updateはこの時点では維持する。clientによる新規CCB field `status/schemaVersion/configurationState/createdBy/updatedBy`の追加・変更・削除と既存`createdAt`の変更は拒否するが、現行adapterがCompany保存ごとに変更するlegacy `updatedAt`はcutoverまで許容する。
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
- 利用者用`saved-data`とbinary export bodyは調査対象にせず、値を読んでいない。Devの現在分布は後述のbounded read-only preflightで、会社ID・値・個人情報を出力せず集計した。

## package互換性

| consumer | 現行実解決 |
|---|---|
| root app | air-firebase `2.3.1-dev.6`、client adapter `2.1.3-dev.10`、schemas exact `2.4.2-dev.166` |
| Functions | air-firebase `2.3.1-dev.6`、server adapter `2.2.1-dev.3`、schemas exact `2.4.2-dev.166` |
| Admin SDK | schemas `2.4.2-dev.162`。app/Functionsより古く、Companyに`attendanceManagementMode`がない。 |

2026-08-28のoperator tool再確認では、関連repository `air-guard-v2-admin-sdk`はbranch `codex/is-super-user-claim-migration`、HEAD `1be81f6745e0033093bb84988194358d0a85a71f`、clean、package `1.0.0`、lockfile解決schemas `2.4.2-dev.162`だった。Company maintenanceはrootへのfield update、会社削除は固定catalogのsubcollectionとroot deleteであり、`Settings`、`PrivateSettings`、`SettingAudits`をcatalogに含まない。Company root全体のset writerではないが、CCB後のpath・field・backup/delete contractへ未対応なのでactivation前の更新対象である。

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

### 3. exact schema v1

2026-08-28にroot、6 Settings、2 PrivateSettings、SettingAuditsの完全field allowlist、型、文字数、enum、相関、default、Timestamp、maskを承認した。詳細の正本は[ADR 0025のExact schema v1](../decisions/0025-company-configuration-boundary.md#exact-schema-v1)と[現行仕様](../specification.md#company設定とtenant-lifecycle)である。互換実装では特に次をpackage・fixture・migrationへ同一に写す。

- 文字数はUnicode Extended Grapheme Cluster単位とし、結合文字で表した`が`も1文字と数える。trim以外のUnicode正規化を保存時に自動適用しない。
- `minuteInterval`はinteger `5/10/15/20/25/30`だけを許可する。現行UIの1〜30連続範囲を互換仕様へ持ち込まない。
- 空の振込先は`accountType`を含む5 fieldすべてnullにする。現行default `普通`を空口座へ残さない。
- arrangement itemはexact `{siteId,shiftType}`でcomputed `key`を除外し、各配列最大2000件、組合せ一意とする。1 callはsite/scheduleの一方だけを変更する。
- entitlement v1はdisabled/nullだけ、maintenanceはpublic/privateの相関を検査し、auditのbank非null値はliteral `***`へ置換する。
- canonical rootはcleanup後にreserved 7 field exactとする。activation期間はreserved 7 field必須かつ既知legacy extras一時許容とし、readerはreserved projectionだけを検査する。legacy extrasをactivation時に削除しない。

### 4. cutoverとrollback

- compatible clientはrootの`schemaVersion=1`と`configurationState=CCB_V1_ACTIVE`の両方が一致しない間だけlegacy rootを読み、両方が一致した後はcompleteなSettings setだけを読む。client deploy前に全対象rootの同名field分布を確認する。個別document欠損、version不一致、invalid shapeをlegacyへsilent fallbackせずfail closedとする。
- create-only backfillはSettings/PrivateSettingsの不存在時createだけを許可し、既存targetのupdate/deleteとroot cleanupを行わない。分類は`eligibleCreate`、`alreadyEquivalent`、`targetConflict`、`invalidSource`、`unknownFieldReview`、`ambiguousMapping`、`rootMissingOrOrphan`、`editionUnverified`等に分ける。
- backfill中はrootをlegacy正本のまま維持する。全tenant parityが整ったmaintenance cutoverで最終Rules、Functions、clientを有効化し、root client updateを拒否する。remote Functions、operator、Admin SDKを含む旧whole-document writer 0件を確認してから、root schemaとactivation markerを最後に設定する。
- cutover後のrollback先は、旧whole-document writerではなく、Settingsを読めて新writeを停止できる既知のcompatible releaseとする。新Settingsやlegacy rootを推測削除せず、schemaVersionを戻さない。data apply後の旧client復帰が必要なら、Settingsからrootへの明示reverse planを別repairとして承認する。

## 2026-08-28 package・Admin SDK follow-up

AirGuardV2、schemas、Admin SDKを3系統のread-only調査として再照合した。以下は確認済みの実装事実であり、関連repositoryの変更・公開承認ではない。

Schemasの管理はAirGuardV2 repositoryではなく別project `AirGuardV2Schemas`が担う。2026-08-28、利用者指示により既存task `PM（Schemas）-02`（task `01a03be0-539a-79f2-921b-311c85e135ce`）へcheckpoint `CCB-SCHEMAS-CONTRACT-001`を1回送達した。Schemas側は自身のgovernanceと正本に従い、additive `./company-configuration`契約とrelease guardを検討・実装する。version確定、tag、push、publish、consumer install、deployは移管checkpointに含めず、別承認とした。AirGuardV2 taskはSchemas repositoryを直接編集しない。

| 対象 | 確認済み状態 | CCB blocker |
|---|---|---|
| schemas | `main`、HEAD `3310dfe8c754a8d5840e486f95688d02fe4daf67`、clean、package `2.4.2-dev.166`。CCB model/exportなし。tag push workflowは`npm ci`後にtest・tag/version照合・package内容検査なしで直ちにpublishする。 | additive exact schemaとrelease gateが必要。次候補は現行慣行上`2.4.2-dev.167`だが、registry未使用確認と採用承認は未実施。 |
| AirGuardV2 app/Functions | root・Functionsともschemas exact `2.4.2-dev.166`。 | 新CCB exportを使う同一exact versionへ揃え、client/Functions別に導入検証する必要がある。 |
| Admin SDK | branch `codex/is-super-user-claim-migration`、HEAD `1be81f6745e0033093bb84988194358d0a85a71f`、clean。schemas range `^2.4.2-dev.162`、lock `.162`。 | exact version不一致、新path未対応、compatible rollback artifact不在。 |

Admin SDKの固定flat catalogは`Settings`、`PrivateSettings`、`SettingAudits`と他の未知nested pathを発見しない。現行の完全restoreは固定catalogを削除してrootをwhole-document `set`し、Auth失敗を警告だけで継続できる。selective/diff restoreはgeneric merge、Company deleteはAuthと固定catalogを部分削除し得る。これらはcanonical root、append-only audit、PrivateSettings、fail-closed契約と両立しない。さらにpublic classのrestore引数と実装signature、READMEの「全collection」説明にも不一致がある。CCB document作成前に、旧toolのdestructive restore/deleteをCCB tenantへfail closedにし、backup formatと実API説明を一致させる必要がある。

### 推奨package・consumer導入順（承認待ち）

1. schemasへ旧`Company`とroot exportを変更せず、pureな`./company-configuration` subpathとしてv1 constants、strict parser/normalizer/serializer、legacy mapping、audit maskをadditive追加する。AirFirebase adapterとFirebase SDK class identityへ依存させない。
2. schemasのtargeted testでstrict allowlist、全field制約、grapheme、結合濁点、Timestamp structural boundary、legacy mapping、audit mask、旧`Company`回帰を固定する。publish workflowへtag/version一致、targeted test、public self-import、package file検査を加え、成功前にpublishしない。
3. 承認済みimmutable prereleaseをtag/publishし、workflow、registry version、integrity、fresh public importを確認する。tag pushがpublishをtriggerするため、tag作成、push、Trusted Publishingは明示承認後だけ行う。
4. Admin SDKを同じexact versionへpinし、marker-aware reader、catalog inventory、version付きbackup manifest、CCB destructive operation拒否、maintenance compatible path、testと説明を先に整える。新CCB documentはこのtoolが安全になるまで作らない。
5. AirGuardV2 rootとFunctionsを同じexact versionへpinし、compatible readerと未有効writerを検証する。その後にだけpre-containment Rules、complete-set staging、final cutoverへ進む。

publish済みpackageをunpublishせず、未採用ならconsumerを旧exact versionに留める。採用後・activation前のconsumer rollbackは各consumerの既知versionとlock/integrityを戻してtestする。activationまたはdata apply後はpackage downgradeだけをdata rollbackとみなさず、Settings対応済みreleaseへ戻す。Admin SDKの現行`.162`はSettingsを読めないため、CCB cutover後のrollback artifactにはできない。

## canonical parity plan案（承認待ち）

### 対象と分類

- candidate universeは、外部保管する承認済みtarget manifest、Company root、既存CCB target pathのunionとする。manifestは全観測rootをinclude/exclude理由付きで分類し、company ID、会社名、個人情報をrepository・stdout・応答へ出さない。未分類root、manifest不一致、orphan targetはglobal blockerとする。
- tenantのprimary classificationは順に`editionUnverified`、`rootMissingOrOrphan`、`targetConflict`、`unknownFieldReview`、`invalidSource`、`ambiguousMapping`、`alreadyEquivalent`、`eligibleCreate`とする。先行classを優先し、全finding codeと件数を別に保持する。1〜6が1件でもあればapply全体をwrite 0で停止する。
- `alreadyEquivalent`は8 target documentがcomplete、exact、revision 1、valid metadata、source mappingとbusiness parityを持ち、unexpected audit・pathがない場合だけとする。partial setを残りcreateで自動修復しない。`eligibleCreate`はmarker未active、sourceが決定的にmapでき、8 targetとauditがすべて不存在の場合だけとする。

### mapping・digest・write契約

- exact mappingはADR 0025を再実装せずschemas packageのpure mappingを使う。legacy `ACTUAL_DATE/OPERATION_DATE`だけを承認済みenumへ写し、unknownは停止する。空bankは`accountType`を含め全null、active legacy maintenanceからprivate scope等を決められなければ`ambiguousMapping`とする。Stripe・legacy employeeLimitをentitlementへ昇格しない。
- migration metadataのactorはcheckpointで固定した1〜128文字のnon-email opaque provider IDとし、timestampはserver-set sentinelとしてplanへ含める。個別値、path、company ID、per-subject hashを出力しない。
- plan digestはdomain separator `airguard:ccb-v1:create-only-plan:v1`と、project、database、edition、fixed commit、schema version、schema contract version、deployed pre-containment rules receipt digest、target manifest digest、全tenantのraw source/target fingerprint・updateTime・classification・expected bodyをtype-tagged canonical encodingでUTF-8 byte順に並べたSHA-256とする。Firestore integer/double、Timestamp、GeoPoint、reference、bytes、list、mapを型付きで区別し、単純な`JSON.stringify(data())`やprivate SDK fieldへ依存しない。
- dry-runは変更なし0、create候補あり2、data blocker 3、digest/concurrency/partial/post-check mismatch 4、usage 64、unexpected pre-write error 70、target/credential/edition/rules proof拒否78を使う。applyはlive stateから同planを再生成してdigest一致後だけ進み、tenantごとのtransactionでroot source/marker/updateTimeと8 target不存在を再検査して8 documentをcreateする。root、audit、既存targetのupdate/deleteは0とする。
- 複数tenantは全体atomicではない。途中成功後は作成済みdocumentを削除せずfresh dry-runし、成功tenantが`alreadyEquivalent`、残りが`eligibleCreate`となる新digestで再開する。post-checkはinclude tenantが全件equivalent、eligible/blocker 0、root business値・marker不変、audit 0、create件数一致、update/delete/root write 0を必須とする。activationは別checkpointである。

local実装候補は`scripts/migrate-company-settings.mjs`、専用domain test、専用synthetic fixture、Codex local harness追加である。現行generic Rules下ではstaging不可であり、pre-containment deployed rulesetをmachine-verifiable receiptへ結ぶまでapplyを有効化しない。runbookのexact commandは実装・target guard・testが揃った後に記録する。

## 未確認事項・完了条件

CCB-02は次が完了するまで10点を加点しない。

- Dev Companyごとの承認済みcanonical Settings expected valueとのparity、`alreadyEquivalent`・`targetConflict`・`invalidSource`等を判定するmigration plan digest。2026-08-28のread-only preflightではedition、root field/type、旧enum、unknown field、target document存在を確認したが、exact schema v1への値の写像・比較はまだ行っていない。
- DevではCompany root 4件のうち承認済み合成test 2件を用途分類できた。残る2件は、識別情報を出力しない自動照合だけでは利用者会社・協力会社・残存tenantを確実に区別できず`residual_review`とした。4件すべてをstaging・migration対象と仮定せず、残る用途とinclude/excludeを利用者確認で固定する。推測削除は行わない。
- Schemas変更は別project taskへ移管済み。Schemas側の変更範囲・version・検証結果と、Admin SDKの変更範囲、publish/install/deploy順、backup/restore互換、rollback releaseの個別承認が必要である。
- generic Rules fallbackを先に閉じるreleaseと、全client/Functions/Admin SDK callerの回帰matrix確定。
- migration actor ID、PrivateSettings backup、SettingAudits restore、CCB tenant deleteのfail-closed境界確定。

## 2026-08-28 Dev read-only preflight

- checkpoint: `CCB-02-DEV-SHAPE-001`
- target: `air-guard-v2-dev`、Firestore `(default)`
- approved read: edition、deploy済みFunctions、operator tool、Company rootのfield名・型・分類件数・digest。値、company ID、個人情報、Stripe識別子、credentialは出力しない。
- local preflight: Node `v22.23.2`、Firebase CLI `15.28.1`、cwdとGit top-level `C:\Users\seven\projects\AirGuard\air-guard-v2`、branch `codex/dev-user-reservation-migration`、HEAD `41a73c3995963c85545f7ffa4deaddd4c109bb5d`、upstream none、clean、primary-only worktreeを確認した。
- authentication recovery: 初回はFirebase CLI credential失効でdatabase API到達前にexit 1となり、Firestore document read 0で停止した。利用者のFirebase CLI再認証後、同じ`firestore:databases:list --project air-guard-v2-dev --json`を再実行してexit 0を確認してから後続へ進んだ。gcloudはrunbook記録済みのprocess-scoped Python truststore経路でdatabase describeがexit 0となった後だけ、access tokenをprocess内に保持するFirestore REST読取へ使用した。token本文、credential、document ID・値は出力していない。
- database: `FIRESTORE_NATIVE`、`STANDARD`、`asia-northeast1`、PITR有効、version retention `604800s`、pessimistic concurrency。Firebase CLI database list/getとgcloud database describeは各exit 0だった。
- deployed Functions: 36件すべて`ACTIVE`、region `asia-northeast1`、runtime `nodejs22`。35件が`gcfv2`、`onAuthUserDeleted`だけが`gcfv1`。承認済みの4つのCCB Company設定Callableは0件で、まだ未deployである。
- Company root: 4件、すべて同じ38 field shapeだった。`schemaVersion`と`configurationState`は各4件すべて欠損、`attendanceManagementMode`は4件すべて`ACTUAL_DATE`で、`OPERATION_DATE`、unknown、欠損は0件だった。current known-root setに対するunknown fieldは0件である。
- legacy・leak baseline: `agreementsV2`、`location`、`geopoint`、`subscription`、`stripeCustomerId`、maintenance fieldは各4件に存在した。`docId`、`uid`、`fullAddress`、`prefecture`、`hasBankInfo`、`isCompleteRequiredFields`も各4件に保存され、computed/framework field混入が実dataでも確認された。Admin SDK側が使う`maintenanceStartedAt`は0件、schema側の`maintenanceStartAt`は4件だった。
- target documents: `Settings/{profile,billing,operations,arrangement,entitlement,maintenance}`、`PrivateSettings/{entitlement,maintenance}`、`SettingAudits`は観測した4 rootすべてで0件だった。partial、complete、unexpected target documentも0件で、data shape上は全件staging前のempty状態である。ただし各rootのmigration対象性とcanonical expected valueが未確定なので、4件すべてを対象とする判断、parity・target conflict判定はまだ行っていない。
- aggregate digest: field名、Firestore型、件数、固定enum分類だけから作ったSHA-256は`295d7a924c6ae9c899e625bed54565b517135af6c7d308b0f4c8766160cd981a`。会社ID、field値、PII、Stripe識別子をdigest入力へ含めていない。
- invalid diagnostic: 最初のfull aggregate probeはPowerShell URL補間の変数境界が曖昧で誤ったcollection pathを読み、exit 0・Company 0件を返した。既知状態と矛盾したため証拠採用せず、明示URLのmasked count probeで4件を確認してから修正版を再実行した。誤probeも読取専用で、writeは0だった。
- operator tool: `air-guard-v2-admin-sdk`のlocal repositoryをcommand-local safe-directoryだけで確認し、HEAD `1be81f6745e0033093bb84988194358d0a85a71f`、clean、package `1.0.0`、schemas `2.4.2-dev.162`を確認した。tool自体は実行せず、Dev dataやcredentialを渡していない。

### command・exit status証拠

各行は別processまたは明示したfail-fast processで観測した。`result`へtoken、credential、Company ID、field値、PII、Stripe識別子を含めていない。

| 種別 | command・処理契約 | result | exit |
|---|---|---|---:|
| Node | `node --version` | `v22.23.2` | 0 |
| Firebase CLI | `C:\Users\seven\AppData\Roaming\npm\firebase.cmd --version`。同processだけ`NODE_USE_SYSTEM_CA=1` | `15.28.1` | 0 |
| database list | `npx -y firebase-tools@latest firestore:databases:list --project air-guard-v2-dev --json`。同processだけ`NODE_USE_SYSTEM_CA=1` | `(default)` 1件、Standard/Native | 0 |
| database get | installed Firebase CLIの`firestore:databases:get "(default)" --project air-guard-v2-dev --json`をprocess内でparseし、project、database、location、type、edition、concurrency、PITR、retention、delete protectionだけを出力 | allowlist fieldが期待値と一致 | 0 |
| Functions | installed Firebase CLIの`functions:list --project air-guard-v2-dev --json`をprocess内でparseし、ID、region、runtime、platform、stateだけを出力 | 36件ACTIVE、gcfv2 35、gcfv1 1、CCB Callable 0 | 0 |
| gcloud trust/token refresh | [Dev deploy runbook](../runbooks/dev-deployment.md#2026-08-27に確認した実行環境)記録のPython `truststore.inject_into_ssl()`付き`gcloud firestore databases describe` exact process | Dev `(default)` metadata取得成功 | 0 |
| masked count | gcloud access tokenをprocess内だけで取得し、`Invoke-RestMethod -Method Get -Uri "${base}/Companies?pageSize=1000"`へ`mask.fieldPaths=schemaVersion`を付けたread-only GET。件数だけ出力 | Company root 4件 | 0 |
| aggregate | `ErrorActionPreference=Stop`の単一PowerShell fail-fast process。`GET .../documents/Companies?pageSize=1000`と、各非出力ID配下の`Settings`、`PrivateSettings`、`SettingAudits`をpage token付きでreadし、field名・Firestore型・件数・固定enum分類だけを出力 | 4 root、同一38-field shape、target 0、digest `295d7a...981a` | 0 |
| operator Git | `git -c safe.directory=C:\Users\seven\projects\AirGuard\air-guard-v2-admin-sdk -C <repo> ...`を各Git段階でfail-fastし、package/lockfileはPowerShell JSON parse | HEAD、clean、package/schema version確認 | 0 |

aggregate digestは、root field名とtype別件数をfield名・type名順、shape classをfield名連結key順にsortし、`project`、`database`、root件数、schema分類、activation分類、attendance分類、選択field存在数、target件数、field inventory、unknown inventory、shape classの順でordered objectを作った。PowerShell `ConvertTo-Json -Depth 20 -Compress`のUTF-8 bytesへ.NET `SHA256.HashData`を適用した観測用digestである。値parityや将来migration planの正本digestには再利用しない。

不採用診断も成功証拠と分ける。最初のaggregate processは`"$base/$relativePath?pageSize=1000"`がPowerShellで`.../documents/=1000`へ展開され、exit 0・0件を返した。後続の成功で覆わず、既知状態との矛盾を理由に不採用とした。operator確認の最初のbatchもsandbox ownership errorを内包したままexit 0となり、package-lock初回parseもnon-terminating errorをexit 0に畳み込んだため不採用とし、command-local safe-directoryとterminating JSON parseで個別に再確認した。

## 2026-08-28 Dev tenant用途分類

- checkpoint: `CCB-02-DEV-TENANT-CLASSIFY-001`
- approval: 利用者はDev 4 rootのcompany ID、会社名、同社Userの最小識別情報をprocess内だけで読むbounded read-only分類を承認した。
- process: gcloud access tokenをprocess内だけで取得し、明示project `air-guard-v2-dev`・database `(default)`のCompany rootと各UsersをFirestore REST GETでpage token付き読取りした。会社名・カナ、User email・表示名の合成test signalを照合し、Gmail plus addressから安全に同一base accountを確認できる場合だけ利用者会社候補とした。残り1件を協力会社とみなす推測は、利用者会社を確定できた場合にだけ許すfail-closed分類とした。
- result: `approved_synthetic_test` 2件、`user_company` 0件、`partner_company` 0件、`residual_review` 2件。未解決2件のためterminal stateは`REVIEW_REQUIRED`である。
- classification manifest digest: `38aa4c9380a33d7cd010164aa34b1341c61666fb8f1fda97e48795e0176a7bf2`。domain separatorと、非出力company ID・分類の組だけをID順に並べたSHA-256であり、個別ID、名称、email、document値、per-subject hashは出力していない。migration plan digestには再利用しない。
- command result: 単一のfail-fast PowerShell processがexit 0。識別情報出力0、remote create/update/delete 0、repository外artifact 0。用途を断定できない2件は分類を推測せず、migration include/excludeを未確定のまま維持した。

## 実施していないこと

- application code、Rules、test、fixture、package、Admin SDK、正本仕様の変更
- test、validator、build、Emulator、application/server/browser起動
- deploy、migration、backup、restore、maintenance、remote data create/update/delete、credential変更、persistent trust設定。remote作用は承認済みDev metadataとCompany data-shapeのreadだけで、data writeは0だった。
- remote inspectionの開始から結果確定までのbranch/HEAD変更、stage、commit。結果反映は本checkpointで明示したproject-owned文書だけを後続のlocal document commit対象とする。
