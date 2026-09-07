# 4マスター Dev反映前 release surface inventory

- 状態: `MASTER-DEV-PREFLIGHT-01` No.7完了
- local source baseline: `7ce7b485c7bb1350b9112b2a12075d6bedf25e7e`
- No.5検討baseline: `1204ba205ddf4ca2f3d2de7f32924d7404db8af5`
- branch: `codex/master-dev-preflight`
- 対象: Customer、Site、Outsourcer、EmployeeのLocal完了差分から、Dev反映候補と対象外を静的に分類する
- 対象外: Dev/Prod接続、build、deploy、remote revision・実data・IAM確認、migration、tenant開放、利用者受入れ

この文書は反映候補のinventoryであり、release checkpointの承認、最終commit、exact deploy command、実行順序を確定しない。最終release差分は後続Checkpointで再照合する。

## 比較基準

確認済みのlocal Gitとimmutable receiptを比較した。live remoteは未確認である。

| surface | 記録から確認できる比較元 | 今回確認できた事実 |
|---|---|---|
| Functions | [STRIPE-05 receipt](../verification/stripe-05-dev-release.md)のsource `c3b29c59903928159f0d1c6f2ee3852b6ad7b46c` | 比較元より後に4マスター用API、既存trigger/schedulerと共有moduleが変更されている |
| Firestore Rules | [CUSTOMER-01D receipt](../verification/customer-01d-dev-test.md)の最終source `ae5abef9b2666266963412812a79125c3271ca94` | 現行`firestore.rules`にはCustomer archive、Site、Outsourcer、Employeeと参照先collectionの追加境界がある。Rulesはfile全体が反映単位になる |
| Hosting | [CUSTOMER-01D receipt](../verification/customer-01d-dev-test.md)の初回source `52de0349b7230d4306bad845a9c93a55c0497a53` | 4マスターの画面・client action・reader/writerと、予定・実績・請求の到達UIが比較元より変更されている |
| Firestore Indexes | remoteの現在状態を示す信頼できる記録は確認できない | 現行`firestore.indexes.json`は17 composite index・3 field overrideを持ち、このうち下記16 indexが4マスターまたは参照先に関係する。存在・build状態は後続のread-only remote確認まで未確認 |

## 反映対象候補

### Hosting

`dist/`全体を候補とする。4マスターの一覧・詳細・作成・編集・状態遷移・archive導線だけでなく、参照保護に伴って変更した予定、実績、請求の画面とclient保存経路も同じNuxt artifactへ含まれる。master別の部分artifactとして分割しない。`firebase.json`のHosting/cache設定は比較元以後に4マスター固有差分がないが、生成物と同じrelease設定としてidentity照合対象に残す。

### Firestore Rules

`firestore.rules`全体を候補とする。対象となる主要pathは次のとおりである。

| 主目的 | path・境界 |
|---|---|
| Customer | `Customers`、`Customers_archive`、Site・OperationResult・BillingのCustomer参照barrier |
| Site | `Sites`、`Sites_archive`、`SiteOperationSchedules`、予定と実績のSite参照・revision境界 |
| Outsourcer | `Outsourcers`、`Outsourcers_archive`のactor・保存契約・client破壊操作拒否 |
| Employee | `Employees`、`Employees_archive`のread/write境界と同ID archive拒否 |
| Employee参照先 | `ArrangementNotifications`、`Billings`、`DailyAttendances`、`DailyOperationsByEmployee`、`OperationResults`、`SiteOperationSchedules`、`SiteEmployeeHistories`のclient/server保存境界 |

Rulesの一部だけを旧版と組み合わせない。既存Dev Rulesとの差分、旧client互換、反映順序はNo.5で、既存data適合性はNo.6で扱う。

### Functions

次をbehavior上の反映候補とする。共有moduleを含むため、exactなFunctions deploy closureと一括・限定deployの選択はNo.5で確定する。

| 区分 | function候補 | 理由 |
|---|---|---|
| Customer | `archiveCustomer`、`onUpdateCustomer` | archive transactionとSite customer projection |
| Site | `archiveSite`、`terminateSite`、`reactivateSite`、`updateSiteAgreements`、`runDailySiteTermination` | archive、終了・再有効化、取極め、自動終了 |
| Employee CRUD | `createEmployee`、`updateEmployeeBasic`、`updateEmployeeNationality`、`updateEmployeeSecurity`、`updateEmployeeCertifications`、`transitionEmployeeInsurance` | operation別server保存 |
| Employee lifecycle | `archiveEmployee`、`terminateEmployee`、`onEmployeeDeleted` | 通常archive API、統括退職actor、旧削除eventのUser/Auth連鎖無作用化 |
| 予定・実績 | `saveOperation`、`onOperationResultChange`、`runDailyTask` | Site/Employee参照barrier、実績からの派生同期、予定cleanup |
| 請求・履歴 | `updateBillingPaymentDate`、`rebuildAllHistories` | client Billing write閉鎖後の専用更新、Employee索引を含む履歴再生成 |

`onOperationResultChange`の依存先にはBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoryの生成・再生成が含まれる。これらの共有module変更を、新規Callableだけの反映で済むとは扱わない。

Employee archiveの通常用`AIR_GUARD_EMPLOYEE_ARCHIVE_TENANTS`は既定空集合のままであり、Functions codeの反映候補とtenant開放を分離する。対象tenantを設定するまでは全tenant拒否とし、設定・開放は別承認事項である。

### Firestore Indexes

`firestore.indexes.json`全体を技術的な反映候補とする。現行codeから4マスターまたは参照先に関係する次の16定義を確認した。remoteに既に存在する同一定義は重複作成せず、No.6のread-only照合で「反映必要」「既存でカバー済み」「不要」を限定する。

| collection group | query scope | fields |
|---|---|---|
| ArrangementNotifications | COLLECTION | `id ASC, dateAt ASC, __name__ ASC` |
| Customers | COLLECTION | `contractStatus ASC, updatedAt DESC, __name__ DESC` |
| Employees | COLLECTION | `employmentStatus ASC, dateOfHire ASC, __name__ ASC` |
| Employees | COLLECTION | `employmentStatus ASC, dateOfHire ASC, dateOfTermination ASC, __name__ ASC` |
| Employees | COLLECTION | `employmentStatus ASC, updatedAt DESC, __name__ DESC` |
| OperationResults | COLLECTION | `employeeIds CONTAINS, siteId ASC, date ASC, __name__ ASC` |
| OperationResults | COLLECTION | `employeeIds CONTAINS, siteId ASC, date DESC, __name__ DESC` |
| Outsourcers | COLLECTION | `contractStatus ASC, updatedAt DESC, __name__ DESC` |
| Sites | COLLECTION_GROUP | `status ASC, constructionPeriodEndAt ASC, __name__ ASC` |
| Sites | COLLECTION | `hasConstructionPeriodEndAt ASC, status ASC, constructionPeriodEndAt ASC, __name__ ASC` |
| Sites | COLLECTION | `status ASC, updatedAt DESC, __name__ DESC` |
| SiteOperationSchedules | COLLECTION | `date ASC, shiftType ASC, siteId ASC, displayOrder DESC, __name__ DESC` |
| SiteOperationSchedules | COLLECTION | `operationResultId ASC, date ASC, __name__ ASC` |
| SiteOperationSchedules | COLLECTION | `siteId ASC, operationResultId ASC, __name__ ASC` |
| SiteOperationSchedules | COLLECTION | `siteId ASC, date ASC, __name__ ASC` |
| SiteOperationSchedules | COLLECTION | `siteId ASC, dateAt ASC, __name__ ASC` |

残る`Users` composite index 1件とfield override 3件は4マスター受入れの対象ではないが、index設定全体を反映する場合の比較・削除影響確認から除外しない。

## 反映対象外

- `storage.rules`、`database.rules.json`: 4マスター差分なし。
- `functions/codex-test/**`、`firebase.codex-test.json`、`.codex-test/**`、Local UI build/server/fixture: Codex専用Local検証資産でありDevへ公開しない。
- schema package、client/server adapter、Admin SDK repositoryの公開・更新: 現時点で必要性を確認しておらず別承認対象。
- Firestore documentの補完、backfill、archive変換、migration、repair、snapshot、実data作成・更新・削除: No.6以降で必要性が確認された場合だけ別計画・別承認する。
- IAM、Callable公開権限、App Check、Employee archive tenant開放、secret・credential変更、外部住所provider・通知・Stripe操作: code surface inventoryから承認を推論しない。
- Customer/Site/Employeeのrestore・purge、Outsourcer archive、transaction系全体の刷新、未承認FUT: 今回の4マスターDev受入れへ混ぜない。
- Prod、Git push、`main`統合、関連repository変更: 対象外。

Company/UWB/Stripe等の既存機能は4マスターの受入れ対象外である。ただしHosting・Rules・Functionsを全体単位で反映すると、同じartifactまたはcodebase内の既存機能も再配信・再更新され得る。No.5では記録済みDev比較元との差分とrollback対象を確認し、4マスター対象外であることを「技術的に変更されない」という意味へ広げない。

## No.5 旧clientと反映順序

### 確認できた互換性

記録済みDev sourceと現行sourceを比較した結果であり、live Devの稼働revision・開いているbrowser・利用者有無は未確認である。

| 範囲 | 旧clientが残る場合 | 切替条件 |
|---|---|---|
| Customer | 新しいarchive操作は露出しない。旧Customer writerが新Rulesのoperation別field契約を満たすことは保証できず、保存がfail closedとなり得る | 新Hostingへ更新後に再読込する。保存中の旧tabを残さない |
| Site | 旧clientの直接status・取極め・全体保存は、新しいserver-only／operation別境界と互換とみなせない | Site編集、終了・再有効化、取極めの旧tabを閉じ、新Hostingで再開する |
| Outsourcer | 旧generic writerまたは全体保存は、exact field・actor・revision境界で拒否され得る | 一覧・詳細・編集の旧tabを閉じ、新Hostingで再開する |
| Employee | 新Rulesでは通常client writeを許可せず、operation別Callableを正規経路とするため、旧直接writerは拒否される | Employee作成・編集・退職・archiveの旧tabを閉じ、新Hostingで再開する |
| 予定・実績・請求 | Site／Employee参照barrierとserver-only writerの変更により、旧画面の保存互換を保証できない | 予定・実績・請求の編集を停止し、新Hostingへ更新後に再開する |

現在の実装には、開いている全clientへ更新を強制するclient version gateや、取得済みSDK referenceからのwriteを一律停止する排他lockを確認できない。System／Company maintenanceも画面遷移の制御であり、Rules、Callable、Admin SDK、scheduled処理、開始済みwriteを停止する保証はない。したがってRules切替からHosting更新・再読込確認まで、対象会社で人手によるboundedな無書込み時間帯を必要条件とする。利用者・協力会社の稼働有無と許容時間帯は利用者確認待ちである。

Hostingの`no-store`設定は新規取得を助けるが、既に実行中の旧JavaScriptを置換しない。切替後は対象browserを再読込し、認証状態またはclaims更新が関係するactorは再ログインしてから受入れを開始する。

### Functionsの限定closure

Functions codebase全体の一括更新を既定にせず、4マスターと参照保護に必要な21 functionを次の3段階へ分ける。共有moduleを使う既存trigger／Callableもclosureへ含める。

1. 安全化先行（2件）: `runDailyTask`、`onEmployeeDeleted`。
2. client公開前のserver closure（18件）: `archiveCustomer`、`onUpdateCustomer`、`archiveSite`、`terminateSite`、`reactivateSite`、`updateSiteAgreements`、`createEmployee`、`updateEmployeeBasic`、`updateEmployeeNationality`、`updateEmployeeSecurity`、`updateEmployeeCertifications`、`transitionEmployeeInsurance`、`archiveEmployee`、`terminateEmployee`、`saveOperation`、`onOperationResultChange`、`updateBillingPaymentDate`、`rebuildAllHistories`。
3. 条件確認後に別途有効化（1件）: `runDailySiteTermination`。

記録済みDev sourceの`runDailyTask`はcleanup後に旧`sitesAutoTermination()`を同じhandlerから実行し、errorを再throwしない。現行版は旧自動終了を外し、bounded cleanupだけを担うため、これを先行更新して旧挙動を止める。記録済みDev sourceの`onEmployeeDeleted`はEmployee削除eventからUser/Authを削除する。現行版の無作用handlerを先行更新し、archiveやRules切替より前に連鎖削除を止める。

`archiveEmployee`のcode反映とtenant開放を分離する。初回反映では通常用`AIR_GUARD_EMPLOYEE_ARCHIVE_TENANTS`を未設定または空集合に保ち、deny-by-defaultを維持する。tenant追加とそのための再反映は、No.6のdata・参照整合、No.7のbackup／停止／rollback、明示承認を満たした後の別操作とする。

`runDailySiteTermination`はdeploy後に日次writeを開始し得るため、通常closureと同時に公開しない。No.6で対象field・予定・indexを確認し、No.7でbackup／停止／rollbackを確定し、明示承認を得た後に最後に反映する。

### Dev反映時の順序

実deploy command、target project、remote revision、indexのREADY状態は後続のrelease checkpointでactual targetへ照合する。現時点で固定できる順序は次のとおりである。

1. release source、対象project、remote revision、選択function、無書込み時間帯をread-only preflightで固定する。
2. 必要なFirestore indexだけを先に反映し、利用するindexがREADYになるまでquery・schedulerを有効化しない。既存で同一定義がREADYなら再反映しない。
3. `runDailyTask`と`onEmployeeDeleted`を安全化先行で更新し、deployed revisionと正常状態を確認する。
4. 残るserver closure 18件を限定反映し、Callable／triggerのdeployed revisionと正常状態を確認する。Employee archive allowlistは空のままとする。
5. 対象会社の無書込み時間帯を開始し、master・予定・実績・請求の旧tabで保存しないことを確認する。
6. `firestore.rules`全体を反映する。Rulesの一部だけを旧版と組み合わせない。
7. 同じrelease sourceから生成・identity確認したHosting artifactを反映する。RulesからHostingまでをboundedに連続実行する。
8. 対象browserを再読込し、必要なactorは再ログインする。新clientとserver revisionの組合せで技術smokeを終えてから無書込み時間帯を解除する。
9. `runDailySiteTermination`とEmployee archive tenant開放は、それぞれの追加条件と明示承認を満たした場合だけ別に実施する。

Functionsを先行するのは、新clientが未反映APIを呼ぶ期間を作らないためである。RulesをHostingより先行するのは、archive UIを公開した後に旧Rulesが参照新設や直接writeを許す期間を作らないためである。Rules先行中は旧client保存が拒否され得るため、手順5の無書込み時間帯を組み合わせる。

### 中断・rollback境界

- index、Functions安全化、server closureの各段階で失敗した場合は、Rules／Hostingへ進まない。
- Rules成功後にHostingが失敗した場合は無書込みを継続し、旧client保存を再開しない。旧Rulesへの自動復帰で権限を再拡大せず、原因修正後のforward releaseを第一候補とする。
- Hostingだけを旧版へ戻すと、新Rulesに対して旧client writerが不整合となるため、単独rollbackを安全とはみなさない。
- Functionsだけを旧版へ戻すと、新client API不在、旧自動終了、Employee削除連鎖が再発し得るため、単独rollbackを安全とはみなさない。
- Rulesだけを旧版へ戻すと、直接writeと参照raceを再び許すため、通常rollbackにしない。coordinated rollbackが必要な場合は、書込み停止、data状態、戻すsource一式を確認して別承認する。
- schedulerまたはEmployee archive開放後の停止・復旧はNo.7で具体化する。現時点ではdata rollback可否を断定しない。

### No.5の検証選定

今回証明する事項はsource上の旧client互換境界、記録済みDevとの差分、反映依存順であり、runtime機能の再証明ではない。既存のLocal domain／Emulator／Chrome UI／build結果はNo.5の文書変更で失効しないため再実行しない。文書変更で失効する`project-docs`とdiff checkだけを最終状態で実行する。直前のgovernance変更で成功した`managed-governance`、`project-docs-negative`、`capacity-regression`は各gateの`invalidatedBy`に該当する変更がなく、既存検証でカバー済みとする。

## No.6 既存data・index確認範囲

### このCheckpointで確定する範囲

No.6はremote全件診断やmigration実行ではなく、差分とreader／writerから、後続の承認済みread-only preflightで確認しなければならない範囲を限定するCheckpointである。`.firebaserc`のDev aliasは`air-guard-v2-dev`、`firebase.json`のdatabase候補は`(default)`だが、実行時のcritical identifierとしては未確定である。2026-09-03のreceiptではSTANDARD／FIRESTORE_NATIVE／`asia-northeast1`／PITR有効だったが、現在状態はactual targetから再確認する。

Firestore接続を開始する最初の工程でdatabase一覧と対象database詳細をread-only取得し、project、database ID、edition、mode、location、PITRを固定する。承認前は専門guideやcommandを現在のeditionへ決め打ちしない。

### master別の確認範囲

| 範囲 | 既存証拠から再実行しない事項 | 新たに確認が必要な事項 | migration判断 |
|---|---|---|---|
| Customer | 2026-09-03にCustomers 90件を取得し、34件適合・56件は既知の任意文字列／field-set互換不適合だった。後続の通常create・更新は成功した。Customer schema自体は今回変わらないため、このreleaseだけを理由に同じ全件保存形式検査を反復しない | archiveを実行するexact対象についてactive原本、同ID archive、Sites／OperationResults／Billings参照をAPI自身がtransactionで確認する。既存flat archiveや衝突を一括変換しない | active Customerの一括migrationなし。通常操作が既知不適合で失敗した場合だけ対象field・操作を限定して再判断 |
| Site | SITE-08で欠損する略称・工期sourceを既定値で評価するLocal互換を確認済みで、全件backfillを要求しない | 選択tenantのSitesについて、一覧queryに必要な`status/updatedAt`、工期sourceと3つの派生boolean、任意`scheduleRevision`、Customer IDとexact埋込みprojection、archive envelope／同ID衝突を値非出力の集計で確認する。自動終了候補はACTIVE＋工期終了日時だけへ限定し、候補Siteに関係する予定のID・日付・実績化状態を確認する | 一覧から脱落する必須query field、工期派生値不一致、または不正revisionが実在すると確認した場合だけ限定補完を計画。現在値を過去snapshotとして推測補完しない |
| Outsourcer | 現行一覧・検索・配置候補はstatusで絞らず、通常一覧は`nameKana`とdocument ID順である。`contractStatus + updatedAt` composite indexは現行受入れ経路の必須indexではない | 受入れに使う新規または指定対象だけ、exact 11 field、status、tokenMap、監査fieldと正規actorを確認する。既存archive、重複、参照件数の全件scanは行わない | archiveを提供せずlive保持するため一括migrationなし。通常編集で具体的な不適合が出た対象だけ再判断 |
| Employee本体 | optional `insuranceOperationVersions`不存在はlegacy互換として検証済みであり、存在しないdocumentへ一括補完しない | 受入れ対象について既知field、雇用状態と退職日、保険map／世代値、同ID archive、User／Auth／予約／lifecycle状態を確認する | 本体一括migrationなし。対象の不正型・相関不一致は自動修復せずarchive開放を停止 |
| Employee参照索引 | Localでは純粋検査と6 collectionの保存経路を確認済みだが、remote整合を証明しない | archive開放候補tenant全体の`SiteOperationSchedules`、`OperationResults`、`ArrangementNotifications`、`DailyAttendances`、`DailyOperationsByEmployee`、`Billings`について、raw明細から導くEmployee集合と`employeeIds`または`employeeId`の一致を完全走査する。6 collectionすべての取得完了が必要。User、予約、lock、head、LifecycleOperations、SiteEmployeeHistoriesはarchive exact対象の12従属queryで別確認する | 欠損・不一致が1件でもあればtenant開放不可。所属Employeeを一意に導出できる範囲だけ、別承認のbackfill dry-run／apply／post-checkを設計する |

`functions/modules/employees/inspectEmployeeReferences.js`は、callerが供給したrawだけを検査するlibraryであり、remoteへ接続するCLIではない。既存Customer toolをEmployeeへ流用せず、Employee archive開放を必要とする場合は、明示tenant、取得上限または完全走査、pagination、値・ID非出力、全6 collection完了、digest、credential／Emulator拒否を備えたread-only readerを別Checkpointで実装・検証する。dry-runの`archiveReady`は常にfalseのままとし、検査成功だけで開放しない。

### indexの判定

現行`firestore.indexes.json`は17 composite indexと3 field overrideを持つ。remoteでは定義の存在だけでなく状態を確認し、今回使用するqueryがREADYの定義だけを「既存でカバー済み」とする。

- 初回client／server closureに必要なもの: Customer・Employee・Siteの一覧、OperationResult履歴、SiteOperationSchedule保存／検索、既存UWB query等、実際に反映するsourceから到達するqueryの定義。
- Site自動終了まで保留できるもの: Sites collection-groupの`status + constructionPeriodEndAt + __name__`。`runDailySiteTermination`を公開する前にREADYを必須とする。
- 現行4マスター受入れに不要と確認できたもの: Outsourcersの`contractStatus + updatedAt + __name__`は、現行一覧・検索がstatus／updatedAt queryを使わないため、この経路の新規作成理由にしない。ただしremoteからの削除も行わない。
- 全config反映前に別途照合するもの: 4マスター外のUsers composite indexと3 field override、既存remoteにだけある定義。未知定義や削除候補があればindex deployを停止し、機械的な削除を承認範囲へ含めない。

remoteで同一定義がREADYなら再作成・再deployしない。不足分だけを追加候補とし、BUILDING／ERRORはREADYになるまで依存query・scheduler・受入れを開始しない。exact remote状態の取得、index追加、data読取りはbounded Dev release checkpointの承認後に行う。

### No.6の判断結果

初回releaseはEmployee archive tenant allowlistを空、`runDailySiteTermination`を未公開に保てば、既存dataの補完・migrationを前提にせず進められる。初回release前の全tenant既存data scanも不要である。既存data確認が必須なのは、後段のSite自動終了に関係するquery／工期候補と、Employee archiveを開放するtenantの参照索引である。結果が得られる前に「archive開放可能」「scheduler実行可能」とは確定しない。

## No.7 backup・停止・rollback計画

### 2026-09-07に利用者から確認できたDev運用条件

利用者説明から、Devには次の3区分のtenantが存在すると確認した。repositoryには実company ID、名称、account、dataを記録しない。

1. 利用者自身の会社: 利用者だけが使用し、任意の時間に作業停止できる。
2. 知人の会社: 本番運用ではなく主にUI改善意見の収集に使用し、業務dataの不整合を許容できる。
3. Codex検証用会社: 合成test用であり、新旧client切替中のdata保全を通常利用会社と同じ条件にしなくてよい。

この運用条件はdata整合・backup・停止を簡素化できる根拠である。一方、tenant分離、認証・認可、User/Auth削除、秘密情報、他tenant作用、対象外serviceへの変更、予期しない全体破壊を許容する根拠にはしない。

利用者は2026-09-07に、以下の簡素化案をNo.7の確定方針として承認した。

### releaseを二段階へ分離する

| 段階 | 含めるもの | data作用 | backup判断 |
|---|---|---|---|
| A. 初回4マスターrelease | No.5のindex不足分、Functions安全化2件、server closure 18件、Rules、Hosting。Employee archive allowlistは空、Site自動終了Functionは未公開 | deploy自体による既存document変換なし。受入れは原則として区分3の合成dataを使い、区分1の既存data操作は利用者が明示した対象だけ | 全体snapshot、全tenant scan、migration dry-run、System／Company maintenanceを要求しない。remote revision、既知正常source、index／Rules／Functions／Hosting identityを復旧根拠として保存する。合成dataはexact ID、開始時不存在、許可した作成・cleanupだけを記録する |
| B. data作用を伴う後段 | 必要と確認されたEmployee参照索引backfill、Employee archive tenant開放、`runDailySiteTermination` | 既存document更新、live Employeeのarchive移動、Site status変更が起こり得る | 別の明示承認、Transitional quiet mode、連続dry-run、整合snapshot、fresh dry-run、post-checkを必須とする |

既存Admin SDKの会社backupは`LEGACY_COMPANY_LOGICAL` v1／coverage `INCOMPLETE`である。16 legacy collectionには今回必要な`DailyOperationsByEmployee`、`SiteEmployeeHistories`、Employee lifecycle／予約系等が含まれず、PrivateSettings等も除外される。このためNo.7の完全backupまたは全面restoreとして採用しない。関連repositoryはread-only確認だけで、変更・実行しない。

段階Bでdata変更が必要になった場合は、現在のdatabase editionと運用手順へ照合したFirestore managed exportを候補とし、対象project／database、operation、保存先、開始・完了時刻、errorなし、scope、保持・復元制約をreceipt化する。PITR有効という履歴情報だけで、cutoff時点の整合snapshotやAuthentication backupを代替しない。Authenticationを変更しないplanを維持し、既存の実Employee／User／Authをarchive受入れ対象にしない。Authenticationへ作用する必要が生じた時点で、backupと復旧不能範囲を追加提示して停止する。

### 停止modeと静穏化

段階Aは既存dataを変換せず、自動変更を行う2機能を無効のままにするため、maintenance・data change runbookの実行Checkpointにせず、次の簡素なbounded切替とする。

- 区分1だけはRules反映開始からHosting反映・再読込完了まで利用者が保存を停止する。区分2はdata整合上の停止を必須とせず、旧clientの保存拒否または不整合を受容する。区分3はCodexが操作を止めて切り替える。
- 区分2・3でも旧tabの継続利用を推奨せず、新Hosting反映後に再読込する。tenant分離・認可・予期しない削除のerrorは「許容した不整合」として無視しない。
- 初回受入れは区分3の新規合成dataを基本とする。区分1での確認は既存dataを変更しないreadと、利用者が対象・復元を明示した通常操作だけにする。
- 区分1の停止確認、Functions安全化、Rules→Hostingの連続反映、再読込、技術smokeを一つの短いcutoverにする。固定時間のmaintenance待機、連続data digest、snapshotは追加しない。

段階Bで区分1または全tenantへ既存data変更が及ぶ場合は、現行maintenanceが通常writeをserverで完全拒否しないため**Transitional quiet mode**を選ぶ。Gate-ready成功とは報告しない。Employee archiveはまず区分3だけを開放候補にできるが、確認済み仕様にあるtenant全体の6 collection整合検査を省略するには仕様変更承認が必要であり、No.7の簡素化からは推論しない。`runDailySiteTermination`は全tenantへ作用するため、区分2・3のrisk受容だけでは区分1の確認・snapshot条件を省略できない。

1. 段階Aでは区分1の利用者が作業停止し、区分3のCodex操作も止める。段階Bでは作用するtenantとbackground writerに応じて停止対象を追加する。
2. 対象のmaster、予定、実績、請求tabを閉じる。maintenance画面を使う場合も補助であり排他証拠にしない。
3. cutoff後、対象Callable／trigger／scheduled処理の実行状況とerrorを確認する。特に`runDailyTask`、`onEmployeeDeleted`、`onUpdateCustomer`、`onOperationResultChange`、予定・通知・User lifecycleを観測対象にする。
4. 段階Aは日次taskの00:00 JST付近を避け、実行中operationなしを確認して直ちに連続反映する。段階Bのquiet periodは固定分数を推測せず、actual Functions設定、実行中operation、schedule時刻、trigger chainから決める。
5. 段階Bでは同じread-only dry-runを連続実行し、件数・分類・digestが一致しblocker 0になってからsnapshotへ進む。snapshot後のfresh dry-runが変化したらapplyしない。
6. Rules→Hosting→新client再読込／必要時再ログイン→技術smokeまで区分1の無書込みを維持する。解除条件が揃う前に区分1の旧tab保存を再開しない。

### 停止条件

- project、database、edition、location、commit、operator、remote revisionのいずれかが計画と一致しない。
- indexに未知差分、削除候補、ERRORがある、または必要定義がREADYでない。
- Functions公開集合、runtime config、Employee archive allowlistが計画と異なる。
- quiet開始後も通常client／Callable／scheduled／trigger writeが続く、または連続dry-runが一致しない。
- Site／Employeeの不正shape、orphan、参照索引不一致、同ID archive衝突、対象増加がある。
- snapshot scope・完了receipt・復元制約を確認できない、またはAdmin SDKの不完全backupしか用意できない。
- deploy／apply／readback／log／browser smokeのいずれかで未説明のerrorがある。

### 失敗時の扱い

| 失敗点 | 既定対応 |
|---|---|
| index／Functions安全化／server closure前後 | Rules／Hostingへ進まず、成功済みserviceとrevisionを記録してforward correctionを判断 |
| Rules成功・Hosting失敗 | 無書込みを維持。旧Rulesへ自動復帰せず、同じsourceのHosting是正を優先 |
| Hosting後のclient不具合 | 旧clientを再開しない。新clientとserverのどちらを是正するかを影響差分から決め、単独Hosting rollbackを安全とみなさない |
| migration部分失敗 | maintenance／quietを維持し、現在状態を再読込してdry-runを作り直す。推測delete・全体restore・同じapplyの無条件再送をしない |
| Employee archive後 | allowlistから対象tenantを外して新規操作を止める。旧`onEmployeeDeleted`や直接writerを戻さず、archiveをgeneric restoreしない。exact preimageと現在状態から別承認repairを作る |
| Site自動終了後 | schedulerを止め、対象Siteの前後証拠を固定する。statusだけを推測でACTIVEへ戻さず、予定・工期・競合を再確認した限定repairを別承認する |

段階Aのrollbackはdata restoreではなく、書込み停止下のcorrective／forward releaseを第一候補とする。段階BはGit revertだけでdataを戻せない。managed exportも通常の全体restoreを自動実行する許可ではなく、復旧はexact対象・precondition・影響を提示した別承認操作とする。

### No.6・No.7の検証選定

今回証明する事項はread-only確認範囲とrelease／backup／rollback手順の具体化であり、remote状態やruntime動作の再証明ではない。Local domain、Emulator、Chrome UI、build結果は文書変更で失効せず、同じ結果を再確認しない。`build-release-deploy`のcompletion gate集合のうち、文書変更で失効する`project-docs`とdiff checkだけを最終状態で再実行する。`managed-governance`、`project-docs-negative`、`capacity-regression`は各`invalidatedBy`に該当する変更がなく、既存成功証拠を再利用する。remote read、index照合、snapshot、build、deploy、migration、data変更は未実行である。

## 後続Checkpointへ渡す未確認事項

1. No.8: 権限別account、合成data、Customer新UIを含む受入れ操作、外部作用、cleanupを具体化する。
2. No.9: No.6で必要性を限定したread-only preflight／dry-runに不足するlocal tool、最終差分、gateを確認する。
3. No.10: actual Dev targetのread-only preflight結果を含むbounded release checkpointを提示し、明示承認後だけbuild／remote変更へ進む。

## No.4の検証選定

今回証明する事項はlocal sourceと記録済みDev比較元からのsurface分類であり、runtime動作ではない。既存のLocal domain/Emulator/UI/build証拠は変更されず、同じ機能動作を再証明する必要がないため再実行しない。文書追加により失効する`project-docs`と`diff-check`だけを最終状態で実行する。直前のgovernance変更で成功した`managed-governance`、`project-docs-negative`、`capacity-regression`は各`invalidatedBy`に該当する変更がなく、既存検証でカバー済みとする。
