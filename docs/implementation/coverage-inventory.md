# 実装仕様調査カバレッジ棚卸し

> **Current review-depth (2026-08-12):** SPEC-DEEP-045a/045b and schema checkpoints 046〜054 completed — A 519, B 0, C 0, D 11, E 1, Unknown 0; remaining B/C 0 files in 0 execution checkpoints. The [deep review plan](deep-review-plan.md) is authoritative for exclusive assignment.

- 状態: 棚卸し（実装仕様の新規断定を目的としない）
- 対象セグメント: SPEC-SEG-045
- 最終確認日: 2026-08-12
- 根拠: `rg --files`による`pages/`、`components/`、`composables/`、`stores/`、`services/`、`utils/`、`functions/`、関連schemas `src/`のファイル名、route/import/export対応、および既存`docs/implementation/*.md`の対象・未確認範囲
- 制約: 新しい業務実装本文は深読みに入らず、coverage判定は文書とfile/symbol対応の有無に基づく。

SPEC-AUDIT-001で531 source filesを機械再照合した。分類方法、母数、重複/漏れ検査、未被覆clusterは[coverage mechanical audit](coverage-audit.md)を参照する。

> **review-depth進捗:** 本文精査の完了判定にはMechanical Coveredを使用しない。SPEC-DEEP-045a/045b反映後はA 519、B 0、C 0、D 11、E 1、Unknown 0である。排他的割当と終了条件は[deep review plan](deep-review-plan.md)を正とする。

## coverage基準

- **Covered**: 独立implementation文書があり、主要route/model/entry/data flowと境界が記録される。文書内に未確認事項があっても、対象segmentの責務は調査済み。
- **Partially covered**: 隣接文書で入口・一部component/schemaのみ扱うか、主要routeの特定操作だけを扱い、一覧/詳細/補助機能等が未調査。
- **Uncovered**: file/domainは存在するが、専用文書または明確な既存文書scopeがない。
- **Inventory only**: test/dev-only候補、asset、helper等で、deployment/業務仕様上の位置付け自体が未決定。

この分類は品質・完成度・本番運用可否を示さず、本文深読みによる再検証前の調査ナビゲーションである。

## 文書 / source map

| 領域 | 主なimplementation文書 | 主要source群 | 判定 |
| --- | --- | --- | --- |
| app entry/layout/navigation/access | app-shell、page-access、layout-navigation-components | app.vue、layouts、middleware、plugins、pageSettings、shell components | Covered |
| auth/User/state/authorization | state-initialization、user-auth-lifecycle、authorization-model、callable-authorization | 4 core stores、auth actions、auth-v2 callable guards/target/UI/Rules、User、settings/users | Covered |
| shared data/UI/error | data-management-composables、shared-ui-components、organisms-components-deep-review、error-logging-feedback | useFetch/base managers、atoms/molecules/organisms、error/loading/message stores | Covered（選定された共通部品。全componentではない） |
| Company/System/subscription | company-settings、system-maintenance、subscription-stripe | settings/company、Company/System、maintenance、Stripe module/UI | Covered（Stripe export停止状態を含む） |
| Customer/Site/Agreement/Article | customer-master、site-master、agreement-master、article-master | master pages/components/schema/Rules | Covered |
| Employee/Outsourcer/qualification/OJT/Insurance | employee-master、employee-insurance、outsourcer-master、outsourcer-components-deep-review、qualification-management、ojt-education | master pages/components/schema/Rules、Insurance current/history/transition UI | Covered |
| SiteOperationSchedule/arrangement | site-operation-schedule、arrangement-notifications、arrangement-notification-ui | schedule/arrangement pages/components/composables/triggers | Covered |
| OperationResult生成・派生同期 | operation-result-generation、operation-result-delete-chain、daily-attendance-sync、daily-operations-sync、site-employee-history-sync、billing-aggregation-sync | generator、OperationResult trigger、delete時の4派生＋cleanup fan-out、各module/schema | Covered（一覧/詳細/汎用CSVは別文書） |
| Billing操作・回復・PDF | operation-billing-recovery、billing-access-and-manual-adjustment、billing-lifecycle-ui、billing-invoice-pdf、tax-cutoff-billing-primitives | billings routes/components/composables/Billing/OperationBilling | Covered |
| Attendance表示/export | attendance-ui、attendance-export | attendances routes/components、DailyAttendance、CSV utils | Covered |
| Notification/PWA | pwa-notifications、notification-delivery、notification-authorization | service worker、messaging plugin、Notification/FcmToken、trigger | Covered |
| Operation/SecurityReport | operation-management、security-report | operation service/schema、SecurityReports components/storage trigger | Covered |
| address/archive/admin/cloud surface | address-geocoding、archive-restore、admin-backup-recovery、cloud-functions-catalog | geocoding、adapters、Admin SDK、functions entry | Covered |
| ledgers / coverage audit | future-actions、pending-confirmations、coverage-audit、review-reconciliation-2026-08-12 | FUT-0001〜0183、CONF-0001〜0138、531-file inventory | Cross-cutting |

## route coverage

| routes | 判定 | 対応文書 / gap |
| --- | --- | --- |
| `/`, `/auth/*`, `/maintenance`, `/unconfirmedEmail` | Covered | app-shell、page-access、user-auth-lifecycle、system-maintenance、`auth-onboarding-ui.md`。login/signup/reset/verificationの画面契約と直接作用を調査。 |
| `/dashboard` | Covered | `dashboard.md`でwidget、query、7日集計、表示条件、navigationを調査。 |
| `/customers`, `/customers/[id]` | Covered | customer-master。 |
| `/sites`, `/sites/[id]`, `/sites/terminated` | Covered | site-master。 |
| `/employees`, `/employees/[id]`, `/employees/resigned` | Covered | employee-master、qualification-management、ojt-education。 |
| `/outsourcers` | Covered | outsourcer-master。 |
| `/articles` | Covered | article-master。 |
| `/operation-schedules`, `/arrangements-manager` | Covered | site-operation-schedule、arrangement-notification-ui。 |
| `/operation-results/generator` | Covered | operation-result-generation。 |
| `/operation-results`, `/operation-results/[id]` | Covered | `operation-result-ui-export.md`で一覧抽出、詳細編集/削除/複製を調査。生成・同期は既存文書参照。 |
| `/attendances`, `/attendances/export` | Covered | attendance-ui、attendance-export。 |
| `/billings/operations/*`, `/billings/customers/*` | Covered | billing recovery/access/lifecycle/PDF群。route別重なりが大きく、field責務の正本整理は必要候補。 |
| `/settings/company`, `/settings/users`, `/settings/checkout` | Covered | company-settings、user-auth-lifecycle、subscription-stripe。 |
| `/super-user` | Covered | `super-user-operations-ui.md`で2 rebuild操作、tenant、UI/server guard、誤操作・監査境界を調査。 |
| `/test/*` 5 routes | Covered | `test-development-routes.md`でproduction到達候補、client guard、Firestore作用、破壊的rollback、重複/未登録routeを調査。正式な保持・production除外方針はCONF-0136。 |

## component / composable / store coverage

### Components

Coveredまたは主要flow内で部分確認済みの大分類はAgreement、ArrangementNotification(s)、Arrangements、Article(s)、Company、Customer(s)、DailyAttendance、Employee(s)、OperationBilling(s)、OperationResult(s)、OperationSchedules、Outsourcer(s)、SecurityReports、Site(s)、SiteOperationSchedule(s)、User(s)、Worker(s)、共通atoms/molecules/organismsである。

専用調査が不足する分類は次のとおり。

| component群 | 判定 | gap |
| --- | --- | --- |
| Charts | Covered〜Partial | dashboardのWeeklyOperationQuantityBarは`dashboard.md`で調査。他chart追加時は再棚卸し。 |
| Insurance | Covered | `employee-insurance.md`で9 Vue components、schema、保存・遷移・権限境界を調査。 |
| SiteShiftTypeOrder / Draggable | Covered | `site-ordering.md`でCompany内2配列、補完、drag、保存失敗、競合、欠損Site、旧実装候補を調査。 |
| SiteEmployeeHistory | Covered | Functions同期に加え`site-employee-history-ui.md`でquery、表示、privacy/Rules境界を調査。 |
| Tag、DayType、ShiftType、SecurityType、EmploymentStatus | Covered | `enum-field-input-contracts.md`で選択肢、保存型、default、unknown、validationを横断整理。 |

### Composables / services / utils

| source群 | 判定 | 対応 / gap |
| --- | --- | --- |
| fetch/base manager、dialog/overlay、logger | Covered | data-management-composables、error-logging-feedback、shared-ui-components。 |
| auth/system/arrangement/schedule/user actions | Covered | 各domain文書。 |
| billing/customerBilling/OperationBilling managers | Covered〜Partial | billing文書群で主要操作は確認済み。composable相互の重複責務は未統合。 |
| date/range/timed/regular-time/performance | Covered | `date-range-performance-utilities.md`で固定5 utilityのJST range、debounce、timer/cache lifecycleを調査。regular-timeはrounding文書を参照。 |
| `services/operation.js` | Covered | Operation文書で責務境界と直接APIを確認済み。 |
| `utils/formats/util.js` | Covered | SPEC-DEEP-045bで`formatNumber`/`formatCurrency`の公開契約、Intlへの直接委譲、直接caller、validation非担当境界を確認。 |
| `utils/billings/calculateTaxBreakdown.js` | Covered | `tax-cutoff-billing-primitives.md`でschema/client差、税率別集約、端数、負数境界を調査。 |
| `utils/csv/exportOperationResultsCsv.js` | Covered | `operation-result-ui-export.md`。実入口はOperationResult画面でなくBilling groupである。 |
| `utils/generateCollectingReport.js` | Covered | `collecting-report-utility.md`で、実体は運転日報PDF、caller 0件、browser open作用、input/error/privacy境界を調査。 |
| arrangement sheet PDF composables | Covered | `arrangement-sheet-pdf.md`で日別配置表の入力、mapping、layout、browser openを調査。 |
| `useSiteOrderManager` / site shift order data layer | Covered | `site-ordering.md`。現行type対応3 composableと未使用旧composable候補を分離。 |

### Stores

全7 storeはstate-initialization、layout-navigation-components、error-logging-feedbackでCovered。業務data storeは存在せず、data layer composablesが担当する構成として棚卸しできる。ただしstore全getter/actionの再横断比較ではなく、各文書scope内の確認である。

## Functions / schema coverage

### Functions

`cloud-functions-catalog.md`でentry到達25 Function objectとunexported候補をCovered。auth-v2の8 callableは`callable-authorization.md`で入口guard、target/tenant解決、直接UI、Users/Companies Rulesまで再検証した。OperationResult派生、通知、SecurityReport、maintenance等の主要chainは個別文書へ対応する。

Partially coveredまたはUncoveredな内部moduleは次である。

- `modules/sites/autoTermination.js`: Covered。`site-auto-termination.md`でschedule順序、3か月条件、全tenant query/batch、部分失敗、retry、将来予定・再有効化raceを調査。
- `modules/migration.js`: entry未exportのtestGeopointMigration。dev/test用途・廃止判断未整理。
- `modules/stripe.js`: subscription文書で実装とexport停止を確認済みだが、再公開条件は未決定。
- `modules/utils/ContextualError.js`: error基盤文書で横断全利用を確認していない。

### Schemas

Coveredな主要schemaはCompany、System、User、Customer、Site、Agreement/AgreementV2、Article/ArticleDetail、Employee、Outsourcer、ArrangementNotification、SiteOperationSchedule/Detail、OperationResult/Detail、OperationBilling、Billing、DailyAttendance、DailyOperationByEmployee、SiteEmployeeHistory、Notification/Recipient、FcmToken、Operation/Detail、SecurityReportIndexである。

| schema領域 | 判定 | gap |
| --- | --- | --- |
| Insurance | Covered | `employee-insurance.md`。 |
| RoundSetting | Covered | `rounding-and-time-calculation.md`でmode、Company保存、client/server差、売上/税/時間適用、test routeを調査。 |
| SiteOrder | Covered | `site-ordering.md`でkey、Company保存、配列API、未定義ScheduleOrder境界を調査。 |
| Tax | Covered | `tax-cutoff-billing-primitives.md`で固定税率、課税対象、単票/統合、adjustment/Article、validation差を調査。 |
| WorkingResult / WorkTimeBase | Partially covered | OperationResult系の直接基底として必要部分のみ確認。横断日時/休憩計算契約は未統合。 |
| Certification | Covered〜Partial | qualification-managementでEmployee保持・配置境界を扱うが、旧/別命名との互換性は未整理。 |
| constants / fieldDefinitions / accessors / CutoffDate | Covered〜Partial | enum/主要field definitionは`enum-field-input-contracts.md`、CutoffDateは`tax-cutoff-billing-primitives.md`で調査。全accessor catalogだけは未実施。 |

## 重複・訂正候補

- Billingは5文書に分かれ、OperationResult→Billing集計、OperationBilling手動調整、Customer billing lifecycle、PDFが隣接する。`Billing`と`OperationBilling`の用語・lock/status・source-of-truthを横断索引で整理する余地がある。
- ArrangementNotificationはdata contract、UI、OperationResult generatorの3文書にまたがる。承認済み任意状態遷移とFunctions通知副作用の参照先を一本化する余地がある。
- OperationResult deleteは`operation-result-delete-chain.md`で、派生4系統と独立Storage/schedule cleanup triggerのfan-out、部分成功、retry/rebuild境界を統合済みである。
- Customer/Site/Agreement snapshot/live境界はmaster、billing、schedule文書へ重複する。field単位のsnapshot ownership表は未整備。
- page-accessとauthorization-modelはclient route判定を扱うが、個別文書の「権限」表が暫定実装を確定仕様のように読めないか横断reviewが必要。
- implementation directory内のREADME/indexは作成済みである。正本`docs/README.md`からの索引追加は今回の書込みscope外である。
- `daily-operations-sync.md`の表記は実class/collection `DailyOperationByEmployee(s)`との名称差があり、文書titleは既に具体化されているがfile名だけでは検索時に曖昧である。
- 各文書の最終確認日と根拠形式は概ね揃う一方、「未確認範囲」「要確認事項」「仮説」の見出し名が文書ごとに異なる。内容矛盾ではないが機械的coverage抽出を難しくする。

この棚卸しでは本文を再読して矛盾を確定していない。上記は訂正・統合レビュー候補である。

## 優先セグメントbacklog

SPEC-SEG-062時点の**mechanical** audit backlogは0件であり、SPEC-DEEP-045a/045b反映後のreview-depth backlogもB/C 0 files、0 execution checkpointsである。D/Eは分類済みのtest/config/asset・外部境界であり、runtime検証済みという意味ではない。

## 未確認範囲

- `rg --files`と名前・import/export/route対応を超える新規業務本文、runtime behavior、実data、Emulator/UI、external services。
- 全componentのprops/emits/slots、全composable API、全schema field、全Rules/Functions本文の再走査。
- 各implementation文書の全主張をsourceへ再照合する独立review、文書間全field差分、リンク切れ検査。
- remote deployment、production bundleからtest routeが除外されるか、実利用頻度・運用重要度。
- backlog優先度はsecurity/data integrity/coverage gapに基づく暫定調査順で、承認済みroadmap優先度ではない。
- 531-file inventoryの分類は`coverage-audit.md`のcluster規則による。Covered fileの全APIを個別に深読した意味ではない。
