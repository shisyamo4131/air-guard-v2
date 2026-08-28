# Company設定改修ロードマップ

## メタデータ

- 改修コード: CCB（Company Configuration Boundary）
- 状態: In progress（仕様確定・実装未着手）
- 現在の進捗: 10%
- 基準日: 2026-08-28
- 調査基準commit: `c8718a82c43a05d3ea70f928747333ef985e77db`
- 文書化基準commit: `919733aea74476b5839d5e3c277d75641e4a5ccb`
- 親ロードマップ: [AirGuardV2 正式運用準備](airguard-v2.md)
- 現行仕様: [Company設定とtenant lifecycle](../specification.md#company設定とtenant-lifecycle)
- 主要判断: [ADR 0025](../decisions/0025-company-configuration-boundary.md)、[ADR 0026](../decisions/0026-maintenance-quiescence-and-data-change.md)
- 実装調査: [Company（自社情報・会社設定）](../implementation/company-settings.md)
- 確認事項: CONF-0074〜CONF-0082は回答済み。CONF-0083〜CONF-0087のStripe詳細は正式release直前まで明示保留。
- 加点方式: マイルストーン単位。部分加点なし。

## 目的

単一Company documentに混在するtenant anchor、会社・請求元情報、運用設定、表示順、maintenance、entitlementを責務別documentと操作へ分離する。後続のCustomer、Site、Employee、Outsourcer、Billingが依存できるactor、validation、revision、snapshot、lifecycleを先に確立する。

このロードマップはCompanyの全CUDを一律Functions化しない。会社管理者設定、日常業務の表示順、server-owned lifecycle・entitlementの性質に合わせてclient Rules、transaction、Callable/operatorを使い分ける。

## 確定した目標境界

| document | 主なfield | 読取 | 更新 |
|---|---|---|---|
| Company root | status、schemaVersion、作成metadata | 同社の有効な本登録Userへ必要最小 | server/provider only |
| `Settings/profile` | 会社名、カナ、住所、電話、FAX | 同社の有効な本登録User | 会社管理者 |
| `Settings/billing` | invoice number、振込先 | 同社の有効な本登録User | 会社管理者 |
| `Settings/operations` | minute、round、week、attendance summary | 同社の有効な本登録User | 会社管理者 |
| `Settings/arrangement` | siteOrder、scheduleOrder | 同社の有効な本登録User | 既存の配置・予定管理actor |
| `Settings/entitlement` | client-safe plan/feature/employeeLimit projection | 同社の有効な本登録User | server/provider only |
| `Settings/maintenance` | client-safe停止状態・理由・時刻projection | 停止案内対象の同社User | server/provider only |
| `PrivateSettings/entitlement` | Stripe/customer ID、provider metadata、内部状態 | client不可 | server/provider only |
| `PrivateSettings/maintenance` | operator、内部operation/error、private metadata | client不可 | server/provider only |
| `SettingAudits/{auditId}` | profile/billing/operationsのmask済み変更履歴 | 会社管理者専用Callableだけ | server only append |

- profile/billing/operationsはrevisionとappend-only auditを持ち、auditは会社管理者だけが専用Callableからmask済みprojectionを閲覧できる。理由入力は必須にしない。arrangementは現在値とrevisionだけを持つ。
- super-userをCompany設定actorに含めず、会社横断処理は個別承認されたprovider/operator手順とする。
- `attendanceManagementMode`は`attendanceSummaryMode`へ改名し、`LABOR_STANDARD`/`OPERATION_COUNT`で画面・navigationだけを切り替える。両projectionは常時生成する。
- round modeはOperationResult作成時、issuer情報は請求確定時にsnapshotする。
- Company既定取極めとCompany geocodingを廃止する。既存値の削除は別migrationとする。
- lifecycleは`ACTIVE`、`SUSPENDED`、`CLOSED`。root物理削除、法的削除、tenant移転は別scopeとする。
- maintenanceはproject-wide quiet procedureとし、CCBはCompany状態・表示の統合だけを担う。
- Stripe再有効化とemployeeLimit強制は正式release直前の別改修へ延期し、CCBはentitlement documentのserver ownershipだけを準備する。

## 現在実装との差

| 領域 | 現在実装 | 目標との差 |
|---|---|---|
| 保存 | root 1 documentの全体set | 設定document分割、操作別writer、revision、unknown field保護が未実装 |
| actor | 同社有効User全員がroot全field update | 会社管理者・日常業務actor・providerの分離が未実装 |
| read | 全field同一read | server-owned entitlement/maintenanceの最小projectionが未実装 |
| lifecycle | statusなし、client create/deleteだけ拒否済み | ACTIVE/SUSPENDED/CLOSEDとaccess gateが未実装 |
| profile/billing | 長さ・住所editor・invoice/bank validation不一致 | 承認済みvalidation、audit、帳票snapshotが未実装 |
| operations | process-global round、旧attendance enum | snapshot、改名、両projectionの表示切替が未実装 |
| arrangement | 全体set、revisionなし | 専用actor、stale拒否、履歴なし現在値保存が未実装 |
| legacy | agreements/geocodingがrootに残る | caller撤去と別migrationが未実装 |
| maintenance | route redirect中心 | Rules/Callable/scheduled gateとquiet procedureのproduct実装が未完了 |
| Stripe | Functions公開停止、root fieldはclient writable | entitlement隔離未実装。課金本体は意図的に延期 |

## 手戻りを抑える実施順序

```text
CCB-01 confirmed contract
  → CCB-02 data/package compatibility contract
  → CCB-03 root・server-owned containment
  → CCB-04 profile/billing
  → CCB-05 operations・snapshot
  → CCB-06 arrangement・master handoff
  → CCB-07 lifecycle・maintenance integration
  → CCB-08 entitlement isolation
  → CCB-09 migration・回帰・Dev受入れ
```

互換readerを先に導入し、設定documentのcreate-only backfill、操作別writer、制限的Rules、旧全体writer撤去、旧field cleanupの順で進める。関連Schemas/Admin SDK repository変更は対象、互換性、公開・導入順、rollbackを示して別承認を得る。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了条件 |
|---|---:|---:|---|---|
| CCB-01 確認済み仕様・判断基準線 | 10 | 10 | Completed | actor、document分割、validation、revision/audit、snapshot、勤怠、廃止field、lifecycle、maintenance、Stripe延期を質疑で承認し、仕様、ADR、CONF/FUT、roadmap、runbook、manualへ反映してvalidatorを通す。 |
| CCB-02 data・field・package互換契約 | 10 | 0 | Not started | Dev fixtureと全Company callerを再照合し、root・各Settingsのexact schema、default、unknown/legacy field、Schemas/client/Functions/Admin SDKのrelease順、dual-read期間、migration mappingを検証する。 |
| CCB-03 root・server-owned containment | 20 | 0 | Not started | root create/delete拒否を維持し、client-safe entitlement/maintenance projectionとPrivateSettingsを分離してclient writeを拒否する。共通tenant/actor/revision/audit境界、会社管理者専用audit readerと陰性testを実装し、旧client互換中もserver fieldを失わない。 |
| CCB-04 profile・billing | 10 | 0 | Not started | 操作別保存、承認済み長さ・invoice・bank validation、完全住所editor、全User read/管理者write、masked auditを実装する。長値PDF renderとissuer snapshot schemaを検証し、snapshot writeをBillingへ引き渡す。 |
| CCB-05 operations・履歴再現性 | 15 | 0 | Not started | minute/round/week/attendanceSummaryModeを操作別保存へ移し、enum・範囲、即時表示、account切替reset、両勤怠projection、OperationResult round snapshot、既存data不変を検証する。 |
| CCB-06 arrangement・master接点 | 10 | 0 | Not started | agreements/geocoding callerを撤去し、site/schedule orderを既存業務permission、revision、1 reorder 1 save、新規ID末尾補完、archive・削除済みIDの無視・次回保存時除去へ移す。Customer既定取極めと後続masterの共通actor/validation/競合契約を引き渡す。 |
| CCB-07 tenant lifecycle・maintenance統合 | 10 | 0 | Not started | ACTIVE/SUSPENDED/CLOSED、停止案内、通常read/write/Callable拒否、provider restore、root欠損・orphan検出を実装する。project-wide Rules/Callable/scheduled maintenance gate、unknown fail-closed、quiet runbookを検証する。 |
| CCB-08 entitlement隔離・外部連携延期境界 | 10 | 0 | Not started | subscription/feature/employeeLimitをserver-owned documentへ隔離し、client最小projectionとdisabled UIを検証する。Stripe本体を再有効化せず、正式release直前の別roadmapへ未決仕様を引き渡す。 |
| CCB-09 migration・回帰・Dev受入れ | 5 | 0 | Not started | dry-run、backup、rollback、quiet period、旧新compatibilityを固定し、local自動test、Emulator、PDF render、fixed-commit build、bounded Dev release、管理者・一般User・業務actor・providerの受入れ、旧全体writer 0件を確認する。 |
| **合計** | **100** | **10** |  |  |

## 必須検証matrix

- actor: 会社管理者、配置・予定permission actor、権限なしUser、super-user、provider operator、無効User、他tenant、未認証。
- read: profile/billingの同社read、entitlement/maintenanceのclient-safe projection、PrivateSettingsの全client拒否、auditの会社管理者Callableだけ、一般User・super-user・他tenant・未認証拒否、bank before/after mask。
- write: exact field、required/optional、型・長さ・enum・相関、server-owned混入、unknown field、stale revision、同時tab、旧client、Functions競合。
- lifecycle: ACTIVE/SUSPENDED/CLOSED、restore、CLOSED誤操作incident、root欠損、orphan、claim不一致、maintenance unknown。
- downstream: draft/final invoice、issuer snapshot、長値render、OperationResult round snapshot、両attendance projection、calendar、site/schedule order。
- migration: edition、legacy enum/field、agreements/location、dry-run digest、create-only backfill、再実行、部分失敗、derived data、rollback、Rules切替順。

各validator、test、build、migration check、Dev検証はcommand、result、独立exit statusを記録する。画面非表示だけを認可証拠にしない。

## 停止・rollback条件

- Devのcurrent edition、schema、unknown field、実callerが基準線と異なる。
- 旧全体writerがserver-owned fieldを失わせる、または互換readerが旧新dataを決定的に合成できない。
- stale saveが拒否されず別設定を上書きする。
- Company変更が既存OperationResult、Billing、確定帳票、勤怠projectionを意図せず再計算する。
- migration digest、対象company、field、write件数、quiet状態、snapshotがcheckpointと一致しない。
- SUSPENDED/CLOSED/maintenance中に通常business処理が通る。

停止時はmaintenanceを維持し、既知の互換releaseへ戻す。新setting document、legacy field、root/subcollectionを推測削除しない。apply後はsnapshotと前後digestからexact corrective releaseまたは別repairを組み立てる。

## 後続master CRUDへの引渡し

- Customer・Outsourcer: tenant actor確認、操作別field allowlist、revisionによるstale拒否、必要なaudit、archive/lifecycleを機能単位で選ぶ。
- Site: Customer既定取極め、Company arrangement order、終了・再有効化、参照切れを接続する。
- Employee: attendanceSummaryModeの表示契約だけを受け、給与用勤務回数詳細とentitlement実強制は各後続改修で完成させる。
- Billing: issuer snapshot schemaとround snapshotを受け、draft・確定・取消・訂正・再発行のwrite lifecycleを完成させる。

Company全完了を待たず、各引渡し契約が実装・検証された時点で対応masterを開始できる。CUD一律Functions化や全collection共通auditは前提にしない。

## 進捗履歴

| 日付 | 進捗 | 変化 | 理由と証拠 |
|---|---:|---:|---|
| 2026-08-27 | 0% | 基準線 | client、server、Rules/security、下流依存の4系統を独立調査し、影響範囲、判断ゲート、実施順、検証・rollback条件を設定した。 |
| 2026-08-28 | 10% | +10 | Company document分割、actor、validation、revision/audit、snapshot、attendanceSummaryMode、廃止field、lifecycle、project-wide maintenance、Stripe延期を質疑で承認し、仕様・ADR 0025/0026・runbook・台帳・manualへ反映した。application実装・test・migration・Dev受入れは未着手のためCCB-01だけを加点した。 |
