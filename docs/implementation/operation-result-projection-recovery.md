# OperationResult派生文書の復旧計画

## 目的と現在地

Devでは、OperationResult作成・更新後のBilling同期が先に失敗し、後続のDailyAttendance等が作られない事象を確認した。親マスター存在チェックとarchive検索用索引の厳密検査を撤去したcodeを先に反映し、その後、欠落した派生文書だけを安全に再計算する。

読取り確認により、対象は全4 company、期間は2026-09-05から2026-09-14、通常apply候補は344件に確定した。利用者は、Devについてprivate backupの作成後にapplyへ進むことと、メンテナンスモードを必須にしないことを承認した。実company IDとdigestはprivate artifactだけで扱い、この文書やrepositoryには記録しない。

## 読取り専用dry-runとrepair実装の準備状況

読取り専用の差分確認toolは準備済みである。2026-09-05から2026-09-14を対象に、全4 companyについて同一条件で2回確認し、いずれも作成250件、更新94件、書込み計344件、計算不能0件で安定した。内訳はBillingが更新12件、DailyAttendancesが作成120件・更新16件、DailyOperationsByEmployeeが作成120件・更新16件、SiteEmployeeHistoriesが作成10件・更新50件である。余分なBilling 1件は通常applyから除外する。

snapshot準備、apply、rollbackのcodeは実装済みで、限定testを通過した段階である。独立review、総合検証、Devへの書込み、実snapshot作成、apply、rollbackは未実施である。通常applyが扱うのは作成・更新だけで、削除操作は持たない。rollback時だけ、receiptに記録された今回の作成文書を、適用後の更新時刻と内容が一致する場合に限って削除できる。

2026-09-14時点で確認済みなのは、Firebase project `air-guard-v2-dev`、database `(default)`、Firestore Standard edition / Native mode、対象が全4 company、期間が2026-09-05から2026-09-14、通常apply候補が作成250件・更新94件の計344件である。privateなcompany ID、2回分の安定digest、private artifact path、実行時に再確認する各collection上限値はrepositoryには未記録であり、実行承認時にprivate入力と実値を照合する。

実行templateは次のとおりである。`<...>`はoperatorが実値を指定する必須項目である。344件とその派生先別内訳は確認済みで、collection読取り上限は実行時に指定する。

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

## snapshot準備・apply・rollbackのcommand template

private backupの保存場所と保存期間は実行前に決める。toolはrepository外の固定local driveだけを許可し、symlinkまたはjunction経由、repository内、既存backupの上書きを拒否する。`<...>`には承認された実値を指定し、対象company IDと2回分のdigestはrepositoryへ置かず、privateなcompanies fileだけに保存する。

```powershell
$env:AIRGUARD_DEV_CREDENTIAL_PATH = '<承認済み資格情報fileの絶対path>'
node scripts/prepare-operation-result-projection-repair.mjs `
  --prepare --project air-guard-v2-dev --database '(default)' `
  --companies-file '<private companies fileの絶対path>' `
  --snapshot-file '<新規backup snapshot fileの絶対path>' `
  --start-date 2026-09-05 --end-date 2026-09-14 `
  --page-size '<承認値>' --max-operation-results '<承認値>' --max-billings '<承認値>' `
  --max-daily-attendances '<承認値>' --max-daily-operations-by-employee '<承認値>' `
  --max-site-employee-histories '<承認値>' --max-customers '<承認値>' `
  --timeout-ms '<承認値>' --expected-commit '<承認済み40桁commit SHA>'
```

prepareはDevを読み直して計画が変わっていないことを確認し、利用したOperationResultsと変更対象の変更前状態をprivate backup snapshotへ保存するだけで、Firestoreへは書き込まない。applyはbackup内部のdigestと344件の内訳を再検証し、現在のsource・targetの更新時刻と内容がbackup時点から変わっていないことを各transactionで確認する。

```powershell
node scripts/apply-operation-result-projection-repair.mjs `
  --apply --project air-guard-v2-dev --database '(default)' `
  --snapshot-file '<prepareで作成したprivate backup snapshotの絶対path>' `
  --expected-commit '<承認済み40桁commit SHA>'
```

rollbackはapplyの一部ではなく、利用者がrollbackを別途承認した場合だけ同じcommandの`--apply`を`--rollback`へ変えて実行する。receiptに記録済みのbatchを逆順に戻し、現在値がapply直後の更新時刻・digestと一致しない文書が1件でもあれば停止する。

```powershell
node scripts/apply-operation-result-projection-repair.mjs `
  --rollback --project air-guard-v2-dev --database '(default)' `
  --snapshot-file '<applyで使用したprivate backup snapshotの絶対path>' `
  --expected-commit '<承認済み40桁commit SHA>'
```

modeを省略した場合、または`--apply`と`--rollback`を同時指定した場合は書込み0件で拒否する。applyはcompanyごと、最大50件かつ計画data 4 MiB以下のtransactionに分割し、最初の失敗で後続batchを止める。OperationResult自体は更新せず、Triggerを再発火させない。receiptと同時実行防止lockはbackup pathから内部で決めるため、operatorが個別指定する必要はない。

apply後は同じ条件のread-only dry-runを再実行し、不足・更新候補が0であることを確認する。intent記録後にprocessが止まっても、batch内の全件がbackupの期待値と一致する場合は、そのbatchを完了済みとしてreceiptへ記録し、次のbatchから再開する。一部だけ一致する場合は自動で続行しない。

利用者承認により、Devではメンテナンスモードを必須にしない。既存source・targetの変更はtransaction前提条件で止めるが、backup作成後から各batch実行までに新しいOperationResultが追加される競合は技術的に完全排除できない。この残存riskを受け入れて進め、apply後のdry-runと画面確認で差分を検出する。完全な排他性があるとは主張しない。

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
2. apply直前にDevの対象project・databaseとprivate companies fileの全4 companyを実値で再確認する。Devの既定databaseがFirestore Standard Native modeであることと対象company数は確認済みだが、実IDは通常logやrepositoryへ出さない。
3. read-only dry-runでOperationResultsから4派生先の期待値を再計算し、現在値との差だけを数える。個人名、現場名、document IDを通常logや報告へ出さず、会社、日付範囲、派生先別の不足・不一致・余剰件数、処理件数、digest、読取り完了状態を記録する。
4. dry-runの結果から正確な日付範囲と対象件数を確定する。利用者観測の「概ね9月4日まで、一部9月10日」は開始候補を探す手掛かりに留める。
5. apply前に対象OperationResultsと変更予定の派生文書だけをsnapshotへ保存し、作成予定ID、更新予定ID、変更前digestをreceiptへ固定する。対象外の会社・期間・collectionを含めない。
6. 専用repairを小さな単位で実行する。単純なcreate event再実行ではなく、現在のOperationResults全体から影響keyごとの期待状態を計算し、既存4派生先との差分を作る。Site、日付、Customer、従業員が途中で変わった実績では旧key側の残存も検出する。OperationResult本体を空更新してTriggerを再発火させる方法は使わない。
7. 各実績について4派生先を独立して試し、一つの失敗で残りを飛ばさない。成功、失敗、対象外を派生先別に記録し、値や個人情報をlogへ出さない。
8. apply後に同じdry-runを再実行し、不足・不一致が0であること、処理件数とdigestが一致すること、Functions errorが増えていないことを確認する。
9. 利用者がDev画面で対象日の勤怠・請求・勤務回数・履歴を確認する。自動照合と画面確認の両方が済むまで復旧完了としない。

read-only dry-runを連続2回行ってdigestが一致し、private backup作成に成功した場合にapplyへ進む。メンテナンスモードや通常writerの停止は必須にしない。更新とrollbackは各文書のupdateTimeまたは同等のrevision/digestを前提条件にし、backup後に変化した既存文書はそのbatchをwrite 0で停止する。Billingの手動調整等、再計算対象外のfieldは置換しない。

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
- Dev applyはprivate backup成功を条件に承認済みである。rollbackは別承認とし、内部receipt、変更上限、batch幅、停止条件を事前に示す。
- Prodは本計画の対象外とする。

## 2026-09-17 試行Dev修復の実施結果（恒久対策とは別）

利用者承認のもと、Billing内にあった、削除済みOperationResultを保持する孤立snapshot 3件に対して、現在の削除projectionを再実行した。うち2件は、撤去済みの厳密な参照チェックによる当時のdelete projection失敗と対応する。最古1件の発生原因は現時点で特定できない。対象はOperationResultからBilling、DailyAttendances、DailyOperationsByEmployee、SiteEmployeeHistoriesへ派生する4 projectionで、Billingは1文書削除・2文書更新、各対象で4 projection処理が成功した。private backupは省略することが明示承認され、PITR有効を確認したうえで実施した。機密ID、個別document ID、個票はこの文書へ記録しない。

修復後の全Dev scanは、OperationResults 2457、Billings 275、DailyAttendances 4561、DailyOperationsByEmployee 4734、SiteEmployeeHistories 873だった。Billings、DailyAttendances、DailyOperationsByEmployeeのorphan・duplicate・index mismatchは各0、SiteEmployeeHistoriesのmissing・extra・mismatchは各0、maintenanceはfalseだった。cutoff後のOperationResult trigger change/failureは0/0だった。これらは試行Devで確認した実施結果であり、repository上の実装変更や恒久同期設計の完了を意味しない。

この修復で確認した現行設計上の再発リスク・限界は、event順序非保証、retry=false、failure ledger・reconciliationの不在、clientのBilling全体保存による古いprojection再混入可能性、差分更新がsource-currentへ必ず収束する設計でない点である。これらは今回の3件の確定原因とは扱わない。恒久対策は[将来要対応事項 FUT-0197](future-actions.md#fut-0197-operationresultから派生文書へのprojection同期を恒久化する)へ切り分けて記録し、本復旧計画の試行結果を恒久対策の実装・完了として扱わない。
