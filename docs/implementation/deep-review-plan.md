# 531-file deep review plan

> Current progress (2026-08-12): SPEC-DEEP-045a/045b and schema checkpoints 046〜054 completed. Cumulative B/C→A promotions: 513; A 519, B 0, C 0, D 11, E 1, Unknown 0; remaining B/C 0 files in 0 execution checkpoints.

- 状態: 詳細精査計画
- 対象チェックポイント: SPEC-DEEP-AUDIT-001
- 最終確認日: 2026-08-12
- 対象: app `pages/components/composables/stores/plugins/middleware/utils/services/functions` 456 files、schemas `src` 75 files
- 根拠: `rg --files` path inventory、既存implementation文書のSource/Scope/checkpoint証拠
- 制約: このcheckpointではcode本文を読んでいない。分類は過去調査証拠だけに基づく。

## depth判定

- **A Deep-reviewed**: file本文のresponsibility/public API、主要分岐、error、side effect、direct callerまで実際に精査した証拠がある。
- **B Flow-reviewed**: 業務flowの必要箇所だけを精査し、file全公開契約は未確認。
- **C Mapped-only**: file名/import/domain対応だけ、または本文精査証拠が曖昧。
- **D Generated/config/test/asset**: deep review終了条件上、生成物/config/test/assetとして別管理する。
- **E External boundary**: app側re-exportだけで実体がpackage境界にある。
- **Unknown**: 分類不能。今回は0。

過去文書内に正規化した完全pathが直接現れる非A fileをB、親domain対応だけのfileをCとする保守的な証拠規則を使った。schemaはclass名をflow中に読んでいてもfile全公開契約の証拠が揃わないため原則Cとした。

## 現在の分類

| depth | count |
| --- | ---: |
| A | 519 |
| B | 0 |
| C | 0 |
| D | 11 |
| E | 1 |
| Unknown | 0 |
| **total** | **531** |

進捗: SPEC-DEEP-045a/045bとschema source reviewがSPEC-DEEP-046〜054を満たした。累計513 filesをB/C→Aへ昇格し、残B/Cは0 files、残execution checkpointsは0。

### A: 再読不要（代表manifestとcompleted rows）

- `composables/useDateUtil.js`
- `composables/useDateRange.js`
- `composables/useTimedSet.js`
- `composables/usePerformanceOptimization.js`
- `composables/validators/rangeValidator.js`
- `utils/generateCollectingReport.js`
- SPEC-DEEP-001の11 files（下記completed row）。詳細は[Functions entry/auth/maintenance deep review](functions-entry-auth-maintenance-deep-review.md)。

### D / E manifest

D 11: `pages/test/*.vue` 5、`utils/fonts/**` 3、`functions/modules/migration.js`、`functions/package.json`、`functions/package-lock.json`。test routeの業務作用は既存文書で扱うが、source inventory上はDとして完了可能とする。

E 1: `functions/schemas/index.js`。隣接schemas packageのre-export境界であり、実体75 filesは別segmentへ割り当てる。

## 初期優先5 segments（履歴）

計画作成時の優先順を履歴として保持する。現在の開始可否は司令塔の明示指示に従い、各checkpoint完了後に停止する。

1. **SPEC-DEEP-001** Functions entry/auth/employee/maintenance（11 files、High）— deploymentと認証境界を最優先。
2. **SPEC-DEEP-002** Functions OperationResult派生同期 entry/billing（12 files、Critical）— billing/partial failure。
3. **SPEC-DEEP-003** Functions Attendance/DailyOperations同期（13 files、Critical）— 勤怠整合性と再実行。
4. **SPEC-DEEP-004** auth/settings/super-user pages（12 files、High）— UI guard、個人情報、外部作用。
5. **SPEC-DEEP-005** stores/plugins/middleware（19 filesを2 checkpointへ分割した前半8 files、High）— 初期化・cleanup・global state。

## 排他的segment manifest

globの`*`は直下file、`**`は全子fileを表す。各rowはA/D/E manifestを除外したB/Cだけを対象とし、row間で重複しない。目安5〜15 filesを基本とし、依存まとまりを壊す場合だけ少数segmentを許す。推定sizeはS（5〜8）、M（9〜12）、L（13〜15）。

| candidate | count | exact glob / list | dependency / risk | size |
| --- | ---: | --- | --- | --- |
| SPEC-DEEP-001 | 11 | `functions/index.js`, `functions/apis/**`, `functions/triggers/**`, `functions/modules/auth/**`, `functions/modules/auth-v2.js`, `functions/modules/Employees.js`, `functions/modules/firebase.init.js`, `functions/modules/maintenance.js` | **completed / A**。entry→auth。High | M |
| SPEC-DEEP-002 | 12 | `functions/modules/billings/**`, `functions/modules/dependentSync.js`, `functions/modules/operationCleanup.js`, `functions/modules/siteEmployeeHistories/**`, `functions/modules/sites/**` | **completed / A**。001後。Critical | M |
| SPEC-DEEP-003 | 13 | `functions/modules/dailyAttendances/**`, `functions/modules/dailyOperationsByEmployee/**` | **completed / A**。001/002後。Critical | L |
| SPEC-DEEP-004 | 12 | `pages/auth/**`, `pages/settings/**`, `pages/super-user/**`, `pages/unconfirmedEmail.vue`, `pages/maintenance.vue`, `pages/index.vue`, `pages/dashboard/index.vue` | **completed / A**。auth flow。High | M |
| SPEC-DEEP-005 | 8 | `stores/**`, `middleware/**` | **completed / A**。001/004後。High | S |
| SPEC-DEEP-006 | 11 | `plugins/**` | **completed / A**。005後。High | M |
| SPEC-DEEP-007 | 5 | `functions/modules/notifications/**`, `functions/modules/utils/notifications.js` | **completed / A**。001後。High | S |
| SPEC-DEEP-008 | 6 | `functions/modules/securityReport/**` | **completed / A**。001後。High | S |
| SPEC-DEEP-009 | 4 | `functions/modules/geocoding.js`, `functions/modules/stripe.js`, `functions/modules/utils/ContextualError.js`, `functions/modules/utils/geocoding.js` | **completed / A**。001後。High | S |
| SPEC-DEEP-010 | 6 | `pages/articles/**`, `pages/customers/**`, `pages/sites/**` | **completed / A**。master入口。Medium | S |
| SPEC-DEEP-011 | 6 | `pages/employees/**`, `pages/outsourcers/**`, `pages/attendances/**` | **completed / A**。PII/勤怠。High | S |
| SPEC-DEEP-012 | 9 | `pages/operation-results/**`, `pages/operation-schedules/**`, `pages/billings/**`, `pages/arrangements-manager.vue` | **completed / A**。operation/billing。High | M |
| SPEC-DEEP-013 | 10 | `components/Agreement/**`, `components/Agreements/**` | **completed / A**。schema agreement後。High | M |
| SPEC-DEEP-014 | 10 | `components/ArrangementNotification/**`, `components/ArrangementNotifications/**`, `components/ArrangementNotificationStatus/**` | **completed / A**。notification schema後。High | M |
| SPEC-DEEP-015 | 10 | `components/Arrangements/**` | **completed / A**。schedule/notification後。High | M |
| SPEC-DEEP-016 | 7 | `components/Article/**`, `components/ArticleDetail/**`, `components/ArticleDetails/**`, `components/Articles/**` | **completed / A**。Article schema後。Medium | S |
| SPEC-DEEP-017 | 7 | `components/atoms/Btns/**`, `components/atoms/chips/**` | **completed / A**。shared UI。Medium | S |
| SPEC-DEEP-018 | 9 | `components/atoms/*.vue`, `components/atoms/alerts/**`, `components/atoms/dialogs/**`, `components/atoms/icons/**` | **completed / A**。shared UI。Medium | M |
| SPEC-DEEP-019 | 13 | `components/Charts/**`, `components/DayType/**`, `components/EmploymentStatus/**`, `components/IsStartNextDay/**`, `components/SecurityType/**`, `components/ShiftType/**`, `components/Tag/**` | **completed / A**。enum/schema後。Medium | L |
| SPEC-DEEP-020 | 8 | `components/*.vue`, `components/Company/**` | **completed / A**。Company/store後。High | S |
| SPEC-DEEP-021 | 10 | `components/Customer/**`, `components/Customers/**` | **completed / A**。Customer schema後。Medium | M |
| SPEC-DEEP-022 | 8 | `components/CustomerBillings/**`, `components/OperationBillings/**`, `components/OperationResults/**` | **completed / A**。billing schema/functions後。High | S |
| SPEC-DEEP-023 | 7 | `components/DailyAttendance/**` | **completed / A**。DailyAttendance schema/functions後。High | S |
| SPEC-DEEP-024 | 14 | `components/Draggable/**`, `components/Worker/**`, `components/Workers/**` | **completed / A**。Employee/Schedule後。High | L |
| SPEC-DEEP-025 | 10 | `components/Employee/*.vue`, `components/Employee/Activator/**`, `components/Employee/Card/**`, `components/Employee/ListItem/**`, `components/Employee/Manager/**`, `components/Employee/ScheduleCalendar/**` | **completed / A**。Employee/User schema後。High | M |
| SPEC-DEEP-026 | 7 | `components/Employee/Certifications/**`, `components/Employee/CustomInput/**`, `components/Employee/Tag/**` | **completed / A**。資格/custom input/Tag。High | S |
| SPEC-DEEP-027 | 11 | `components/Employees/**`, `components/Insurance/**` | **completed / A**。Employee/Insurance PII・履歴。High | M |
| SPEC-DEEP-028 | 12 | `components/molecules/**` | **completed / A**。共有molecules契約。Medium | M |
| SPEC-DEEP-029 | 10 | `components/OperationBilling/**` | **completed / A**。billing funcs/schema後。Critical | M |
| SPEC-DEEP-030 | 14 | `components/OperationResult/**` | **completed / A**。operation schema/functions後。Critical | L |
| SPEC-DEEP-031 | 11 | `components/OperationSchedules/**` | **completed / A**。schedule schema後。High | M |
| SPEC-DEEP-032 | 6 | `components/organisms/**` | **completed / A**。atoms/molecules後。Medium | S |
| SPEC-DEEP-033 | 7 | `components/Outsourcer/**`, `components/Outsourcers/**` | **completed / A**。Outsourcer schema後。High | S |
| SPEC-DEEP-034 | 9 | `components/Site/**` | **completed / A**。Site schema、UI-BASE/MANAGERS後。High | M |
| SPEC-DEEP-035 | 15 | `components/Sites/**`, `components/SiteEmployeeHistory/**`, `components/SiteShiftTypeOrder/**`, `components/User/**`, `components/Users/**`, `components/SecurityReports/**` | **completed / A**。Site/User/report schema後。High | L |
| SPEC-DEEP-036 | 7 | `components/SiteOperationSchedule/effectiveWorker.js`, `components/SiteOperationSchedule/Card/**`, `components/SiteOperationSchedule/CustomInput/**` | **completed / A**。Schedule schema後。High | S |
| SPEC-DEEP-037 | 7 | `components/SiteOperationSchedule/Duplicator/**`, `components/SiteOperationSchedule/ListItem/**`, `components/SiteOperationSchedule/Manager/**`, `components/SiteOperationSchedule/RequiredPersonnel/**`, `components/SiteOperationSchedule/Selector/**`, `components/SiteOperationSchedule/Table/**` | **completed / A**。036後。High | S |
| SPEC-DEEP-038 | 8 | `components/SiteOperationSchedule/Worker/**`, `components/SiteOperationSchedule/WorkerDetailManager/**`, `components/SiteOperationScheduleDetail/**`, `components/SiteOperationSchedules/**` | **completed / A**。036後。High | S |
| SPEC-DEEP-039 | 18 | `composables/*.js`からAの4 filesを除く18 filesを辞書順前半9/後半9の2 checkpoint（039a/039b） | **039a/039b completed / A**。shared/business APIs。High | 2×M |
| SPEC-DEEP-040 | 12 | `composables/application/**` | **completed / A**。domain flow。High | M |
| SPEC-DEEP-041 | 8 | `composables/auth/**`, `composables/domain/**`, `composables/transforms/**` | **completed / A**。auth/aggregation。High | S |
| SPEC-DEEP-042 | 15 | `composables/dataLayers/*.js`, `composables/dataLayers/arrangement/**`, `composables/dataLayers/arrangementNotification/**`, `composables/dataLayers/billing/**`, `composables/dataLayers/dailyAttendance/**` | **completed / A**。query/subscription。High | L |
| SPEC-DEEP-043 | 11 | `composables/dataLayers/dailyOperationByEmployee/**`, `employee/**`, `operationResult/**`, `outsourcer/**`, `securityReport/**`, `site/**`, `siteOperationSchedule/**`, `siteShiftTypeOrder/**` | **completed / A**。query/privacy。High | M |
| SPEC-DEEP-044 | 11 | `composables/fetch/**`, `composables/overlay/**`, `composables/storage/**` | **completed / A**。shared lifecycle/storage。High | M |
| SPEC-DEEP-045 | 13 | `composables/pdf/**`, app `utils/**`からA/Dを除く10 files、`services/**` 1を合わせ、辞書順で7/6の2 checkpoint（045a/045b） | **045a/045b completed / A**。PDF/format/storage。High | 2×S |
| SPEC-DEEP-046 | 7 | schemas `Agreement.js`, `AgreementV2.js`, `Article.js`, `ArticleDetail.js`, `SiteOrder.js`, `Certification.js`, `Insurance.js` | **completed / A**。SCHEMA-MASTER-001。High | S |
| SPEC-DEEP-047 | 7 | schemas `Company.js`, `Customer.js`, `Site.js`, `User.js`, `Employee.js`, `Outsourcer.js`, `System.js` | **completed / A**。SCHEMA-MASTER-001。Critical | S |
| SPEC-DEEP-048 | 9 | schemas `ArrangementNotification.js`, `SiteOperationSchedule.js`, `SiteOperationScheduleDetail.js`, `Operation.js`, `OperationDetail.js`, `OperationResult.js`, `OperationResultDetail.js`, `WorkingResult.js`, `WorkTimeBase.js` | **completed / A**。SCHEMA-OPS-001。Critical | M |
| SPEC-DEEP-049 | 12 | schemas `Billing.js`, `OperationBilling.js`, `DailyAttendance.js`, `DailyOperationByEmployee.js`, `SiteEmployeeHistory.js`, `Tax.js`, `RoundSetting.js`, `FcmToken.js`, `Notification.js`, `NotificationRecipient.js`, `SecurityReportIndex.js`, `errorDefinitions.js` | **completed / A**。SCHEMA-BASE/OPS/FINANCE-001。Critical | M |
| SPEC-DEEP-050 | 10 | schemas constants `arrangement-notification-status`, `attendanceManagementMode`, `billing-unit-type`, `certification-type`, `contract-status`, `day-of-week`, `day-type`, `employment-status`, `security-type`, `shift-type` | **completed / A**。SCHEMA-MASTER/OPS/FINANCE-001。High | M |
| SPEC-DEEP-051 | 9 | schemas constants `blood-type`, `emergency-contact-relation`, `gender`, `index`, `insurance-status`, `payment-month`, `prefectures`, `site-status`, `tag-size` | **completed / A**。SCHEMA-MASTER/FINANCE-001。Medium | M |
| SPEC-DEEP-052 | 8 | schemas `src/parts/*.js` plus fieldDefinitions `array`, `check`, `code`, `constants`, `defaultDefinition`, `object` | **completed / A**。SCHEMA-BASE-001。High | S |
| SPEC-DEEP-053 | 8 | schemas fieldDefinitions `dateAt`, `dateTimeAt`, `multipleLine`, `number`, `oneLine`, `radio`, `select`, `time` | **completed / A**。SCHEMA-BASE-001。High | S |
| SPEC-DEEP-054 | 5 | schemas `src/apis/**`, `src/mixins/**`, `src/utils/**` | **completed / A**。SCHEMA-BASE/MASTER/FINANCE-001。High | S |

上表のcandidateは54主IDだが、039と045をa/bへ分割するため実行checkpoint数は**56**である。SPEC-DEEP-009は残る4 Functions filesを対象とする。全row count合計はB/C合計513 filesである。

## 文書更新規則

- 既存60 domain文書を同じ責務で増殖させない。deep review結果は原則として既存domain文書の「公開契約」「error/side effect」「未確認範囲」を更新する。
- 横断contractまたは複数domainにまたがる新しい責務だけ、新規implementation文書を許す。
- segment完了時に対象fileをAへ昇格し、当文書とcoverage audit/inventoryのdepth count・残segmentを機械更新する。
- bug/risk/test不足はfuture-actionsへ重複なく、利用者判断だけpending-confirmationsへ追加する。
- 質問は全B/CがAまたはD/Eへ到達した後に再reconcileし、それまでは提示しない。

## 終了条件

1. 531 filesがexactly oneのA/D/Eとなり、B/C/Unknownが0。
2. 各実行segmentで全対象fileのresponsibility/public API/主要分岐/error/side effect/direct callerを記録。
3. B/C assignment重複0、未割当0。新規fileはinventoryへ追加してからsegment化。
4. 既存文書のSource/Scope/UnverifiedとFUT/CONF/README/count/linkが静的に整合。
5. 全deep review後にCONFを再reconcileし、実装事実で前提が崩れた質問と上位統合を再判定。

## 未確認範囲

- このcheckpointではcode本文を再読しておらず、B/Cの個別品質・bugを判定していない。
- runtime、UI、Emulator、外部環境、実data、build artifact。
- runtime、UI、Emulator、remote環境、実data、build artifactは、このsource本文精査の完了によって検証済みにはならない。
