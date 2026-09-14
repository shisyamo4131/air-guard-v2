# 実装調査文書索引

履歴集計の記録日: 2026-09-04

このdirectoryは、AirGuardV2の実装から観察した現在の挙動、責務、data flow、境界、矛盾候補をsegment単位で記録した調査資料である。確認済み仕様の正本ではない。設計意図や正式要件を確定するときは、プロジェクトの正本仕様と承認済みADRを優先し、このdirectoryの記述は根拠codeの再確認に使用する。

## 読み分け

- **確認済み実装事実**: 調査時点のfile/symbolから直接確認した挙動。承認済み要件や望ましい設計を意味しない。
- **ユーザー確認済み・承認済み方針**: 調査中に利用者が明示した判断。各文書内で実装事実と分けて記録するが、正本仕様へ統合されるまではこのdirectoryだけを正本にしない。
- **仮説・未確認範囲**: codeの深読、runtime、実data、外部環境等を確認していない事項。事実やbugとして断定しない。
- **将来要対応**: [future-actions.md](future-actions.md)の暫定backlog。bug、security/data integrity risk、仕様矛盾、未使用候補、test不足を含む。状態と根拠を確認してから修正を承認する。
- **要確認事項**: [pending-confirmations.md](pending-confirmations.md)の利用者判断台帳。実装追加検証だけでは決められない仕様判断を集約する。
- **Coverage**: [coverage-inventory.md](coverage-inventory.md)のCovered/Partially covered/Uncoveredは調査文書の有無を示し、品質・完成・本番運用可否を示さない。

## 終了時集計

以下は2026-09-04に記録されていた調査終了時の履歴であり、現在件数ではない。状態・回答は[将来対応台帳](future-actions.md#状態別の参照)と[確認事項台帳](pending-confirmations.md#状態別の参照)、coverageは[調査索引](coverage-inventory.md)を参照する。

<details>
<summary>記録当時の集計</summary>

- このREADME追加前の文書数: 95
- このREADMEを含む文書数: 105
- 実装領域文書: 95
- 横断索引・台帳・再開記録: README、coverage inventory、coverage audit、deep review plan、future actions、pending confirmations、confirmation dependency map、2026-08-12 source review統合記録、2026-08-13 PM交代引継ぎ記録、2026-08-14利用者主導開発ガバナンス交代引継ぎの10文書
- FUT: 184件
  - 状態: Open 135、Needs decision 39、In progress 3、In progress（CAS-02/03/04 local完了・CAS-05 deferred）1、Hypothesis 3、Resolved 2、Completed 1
  - 重大度: Critical 15、High 93、Medium 60、Low 13、未評価 3
- CONF: 146件
  - 状態: Open 78、Answered 63、Partially answered 5
  - reconciliation disposition: Answered 53、Open-user-decision 65、Open-deferred 8、Resolved-by-implementation-fact 0、Merge-candidate 12、Implementation-detail-no-user-question 0、Blocked-by-uninvestigated 0
- 未調査優先候補: 0件（P0 0、P1 0、P2 0、P3 0）。詳細は[coverage inventoryの優先segment backlog](coverage-inventory.md#優先セグメントbacklog)を参照。

</details>

台帳の追加・状態変更では各台帳とその参照索引を更新し、この履歴集計は更新しない。

## 横断索引・台帳

- [Coverage inventory](coverage-inventory.md): 固定inventoryの調査文書・source対応と当時のsegment候補。
- [Coverage mechanical audit](coverage-audit.md): 固定inventoryの監査方法・分類訂正経緯・dynamic import/export棚卸しの履歴。
- [Deep review plan](deep-review-plan.md): 2026-08-12時点の固定inventoryに対するdepth分類・精査計画・完了履歴。
- [Future actions](future-actions.md#状態別の参照): 将来対応・判断待ち・限定的な解決記録を本文へ辿る。
- [Pending confirmations](pending-confirmations.md#状態別の参照): 未回答・部分回答・回答済みの判断記録へ辿る。
- [Confirmation dependency map](confirmation-dependency-map.md): 2026-08-28時点のdisposition・依存関係・統合候補の履歴。現在の回答状態は確認事項台帳を参照。
- [2026-08-12 source review統合記録](review-reconciliation-2026-08-12.md): schema、共通UI、Admin SDK、認証・Functions調査の横断結果、問題、要判断事項。
- [2026-08-13 PM交代引継ぎ記録](task-handoff-2026-08-13.md): Historical。2026-08-13の交代基準と当時の承認境界。現在のrestart指示には使用しない。
- [2026-08-14 利用者主導開発ガバナンス交代引継ぎ](task-handoff-2026-08-14-user-led-governance.md): Historical。PM交代履歴と旧手順の証拠。
- [現在の製品作業と再開案内](current-coordinator-handoff.md): 製品の未決事項・承認・次作業から正本へのroute。
- [Customer Dev反映・受入れ計画](customer-dev-release.md): Customer先行フェーズの閉鎖結果と、当時の反映・試験・復旧計画。
- [4マスター Dev反映前 release surface inventory](master-dev-release-surfaces.md): 初回Dev反映前の候補・停止・復旧条件の履歴と、後続結果への参照。
- [4マスター Dev受入れ計画](master-dev-acceptance-plan.md): 初回Dev受入れ結果と、事前判断・操作・外部作用・cleanup計画の履歴。
- [OperationResult派生文書の復旧計画](operation-result-projection-recovery.md): Devで欠落した請求・勤怠・従業員別稼働・現場勤務履歴を、対象確定、dry-run、snapshot、競合停止、rollbackを伴って復旧する未実行計画。

## アプリ入口・認証・共通基盤

- [アプリケーション入口とshell](app-shell.md)
- [ページアクセス設定](page-access.md)
- [Layout・Navigation components](layout-navigation-components.md)
- [状態管理入口と初期化](state-initialization.md)
- [Stores / auth middleware deep review](stores-middleware-deep-review.md)
- [Nuxt plugins deep review](plugins-deep-review.md)
- [User / Firebase Auth lifecycle](user-auth-lifecycle.md)
- [User Write Boundary（UWB）改修計画](user-write-boundary.md): Usersコレクションのactor・operation・field別書込み境界と、Callable・UI・Rulesの段階的な改修状況。
- [Auth onboarding UI](auth-onboarding-ui.md)
- [Auth / settings / super-user pages deep review](auth-settings-pages-deep-review.md)
- [role・permission認可model](authorization-model.md)
- [Callable認可境界](callable-authorization.md): 旧調査と、UWB・Companyの後続境界への参照。
- [Super-user運用画面](super-user-operations-ui.md)
- [Test / development routes](test-development-routes.md)
- [汎用data取得・管理composables](data-management-composables.md)
- [共通UI components](shared-ui-components.md)
- [Shared molecules components deep review](molecules-components-deep-review.md)
- [Organisms components deep review](organisms-components-deep-review.md)
- [Atoms buttons / chips deep review](atoms-buttons-chips-deep-review.md)
- [Atoms core controls deep review](atoms-core-deep-review.md)
- [Enum display, chart, and Tag deep review](enum-display-chart-tag-deep-review.md)
- [Enum・field definition・input contracts](enum-field-input-contracts.md)
- [error・logging・user feedback](error-logging-feedback.md)
- [Date range・performance utilities](date-range-performance-utilities.md)
- [Dashboard](dashboard.md)

## System・Company・subscription・保守

- [Company設定](company-settings.md)
- [CCB-02 Company data・package互換性調査](company-configuration-compatibility.md): Historical / rollback inventory source。旧CCBの現在code・package成果を安全に整理する根拠。
- [Company components deep review](company-components-deep-review.md)
- [端数処理・時間計算](rounding-and-time-calculation.md)
- [税・締日・請求計算primitive](tax-cutoff-billing-primitives.md)
- [Site自動終了scheduled task](site-auto-termination.md)
- [System / Company maintenance](system-maintenance.md)
- [Subscription・Stripe](subscription-stripe.md)
- [論理削除・archive・restore](archive-restore.md)
- [Admin SDK backup・recovery](admin-backup-recovery.md)
- [Cloud Functions稼働catalog](cloud-functions-catalog.md): 過去のentry調査と後続の反映・撤去証拠への案内。
- [Functions entry・auth・employee・maintenance deep review](functions-entry-auth-maintenance-deep-review.md)
- [Geocoding・Stripe・ContextualError Functions deep review](geocoding-stripe-error-functions-deep-review.md)

## Master data・住所・要員属性

- [Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)
- [Agreement components deep review](agreement-components-deep-review.md)
- [ArrangementNotification components deep review](arrangement-notification-components-deep-review.md)
- [ArrangementsManager components deep review](arrangements-manager-components-deep-review.md)
- [Article components deep review](article-components-deep-review.md)
- [Customer components deep review](customer-components-deep-review.md)
- [Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)
- [Employee components deep review](employee-components-deep-review.md)
- [Employee certification / custom-input components deep review](employee-certification-components-deep-review.md)
- [Employees / Insurance components deep review](employees-insurance-components-deep-review.md)
- [Outsourcer components deep review](outsourcer-components-deep-review.md)
- [Worker / drag components deep review](worker-drag-components-deep-review.md)

- [Customer master](customer-master.md)
- [Customer archive safety](customer-archive-safety.md)
- [CAS-02実行契約とSpark Developer試験記録](customer-archive-cas02-developer-trial.md)
- [Site master](site-master.md)
- [SiteEmployeeHistory UI](site-employee-history-ui.md)
- [Agreement master](agreement-master.md)
- [Article master](article-master.md)
- [Employee master](employee-master.md)
- [Employee保険管理](employee-insurance.md)
- [Outsourcer master](outsourcer-master.md)
- [Qualification管理](qualification-management.md)
- [OJT・警備教育](ojt-education.md)
- [住所・郵便番号・geocoding](address-geocoding.md)

## 予定・配置・配置表

- [SiteOperationSchedule](site-operation-schedule.md)
- [OperationSchedules components deep review](operation-schedules-components-deep-review.md)
- [SiteOrder / SiteShiftTypeOrder](site-ordering.md)
- [ArrangementNotification data / transition](arrangement-notifications.md)
- [ArrangementNotification UI](arrangement-notification-ui.md)
- [配置表・稼働予定表PDF](arrangement-sheet-pdf.md)

## OperationResult・派生同期・勤怠

- [Operation・Schedule・Billing pages deep review](operation-schedule-billing-pages-deep-review.md)
- [Operation CRUD簡素化の現行棚卸し](operation-crud-simplification-inventory.md): FGA-06で通常CRUD、例外、Callable技術要件、権限未決を操作別に分ける現在の移行入口。

- [OperationResult生成](operation-result-generation.md)
- [稼働実績編集のserver認可](operation-result-edit-authorization.md)
- [OperationResult一覧・詳細・汎用CSV](operation-result-ui-export.md)
- [OperationResult components deep review](operation-result-components-deep-review.md)
- [OperationResult削除event chain](operation-result-delete-chain.md)
- [OperationResult dependent sync / billing / site cleanup deep review](operation-result-dependent-sync-deep-review.md)
- [DailyAttendance同期](daily-attendance-sync.md)
- [DailyOperationsByEmployee同期](daily-operations-sync.md)
- [Attendance / DailyOperationsByEmployee sync deep review](attendance-daily-operations-sync-deep-review.md)
- [SiteEmployeeHistories同期](site-employee-history-sync.md)
- [勤怠一覧・calendar](attendance-ui.md)
- [勤怠CSV export](attendance-export.md)
- [DailyAttendance components deep review](daily-attendance-components-deep-review.md)

## Billing・請求・帳票

- [Billing / OperationResult components deep review](billing-operation-result-components-deep-review.md)
- [OperationBilling components deep review](operation-billing-components-deep-review.md)
- [OperationResult→Billing集計](billing-aggregation-sync.md)
- [取極めなし実績の請求回復](operation-billing-recovery.md)
- [請求稼働管理の権限・手動調整](billing-access-and-manual-adjustment.md)
- [Billing lifecycle UI](billing-lifecycle-ui.md)
- [請求書PDF](billing-invoice-pdf.md)

## Notification・PWA

- [PWA / FCM client](pwa-notifications.md)
- [FCM server delivery](notification-delivery.md)
- [Notification Functions deep review](notification-functions-deep-review.md)
- [Notification認可・Recipients](notification-authorization.md)

## Operation・SecurityReport

- [Operation管理](operation-management.md)
- [SecurityReport](security-report.md)
- [SecurityReport Functions deep review](security-report-functions-deep-review.md)
- [未使用運転日報PDF utility](collecting-report-utility.md)

## 静的保守規則

- FUT IDとCONF IDは4桁連番を維持し、同一原因を重複登録しない。
- FUT/CONFの必須fieldを省略しない。Resolved/Answeredへ変える場合も根拠とAnswerを残す。
- relative linkを用い、rename/add時はこの索引とcoverage inventoryを更新する。
- UTF-8 replacement character、trailing whitespace、broken relative linkを残さない。
- 実行していないruntime/UI/Emulator/外部検証を成功と記録しない。
- 文書間の説明差を見つけた場合、実装事実・承認済み方針・仮説のどれかを確認してから訂正する。
