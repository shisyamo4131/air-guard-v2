# OperationResult派生文書の復旧計画

## 目的と現在地

Devでは、OperationResult作成・更新後のBilling同期が先に失敗し、後続のDailyAttendance等が作られない事象を確認した。親マスター存在チェックとarchive検索用索引の厳密検査を撤去したcodeを先に反映し、その後、欠落した派生文書だけを安全に再計算する。

この文書は計画であり、Devデータの読取り・変更・デプロイを承認するものではない。対象会社、正確な開始日・終了日、件数は未確定である。

## 読取り専用dry-runの準備状況

読取り専用の差分確認toolは準備済みで、Devでは未実行である。純粋な計算部分はFirestoreへ接続せず、CLIを直接実行した場合だけDevを読み取る。apply、snapshot、rollback、削除の実装は含めず、これらはdry-run結果を確認した後の別checkpoint・別承認とする。

2026-09-14時点で確認済みの接続先metadataは、Firebase project `air-guard-v2-dev`、database `(default)`、Firestore Standard edition / Native modeである。対象company、日付範囲、各collectionの件数上限は未確定であり、実行承認前に実値と根拠を固定する。

実行templateは次のとおりである。`<...>`はすべてoperatorが実値を指定する必須項目であり、この文書は件数を既定値または承認済み値として定めない。

```powershell
$env:AIRGUARD_DEV_CREDENTIAL_PATH = '<承認済みのローカル読取り資格情報ファイルの絶対パス>'
node scripts/check-operation-result-projections.mjs `
  --read-only `
  --project air-guard-v2-dev `
  --database '(default)' `
  --company-id '<対象company ID>' `
  --start-date '<YYYY-MM-DD>' `
  --end-date '<YYYY-MM-DD>' `
  --page-size '<1回の読取り件数>' `
  --max-operation-results '<OperationResultsの最大読取り件数>' `
  --max-billings '<Billingsの最大読取り件数>' `
  --max-daily-attendances '<DailyAttendancesの最大読取り件数>' `
  --max-daily-operations-by-employee '<DailyOperationsByEmployeeの最大読取り件数>' `
  --max-site-employee-histories '<SiteEmployeeHistoriesの最大読取り件数>' `
  --max-customers '<必要なCustomersの最大読取り件数>' `
  --timeout-ms '<全体の制限時間>' `
  --expected-commit '<実行を承認した40桁commit SHA>'
```

toolは、実行前にproject、database、company ID、期間、branch、commit、cleanなworktree、資格情報のproject一致、Emulator・proxy・接続先上書きがないことを確認する。5 collectionはdocument ID順でpage読取りし、指定上限と同数だった場合も追加で1件だけ確認して、上限による打切りを成功と誤認しない。必要なCustomerだけを別上限内で読む。

標準出力はJSON 1件だけとし、status、読取り完了の可否、project/database、company IDの集約用hash、対象期間、collection別読取り件数、派生先別の候補・不足・更新・一致・余分・計算不能件数、finding code別件数、plan digest、指定上限だけを含める。個人名、現場名、document ID、従業員・取引先・現場のID、実値、資格情報のemail、対象別hashは出力しない。

| exit | 意味 |
|---:|---|
| 0 | 全pageを読み切り、差分なし |
| 2 | 全pageを読み切り、不足・更新候補または余分な文書あり |
| 3 | data不正、上限超過、timeout、page不完了、計算不能等により判定未完了 |
| 64 | 必須引数の不足、余分な引数、形式・範囲不正 |
| 70 | 想定外の内部error |
| 78 | project/database/company、repository、commit、環境、資格情報等のtarget確認拒否 |

同じ固定commit、company、期間、上限でread-only dry-runを2回行い、両方が`complete: true`で、件数と`planDigest`が一致した場合だけ安定した計画候補とする。exit 3・64・70・78、digest不一致、件数変化がある場合はsnapshotやapplyへ進まない。exit 2は想定される差分検出であり、それだけでapply承認とはしない。

## 対象

正本は`Companies/{companyId}/OperationResults`とし、次の4派生先を照合する。

| 派生先 | 確認内容 |
|---|---|
| Billings | 請求対象の実績ID、税率、金額、請求日別の集計 |
| DailyAttendances | 従業員・勤務日別の実績ID、開始・終了、休憩、集計 |
| DailyOperationsByEmployee | 従業員・実績日別の実績ID、勤務時間、集計 |
| SiteEmployeeHistories | 現場・従業員別の初回日と最終日 |

日報写真、予定、Storage削除は今回の欠落作成の直接対象に含めない。照合で別の欠落が確認された場合は、同じrepairへ自動的に広げず別対象として報告する。

## 実行順序

1. 修正済みFunctionsとRulesの最終検証を行い、GitHub ActionsによるDev反映を別承認で実施する。
2. Devの対象project・database・companyを実値で再確認する。現在確認済みなのはDevの既定databaseがFirestore Standard Native modeであることだけで、対象companyは未確定である。
3. read-only dry-runでOperationResultsから4派生先の期待値を再計算し、現在値との差だけを数える。個人名、現場名、document IDを通常logや報告へ出さず、会社、日付範囲、派生先別の不足・不一致・余剰件数、処理件数、digest、読取り完了状態を記録する。
4. dry-runの結果から正確な日付範囲と対象件数を確定する。利用者観測の「概ね9月4日まで、一部9月10日」は開始候補を探す手掛かりに留める。
5. apply前に対象OperationResultsと変更予定の派生文書だけをsnapshotへ保存し、作成予定ID、更新予定ID、変更前digestをreceiptへ固定する。対象外の会社・期間・collectionを含めない。
6. 専用repairを小さな単位で実行する。単純なcreate event再実行ではなく、現在のOperationResults全体から影響keyごとの期待状態を計算し、既存4派生先との差分を作る。Site、日付、Customer、従業員が途中で変わった実績では旧key側の残存も検出する。OperationResult本体を空更新してTriggerを再発火させる方法は使わない。
7. 各実績について4派生先を独立して試し、一つの失敗で残りを飛ばさない。成功、失敗、対象外を派生先別に記録し、値や個人情報をlogへ出さない。
8. apply後に同じdry-runを再実行し、不足・不一致が0であること、処理件数とdigestが一致すること、Functions errorが増えていないことを確認する。
9. 利用者がDev画面で対象日の勤怠・請求・勤務回数・履歴を確認する。自動照合と画面確認の両方が済むまで復旧完了としない。

apply前は通常writerと対象Triggerの動きを止めるか、同等のTransitional quiet状態を確保する。read-only dry-runを連続2回行ってdigestが一致し、snapshot後のfresh dry-runも一致した場合だけapplyへ進む。更新とrollbackは各文書のupdateTimeまたは同等のrevision/digestを前提条件にし、snapshot後に変化した文書はwrite 0で停止する。Billingの手動調整等、再計算対象外のfieldは置換しない。

追加・更新と、余剰文書の削除は分ける。削除済みOperationResultに由来する古い派生文書は、削除前の情報を確認できない限り自動削除しない。削除候補は件数と根拠を別に示し、別承認とする。

## 停止条件

- 対象project、database、company、日付範囲のいずれかが一意に確定しない。
- dry-runが件数上限を超える、全pageが未読了になる、または同じ入力でdigestが安定しない。
- OperationResult自体に計算不能な形状がある。
- repair対象外の削除・余剰文書が見つかる。
- snapshot、作成ID一覧、rollback手順のいずれかを準備できない。
- apply中に想定外のcollectionまたは会社への書込みが1件でも検出される。

## Rollback

更新した派生文書は実行前snapshotへ戻す。repairが新規作成した文書は、receiptに記録された正確な作成IDだけを削除候補とし、rollbackの別承認後に処理する。OperationResult本体、親マスター、対象外期間は変更しない。余剰文書の削除は通常applyにもrollbackにも含めず、根拠と影響を確認した別計画に分ける。

## 承認境界

- GitHub ActionsによるDev反映は、検証済みcommitとworkflowを示したうえで別承認を得る。
- Dev read-only dry-runは、対象project・database・company・期間・出力制限を示して承認を得る。
- Dev applyとrollbackはそれぞれ別承認とし、dry-run receipt、変更上限、batch幅、停止条件を事前に示す。
- Prodは本計画の対象外とする。
