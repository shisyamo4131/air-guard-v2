# CCB-02 Company data・package互換性調査

## メタデータ

- 状態: In progress（repository静的調査・技術契約・Dev read-only data-shape照合・exact schema v1確定、Dev tenant分類・canonical parity plan・package release契約は未完了）
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

## 未確認事項・完了条件

CCB-02は次が完了するまで10点を加点しない。

- Dev Companyごとの承認済みcanonical Settings expected valueとのparity、`alreadyEquivalent`・`targetConflict`・`invalidSource`等を判定するmigration plan digest。2026-08-28のread-only preflightではedition、root field/type、旧enum、unknown field、target document存在を確認したが、exact schema v1への値の写像・比較はまだ行っていない。
- DevではCompany rootを4件観測したが、現行試用主体、承認済み合成test tenant、過去の残存tenant、orphanの内訳とmigration対象性は未分類である。4件すべてをstaging・migration対象と仮定せず、ID・値を応答へ出さない別checkpointで用途分類と対象件数を固定する。推測削除は行わない。
- schemas/Admin SDKの変更範囲、version、publish/install/deploy順、backup/restore互換、rollback releaseの個別承認。
- generic Rules fallbackを先に閉じるreleaseと、全client/Functions/Admin SDK callerの回帰matrix確定。

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

## 実施していないこと

- application code、Rules、test、fixture、package、Admin SDK、正本仕様の変更
- test、validator、build、Emulator、application/server/browser起動
- deploy、migration、backup、restore、maintenance、remote data create/update/delete、credential変更、persistent trust設定。remote作用は承認済みDev metadataとCompany data-shapeのreadだけで、data writeは0だった。
- remote inspectionの開始から結果確定までのbranch/HEAD変更、stage、commit。結果反映はこの3文書だけを後続のlocal document commit対象とする。
