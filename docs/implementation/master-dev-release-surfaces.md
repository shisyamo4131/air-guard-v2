# 4マスター Dev反映前 release surface inventory

- 状態: `MASTER-DEV-PREFLIGHT-01` No.4 完了
- local source baseline: `7ce7b485c7bb1350b9112b2a12075d6bedf25e7e`
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

## 後続Checkpointへ渡す未確認事項

1. No.5: 旧client継続条件、Rules/Functions/Indexes/Hostingの順序、一括または限定Functions deploy、停止要否、互換性とrollback。
2. No.6: Devのindex全17件・field override 3件と4マスター関連16件の状態、既存documentの必要field・埋込みEmployee索引・archive shape、補完やmigrationの必要範囲。
3. No.7: backup、停止条件、部分成功時の復旧先と再開条件。
4. No.8以降: 権限別account・受入れ操作、最終差分・gate、bounded Dev releaseの承認。

## No.4の検証選定

今回証明する事項はlocal sourceと記録済みDev比較元からのsurface分類であり、runtime動作ではない。既存のLocal domain/Emulator/UI/build証拠は変更されず、同じ機能動作を再証明する必要がないため再実行しない。文書追加により失効する`project-docs`と`diff-check`だけを最終状態で実行する。直前のgovernance変更で成功した`managed-governance`、`project-docs-negative`、`capacity-regression`は各`invalidatedBy`に該当する変更がなく、既存検証でカバー済みとする。
