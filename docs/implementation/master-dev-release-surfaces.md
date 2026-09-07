# 4マスター Dev反映前 release surface inventory

- 状態: `MASTER-DEV-PREFLIGHT-01` No.5 完了
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

## 後続Checkpointへ渡す未確認事項

1. No.6: Devのindex全17件・field override 3件と4マスター関連16件の状態、既存documentの必要field・埋込みEmployee索引・archive shape、補完やmigrationの必要範囲。
2. No.7: backup、停止条件、部分成功時の復旧先と再開条件。
3. No.8以降: 権限別account・受入れ操作、最終差分・gate、bounded Dev releaseの承認。

## No.4の検証選定

今回証明する事項はlocal sourceと記録済みDev比較元からのsurface分類であり、runtime動作ではない。既存のLocal domain/Emulator/UI/build証拠は変更されず、同じ機能動作を再証明する必要がないため再実行しない。文書追加により失効する`project-docs`と`diff-check`だけを最終状態で実行する。直前のgovernance変更で成功した`managed-governance`、`project-docs-negative`、`capacity-regression`は各`invalidatedBy`に該当する変更がなく、既存検証でカバー済みとする。
