# CCB-02 Company data・package互換性調査

> 状態: Historical / rollback inventory source（2026-08-30）
>
> ADR 0031により8 target、PrivateSettings、SettingAudits、LEGACY/STAGED/ACTIVE runtime互換設計は廃止された。本書のcode・data・package調査事実は、保持対象とcorrective rollback対象を分離するために使用し、現在の設計または次工程として使用しない。

## メタデータ

- 状態: In progress（Schemas `.167`は公開・artifact検証済み。Admin SDK、AirGuardV2 app、Functionsはexact導入済み。client compatible readerとActive時の旧root write拒否、pure migration planner、Codex専用合成EmulatorのREST reader・create-only transaction・post-check、pre-containment Rules候補のlocal prototypeは実装済み。既存CRUD互換化をRules deployより先に行う計画へ訂正。Company clone、operation別Client/Server writer、両Rules回帰、旧writer 0件、Dev reader/apply、deployed Rules receipt、remote stagingは未完了）
- 改修コード: CCB（Company Configuration Boundary）
- 調査日: 2026-08-29
- 調査基準commit: `16460b8d38a95b62f821afe7677febf5ca28ac19`
- 現行仕様: [Company設定とtenant lifecycle](../specification.md#company設定とtenant-lifecycle)
- 主要判断: [ADR 0025](../decisions/0025-company-configuration-boundary.md)、[ADR 0028](../decisions/0028-ccb-parity-backup-audit-restore.md)
- ロードマップ: [Company設定改修ロードマップ](../roadmaps/company-settings.md)
- 調査方法: client、Functions/Admin SDK、Firestore Rules/fixture、関連packageの4系統を独立したread-only調査として実施した。

この文書は実装事実と互換性を記録する。承認済み仕様の正本ではない。「承認済み技術契約」は2026-08-28に利用者が確認し、現行仕様・ADR・ロードマップへ反映した。

## 結論

CCBの新documentを現在のRules下で先に作成してはならない。`firestore.rules`のgeneric fallbackは、明示的な除外がない`Settings`、`PrivateSettings`、`SettingAudits`にも一致し、同じ会社の有効な本登録Userへ再帰read/writeを許可する。Firestore Rulesは複数matchのallowをOR評価するため、狭い個別matchを追加するだけではfallback allowを打ち消せない。

Company rootへ`status`や`schemaVersion`だけを先に追加することも安全ではない。現行Company modelは定義済みfieldだけをhydrateし、client/server adapterの`update()`はmodel全体を`transaction.set()`する。旧clientまたは旧Functionsが保存すると、未知のserver-owned fieldを落としてroot全体を置換する。

2026-08-29のAirVuetify3・Company clone再調査により、既存Company CRUDの互換確認よりpre-containment Rules deployを先行させていた順序を訂正した。CCBは次の順序を崩せない。

1. additiveな共通schemaと旧新compatible readerを準備する。
2. Admin SDKをexact schemaへpinし、旧backup・restore・maintenance・deleteを新path検出時にfail closedとする。CCB-aware backup本体はPrivateSettings・audit・削除・provider maintenance契約を確定してから追加する。
3. Company固有cloneでnon-enumerable runtime stateを非永続のまま保持し、CompanyManagerとagreements・site/schedule order等の全callerをoperation別handlerへ移す。`useItemManager.updateProperties()`はlocal draft更新として利用できるが、Firestore patchとは扱わない。
4. 同じ4 Callableをmarker-aware operationとして準備する。LEGACYではscope別canonical `expectedValue`を現在root projectionとtransaction内で比較し、既知legacy business fieldと既存legacy更新metadataだけをpartial updateする。reserved field、root whole-set、Settings、PrivateSettings、auditは変更しない。STAGEDでは通常設定writeとsignupを拒否する。ACTIVEではexpectedRevisionを検査してSettingsと必要なauditだけを更新する。各editorは1 operation・1 exact payloadとする。
5. 現行Rulesと候補pre-containment Rulesの両方で、実CompanyManager submit、全既存caller、actor・tenant拒否、stale、部分失敗、旧clientを同じmatrixで回帰する。
6. 現行Rules下へClient/Serverを先行deployし、LEGACY modeの既存Company CRUD継続、scope競合拒否、reserved field不変、Settings/audit write 0件、client・deploy済みFunctions・operator・Admin SDKを含む旧whole-document writer 0件を確認する。
7. [maintenance・data change runbook](../runbooks/maintenance-and-data-change.md)に従ってmaintenanceを開始し、通常設定writeとsignupを停止する。bounded quiet period、対象Function log確認、連続dry-run digest一致、整合snapshot/backupを確認する。
8. generic Rules fallbackから新pathを除外し、Settings、PrivateSettings、auditを全client denyにするpre-containment Rulesをdeployする。rootの旧business field updateはcutoverまで維持し、reserved fieldを保護する。候補sourceのlocal成功をdeployed receiptへ代用しない。
9. Rules receipt確認後にだけcomplete Settingsをcreate-only stagingする。STAGEDでは通常運用せず、clientはlegacyを表示できても保存せず、serverは通常設定writeとsignupを拒否する。
10. 同じmaintenance内のcutoverで最終Rules・Functions・clientを整合させ、root activation markerを最後に設定する。activation後はACTIVE writer、root marker、Settings parity、拒否経路、旧writer 0件を再確認してからmaintenanceを解除する。新規signupは解除後にactive rootとcomplete target setを作成する。

### AirVuetify3とCompany cloneの確認結果

- `useItemManager.updateProperties()`は既存top-level propertyをlocal draftへ反映するだけで、changed-key、Firestore patch、deep merge、永続化を提供しない。
- `AirItemManager`のcustom `handleUpdate`はdraft全体を受け取り、throw時にdialogとerror/loading契約を維持する。CompanyManagerはこれをapplication-ownedのscope別writerへ差し替え、`draft.update()`を呼ばない。
- base cloneは`toObject()`のenumerable keyだけをコピーするため、AirGuardV2 Companyのnon-enumerableな`INITIALIZING/LEGACY/ACTIVE/ERROR` runtime stateを失う。Company固有cloneとoriginal/live state再検査が必要である。
- Schemas `.167`は旧Companyへlegacy propertyを追加していない。persisted `configurationState`はActive marker、legacyはmarker未active、4つのmodeはAirGuardV2 runtimeだけの状態である。

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
| root app | air-firebase `2.3.1-dev.6`、client adapter `2.1.3-dev.10`、schemas exact `2.4.2-dev.167`。marker未成立時はlegacy root、成立後はroot projectionと6 Settingsを検証するcompatible readerをlocal実装済み。 |
| Functions | air-firebase `2.3.1-dev.6`、server adapter `2.2.1-dev.3`、schemas exact `2.4.2-dev.167`。CCB write Callableは未実装・未有効。 |
| Admin SDK | local commit `c95660d`でschemas exact `2.4.2-dev.167`。CCB public contractをimportし、旧破壊操作をCCB tenantへfail closedにする。 |

2026-08-28の初回operator tool再確認では、関連repository `air-guard-v2-admin-sdk`はHEAD `1be81f6`、schemas `.162`だった。その後、利用者承認によりlocal commit `c95660d`へ更新し、exact `.167`とCCB safety guardを導入した。固定catalog自体はCCB backup/restoreに未対応だが、Company maintenance、会社削除、backup/restore等はroot markerまたは新pathを検出するとwrite前に停止する。

推奨するpackage境界は次である。

- schemasへ旧Companyを維持したまま、CompanyRoot、各Settings、PrivateSettings、SettingAudit、legacy mappingの純粋なexact parser/normalizer/serializerをadditive exportする。
- AirFirebase base/client/server adapterは変更せず、CCBの高risk writeはAirGuardV2のoperation別transactionとAdmin SDKのraw Firestoreで明示的に行う。汎用FireModelへrevisionやpatchを追加して影響範囲を広げない。
- app、Functions、Admin SDKは同一の承認済みexact schemas versionへ揃える。range、古いAdmin SDK、local duplicate schemaを正本にしない。
- Schemas releaseとAdmin SDK local consumer導入は個別承認を経て完了した。AirGuardV2 app/Functions consumer導入、Admin SDK push/deploy、data操作は引き続き別承認を必要とする。

## 承認済み技術契約

### 1. Company設定write方式

Company設定だけについて、次の4つの専用Callableを設け、clientのSettings create/update/deleteを拒否する。

- `updateCompanyProfile`
- `updateCompanyBilling`
- `updateCompanyOperations`
- `updateCompanyArrangement`

各Callableはcurrent Auth、claim、同社User、actor、Company lifecycle、maintenance、mode別exact inputをtransaction内で再検査する。LEGACYはscope別expected valueを比較してaudit 0、STAGEDは常時拒否、ACTIVEはexpected revisionを検査する。ACTIVEのprofile/billing/operationsは設定更新とmask済みaudit createを同一transactionに含める。ACTIVEのarrangementはauditを作らず、siteOrderとscheduleOrderを変更field別permissionで検査する。

これは全collectionのCUDをFunctionsへ移す共通規則ではない。Company設定はaudit atomicity、list item検証、root/private containmentが同時に必要なための機能限定判断であり、Customer、Site、Employee、Outsourcerは各改修で改めて判断する。

確定actorは、profile/billing/operationsが会社管理者、siteOrderが`sites:write`、scheduleOrderが`site-operation-schedules:write`である。manager/controller/legal等のrole名を直接判定せず、既知presetから得たpermissionを使う。super-userと直接permission文字列をstrict actorへ含めない。

### 2. exact document共通規則

- rootと全documentの`schemaVersion`初期値をinteger `1`とする。clientの正本切替は`schemaVersion`単独で判定せず、既存値との衝突を事前dry-runした専用marker `configurationState=CCB_V1_ACTIVE`との両方が一致した場合だけ行う。
- client/providerが更新する設定は`revision`をinteger `1`から開始し、成功ごとにexactly `+1`する。
- `createdAt`、`createdBy`、`updatedAt`、`updatedBy`をserverが設定する。optional fieldは欠損とnullを混在させず、初期documentへ明示的な`null`または空配列を保存する。
- unknown field、computed accessor、frameworkの`docId/uid`、converterの`geopoint`をcanonical Settingsへ保存しない。
- deny receipt取得後からglobal cutover完了まではmaintenanceで新規signupを停止する。cutover後の新規signupはactive root、profile、billing、operations、arrangement、entitlement projection、maintenance projection、両PrivateSettingsをUser・email予約と同じtransactionでcomplete setとして作る。既存tenantのbackfillも同じcomplete setをcreate-onlyで準備し、一部documentだけ存在する状態を成功扱いしない。
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

同日、利用者はSchemas側のS1文書とS2 pure package contract・targeted testを承認した。checkpoint `CCB-SCHEMAS-S1S2-IMPLEMENT-001`ではlegacy mappingをS2へ含め、決定不能値をexplicit conflictにする。package version・lock変更、S3 release guard、tag、push、publish、consumer install、deployは含めていない。

Schemas taskはcommit `ebfc173053c0fba6e7931ff2825bcfff61698763`（`feat: add company configuration v1 contract`）を作成した。AirGuardV2 coordinator reviewでは、旧空口座で4 fieldが空かつ旧既定`accountType=普通`のcaseが競合になることと、Dev実dataに存在する既知legacy framework/computed field 6件をactivation root projectionが拒否することを合成値診断で再現したため、初回commit単独では受入れなかった。Schemas taskはhistory rewriteを行わず、corrective commit `53fb53de35d2cf4f408041969ba443b49d756484`（`fix: align company configuration legacy compatibility`）を追加した。

corrective review後、Schemas repositoryは`main`、HEAD `53fb53de35d2cf4f408041969ba443b49d756484`、upstream比0/2、clean、primary-onlyだった。Schemas側Node 24でCCB 11/11、既存role preset 6/6、self-import、package/lock/export互換、project/managed/renderer validator、`git diff --check`が各exit 0である。AirGuardV2 coordinatorもNode 22.23.2で同じCCB 11/11、role preset 6/6、空口座5 field全null、6 extras受入れ・7 reserved field返却、public self-importとroot非公開を独立に各exit 0で確認した。S1/S2 local contractはこの2 commitを一体として受入れる。

S3 commit `78bb1f427ffec9bd5f89bb405770502b0f083f58`（`build: prepare 2.4.2-dev.167 release`）でpackage/lockを`2.4.2-dev.167`へ揃え、全10 test fileのfail-closed inventory、tag/version/export/root非公開/public import/package内容を検査するrelease guard、Node 22/24 test成功後だけNode 24で公開するtag-only workflowを追加した。Schemas taskではNode 22/24の全test、実release guard、pack dry-run、project/managed/renderer validatorが各exit 0で、registry readは`.167`未公開を示した。AirGuardV2 coordinatorもNode 22.23.2で`npm test`と`RELEASE_TAG=v2.4.2-dev.167 npm run check:release`を独立に再実行し、各exit 0を確認した。GitHub公式の`actions/checkout@v6`・`actions/setup-node@v6`とnpm Trusted Publishingの`id-token: write`要件にも整合する。

S3後、active project ruleに旧「7 scriptはdiagnostic、error test失敗」の記述が残っていることを公開preflightで検出し、外部作用前に停止した。利用者承認後、Schemas commit `bb2390997153b2e57470d0c04012d93ddde2f971`でformal 10-file suiteへ正本を一致させ、managed governance 1.3.0のinstruction-chain手順により`PM（Schemas）-03`へ完全新規task交代と変更なしcallbackを完了した。package runtime/API/version/workflow/test fileはS3から不変である。

commit `bb23909`へannotated tag `v2.4.2-dev.167`を付け、normal main push、separate tag push、GitHub Actions run `33150835365`のNode 22/24 test、Node 24 release guard、Trusted Publishingがすべて成功した。registryの`dev`はexact `2.4.2-dev.167`を指し、shasumは`b4cbc285438179f75b69bd754141b0a4492c722d`、integrityは`sha512-EsMVhMXo9Rrc6AdLT98sdiN5iGniVZq6mEDN+XMgxuB1e8TYbNPPQCHRCdf+HcnvbTseruo23A+4PQnFpw/p0g==`である。Windows事前packのdigestとは異なったが、`core.autocrlf=true`のCRLF checkout・npm 10.9.8と、CIのLF checkout・npm 11.17.0の差で再現した。exact commitのLF clean treeを公開toolchainでpackするとregistry tarballとbyte-identicalとなり、84 filesのraw差0、source/runtime/API差0だった。fresh exact installではversion、CCB 27 exports、主要parser、root非公開、peer importがexit 0である。package公開とAdmin SDK local adoptionは受入れ済みだが、AirGuardV2 app/Functions adoption、Admin SDK push/deploy、data operationは未実施・別checkpointとする。公開後はunpublish、tag移動・削除、history rewriteをrollbackに使わず、問題があれば後続versionでsupersedeする。

| 対象 | 確認済み状態 | CCB blocker |
|---|---|---|
| schemas | `main`、HEAD/origin `bb2390997153b2e57470d0c04012d93ddde2f971`、clean、tag/public package `2.4.2-dev.167`。additive `./company-configuration`、formal Node 22/24 suite、release guard、Trusted Publishing、registry artifact/fresh install検証済み。 | package側blockerは解消。Admin SDKとAirGuardV2 app/Functionsは同じexact version/contentへ導入済み。 |
| AirGuardV2 app/Functions | root・Functionsともschemas exact `2.4.2-dev.167`。clientは両marker未成立時だけlegacy rootを読み、成立後はreserved root projectionと6 Settingsをpackage parserで検証する。欠損・invalid時はread errorとしてmaintenance側へfail closedにし、Active/error時の旧whole-document updateを実行前に拒否する。 | package consumer導入とcompatible read境界はlocal実装済み。canonical parity、Rules、Callable、staging、Dev cutoverは未実施。 |
| Admin SDK | branch `codex/is-super-user-claim-migration`、local commit `c95660d2f60b93f7f0c3f3fe1ddc42373374aade`、clean。schemas exact `2.4.2-dev.167`。CCB root marker、新3 collection、backup payloadを検査し、旧backup/snapshot/diff/restore/delete/maintenanceをwrite前に拒否する。Node 22/24専用17件と既存9件成功。 | CCB-aware backup/restore、PrivateSettings保管、SettingAudits create-only restore、CCB tenant delete、provider maintenance、push/deployは未実装・未確認。 |

Admin SDKの固定flat catalogは`Settings`、`PrivateSettings`、`SettingAudits`と他の未知nested pathを発見しない。現行の完全restoreは固定catalogを削除してrootをwhole-document `set`し、Auth失敗を警告だけで継続できる。selective/diff restoreはgeneric merge、Company deleteはAuthと固定catalogを部分削除し得る。これらはcanonical root、append-only audit、PrivateSettings、fail-closed契約と両立しない。さらにpublic classのrestore引数と実装signature、READMEの「全collection」説明にも不一致がある。CCB document作成前に、旧toolのdestructive restore/deleteをCCB tenantへfail closedにし、backup formatと実API説明を一致させる必要がある。

利用者はAdmin SDKに独立project taskを置かずAirGuardV2 coordinatorが直接変更することを承認した。local commit `c95660d`はSchemasをexact `.167`へpinし、rootの`schemaVersion`/`configurationState`、`Settings`、`PrivateSettings`、`SettingAudits`、およびrestore元backup payloadを検査する共通guardを追加した。CCB検出は`CCB_UNSUPPORTED_OPERATION`、検査失敗は`CCB_BOUNDARY_CHECK_FAILED`で停止し、Auth削除、Firestore batch/root write、storage保存前である。legacy tenantの既存経路は維持する。これは固定catalogへ機密・append-only dataを無条件追加しない安全停止であり、完全backup対応の証拠にはしない。

### 推奨package・consumer導入順（承認待ち）

1. schemasへ旧`Company`とroot exportを変更せず、pureな`./company-configuration` subpathとしてv1 constants、strict parser/normalizer/serializer、legacy mapping、audit maskをadditive追加する。AirFirebase adapterとFirebase SDK class identityへ依存させない。
2. schemasのtargeted testでstrict allowlist、全field制約、grapheme、結合濁点、Timestamp structural boundary、legacy mapping、audit mask、旧`Company`回帰を固定する。publish workflowへtag/version一致、targeted test、public self-import、package file検査を加え、成功前にpublishしない。
3. 承認済みimmutable prereleaseをtag/publishし、workflow、registry version、integrity、fresh public importを確認する。tag pushがpublishをtriggerするため、tag作成、push、Trusted Publishingは明示承認後だけ行う。
4. Admin SDKを同じexact versionへpinし、CCB destructive operation拒否とtest・説明を先に整える。この安全停止はcommit `c95660d`で完了した。version付きbackup manifest、catalog inventory、CCB-aware backup/restore、provider maintenanceは別契約として残し、承認済み復旧方針がないまま新CCB documentを作らない。
5. AirGuardV2 rootとFunctionsを同じexact versionへpinし、compatible readerを検証する。このlocal境界は完了した。次はCompany cloneとoperation別Client/Server writer、全caller、現行・候補Rules両回帰、旧writer 0件を完成させてからpre-containment Rules deploy、complete-set staging、final cutoverへ進む。

### AirGuardV2 compatible reader local実装

AirGuardV2のCompany singletonはrootだけを読む旧`FireModel.fetch/subscribe`を上書きし、rootに`schemaVersion=1`と`configurationState=CCB_V1_ACTIVE`の両方がない間はlegacy rootを現行Company modelへhydrateする。両marker成立後はactivation期間用root projectionと`Settings/profile`、`billing`、`operations`、`arrangement`、`entitlement`、`maintenance`の6件をexact `.167` parserで検証し、complete setだけを現行表示形へ写す。`attendanceSummaryMode`は表示互換のため`LABOR_STANDARD→ACTUAL_DATE`、`OPERATION_COUNT→OPERATION_DATE`へ写すが、正本値はparsed Settingsとして別保持する。

Active後の欠損、unknown、invalid、listener errorはlegacyへ戻さずCompany read errorとし、system maintenance判定をtrueにする。root statusが`SUSPENDED`または`CLOSED`の場合も通常画面をmaintenance側へfail closedにする。Active、read error、初期化中のCompanyに対する旧`update()`は`LEGACY_COMPANY_WRITE_DISABLED`でFirestore呼出し前に拒否する。legacy modeの既存更新だけを維持する。新Settings writer、Callable、Rules、migration、remote dataはこのlocal実装に含めない。

publish済みpackageをunpublishせず、未採用ならconsumerを旧exact versionに留める。採用後・activation前のconsumer rollbackは各consumerの既知versionとlock/integrityを戻してtestする。activationまたはdata apply後はpackage downgradeだけをdata rollbackとみなさず、Settings対応済みreleaseへ戻す。Admin SDKの現行`.162`はSettingsを読めないため、CCB cutover後のrollback artifactにはできない。

## canonical parity確定契約

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

local実装は`scripts/migrate-company-settings.mjs`、専用domain test、専用synthetic fixture、保護付きCodex local harnessへ追加した。exact demo project・loopback Firestore・external effects deny・credential拒否のtarget guard内でだけ、公開REST readerと`Bearer owner`、tenant単位read-write transaction、`currentDocument.exists=false`付き8 create、fresh post-checkを提供する。pre-containment Rulesのlocal prototypeは、`Settings`、`PrivateSettings`、`SettingAudits`のrecursive denyとgeneric fallback除外、legacy root reserved field保護、active root update拒否を実装し、専用Emulator 8件と既存Firestore Rules回帰37件で検証した。local Rules file receiptはpre-containment deployed rulesetの証拠に再利用しない。Dev reader/apply、Rules deploy/remote receipt、remote staging、実data applyは別checkpointまで無効である。

## 未確認事項・完了条件

CCB-02は次が完了するまで10点を加点しない。

- Dev Companyごとの承認済みcanonical Settings expected valueとのparity、`alreadyEquivalent`・`targetConflict`・`invalidSource`等を判定するmigration plan digest。pure plannerは2026-08-28に実装し、Schemas exact mapping、8 target create-only、complete exact、partial、不一致、unknown、invalid、ambiguous、orphan、edition未確認、manifest/environment/full snapshot digest binding、UTF-8 byte順、primary分類と全finding保持、per-subject非出力、fresh re-planを合成fixtureで検証した。同日、Codex専用合成Emulatorの公開REST reader、local target guard、tenant単位transaction、fresh post-checkを追加し、2 tenantのdry-run 16 create、apply、root不変、audit 0、update/delete 0、再dry-run全件`alreadyEquivalent`を確認した。実Dev値をmigration commandから取得する経路、Dev manifest/deployed Rules receipt、remote dry-run/apply/post-checkはまだ提供しない。
- Dev Company root 4件は、利用者確認により利用者会社1件、試用中の別会社1件、承認済み合成test 2件と確定し、4件すべてをmigration対象とする。会社名・ID・emailはrepositoryへ記録しない。実行時はlive candidate universeと承認済み全件includeをmanifest digestへ固定し、新しいrootやorphanが増えていれば停止する。推測削除は行わない。
- Schemas `2.4.2-dev.167`の公開・artifact確認、Admin SDKとAirGuardV2 app/Functionsのexact consumer導入、旧破壊操作/旧root writeのfail-closed、canonical parity・PrivateSettings backup・SettingAudits restoreの契約確定、pure migration plan/digest、Codex専用合成EmulatorのREST reader・create-only transaction・post-check、pre-containment Rulesのlocal sourceと合成回帰までは完了した。残るのはDev向けmanifest/reader/apply証拠、deployed Rules receipt、audit artifact/apply、rollback release、Callable・staging・deploy順の個別実装・検証・承認である。
- generic Rules fallbackを閉じるlocal sourceと合成回帰は完了した。remote staging前に対象project/databaseへdeployしたrulesetと承認済みsourceの一致を機械検証し、全client/Functions/Admin SDK callerのrelease回帰matrixを確定する。
- AirVuetify3のmanager contractとCompany clone defectは静的確認済みである。Company固有clone、実CompanyManager submit、scope別exact payload、旧root writer不在、全agreements・site/schedule caller、現行・候補Rules双方の回帰は未実装・未検証であり、pre-containment Rulesをdeploy可能とは扱わない。
- marker-aware writerは文書契約だけで未実装である。LEGACYのexpected-value比較・partial update、STAGEDのwrite/signup拒否、ACTIVEのrevision/audit、maintenance内のstaging/activation、dual-write 0を実装・検証するまで既存CRUD互換化は完了しない。
- CCB tenant deleteの旧command fail-closedは確定・実装済み。PrivateSettingsは既存logical backupから除外し、当面はmanaged backup/PITRへ依存する。SettingAudits restoreは同一company/schema/IDのcreate-only、同値skip、異値拒否に限定し、update/delete/clearを禁止する。専用実装・復旧演習とprovider maintenanceは未完了である。migration actorとmaintenance中の決定不能mapping停止も確定済みである。

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
- user resolution: 利用者は非出力の識別情報に基づき、未解決2件を利用者会社1件・試用中の別会社1件と確認した。先に分類済みの合成test 2件と合わせ、4件すべてをmigration対象と承認した。この回答は用途とinclude方針を確定するが、既存の観測digestを書き換えず、実migrationのtarget manifest digestはfresh dry-runで別途生成・承認する。
- staging metadata: 利用者は`createdBy/updatedBy`へ承認済みDev service accountのstable non-email opaque IDを使用することを承認した。既にmaintenance中で内部理由・scopeを旧dataから決定できないtenantは`ambiguousMapping`としてapply前に停止する。

## 実施していないこと

- application code、Rules、test、fixture、package、Admin SDK、正本仕様の変更
- test、validator、build、Emulator、application/server/browser起動
- deploy、migration、backup、restore、maintenance、remote data create/update/delete、credential変更、persistent trust設定。remote作用は承認済みDev metadataとCompany data-shapeのreadだけで、data writeは0だった。
- remote inspectionの開始から結果確定までのbranch/HEAD変更、stage、commit。結果反映は本checkpointで明示したproject-owned文書だけを後続のlocal document commit対象とする。
