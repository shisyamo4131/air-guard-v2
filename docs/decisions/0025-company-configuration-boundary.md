# 0025 Company Configuration Boundaryとtenant lifecycle

- 日付: 2026-08-28
- 状態: Superseded
- 置換: [ADR 0031 必要十分なdata境界と変更保護](0031-proportional-data-boundary-and-change-safeguards.md)
- 改修コード: CCB（Company Configuration Boundary）
- 関連仕様: Company設定とtenant lifecycle、請求・税・丸め、勤怠、サブスクリプション
- 関連ロードマップ: [Company設定改修ロードマップ](../roadmaps/company-settings.md)
- 実装調査: [Company設定](../implementation/company-settings.md)
- 関連判断: [0016 FireModel CRUDの利用境界](0016-firemodel-crud-boundary.md)、[0026 project-wide maintenance quiet procedure](0026-maintenance-quiescence-and-data-change.md)、[0029 Firestore Rules互換CRUD先行と段階的閉鎖](0029-firestore-rules-compatible-crud-cutover.md)

## 背景

> 2026-08-30: 本ADRの8 document分割、PrivateSettings、SettingAudits、全設定revision、LEGACY/STAGED/ACTIVE互換運用、tenant lifecycle、Stripe/entitlement境界はADR 0031により置換された。本ADRは旧CCBのrollback inventoryと判断履歴として保持する。会社名、住所、請求元、丸め等の個別validationは、現行仕様へ独立して残された範囲だけが有効である。

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

ACTIVEのprofile、billing、operationsはrevisionによるoptimistic concurrencyを必須とし、stale saveを拒否して再読込を求める。ACTIVEの変更はserver-only `SettingAudits/{auditId}`へactor、時刻、変更field、変更前後をappendし、変更理由を必須にしない。銀行値はmaskし、共通保持方針が確定するまでauditを自動purgeしない。clientのaudit直接read/writeを拒否し、会社管理者だけが専用Callableのmask済み最小projectionを閲覧する。ACTIVEのarrangementは履歴・undoを持たず、現在値、revision、更新者、更新時刻だけを保存する。drag中ではなく並べ替え完了後に一度保存し、新規master IDは末尾へ補完、archive・削除済みIDは表示時に無視して次回保存時に除去する。

2026-08-28のCCB-02互換性調査後、Company設定のwrite経路を次の技術契約へ確定した。

- profile、billing、operations、arrangementを4つの専用Callableから更新し、clientのSettings create/update/deleteを拒否する。汎用Company wrapperや全collection共通Functions化は採用しない。
- 各Callableはidentity、同社User、Company lifecycle、maintenance、actor、mode別exact inputをtransaction内で再検査する。LEGACYはscope別`expectedValue`を必須としてrevisionとauditを使わず、STAGEDは常時拒否、ACTIVEは`expectedRevision`を必須とする。ACTIVEのprofile、billing、operationsはauditを同じtransactionでcreateし、arrangementはauditなしでsiteOrderとscheduleOrderの変更field別permissionを検査する。
- siteOrderは既知preset由来の`sites:write`、scheduleOrderは既知preset由来の`site-operation-schedules:write`を使い、role名、直接permission、super-userをstrict actorにしない。
- rootと各documentは`schemaVersion=1`、更新対象設定は`revision=1`から開始する。server metadataとnull/空配列を明示し、unknown・computed・framework fieldをcanonical Settingsへ保存しない。cutover前のsignupはlegacy rootだけを作り、deny receipt後のmaintenance中に既存tenantのcomplete target setをcreate-only stagingする。cutover後のsignupはactive rootとcomplete target setをatomicに準備し、partial setを成功扱いしない。
- clientの正本切替は`schemaVersion=1`と`configurationState=CCB_V1_ACTIVE`の両方で判定する。marker設定後にSettingsが不完全・invalidならlegacyへfallbackせずfail closedとする。
- legacy Admin SDKはexact CCB schemasを導入し、root markerまたは新3 collectionを検出したbackup、snapshot、diff、restore、Company物理削除、legacy maintenance操作を外部write前にfail closedとする。検査不能とCCB marker/pathを含むbackup payloadのrestoreも拒否する。これはCCB-aware backup/restoreの代替ではなく、PrivateSettings、SettingAudits、tenant delete、provider maintenanceの後続契約が揃うまでの安全境界である。

入力、請求snapshot、丸め、勤怠方式、廃止field、Stripe延期、tenant lifecycleの詳細は[現行仕様](../specification.md#company設定とtenant-lifecycle)を正本とする。特に次を採用する。

- Company既定`agreementsV2`とCompany geocodingを廃止し、既存値の削除は別migrationとする。Site既定取極めはCustomer側で後続設計する。
- `attendanceManagementMode`を`attendanceSummaryMode`へ改名し、`LABOR_STANDARD`と`OPERATION_COUNT`を画面・navigation切替にだけ使う。両projectionは常時生成する。
- `roundSetting`はOperationResult作成時にsnapshotし、Company変更で既存結果を再計算しない。
- draft帳票はlive Company値、確定帳票はissuer snapshotを使い、訂正・再発行は新revisionとする。
- Stripe再有効化とemployeeLimit強制は正式release直前の別改修へ延期し、CCBはserver-owned entitlement境界だけを準備する。
- lifecycleは`ACTIVE`、`SUSPENDED`、`CLOSED`とする。`SUSPENDED`はproviderだけが一時停止・再開し、`CLOSED`は通常のACTIVE復帰を持たない。root物理削除と法的削除は別手順とする。
- CCB cutover後の新規Companyは`ACTIVE`、paid entitlement無効、maintenance offで開始する。cutover前はlegacy rootだけを作り、target lifecycle markerを先行追加しない。

## Exact schema v1

### 共通規則とroot

- 文字列長はUnicode Extended Grapheme Cluster単位で数える。合成済み・結合文字列のどちらで表した`が`も1文字である。外側をtrimするがNFC/NFKCへ自動変換せず、1行fieldはCR/LFとcontrol characterを拒否する。
- optional stringは空文字を`null`へ揃える。各documentはstrict allowlistでunknown keyを拒否し、canonical Settingsへ`docId`、`uid`、computed accessor、geopointを保存しない。
- Settings/PrivateSettingsは`schemaVersion=1`、`revision`を1から開始して更新ごとにexactly `+1`し、server-setの`createdAt:Timestamp`、`createdBy:string`、`updatedAt:Timestamp`、`updatedBy:string`を持つ。actor IDはnull不可、1〜128文字のopaque UIDとし、email等の表示識別子を保存しない。rootとappend-only auditはrevisionを持たない。
- cleanup完了後のcanonical rootはexact `{schemaVersion:1, configurationState:'CCB_V1_ACTIVE', status:'ACTIVE'|'SUSPENDED'|'CLOSED', createdAt:Timestamp, createdBy:string, updatedAt:Timestamp, updatedBy:string}`とし、actor UIDは同じ1〜128文字・null不可契約を使う。activation期間のphysical rootはこのreserved 7 fieldを必須とし、移行前から存在した既知legacy extrasだけを一時許容する。compatible readerはreserved projectionとcomplete Settingsを検査し、physical root全体を7 field parserへ渡さない。legacy extrasの削除と7 field exact化は別承認cleanupで行う。
- marker未設定中はlegacy rootを正本とする。pre-containmentでは新規CCB field `status/schemaVersion/configurationState/createdBy/updatedBy`のclient追加・変更・削除と既存`createdAt`の変更を拒否する一方、現行whole-document writerが毎回変更するlegacy `updatedAt`はroot client updateを全面拒否するcutoverまで許容する。activation transactionでserverがreserved 7 fieldを整えた後はroot client CUDを拒否する。

### client-visible Settings

| document | business fieldのexact契約 |
|---|---|
| `Settings/profile` | `companyName`: trim後1〜100文字。`companyNameKana`: trim後1〜200文字でUnicode `U+30A0–U+30FF`、`U+3000`、`U+FF10–U+FF19`、control characterを除く空白。`U+3099/U+309A`は直前のKatakana baseと同一grapheme clusterの場合だけ許可する。`zipcode`: nullまたはASCII数字7桁。`prefCode`: nullまたは`01`〜`47`。`city`: nullまたは100文字以内。`address/building`: nullまたは各200文字以内。`tel/fax`: nullまたは32文字以内のASCII数字・`+ - ( ) .`・空白。 |
| `Settings/billing` | `invoiceNumber`: nullまたはASCII数字13桁。入力先頭の`T/t`を除去する。`bankName/branchName`: nullまたは各100文字以内。`accountType`: null・`普通`・`当座`。`accountNumber`: nullまたは先頭0を保持するASCII数字1〜7桁。`accountHolder`: nullまたはtrim後200文字以内。振込先5 fieldは全nullまたは全field有効のどちらかだけとする。 |
| `Settings/operations` | `minuteInterval`: integer `5/10/15/20/25/30`、default 15。`roundSetting`: `FLOOR/ROUND/CEIL`、default `ROUND`。`firstDayOfWeek`: integer 0〜6、default 0。`attendanceSummaryMode`: `LABOR_STANDARD/OPERATION_COUNT`、default `LABOR_STANDARD`。 |
| `Settings/arrangement` | `siteOrder/scheduleOrder`: default `[]`、各最大2000件。itemはexact `{siteId, shiftType}`で、`siteId`は1〜128文字かつ`/`・control character不可、`shiftType`は`DAY/NIGHT`、同一配列内の組合せは一意。computed `key`は保存しない。 |
| `Settings/entitlement` | `entitlementState:'DISABLED'`、`planCode:null`、`featureCodes:[]`、`employeeLimit:null`だけをv1で許可する。legacyの`employeeLimit=10`を有効な課金制限へ昇格しない。 |
| `Settings/maintenance` | `maintenanceMode:boolean`、`maintenanceReason:null|string(最大200文字)`、`maintenanceStartAt:null|Timestamp`。offでは理由・開始時刻をnull、onでは両方を必須とする。 |

ACTIVEの`updateCompanyArrangement`はexact `{expectedRevision, field:'siteOrder'|'scheduleOrder', order:[...]}`を受け、1 callで一方だけを変更する。変更fieldに対応するpermissionだけを検査する。transaction中に全Site documentの存在を検査せず、UIはarchive・削除済みIDを非表示にして次回保存で除去する。

### private Settingsとaudit

| document | business fieldのexact契約 |
|---|---|
| `PrivateSettings/entitlement` | `stripeCustomerId:null`、`stripeSubscriptionId:null`、`stripeSubscriptionStatus:null`、`currentPeriodEnd:null`だけをv1で許可する。Stripe再開は後続schema revisionと別承認を必要とする。 |
| `PrivateSettings/maintenance` | `maintenanceMode:boolean`、`internalReason:null|string(最大500文字)`、`scope:string[]`最大50件・各1〜100文字、`maintenanceStartAt:null|Timestamp`、`maintenanceStartedBy:null|string(最大128文字)`、`operationId:null|string(最大128文字)`、`lastErrorCode:null|string(最大100文字)`、`lastErrorAt:null|Timestamp`。off時はscopeを空、他のprivate operation fieldをnullとする。on時はinternalReason、非空scope、startAt、startedByを必須、operationIdは任意、error code/timeは両方nullまたは両方存在とする。raw error textとemailを保存しない。 |

`SettingAudits/{auditId}`はexact `{schemaVersion:1, settingType, fromRevision, toRevision, actorUid, createdAt, changes}`とする。`settingType`は`PROFILE/BILLING/OPERATIONS`、`fromRevision`は1以上、`toRevision=fromRevision+1`、actor UIDは1〜128文字、`changes`はfield名順・重複なし・1〜9件で、各itemはexact `{field,before,after}`とする。field allowlistはPROFILEが`companyName/companyNameKana/zipcode/prefCode/city/address/building/tel/fax`、BILLINGが`invoiceNumber/bankName/branchName/accountType/accountNumber/accountHolder`、OPERATIONSが`minuteInterval/roundSetting/firstDayOfWeek/attendanceSummaryMode`である。変更fieldだけをfieldごとのcanonical型で記録する。bank 5 fieldはnullをnullのまま、それ以外をliteral `***`へ置換し、表示名・email・理由を保存しない。clientのaudit直接read/writeを拒否する。

### Callable、Auth、Rules

- ACTIVEのprofile/billing/operationsはexact `{expectedRevision, value:<完全business payload>}`を受け、arrangementは前記ACTIVE inputを受ける。`expectedRevision`はinteger 1以上とする。LEGACYはscope別exact `{expectedValue:<完全な旧business payload>, value:<完全business payload>}`を受け、STAGEDは入力内容にかかわらず拒否する。clientからcompany ID、actor、metadataを受け取らない。成功結果はmodeを識別できるcanonical updated projectionだけを返す。
- Firebase Authの有効状態はFirestore transaction内でatomicに再読取できないため、Callableはtransaction直前にcurrent Authを確認し、transaction内でUser/root/lifecycle/maintenance/actor/revisionを再検査する。Auth確認後のdisable raceはbounded in-flight riskとして受容する。
- pre-containment Rulesは`Settings`、`PrivateSettings`、`SettingAudits`をgeneric fallbackから除外して再帰的client denyを置き、rootのreserved field変更を拒否する。activation後はrootのclient create/update/deleteを拒否する。通常descendant accessはroot存在と`ACTIVE`を必須とし、`SUSPENDED`は停止案内projectionだけ、`CLOSED`は全client accessを拒否する。System maintenance中はsignupも通常処理として拒否する。complete setを正本とし、個別欠損はfail closedとする。

## 理由

- Firestore Rulesのdocument単位read制約に合わせ、閲覧範囲とserver ownershipをdocument境界で表現できる。
- 設定間の全体保存競合を減らし、後続masterとtransactionが依存するsource、snapshot、revisionを明確にできる。
- 日常的な表示順変更へ高コストな履歴を課さず、請求・丸め等の説明責任が必要な変更だけ監査できる。
- 仮のsuper-user仕様を製品認可へ固定せず、provider操作をbounded operationとして扱える。

## 代替案

- 単一Company documentを維持してfield diffだけで守る案は、read分離ができず、全体set互換とserver-owned field競合が残るため採用しない。
- 全collectionのCUDを共通Functions wrapperへ移す案は、機能別のoffline・競合・atomicity要件を無視して実装範囲を広げるため採用しない。Company設定では承認済みの4操作だけを専用Callableとする。
- 全設定変更へ履歴・undoを付ける案は、価値のない表示順履歴を大量生成するため採用しない。
- super-userを恒久的なCompany管理者として残す案は、利用目的と承認境界が確定していないため採用しない。

## 影響

- 利用者: 現行画面・dataは直ちに変わらない。CCB実装後は会社管理者と日常業務actorの操作範囲が分かれ、stale saveは再読込が必要になる。
- data: rootから複数setting documentへ互換移行が必要になる。既存Company document、unknown field、長い値、旧enum、server fieldをdry-runで分類し、推測削除しない。
- package: Schemas、client、Functions、Admin SDKのpath・field・defaultを揃える必要がある。関連repository変更は別承認・別release順とする。
- test: actor、field、schema、revision、audit、snapshot、旧data、migration、Rules、Emulator、UI、PDF render、Dev受入れを機能単位で検証する。entitlement/maintenanceは一般User・会社管理者・super-user・他tenant・未認証ごとにclient-safe projectionとPrivateSettingsのread/write露出を分け、auditは会社管理者Callable、他actor拒否、bank mask、理由なし変更を確認する。
- 進捗: 承認済み契約の文書化でCCB-01だけを完了できる。application実装・migration・Dev受入れには加点しない。

## 移行とロールバック

2026-08-29に、既存Company CRUDの互換確認よりpre-containment Rules deployを先行させる初期順序を[ADR 0029](0029-firestore-rules-compatible-crud-cutover.md)で置換した。現行の実行順は、現行Rules下で将来境界へClient/Server CRUDを先行移行し、両Rules回帰・既存CRUD継続・旧writer 0件を確認した後にRulesを閉じる。新Settingsのcreate-only stagingをdeny receipt後に行う契約、target schema、activation、rollback境界は維持する。

実装前にDevのFirestore editionを再確認し、`STANDARD / FIRESTORE_NATIVE`の現在baselineと一致することを確かめる。additive schemas、Admin SDKの旧破壊操作fail-closed、承認済みCCB backup方針、compatible reader、Company clone、marker-aware operation別Client/Server writerを準備する。LEGACY modeはscope別expected valueをtransactionで比較して既知legacy fieldだけをpartial updateし、root whole-set、reserved field、新path writeを行わない。現行Rulesと候補Rulesの両回帰、既存CRUD継続、旧whole-document writer 0件を確認した後にmaintenanceを開始して通常設定writeとsignupを停止し、pre-containment Rulesをdeployする。receipt確認後だけSettingsをcreate-only stagingして同じmaintenance内で最終Rules/Functions/clientとroot activationを整合させる。STAGEDを通常運用せずdual-writeしない。

migrationは対象company、field mapping、write件数、plan digest、backup、rollback、停止条件を固定する。`createdBy/updatedBy`は承認済みservice accountのstable non-email opaque IDを使い、個人emailや表示名を保存しない。`ACTUAL_DATE`は`LABOR_STANDARD`、`OPERATION_DATE`は`OPERATION_COUNT`へ写像し、欠損時だけ`LABOR_STANDARD`を補う。未知値は自動変換しない。移行前からmaintenance中で、PrivateSettingsに必要な内部理由・scopeを旧dataから決定できないtenantは`ambiguousMapping`としてapply前に停止し、値を推測しない。既存rootやlegacy fieldを最初のreleaseで削除せず、旧clientを戻せる互換期間を設ける。rollbackは新setting documentを推測削除せず、Settingsを読める既知の互換releaseへ戻し、正本切替後のdataを再dry-runして別repairで扱う。旧whole-document writerへ戻す場合はSettingsからrootへのreverse planを別承認する。

## 再検討条件

複数管理者、Company設定専用permission、tenant統合・分割、Company間共有設定、課金機能、法的削除、またはFirestore edition変更が必要になった場合に再検討する。
