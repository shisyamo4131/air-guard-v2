# OJT・警備教育情報実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-037
- 最終確認日: 2026-08-11
- 根拠ファイル: schemas `Employee.js`、`OperationDetail.js`、`SiteOperationScheduleDetail.js`、`ArrangementNotification.js`、`OperationResultDetail.js`、`Operation.js`、`OperationResult.js`、`DailyOperationByEmployee.js`、security-type constants、予定worker/通知/実績の直接UI、`components/SiteOperationSchedule/effectiveWorker.js`、`Arrangements/Manager/useIndex.js`

## 責務・用語

現行の`isOjt`は、特定稼働のworkerを「OJTとして配置人数・売上計算上区別する」boolean flagである。Employeeが受講・実施した警備教育の履歴modelではない。

securityType enumには`TRAINING`（研修）があり、sales/operationQuantity集計対象falseだが、これは現場稼働全体の種別であり、worker単位`isOjt`やEmployee教育履歴と連動しない。

## データ契約

| 対象 | 契約 |
|---|---|
| Employee | 教育履歴/OJT専用fieldなし |
| OperationDetail派生 | `isOjt` boolean、label OJT、defaultはcheck field既定値に依存 |
| SiteOperationSchedule | worker明細ごとの`isOjt`を保持 |
| ArrangementNotification | schedule detailを継承し`isOjt`を保持・編集可能 |
| OperationResult | result detailへ`isOjt`をsnapshot |
| securityType | `TRAINING`は稼働全体の研修区分、売上/稼働数量集計false |

教育区分、新任/現任、法定/任意、受講日、開始終了、時間数、期限、指導責任者、教育者、教材、評価、修了、証跡、次回期限は存在しない。

## Employee保持

Employee schemaと従業員詳細の直接範囲に、教育/OJT履歴配列、累積時間、最終教育日、次回期限、指導者資格は確認できない。したがってEmployee単位で検索・期限通知・修了判定・配置適格性を導出する保存方式もない。

## 配置・通知・実績flow

1. SiteOperationSchedule worker editorで`isOjt`をcheckbox設定する。
2. 配置通知にも`isOjt`がcopyされ、配置管理者は承認済み現行挙動として通知編集時に変更できる。
3. 表示・人数集計は通知が存在すればnotification.isOjtを優先し、なければschedule worker.isOjtを使う。nullish coalescingのため明示falseもoverrideとして保持する。
4. SiteOperationScheduleの実効worker変換も同じ通知優先値をOperationResult detailへ設定する。
5. OperationResult worker editorでも`isOjt` checkboxを直接編集できる。

OJT指定の根拠となる教育program、対象Employee、指導者、承認者、期間を参照/snapshotしない。

## 計算影響

- Operation.assignedPersonnelCountはOJT employeeを0人、OJT outsourcer明細も0人として必要人数判定から除外する。
- 配置管理の日別assignedも通知優先の実効OJTを除外する。一方、通知status件数はOJT workerも1明細として数える。
- OperationResult.statisticsはbase/qualified/totalそれぞれの`ojt` subcategoryへ人数・勤務・残業・休憩時間を分離集計し、通常category本体へは加えない。
- DailyOperationByEmployee.agreementBasedSalesDetailsはOJTなら取極めの有無にかかわらず計算可能な0円とする。
- securityType TRAININGは別軸でsales/operationQuantity集計falseである。

OJTが勤怠時間、給与、法定教育時間、外注費、請求書へ及ぼす全体は対象外で、上記直接getterだけを確認した。

## Validation・履歴

`isOjt`はboolean checkだけで、Employee、日付、教育履歴、指導者、同一site、最大人数、期間、資格との整合validationがない。誰がいつfalse/trueへ変更したかのfield-level履歴もない。予定→通知→実績で値をcopyするが、元の値・override理由・変更者を実績に保存しない。

## 権限・security

専用OJT page/permission/Rulesはない。予定、通知、実績それぞれの暫定pageSettingsと包括的同社Rulesに従う。配置管理者が通知のOJTを変更できることは承認済みだが、具体的role/permission名と、実績作成後の訂正actorは未確定である。教育履歴自体がないため、個人教育情報の閲覧範囲も未設計である。

## Qualificationとの違い

QualificationはEmployee内Certification配列を持つが配置判定とは未連動であり、`isQualified`も手動booleanである。OJTはEmployee側の履歴すらなく、稼働明細booleanだけである。workerは`isQualified=true`かつ`isOjt=true`を同時に持て、statisticsではqualified.ojtへ分類される。

## 矛盾・未使用候補

- OJTという名称から教育履歴を想起するが、実装は稼働ごとの計算flagだけである。
- OJTを必要人数0人・従業員売上0円とする一方、通知statusと実勤務時間は保持する。この境界の正式な給与/勤怠/請求仕様は未確認。
- schedule、notification、resultで直接変更できるが、override理由と教育根拠がない。
- `TRAINING` securityTypeとworker `isOjt`は独立し、組合せ制約がない。
- 外注workerもisOjt=trueにでき、人数全量を0として扱うが、外注OJTの正式運用は未確認。

## 将来要対応

FUT-0127〜FUT-0129を`future-actions.md`へ追加した。

## 要確認事項

CONF-0106〜CONF-0108を`pending-confirmations.md`へ追加した。

## 未確認範囲

勤怠・給与・請求全体、研修帳票、法令・外部制度、Employee全体、予定/実績保存本文、実データ、remote環境は未確認である。
