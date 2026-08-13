# ArrangementNotification状態遷移UIと時間入力結線の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-008 — ArrangementNotification状態遷移UIと時間入力結線
- 最終確認日: 2026-08-11（SPEC-DEEP-014で対象component本文を再確認）
- 根拠ファイル: `components/ArrangementNotifications/Manager/index.vue`、`components/ArrangementNotification/Manager/index.vue`、`components/ArrangementNotification/Manager/toLeaved.vue`、`components/ArrangementNotification/CustomInput/index.vue`、`components/ArrangementNotification/TransitionBtn/index.vue`、`components/Arrangements/Manager/index.vue`・`useIndex.js` の直接呼出し、`composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js` のnotify、`components/OperationResult/Generator/index.vue`・`Detail.vue` の直接結線

この文書は検索で特定した状態遷移・notify呼出しと、その狭いUI結線から観察できる実装事実を記録する。下流のOperationResult・Attendance・Billing本文、配置管理全体、基底UIライブラリ、実データは調査していない。

## 承認済み仕様

2026-08-10にユーザーが次を承認した。以下はコードからの推測ではなく、承認済みの設計意図である。

- 配置管理者はArrangementNotificationを任意の4状態へ変更できる。状態を飛ばす操作と戻す操作を含む。
- OperationResult Generatorは、配置通知の現在状態にかかわらず直接LEAVEDへ変更できる。
- 配置管理者は状態変更と同じ編集操作で資格・OJTを変更できる。
- status transition historyはappend-onlyとし、過去確定時刻を消去・上書きしない。訂正はbefore・after・actor・reasonを記録する。
- reverseだけでは自動再送せず、同status再進行でも自動duplicate sendを行わない。resendはmanagerがreason付きで明示実行し、User normal forwardとmanager correctionをaudit上区別する。
- transition中は対象行の全操作をdisabledにし、client/server双方でduplicateを拒否する。server idempotency keyを使い、lockは対象行だけに限定する。
- 失敗時はlocal stateをrollbackし、最新状態をrefetchしてerror表示する。state＋notificationは無条件自動retryせず、refresh後に利用者が明示retryする。未使用reverse/timeOptionsは削除候補とする。

実装上、配置管理画面と上下番確定処理画面のpage accessはいずれも `site-operation-schedules:read` を要求する。これが「配置管理者」の正式なrole名・十分条件であるかは確認できないため、role名へ読み替えない。

## 画面・主体

| UI入口 | 実装上の主体・表示 | 操作 |
|---|---|---|
| `ArrangementNotifications/Manager` | コメント上は従業員本人向け。一覧itemを選択して編集 | enumのnextだけを順方向に実行。ARRIVED時だけ専用下番入力を表示 |
| `Arrangements/Manager` 内の `ArrangementNotification/Manager` | 配置管理側。workerの通知status tagクリックで編集 | status chipで4状態から選び、選択statusに対応する専用methodを実行 |
| `OperationResult/Generator/Detail` 内の同Manager | 上下番確定画面 | 編集開始時にstatusをLEAVEDへ強制し、実績入力後 `toLeaved` を実行 |
| 配置管理のnotify card | `SiteOperationSchedule` の未通知配置を通知 | `useSiteOperationScheduleActions.notify` から `schedule.notify()` |
| 上下番確定のschedule選択watcher | 未通知workerを含むschedule選択時 | `schedule.notify(false)` 後にArrangementNotification購読を開始 |

この調査範囲の各manager内には認証role検査がない。配置管理側の任意状態変更・資格/OJT変更と上下番確定側のLEAVED強制は承認済みだが、誰を配置管理者と認定するかは上位page・Rules等の境界に依存する。従業員managerも「本人」であることをcomponent内では検証せず、渡されたdocsを操作する。

## 遷移別UIフロー

### 従業員向け順方向フロー

1. item選択前に対象SiteOperationScheduleを取得する。失敗時はloggerへ渡して編集を開始しない。
2. ARRANGED、CONFIRMEDでは、enumのnext methodを `item.clone()` に対して呼ぶ。
3. ARRIVEDでは専用下番managerを開き、実績値を編集したitemの `toLeaved()` を呼ぶ。
4. LEAVEDではTransitionBtnがtargetなしでdisabledになり、「下番済みです」を表示する。

確認ダイアログを明示するコードはこのwrapper群にはない。基底 `AirItemManager` のsubmit確認契約は未確認である。逆遷移用の `toPrevStatus` 呼出しは検索で見つからず、TransitionBtnの`prev` typeにも呼出し元は見つからなかった。

### 配置管理側の任意status編集

status chipはARRANGED・CONFIRMED・ARRIVED・LEAVEDをmandatory選択させる。保存時は、選択された現在の `item.status` によって `toArranged`、`toConfirmed`、`toArrived`、`toLeaved` のいずれかを直接呼ぶ。元のDB statusとの隣接関係やactor roleはcomponentで検査しないため、UIから順序を飛ばす・戻す操作が到達可能である。

### 上下番確定でのLEAVED強制

OperationResult Generatorは編集開始時に `item.status = 'LEAVED'` とし、同じmanagerへ渡す。これにより元statusに関係なくactual入力が表示され、保存時は `toLeaved()` が実行される。その後のschedule同期は成功時に成功messageを表示して選択scheduleを解除し、失敗は上位へ伝播する。

## 入力値マッピング

| UI入力 | modelへの結線 | transition引数・挙動 |
|---|---|---|
| 実開始時刻 | `componentAttrs.actualStartTime` | 引数では渡さず、編集済みinstanceに対して `toLeaved()` |
| 実開始翌日 | `componentAttrs.actualIsStartNextDay` | 同上。保存はされるがschemaのactual日時計算がこのfieldを使わない |
| 実終了時刻 | `componentAttrs.actualEndTime` | 同上 |
| 実休憩 | `componentAttrs.actualBreakMinutes`、0.5時間step | 同上 |
| 資格 | `componentAttrs.isQualified` | 配置管理・上下番確定のgeneric custom inputで直接編集して同じupdateへ含める |
| OJT | `componentAttrs.isOjt` | 同上 |

- 従業員専用下番UIには実開始・開始翌日・実終了・実休憩があるが、資格・OJT入力はない。
- generic custom inputは選択statusがLEAVEDのときだけactual入力を表示するが、資格・OJTは常に表示する。
- どのUIも `toLeaved` の宣言済み `timeOptions` を渡さない。値をinstanceへ直接結線してからmethodを呼ぶため、現在のUIに限ればtimeOptions未使用は入力喪失の直接原因ではない。
- `toArranged`・`toConfirmed`・`toArrived` を選ぶとschema methodがactual時刻を予定値、休憩を60分へ上書きする。status選択時にUIがこの上書きを説明する表示は確認できない。
- SPEC-DEEP-024で、配置表の`WorkersTable`はLEAVED時だけnotificationのactual timeを表示する一方、schedule cardのWorkerTagはnotificationがあればstatusを問わずactual start/endを渡すことを確認した。同じ未LEAVED通知で時刻表示が異なり得る。詳細は[Worker / drag components deep review](worker-drag-components-deep-review.md)を参照する。
- 従業員下番wrapperの必須 `siteOperationScheduleId` propはtemplate/script内で使用されない。

## 権限・二重実行防止

- TransitionBtnはnext targetがない場合だけdisabledで、loadingやactor roleを受け取らない。
- `ArrangementNotificationChip`は未知statusを他のstatus表示componentのように正規化せずthrowし得る。一方、ListItemはsite cache未準備と日時field欠損をloading/current-time表示へ置換するため、欠損を利用者へ明示しない。詳細は[ArrangementNotification components deep review](arrangement-notification-components-deep-review.md)を参照する。
- 従業員managerは遷移中にlocal `isLoading` とglobal loadingを設定するが、今回読んだtemplateではTransitionBtnへのdisabled/loading結線を確認できない。基底manager側のsubmit抑止は未確認である。
- 上下番確定の最終submit buttonは `loading` 中disabledかつloading表示になる。
- notify actionはglobal loadingを追加するが、呼出しcard自体のdisabled結線は今回の狭い範囲では確認できない。
- generic managerはcreate/delete handlerをthrowし、delete buttonも隠す。検索したUI経路にはArrangementNotificationの直接delete呼出しはなかった。

## エラー・成功表示・再試行

- 従業員の対象schedule取得・transition失敗はloggerへ渡し、global loadingを解除する。専用の利用者向け失敗messageや再試行buttonは確認できない。
- productionでnext definition/functionが欠ける場合は明示検査せず、nullのcallによる例外をcatchしてloggerへ渡す。DEVだけ明示errorをthrowする。
- 配置管理notify actionは失敗をloggerへ渡してloadingを解除するが、成功・失敗messageを出さない。
- 上下番確定前の自動notifyは失敗時に利用者向けmessageを表示し、loadingを解除する。
- 上下番確定のschedule同期は成功messageを表示する。catchはなく、失敗の表示・再試行契約は上位managerに依存する。

## 仕様との一致

- schema enumのnextを使う従業員UIはARRANGED→CONFIRMED→ARRIVED→LEAVEDの順方向を提示する。
- modelの専用transition APIがすべての確認済みUI更新経路で使われ、`update()`・`delete()` の直接UI呼出しは検索で見つからなかった。
- 配置管理UIの任意status変更、上下番確定UIのLEAVED強制、同じ配置管理編集での資格・OJT変更は、2026-08-10のユーザー承認と一致する。

## 矛盾・未使用候補

- `toArrived`・`toLeaved` の `confirmAt` 参照により、通常の従業員順方向UIでもCONFIRMED時刻が上番・下番時に現在日時へ上書きされる到達性がある。
- `actualIsStartNextDay` はUI入力・保存されるが、schemaのactual日時計算は予定側flagを使う。
- `toLeaved` のtimeOptions、TransitionBtnのprev type、従業員下番wrapperのsiteOperationScheduleId propは、確認したUI結線では未使用である。
- 配置管理managerはcreate/deleteをthrowする一方、基底manager経由の `toCreate`・`toDelete` をexposeする。画面buttonは隠されているため、外部ref呼出しの有無は未確認である。

## 仮説

- local/global loadingだけでは従業員transitionやnotify cardの二重clickを抑止できず、同じtransition・通知作成が重複する可能性がある。基底managerとloading overlayの入力遮断を未確認のため仮説である。
- 上下番確定のschedule選択が自動notify完了前に変更可能なら、watcherの非同期結果と選択中scheduleが競合する可能性がある。Listの選択結線・disabledを未確認のため仮説である。

## 将来要対応

- 承認された配置管理者の任意状態変更と上下番確定のLEAVED強制を保ちつつ、配置管理者の認定条件と従業員本人の順方向操作をRules/server境界で区別する（FUT-0018、FUT-0021）。
- confirmation timestampとactual日跨ぎ・休憩既定値を修正し、UI入力から下流計算まで境界testを追加する（FUT-0021、FUT-0022）。
- 承認済みの対象行lock、client/server duplicate拒否、server idempotency、rollback・refetch・error・明示retryを実装する（FUT-0012、FUT-0024、FUT-0026）。
- 未使用reverse/timeOptionsを削除候補として整理し、未使用propは用途確認後に除去または結線する（FUT-0025）。

## 質問

- `site-operation-schedules:read` を持つ全利用者を配置管理者として任意状態・資格・OJT変更可能にするか。それとも別の具体的な権限条件を設けるか。
- 配置管理者による状態訂正時のappend-only履歴とexplicit resend方針は確認済みである。履歴保持期間とresendの具体的権限・理由区分は未確定である。

## 未確認範囲

- 基底 `AirItemManager`・`useBaseManager` の確認dialog、submit lock、error表示、外部ref API利用。
- page access以外の上位UI表示条件と、role別の実ブラウザ到達性。
- OperationResult・Attendance・Billingへのactual値反映、競合・再実行時の実データ挙動。
- 実機での日跨ぎ入力、二重click、offline/retry、複数tab動作。
