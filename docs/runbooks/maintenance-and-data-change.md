# maintenance・data change runbook

- 状態: 承認済み運用契約・product gate未実装
- 最終確認日: 2026-08-28
- 役割: maintenanceを伴うmigration、repair、restoreで通常処理を静穏化し、snapshot・apply・post-checkを安全に行う共通手順
- 関連ADR: [0026 project-wide maintenance静穏化とdata change境界](../decisions/0026-maintenance-quiescence-and-data-change.md)

## 適用境界

このrunbookはCompany専用ではなく、System全体または1 tenantのdata changeへ適用する。maintenanceは排他lockではない。現行productはclient route制御が中心であり、Firestore Rules、Callable、Admin SDK、scheduled・trigger Functions、開始済み処理の完全停止を保証しない。

実行前に、対象環境、固定commit、service、collection/data、通常停止対象、例外provider処理、quiet period、監視Function、backup、rollback、停止条件、dry-run/apply/post-check、derived data、解除後受入れを一つのbounded checkpointへ固定する。新しいmigration、破壊的repair、対象拡張、Prodは別承認とする。

## product gateの目標状態

次が実装・検証済みになるまでは、runbookだけで排他が成立したと報告しない。

- maintenance stateはserver-ownedで、通常clientが変更できない。
- Firestore Rulesはmaintenance中の通常client writeを拒否する。
- business Callableの共通identity/auth gateは新しい通常処理を拒否する。
- scheduled・trigger Functionsは対象tenantまたはSystemがmaintenance中なら通常の自動変更をskipする。
- maintenance stateを取得できない保護対象操作はfail closedとし、有限deadline、retry、状態再取得を持つ。
- 一般利用者は停止案内とsign-outだけを利用でき、provider migration・repairは製品内super-user bypassでなく個別承認されたoperator経路から行う。

## 実行mode

- **Gate-ready mode**: 上記product gateが対象service・tenantで実装・検証済みである。maintenance開始後に通常client write、business Callable、scheduled/trigger変更の拒否・skipを直接確認してからquiet periodへ進む。
- **Transitional quiet mode**: product gateが未実装または対象外である。checkpointに未実装gateと補償策を明記し、停止画面への遷移、既知の試用利用者・operatorの作業停止、対象client/Callable/scheduled/trigger log、より保守的なquiet period、連続dry-run digestで補う。これは排他や拒否成功の証拠ではない。想定外writeを1件でも観測した場合はapply前に停止し、追加waitまたはgate-ready releaseを先行する。

実行modeをcheckpointで必ず一つ選ぶ。未実装gateを成功扱いせず、Gate-ready modeの拒否証拠をTransitional quiet modeへ転用しない。ProdでTransitional quiet modeを使えるとは本runbookから判断せず、Prod固有の別承認とRPO/RTO・operator条件で決める。

## checkpoint必須項目

| 項目 | 固定する内容 |
|---|---|
| identity | release/migration ID、environment、project、database、commit、operator |
| scope | service、collection/path、想定read/write/delete、対象件数、derived data |
| normal stop | 拒否するclient/Callable、skipするscheduled/trigger、停止案内 |
| mode | Gate-readyまたはTransitional quiet、未実装gate、補償策 |
| exception | 許可するmigration・repair・rebuild・verificationだけ |
| quiescence | cutoff、quiet period、監視Function/log、dry-run digest、安定判定 |
| recovery | snapshot/backup、rollback可能範囲、apply後のcorrective path |
| evidence | command、result、独立exit、前後digest、integrity、log、受入れ |
| stop | identity不一致、対象増加、digest不安定、想定外write、backup不備、error |

## 標準手順

1. **remote変更前preflight**: 固定commit、Git clean、対象project/database edition、CLI/auth、必要test・build、migration dry-runの構文・target guardを確認する。Hostingを含む場合は実際のDev設定で静的生成を先に成功させる。
2. **maintenance開始**: 対象System/tenantをmaintenanceへ切り替え、cutoff時刻、reason、actor、scopeを記録する。Gate-ready modeは通常client/Callableの拒否とscheduled/trigger skipを確認する。Transitional quiet modeは停止画面、既知利用者・operatorの作業停止、観測対象を確認し、server拒否は未実装と明記する。
3. **bounded wait**: checkpointで定めたquiet periodを待つ。時間は対象Functionの最大想定処理時間、schedule、外部呼出し、trigger chainから決め、固定のproject共通値にしない。
4. **観測**: cutoff以降の対象Function log、scheduled実行、trigger errorを確認する。logが静かなことだけで処理不存在を断定しない。
5. **連続dry-run**: side effectなしのdry-runを実行し、digest、件数、findingを保存する。対象writeが収束していなければ追加waitと観測後に再実行する。連続するdigestが一致し、blocker 0になるまでsnapshot/applyへ進まない。
6. **整合snapshot**: 静穏判定後に対象dataと必要な外部状態のsnapshot/backupを取得し、receipt、時刻、scope、復元制約を確認する。PITRだけを整合snapshotやAuthentication・Storage・外部service backupの代替にしない。
7. **fresh dry-run**: snapshot後のfresh dry-runが承認済みplanと一致することを確認する。件数・digest・targetが変われば停止する。
8. **apply**: exact target、plan digest、backup confirmationを指定して実行する。部分失敗時は推測deleteや別scopeへの自動repairを行わず、maintenanceを維持して再dry-runする。
9. **post-check**: 同じdry-runがcleanまたは承認済み終端になること、schema・参照・件数を確認する。Gate-ready modeは拒否・skip経路も確認する。Transitional quiet modeは未実装拒否を成功扱いせず、対象logとdigestに想定外writeがないことを再確認する。migrationが起動または抑止したderived dataを列挙し、checkpointで承認したものだけを再構築して再検証する。
10. **log・service検証**: 対象Functionsのerror、service revision、Rules、client/server contract、主要正常・拒否経路を確認する。
11. **maintenance解除**: 解除条件がすべて揃った場合だけ解除する。解除後は新しいsessionで通常利用と対象機能を受入れ、想定外write・errorがないことを確認する。

## scheduled・trigger処理

- Site migration時のSite自動終了、通知dispatcher、reconciler等、対象dataを更新する通常処理は停止対象へ含める。
- maintenance開始前に受理済みの処理はcancelできると仮定せず、bounded waitとdry-run安定で終了を確認する。
- migration自身がtriggerを起動する場合、許可するtrigger、抑止するtrigger、再構築するderived data、検証digestをcheckpointに明記する。
- 全collectionの一括rebuildを安全策として推測実行しない。

## 停止とrollback

次のいずれかでapply前に停止する。

- environment、project、database、commit、operator identityがcheckpointと異なる。
- maintenance中も通常client/Callable/scheduled/trigger writeが継続する。
- 連続dry-run digestが安定しない、または対象件数・field・collectionが増えた。
- snapshot/backup scope、receipt、復元制約が確認できない。
- unknown field、不正data、競合、orphan、provider errorが自動repairを要求する。

apply後の失敗はmaintenanceを維持する。Git revertだけでdataを戻せると仮定せず、snapshot、前後digest、exact write evidenceからcorrective releaseまたは別承認repairを組み立てる。create-only migrationの追加documentを推測削除せず、既存documentのupdate/deleteはbefore snapshotとrevision preconditionなしに戻さない。

## 完了証拠

release/migration ID、commit、environment、project/database、service、data scope、実行mode、未実装gateと補償策、maintenance開始・解除、quiet period、監視Function、各command/result/exit、連続dry-run digest、snapshot receipt、apply件数、post-check、derived rebuild、log、受入れ、rollback状態、未確認事項を報告する。秘密情報、token、実account識別子、個人・顧客・勤怠・請求dataを含めない。
