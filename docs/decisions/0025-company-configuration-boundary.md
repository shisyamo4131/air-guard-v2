# 0025 Company Configuration Boundaryとtenant lifecycle

- 日付: 2026-08-28
- 状態: Accepted
- 改修コード: CCB（Company Configuration Boundary）
- 関連仕様: Company設定とtenant lifecycle、請求・税・丸め、勤怠、サブスクリプション
- 関連ロードマップ: [Company設定改修ロードマップ](../roadmaps/company-settings.md)
- 実装調査: [Company設定](../implementation/company-settings.md)
- 関連判断: [0016 FireModel CRUDの利用境界](0016-firemodel-crud-boundary.md)、[0026 project-wide maintenance quiet procedure](0026-maintenance-quiescence-and-data-change.md)

## 背景

現行の`Companies/{companyId}`はtenant anchor、会社・請求元情報、口座、丸め・勤怠設定、取極め、表示順、maintenance、Stripeを一つのdocumentへ保存する。同社の有効な本登録User全員がdocument全体をread/updateでき、古いclientや別機能の保存がserver-owned fieldを上書きできる。Firestore Rulesは同一document内のfieldを読者別に隠せず、document全体setは設定間の競合と未知field消失を起こし得る。

この構成はDevからProdへ移すcollection数を抑えるための仮実装であり、collection数抑制は将来architectureの制約ではない。Company設定は後続のCustomer、Site、Employee、Outsourcerとtransaction機能が依存するため、actor、field ownership、lifecycle、snapshot、競合を先に固定する必要がある。

## 決定

改修コードを`CCB`とする。Company rootは削除しない最小tenant anchorとし、server-controlledの`status`、`schemaVersion`、作成時刻等だけを保持する。設定は次へ分割する。

| path | 責務 | read | write |
|---|---|---|---|
| `Settings/profile` | 会社名、カナ、住所、電話、FAX | 同社の有効な本登録User | 会社管理者 |
| `Settings/billing` | 適格請求書番号、振込先 | 同社の有効な本登録User | 会社管理者 |
| `Settings/operations` | minute、丸め、週開始、勤怠summary方式 | 同社の有効な本登録User | 会社管理者 |
| `Settings/arrangement` | site・schedule表示順 | 同社の有効な本登録User | 配置・予定を管理する既存permission actor |
| `Settings/entitlement` | client-safe plan/feature/employeeLimit projection | 同社の有効な本登録User | server/provider only |
| `Settings/maintenance` | client-safe停止状態・理由・時刻projection | 停止案内対象の同社User | server/provider only |
| `PrivateSettings/entitlement` | Stripe/customer ID、provider metadata、内部状態 | client不可 | server/provider only |
| `PrivateSettings/maintenance` | operator、内部operation/error、private metadata | client不可 | server/provider only |
| `SettingAudits/{auditId}` | profile/billing/operationsのmask済み変更履歴 | 会社管理者専用Callableだけ | server only append |

Company設定用の専用permissionは新設せず、profile、billing、operationsは会社管理者へ限定する。super-userをCompany設定actorに含めず、会社横断のmigration・repairは対象と作用を限定して個別承認されたservice provider/operator手順で行う。Firestore Rulesで同一document内のfieldを隠せないため、client-safe projectionとprovider-private documentを混在させず、clientのPrivateSettings read/writeを拒否する。

profile、billing、operationsはrevisionによるoptimistic concurrencyを必須とし、stale saveを拒否して再読込を求める。変更はserver-only `SettingAudits/{auditId}`へactor、時刻、変更field、変更前後をappendし、変更理由を必須にしない。銀行値はmaskし、共通保持方針が確定するまでauditを自動purgeしない。clientのaudit直接read/writeを拒否し、会社管理者だけが専用Callableのmask済み最小projectionを閲覧する。arrangementは頻繁な並べ替えを想定し、履歴・undoを持たず、現在値、revision、更新者、更新時刻だけを保存する。drag中ではなく並べ替え完了後に一度保存し、新規master IDは末尾へ補完、archive・削除済みIDは表示時に無視して次回保存時に除去する。

2026-08-28のCCB-02互換性調査後、Company設定のwrite経路を次の技術契約へ確定した。

- profile、billing、operations、arrangementを4つの専用Callableから更新し、clientのSettings create/update/deleteを拒否する。汎用Company wrapperや全collection共通Functions化は採用しない。
- 各Callableはidentity、同社User、Company lifecycle、maintenance、actor、exact input、expected revisionをtransaction内で再検査する。profile、billing、operationsはauditを同じtransactionでcreateし、arrangementはauditなしでsiteOrderとscheduleOrderの変更field別permissionを検査する。
- siteOrderは既知preset由来の`sites:write`、scheduleOrderは既知preset由来の`site-operation-schedules:write`を使い、role名、直接permission、super-userをstrict actorにしない。
- rootと各documentは`schemaVersion=1`、更新対象設定は`revision=1`から開始する。server metadataとnull/空配列を明示し、unknown・computed・framework fieldをcanonical Settingsへ保存しない。signupとbackfillはcomplete document setを準備する。
- clientの正本切替は`schemaVersion=1`と`configurationState=CCB_V1_ACTIVE`の両方で判定する。marker設定後にSettingsが不完全・invalidならlegacyへfallbackせずfail closedとする。

入力、請求snapshot、丸め、勤怠方式、廃止field、Stripe延期、tenant lifecycleの詳細は[現行仕様](../specification.md#company設定とtenant-lifecycle)を正本とする。特に次を採用する。

- Company既定`agreementsV2`とCompany geocodingを廃止し、既存値の削除は別migrationとする。Site既定取極めはCustomer側で後続設計する。
- `attendanceManagementMode`を`attendanceSummaryMode`へ改名し、`LABOR_STANDARD`と`OPERATION_COUNT`を画面・navigation切替にだけ使う。両projectionは常時生成する。
- `roundSetting`はOperationResult作成時にsnapshotし、Company変更で既存結果を再計算しない。
- draft帳票はlive Company値、確定帳票はissuer snapshotを使い、訂正・再発行は新revisionとする。
- Stripe再有効化とemployeeLimit強制は正式release直前の別改修へ延期し、CCBはserver-owned entitlement境界だけを準備する。
- lifecycleは`ACTIVE`、`SUSPENDED`、`CLOSED`とする。`SUSPENDED`はproviderだけが一時停止・再開し、`CLOSED`は通常のACTIVE復帰を持たない。root物理削除と法的削除は別手順とする。
- 新規Companyは`ACTIVE`、paid entitlement無効、maintenance offで開始する。

## 理由

- Firestore Rulesのdocument単位read制約に合わせ、閲覧範囲とserver ownershipをdocument境界で表現できる。
- 設定間の全体保存競合を減らし、後続masterとtransactionが依存するsource、snapshot、revisionを明確にできる。
- 日常的な表示順変更へ高コストな履歴を課さず、請求・丸め等の説明責任が必要な変更だけ監査できる。
- 仮のsuper-user仕様を製品認可へ固定せず、provider操作をbounded operationとして扱える。

## 代替案

- 単一Company documentを維持してfield diffだけで守る案は、read分離ができず、全体set互換とserver-owned field競合が残るため採用しない。
- Companyの全CUDをFunctionsへ移す案は、配置・予定の高頻度な表示順まで一律にserver API化し、機能別のoffline・競合要件を無視するため採用しない。
- 全設定変更へ履歴・undoを付ける案は、価値のない表示順履歴を大量生成するため採用しない。
- super-userを恒久的なCompany管理者として残す案は、利用目的と承認境界が確定していないため採用しない。

## 影響

- 利用者: 現行画面・dataは直ちに変わらない。CCB実装後は会社管理者と日常業務actorの操作範囲が分かれ、stale saveは再読込が必要になる。
- data: rootから複数setting documentへ互換移行が必要になる。既存Company document、unknown field、長い値、旧enum、server fieldをdry-runで分類し、推測削除しない。
- package: Schemas、client、Functions、Admin SDKのpath・field・defaultを揃える必要がある。関連repository変更は別承認・別release順とする。
- test: actor、field、schema、revision、audit、snapshot、旧data、migration、Rules、Emulator、UI、PDF render、Dev受入れを機能単位で検証する。entitlement/maintenanceは一般User・会社管理者・super-user・他tenant・未認証ごとにclient-safe projectionとPrivateSettingsのread/write露出を分け、auditは会社管理者Callable、他actor拒否、bank mask、理由なし変更を確認する。
- 進捗: 承認済み契約の文書化でCCB-01だけを完了できる。application実装・migration・Dev受入れには加点しない。

## 移行とロールバック

実装前にDevのFirestore editionを再確認し、`STANDARD / FIRESTORE_NATIVE`の現在baselineと一致することを確かめる。additive schemasとAdmin SDK backup対応、未有効のFunctions/client compatible readerを準備し、generic Rules fallbackから新pathを除外するpre-containment Rulesを新documentより先にdeployする。新規Companyと既存tenantのSettingsはrootをlegacy正本のままcreate-onlyでstagingし、maintenance cutoverで最終Rules/Functions/clientを有効化する。client、deploy済みFunctions、operator、Admin SDKを含む旧whole-document writer 0件を確認してからrootの`schemaVersion`とactivation markerを最後に設定する。dual-writeを採用する場合は期間・正本・競合判定をcheckpointで固定し、無期限に残さない。

migrationは対象company、field mapping、write件数、plan digest、backup、rollback、停止条件を固定する。`ACTUAL_DATE`は`LABOR_STANDARD`、`OPERATION_DATE`は`OPERATION_COUNT`へ写像し、欠損時だけ`LABOR_STANDARD`を補う。未知値は自動変換しない。既存rootやlegacy fieldを最初のreleaseで削除せず、旧clientを戻せる互換期間を設ける。rollbackは新setting documentを推測削除せず、Settingsを読める既知の互換releaseへ戻し、正本切替後のdataを再dry-runして別repairで扱う。旧whole-document writerへ戻す場合はSettingsからrootへのreverse planを別承認する。

## 再検討条件

複数管理者、Company設定専用permission、tenant統合・分割、Company間共有設定、課金機能、法的削除、またはFirestore edition変更が必要になった場合に再検討する。
