# OperationResult削除event chain（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-050
- 最終確認日: 2026-08-11
- 根拠ファイル: `functions/index.js`、`functions/triggers/operationResult.js`、`functions/modules/operationCleanup.js`、Billing/DailyAttendance/DailyOperationsByEmployee/SiteEmployeeHistoriesの直接同期helper、関連sync文書
- 調査境界: OperationResult deleteを受ける2 exported triggerと直接削除・再構築処理のみ。runtime、Firebase CLI、実data、UI実行は禁止範囲として未確認。

## export・fan-out

`functions/index.js`は`triggers/operationResult.js`と`modules/operationCleanup.js`をstar exportする。同じ `Companies/{companyId}/OperationResults/{docId}` deleteから、次の2 Functionが独立して発火する。

```text
OperationResult delete commit
├─ onOperationResultChange (onDocumentWritten)
│  ├─ 1 Billing remove
│  ├─ 2 DailyAttendance sync delete
│  ├─ 3 DailyOperationsByEmployee sync delete
│  └─ 4 SiteEmployeeHistories rebuild
└─ onOperationResultDeleted (onDocumentDeleted)
   ├─ A SecurityReports Storage folder delete
   └─ B linked SiteOperationSchedule delete
      └─ onSiteOperationScheduleDeleted
         └─ operationResultIdありならStorage deleteをskip
```

2本のtop-level trigger間に順序保証、共通transaction、相互待機はない。各trigger内部の番号順だけが直列`await`である。

## 派生data削除契約

| 対象 | lookup | 除去・0件処理 | atomicity / failure |
| --- | --- | --- | --- |
| Billing | beforeのcustomerId/siteId/billingDateからkey生成 | embedded resultをdocIdで除去。残件update、0件Billing delete | transactionなし。不存在はwarn。key欠損はthrowし後続を止める |
| DailyAttendance | before.employeesの`${employee.id}_${employee.attendanceDate}`をpoint fetch | embedded result除去。`isAttended`ならupdate、0件delete | 対象群は1 transaction。array-contains逆引きなし |
| DailyOperationsByEmployee | `operationResultIds array-contains before.docId` | 全旧配置先から除去。残件update、0件delete | 対象群は1 transaction、docId Mapで重複排除 |
| SiteEmployeeHistories | before.siteId＋before.employeeIdsごとに残存OperationResultsをquery | first/lastを再作成。残存0件ならdelete | employeeごと直列、共通transactionなし。0件delete errorは吸収 |
| SecurityReports | docIdからStorage prefix決定 | prefix全file delete、個別404は成功 | 非404 failureでschedule処理へ進まない |
| SiteOperationSchedule | before.siteOperationScheduleIdをpoint get | 存在時schedule物理delete | Storage成功後。transactionなし、不在は成功 |

## 実行順・部分成功

projection triggerはBilling→DailyAttendance→DailyOperationsByEmployee→SiteEmployeeHistoriesを直列処理し、途中errorをlogしてrethrowする。先行作用はrollbackされない。historyもemployee単位で部分成功し得る。

cleanup triggerはStorage削除後にscheduleを削除する。Storage failureならscheduleは残る。schedule deleteで別triggerが発火するが、delete snapshotの`operationResultId`がtruthyならStorage削除をskipする。projectionとcleanupは独立するため、派生dataだけstale、またはStorage/scheduleだけ残存する状態が可能である。

## retry・idempotency

- 明示retry option、event ledger、idempotency key、per-result sync statusはない。platform設定は未確認。
- Billingは同ID filterで逐次再実行時の除去を重複しにくくし、既にBilling不存在ならwarn終了するが、transaction外の並行lost updateは残る。
- DailyAttendanceはtransactionと同ID filterを使うが、before employees/dateから再構成した対象だけを読む。別のstale配置先はretryでも発見しない。
- DailyOperationsByEmployeeはarray-contains逆引きする。初回成功後は対象IDが消えるためretryはno-opとなる。
- SiteEmployeeHistoryは残存OperationResultsから再構築する。Storageは既削除404と空prefix、scheduleは不存在を成功扱いとする。

## source削除後の再構築

delete eventのbefore snapshotがdelivery/retryへ残る間は、削除済みsourceがなくても各keyを利用できる。しかし後日repair用にbefore metadataを保持するledgerはない。

| 対象 | sourceなしのrepair境界 |
| --- | --- |
| Billing | OperationResult IDのglobal逆引きがなく、before key喪失後はstale Billingを直接特定できない |
| DailyAttendance | array-contains逆引き未実装で、before employees/date喪失後のstale配置先発見が困難 |
| DailyOperationsByEmployee | stale documentにIDが残ればarray-contains逆引き可能 |
| SiteEmployeeHistories | siteId/employeeIdが分かれば残存resultsから再構築可能だが対象組合せledgerなし |
| Storage | companyId/docIdが分かればprefix cleanup可能 |
| schedule | schedule IDはbefore snapshot依存で、後日逆引き処理なし |

CONF-0018で承認済みのprojection別sync status、自動retry、admin reprocess、scheduled reconciliation、repair auditには、delete後もtarget metadataを保持する必要がある。

## schedule link・Billing edge

- delete時はscheduleの`operationResultId`をnullへ戻さず、linked schedule document自体を別triggerが物理削除する。standaloneまたはschedule IDなしならskipする。
- create/updateでは`isBillable=false`をskipするが、deleteは無条件でBilling removeを呼ぶ。取極めなし等でbillingDateがnullならkey生成が最初にthrowし、DailyAttendance、DailyOperationsByEmployee、historyが未到達となる（FUT-0046）。

## 確認済み整合・矛盾

- DailyAttendanceとDailyOperationsByEmployeeは残件update・0件deleteを実装するが、前者だけarray-contains逆引きがなくAGENTS.md ToDoとの差が残る。
- UI成功条件をOperationResult primary writeとする承認済み仕様とは整合する。
- 承認済みの自動retry・sync status・repairは未実装で、delete source消失後のmetadata保持もない。

## 将来要対応

- FUT-0030: 2 top-level triggerを含む部分成功、sync status、retry、repair metadataを実装する。
- FUT-0046: 非請求delete時はBilling removeをskipして後段を継続する。
- FUT-0035: DailyAttendanceをoperationResultIds逆引きへ移行する。
- FUT-0047: Billing removeをatomic化する。

## 要確認事項

- 既存CONF-0018の承認済み方針へdelete chainの証拠を追記した。新規CONFは追加していない。
- 2 triggerの統合方式は実装設計として既存FUT-0030へまとめ、独立した利用者仕様質問にしない。

## code evidenceで質問不要となった事項

- schedule linkはnull解除でなくschedule物理削除である。
- DailyOperationsByEmployeeはdelete時もID逆引きと0件deleteを使い、DailyAttendanceは使わない。
- 非請求deleteの後段停止は仕様不明でなく、Billing key生成前のskip欠落である。
- top-level 2 trigger間の順序は規定されず、各trigger内部だけ直列である。

## 未確認範囲

- Cloud retry、実行順・重複delivery、event ID、timeout/concurrency、monitoring。
- Emulator failure injection、Storage部分削除、schedule chain、同時Billing更新、stale実data、repair運用。
- adapter内部とStorage delete triggerの下流。
