# Operation（警備稼働）実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-031
- 最終確認日: 2026-08-11
- 根拠ファイル: schemas `Operation.js`、`WorkingResult.js`、`WorkTimeBase.js`、`OperationDetail.js`、`SiteOperationSchedule.js`、`OperationResult.js`、`utils/pageSettings.js`、`pages/operation-schedules/index.vue`、`components/OperationSchedules/Manager/index.vue`、`firestore.rules`、`storage.rules`、`functions/modules/operationCleanup.js`、`functions/modules/securityReport/fetchOperationDateAt.js`

## 責務・用語

`Operation`は「稼働ベース」という抽象schema classであり、直接instance化できない。現場稼働予定を表す`SiteOperationSchedule`と、確定済み稼働実績を表す`OperationResult`へ共通field・時刻計算・worker操作を提供する。独立した業務document、画面上のライフサイクル、予定と実績を束ねる永続aggregateではない。

`OperationSchedulesManager`というUI名は`SiteOperationSchedule`の管理画面を指す。Storageの`Operations/{operationId}`は予定または実績のIDで写真を保持する共通namespaceであり、Firestore `Operations` documentではない。

## 入口・権限

独立したOperation一覧・詳細・作成・編集・削除page、pageSettings、composable、Functionは確認できない。`/operation-schedules`は`site-operation-schedules:read`を要求するBetaの稼働予定管理であり、`/operation-results`は`operation-results:read`を要求する稼働実績管理である。これらの具体的CRUD契約は別セグメントの対象であり、本書では混同しない。

## データ契約

抽象classが子classへ提供する主な契約は次のとおり。

| 区分 | field・property |
|---|---|
| 稼働場所・種別 | `siteId`必須、`securityType`必須 |
| 日時 | `dateAt`、`shiftType`、`startTime`、`endTime`、`isStartNextDay`、`breakMinutes`、`regulationWorkMinutes` |
| 人員条件 | `requiredPersonnel`必須、`qualificationRequired` |
| 内容 | `workDescription`、`remarks`。汎用`title`、`content`、`author`、`status`はOperation基底にない |
| 配置 | `employees[]`、`outsourcers[]`。要素はOperationDetail派生class |
| 読み取り専用プロパティ | `date`、`startAt`、`endAt`、`isSpansNextDay`、`attendanceDateAt`、`attendanceDate`、`groupKey`、`agreementKey`、`orderKey`、各ID/count、人員過不足、workers |
| ゲッター | `totalWorkMinutes`、`regularTimeWorkMinutes`、`overtimeWorkMinutes`、変更差分系 |

親のsite/date/shift/start/end/翌日開始/休憩/規定時間を変更すると、全employee/outsourcer明細へ同値を同期する。その後にworker個別値を設定できるが、親を再変更すると該当個別値は上書きされる。employee ID重複は追加時に拒否する。outsourcerは同じ会社IDでもindexを増やして複数明細を表現する。

## CRUD・validation

`Operation` constructorは直接instance化を例外で拒否するため、このclass自体のCRUDは存在しない。static `collectionPath = "Operations"`、autonumber false、logicalDelete falseを持つが、現行アプリはこのclassからFirestore CRUDを行わない。

schema fieldには必須指定があり、setterはsiteId型、shift enum、非負の規定時間、時刻型などを検査する。基底classのvalidationは子classへ継承されるが、Firestore Rulesにはfield schemaの検証がない。status、lock、archive、duplicate契約は基底Operationにはない。

## 検索・表示

Operation collectionを検索・sort・表示する処理はない。予定画面はSiteOperationSchedulesをdateAt範囲で取得して現場・勤務区分orderで表示し、実績画面はOperationResultsを扱う。基底の`groupKey`、`agreementKey`、`orderKey`は子classの集約・適用・表示順で利用可能な計算keyであるが、Operation横断queryを形成しない。

## 写真連携

写真folderの`operationId`はOperation documentへの参照ではない。索引同期時に同じIDのOperationResultを優先し、なければSiteOperationScheduleを検索してdateAtを得る。親がどちらもなければ索引を削除するが、画像は残す。

予定削除時、実績未作成なら予定IDの写真folderを削除し、実績作成済みなら保持する。OperationResult削除時は実績IDのfolderを削除する。この写真境界の認可・保持課題はFUT-0105、FUT-0108、FUT-0109に記録済みである。

## 削除・保持

抽象Operationのdelete/archive/restoreはない。子document削除の具体的可否は各RulesとUIに属する。Operation共通の保持policyや、予定から実績へ移る際の永続的な共通ID entityは確認できない。

## Rules・テナント・セキュリティ

Firestore Rulesに`Companies/{companyId}/Operations/{docId}` matchはないため、通常のdefault deny下ではclient CRUDできない。SiteOperationSchedulesとOperationResultsにはそれぞれ同一company claimまたはsuper-userの包括read/write ruleがある。Storage `Operations` folderは認証のみで全path read/write可能であり、Firestoreの抽象collectionとは別物である。

## 失敗・並行性

Operation自体に保存処理がないためtransaction、同時編集、部分失敗、lockもない。親field setterによるworker全件同期はmemory内で同期的に行われ、途中のsetter例外時に一連の変更をrollbackする仕組みは確認できない。永続化・競合は具体的な子classの処理に委ねられる。

## 矛盾・未使用候補

- 抽象classが`collectionPath = "Operations"`を持つ一方、直接instance化・CRUD・Rules matchはなく、Storage namespaceだけが同名で実利用されるため、用語とpathを誤認しやすい。
- 目的に挙げられたauthor/status/title/contentは基底Operationにはない。類似するのは`workDescription`と`remarks`だけである。
- `Operation.key`と`isKeyChanged`はdeprecatedで常にnull/falseを返す。

## 将来要対応

FUT-0111を`future-actions.md`へ追加した。写真関連はFUT-0105、FUT-0108、FUT-0109を参照する。

## 要確認事項

CONF-0093を`pending-confirmations.md`へ追加した。

## 未確認範囲

SiteOperationScheduleとOperationResult各々のCRUD本文、状態・lock、Attendance/Billing、実データ、remote deploy、親画面全体は本セグメントでは未確認である。
