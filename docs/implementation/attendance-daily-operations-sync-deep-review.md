# Attendance / DailyOperationsByEmployee sync deep review

- 状態: 実装調査（deep review）
- 対象セグメント: SPEC-DEEP-003
- 最終確認日: 2026-08-11
- 対象: Cloud Functions 13 files
- 直接依存: OperationResult trigger、DailyAttendance / DailyOperationByEmployee schema公開契約

## ファイル別公開契約

| file | responsibility / API | branches and effects | failure / retry / reachability |
| --- | --- | --- | --- |
| `dailyAttendances/addOperationResultToDailyAttendances.js` | `addOperationResultToDailyAttendances({attendances, operationResult})` | `employees`のid＋attendanceDate一致先へ、同result ID除去後にfull OperationResultを追加 | 型を厳格検証。pure mutation。trigger syncから到達 |
| `dailyAttendances/fetchDailyAttendancesRelatedOperationResult.js` | company/resultから対象日次勤怠をpoint fetch | `${employee.id}_${employee.attendanceDate}`。不存在はattendanceDateAtで初期化 | transaction任意。employee重複のdocId重複排除なし |
| `dailyAttendances/index.js` | 5 APIのre-export | 副作用なし | OperationResult triggerからsyncが到達。dead codeではない |
| `dailyAttendances/removeOperationResultFromDailyAttendances.js` | 対象配列からresult IDを除去 | 全対象のembedded配列をfilter | 型検証後pure mutation |
| `dailyAttendances/saveDailyAttendances.js` | create/update/deleteを選択 | 既存かつ`isAttended`ならupdate、falseならdelete。未作成はtrue時create | 呼出順にawait。同一transaction内。重複doc instanceを統合しない |
| `dailyAttendances/syncOperationResultToDailyAttendances.js` | create/update/delete統合入口 | create/deleteは片側employeesをpoint fetch。updateはbefore/afterをdocId Mapでunionしてremove→add→save | 1 event内は単一Firestore transaction。旧配置先array-contains逆引きなし。triggerから到達 |
| `dailyOperationsByEmployee/addOperationResultToDailyOperationsByEmployee.js` | id＋operation date一致先へresult追加 | employeesだけを対象に同ID置換 | 型検証後pure mutation |
| `dailyOperationsByEmployee/fetchDailyOperationsByEmployeeRelatedOperationResult.js` | `operationResultIds array-contains`で旧配置先query | query結果をinstance化 | transaction必須。既存stale配置先をevent dataに依存せず取得 |
| `dailyOperationsByEmployee/fetchDailyOperationsByEmployeeTargets.js` | after employeesの新配置先point fetch | `${employee.id}_${employee.date}`、MapでdocId重複排除、不存在はdateAtで初期化 | transaction/Map必須。読み取りをwrite前に完了 |
| `dailyOperationsByEmployee/index.js` | 6 APIのre-export | 副作用なし | OperationResult triggerからsyncが到達 |
| `dailyOperationsByEmployee/removeOperationResultFromDailyOperationsByEmployee.js` | 全旧新対象からresult ID除去 | embedded配列filter | 型検証後pure mutation |
| `dailyOperationsByEmployee/saveDailyOperationsByEmployee.js` | create/update/deleteを選択 | 既存で残件0ならdelete、残件ありupdate、未作成で残件ありcreate | transaction必須。逐次await |
| `dailyOperationsByEmployee/syncOperationResultToDailyOperationsByEmployee.js` | create/update/delete統合入口 | before優先のID逆引き、新対象union、remove→after add→save | 単一Firestore transaction。再実行時ID重複を抑制。triggerから到達 |

## Event flow・状態遷移

OperationResult triggerはBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoryの順に直列awaitする。両日次同期はそれぞれ独立したFirestore transactionで、元OperationResult、Billing、相互の日次documentと共通transactionではない。後段失敗時も元writeと先行projectionは残り、errorはtriggerから再throwされる。

DailyAttendanceはbefore/after employeesからdoc IDを再構成する。updateだけは両集合をMapでunionするが、create/deleteには同一employee＋attendanceDate重複のMap排除がない。過去のstale配置先や壊れたbeforeに含まれないdocumentを発見できない。

DailyOperationsByEmployeeは保存済み`operationResultIds`の逆引きとafter targetのunionを使う。このためemployee/date移動とstale旧配置先の除去を同じtransactionで処理し、残件0を物理deleteする。

## Schema計算・保存境界

両modelはfull OperationResultを`customClass`付き配列に保存し、`operationResultIds`を列挙可能な読み取り専用プロパティとして保存する。DailyAttendanceの`details`は現実装では`operationResult.workers`をidだけでfilterしており、承認済みのemployee-only方針は未実装である。startTime/endTimeはHH:mm文字列比較のままである。

DailyOperationByEmployeeの`details`はemployeesのid＋稼働日を照合する。勤務分数、休憩、日勤/夜勤件数を合計し、取極め基準売上はOJTを0円、取極め・rate欠損を未算出、時間単価を分/60、明細金額を`Math.round`して集計する。同期file自身はこれらを個別計算せず、instance serialization時の読み取り専用プロパティに依存する。

## 認証・tenant・validation

入口はFirestore eventでcaller認証を持たず、event pathのcompanyIdをprefixへ使う。helperはcompanyId、class instance、transaction、Map/配列要素型を検証するが、埋込みOperationResultのcompany整合やemployee所属を再検証しない。Admin SDK経路でRulesを迂回する。

## Error・再実行・並行性

- transaction競合時のplatform/Firestore retryに依存する。同じresult IDを除去後追加するため通常event replayの配列重複は抑える。
- full embedded snapshotの容量超過、validation、create/update/delete失敗はtransaction全体をrejectする。
- DailyAttendance create/deleteの重複targetは同一documentに複数instance/writeを組み立て得る。実adapter/Firestore挙動はruntime未検証。
- DailyOperationsByEmployeeはqueryとpoint readをwrite前に完了し、Mapで同一targetを統合する。

## 到達性・comment mismatch・tests

- 13ファイルはすべてindexまたはsyncから静的に到達し、unused/dead候補はない。
- DailyAttendanceの実装はAGENTS.mdのarray-contains逆引きToDoと未一致。DailyOperationsByEmployeeは同方式を実装済みで、比較可能な先行例である。
- 既存`daily-operations-sync.md`の「schema実体不在」は現在の隣接repository状態と矛盾したため訂正した。
- 対象API/exportを直接検証する自動testはrepository内検索で確認できなかった。
- 新規FUT/CONFは追加せず、FUT-0030、0035〜0039、0041、0153へ統合する。

## 未確認範囲

- Emulatorのtransaction retry、重複employee、1 MiB境界、out-of-order event
- Cloud側retry/runtime override、実データのstale/容量/contention、監視・repair
- FireModel adapterの同一transaction内同一doc複数writeの具体挙動
