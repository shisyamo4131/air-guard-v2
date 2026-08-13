# ArrangementNotificationのデータ契約・状態遷移・書込み入口の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-007 — ArrangementNotificationのデータ契約・状態遷移・書込み入口
- 最終確認日: 2026-08-11（SPEC-DEEP-014で対象component本文を再確認）
- 根拠ファイル: `air-guard-v2-schemas/src/ArrangementNotification.js`、直接親 `SiteOperationScheduleDetail.js` のfield・notification key、`constants/arrangement-notification-status.js`、status field定義、`SiteOperationSchedule.js` のnotify・関連削除部分、`firestore.rules` のArrangementNotifications match、`functions/triggers/arrangementNotification.js`、`functions/modules/maintenance.js` の関連削除部分、通知producer4ファイル、`composables/application/arrangement/useArrangementsActions.js`、`composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js` のnotify、ArrangementNotificationを直接購読するdata-layer定義、UI呼出しシンボルの検索結果

この文書は指定された配置通知境界から観察できる実装事実を記録する。UI本文、配置管理全体、実データ、環境値は調査せず、通知・書込み・Functions・Rules testを実行していない。

## データ契約

### 保存単位と識別子

- 保存先は `Companies/{companyId}/ArrangementNotifications/{docId}` である。
- `docId` はcreate時に `${siteOperationScheduleId}_${workerId}` へ固定される。siteOperationScheduleIdまたはworkerIdがなければcreateは失敗する。
- workerIdは従業員ではid、外注先では `id:index` 形式として親クラスから導出される。
- `useAutonumber = false`、`logicalDelete = false` で、物理削除を前提とする。
- 同じdocIdで再作成できることをclass commentが意図として記載する。基底createが既存documentを上書きする正確な契約は未確認である。

### field

ArrangementNotification自身が追加・上書きするfieldは次のとおりである。

| field | 定義・既定値 | 実装上の用途 |
|---|---|---|
| `status` | 必須、既定 `ARRANGED` | 状態判定・通知trigger |
| `confirmedAt` | time | 確認日時 |
| `arrivedAt` | time | 上番日時 |
| `leavedAt` | time | 下番日時 |
| `actualStartTime` | 必須time | 実開始時刻 |
| `actualIsStartNextDay` | boolean | 実開始が翌日かを示す保存field。ただし日時計算では参照されない |
| `actualEndTime` | 必須time | 実終了時刻 |
| `actualBreakMinutes` | 必須、既定60 | 実休憩分 |
| `shouldNotify` | 既定true、hidden | create triggerがpush用Notificationを作るか |

親から、siteOperationScheduleId、作業員id・index・isEmployee・amount・siteId・isQualified・isOjt、日付・勤務区分・予定開始終了・予定休憩・規定時間などを継承する。継承したhasNotificationとnotificationKeyは初期化後にinstanceから削除される。

### 読み取り専用プロパティ

プロジェクト用語に従い、`Object.defineProperties` でenumerableに定義される次の値を読み取り専用プロパティとして記載する。

- `actualStartAt`: dateAtとactualStartTimeから日時を作るが、翌日offsetは `actualIsStartNextDay` ではなく予定側の `isStartNextDay` を使う。
- `actualEndAt`: dateAtとactualEndTimeから日時を作るが、offsetは予定側の `isStartNextDay` と、予定startTime/endTimeから導出される `isSpansNextDay` を使う。
- `totalWorkMinutes`: actualEndAtとactualStartAtの差からactualBreakMinutesを引き、0未満なら0とする。

### ゲッター

- `isArranged`、`isConfirmed`、`isArrived`、`isLeaved` は現在statusとの一致を返すJavaScript getterである。
- 親からworkerId、employeeId、outsourcerId、date、予定時刻に基づくisSpansNextDayなどのゲッターを継承する。

## 状態遷移表

### enumがUIへ示す遷移

| 現在状態 | 表示 | next | prev |
|---|---|---|---|
| `ARRANGED` | 配置済 | `CONFIRMED` / `toConfirmed` | なし |
| `CONFIRMED` | 確認済 | `ARRIVED` / `toArrived` | `ARRANGED` / `toArranged` |
| `ARRIVED` | 上番済 | `LEAVED` / `toLeaved` | `CONFIRMED` / `toConfirmed` |
| `LEAVED` | 下番済 | なし | `ARRIVED` / `toArrived` |

### transition methodの実処理

| method | 設定する値 | 遷移元検査 |
|---|---|---|
| `toArranged` | actual start/endを予定値、actual breakを60、actual next-dayを予定値、3 timestampをnull、statusをARRANGED | なし |
| `toConfirmed` | actual start/endを予定値、actual breakを60、actual next-dayを予定値、confirmedAtを現在日時、arrivedAt/leavedAtをnull、statusをCONFIRMED | なし |
| `toArrived` | actual start/endを予定値、actual breakを60、actual next-dayを予定値、confirmedAtを `confirmAt` または現在日時、arrivedAtを現在日時、leavedAtをnull、statusをARRIVED | なし |
| `toLeaved` | confirmedAtを `confirmAt` または現在日時、arrivedAtを既存値または現在日時、leavedAtを現在日時、statusをLEAVED | なし。宣言されたtimeOptionsも使用しない |

- 各methodは最後に直接親の `super.update` を呼ぶ。
- ArrangementNotificationのoverride `update()` は、呼出し時点のstatusに応じて同名transition methodへdispatchする。statusが4既知値以外なら何も書かず、明示errorも返さない。
- `update()` 呼出し前にinstance.statusを書き換えると、そのstatusのtransition methodが実行される。現在DB statusと遷移先の組合せは検査しない。
- enumのnext/prevはUIが提示する遷移情報であり、model methodやRulesの強制条件ではない。
- enumファイル冒頭コメントはCONFIRMEDからARRANGEDへ戻らない想定と説明する一方、実enumはCONFIRMED.prevにtoArrangedを定義する。

## 作成・更新・削除経路

### 作成

1. `useArrangementsActions` が `useSiteOperationScheduleActions` のnotifyを公開する。
2. frontend actionはloadingを追加し、受け取ったscheduleの `notify()` をawaitし、errorをloggerへ記録してloadingを解除する。
3. `SiteOperationSchedule.notify(shouldNotify = true)` はworkerのうちhasNotificationがfalseのものを選ぶ。
4. worker dataを展開し、actualStartTime・actualEndTime・actualBreakMinutesを予定値から設定してArrangementNotificationを作る。
5. schedule内の全employee・outsourcerのhasNotificationをtrueにする。
6. 1つのtransactionで全ArrangementNotificationをcreateし、SiteOperationScheduleをupdateする。
7. error時はbackup instanceでscheduleを戻そうとするが、コードコメントはsnapshot再取得により `_beforeData` が更新され、元状態へ戻せない場合を認識している。
8. ArrangementNotification create triggerはshouldNotify未指定をtrueとしてpush用Notification作成へ進み、falseなら作成しない。

- `components/OperationResult/Generator/index.vue` は `newSchedule.notify(false)` を呼ぶ。
- 配置管理側は公開されたnotify actionを使うが、UI本文は未調査である。

### 更新

- UI呼出しとして `components/ArrangementNotification/Manager/index.vue` にtoArranged・toConfirmed・toArrived・toLeaved、`components/ArrangementNotifications/Manager/index.vue` にtoLeavedが見つかった。
- modelのtransition method以外にも、同一会社の認証UserはRules上ArrangementNotification documentを任意fieldで直接updateできる。
- update triggerはbefore/after dataが存在することを確認し、statusがCONFIRMED、ARRIVED、LEAVEDへ変化した場合に対応するpush用Notificationを作る。
- ARRANGEDへの変化ではpush用Notificationを作らない。その後もう一度CONFIRMEDへ変えると、再び確認通知を作る。
- status以外のactual time、OJT、資格、site/schedule/worker参照、shouldNotify変更はupdate triggerの通知条件ではない。

### 削除

- SiteOperationSchedule updateでworkerIdsを除外する経路は、対象workerのhasNotificationをfalseにし、同じtransactionでArrangementNotification.bulkDeleteを呼ぶ。
- SiteOperationSchedule deleteは同じtransactionで関連ArrangementNotificationを全削除してからscheduleを削除する。
- bulkDeleteはclient専用で、schedule ID全件または指定worker IDのdeterministic docIdを削除する。
- 定期maintenanceは古いscheduleを会社別にまとめ、関連ArrangementNotificationsを先にAdmin SDKで削除してからscheduleを削除する。
- ArrangementNotificationのonDelete triggerは存在しない。
- Rules上は同一会社の任意認証UserがArrangementNotificationを直接deleteできる。直接delete時にSiteOperationSchedule側のhasNotificationをfalseへ戻すserver処理はない。

## 認証認可

- `match /Companies/{companyId}/ArrangementNotifications/{id}` は、認証Userのcustom claim companyIdがpathと同じ、またはsuper-userならread/writeを許可する。
- create/update/deleteの区別、User本人、employee/outsourcer、管理role、許可field、document ID形式、siteOperationScheduleId、workerId、status遷移、shouldNotifyを検査しない。
- frontend actionとmodel methodにもrole・User本人・対象worker一致の検査はない。最終的なclient write可否は上記Rulesに依存する。
- Functions triggerはAdmin SDKで動き、元write actorのauth・roleを受け取って再検証しない。
- 通常Userは他社pathへwriteできないが、自社内の任意ArrangementNotificationへwriteできる。

## 関連整合性

- deterministic docIdはscheduleとworkerの組合せを一意にし、data-layerも同じkeyでlookupする。
- createはschedule通知済みflagとArrangementNotification作成をtransactionでまとめ、DB上の片方だけのcommitを避ける。
- worker除外とschedule削除もclient transaction内でnotification削除とflag/schedule更新をまとめる。
- 一方、Rulesが許可する直接create/update/deleteはSiteOperationScheduleのworker・hasNotificationとの同期を強制しない。
- classは従業員と外注先を表現できる。create push producerはemployeeId一致Userを探すため、employeeIdがnullとなる外注先のpush宛先は確認できない。
- configuration上のisOjt、isQualified、actual timeなどはArrangementNotification documentに保存され、既存仕様では配置予定より通知側の実効値を優先する。ただしRulesはこれらの変更主体・許可範囲を制限しない。

### 実勤務時間の整合

- `actualIsStartNextDay` は保存・transition設定されるが、actualStartAt/actualEndAt計算は予定側 `isStartNextDay` を使う。
- actualEndAtの跨日判定はactual時刻ではなく予定時刻から導出される `isSpansNextDay` を使う。
- toArranged/toConfirmed/toArrivedは予定breakMinutesではなく60をactualBreakMinutesへ固定する。create時だけworker.breakMinutesを使う。
- toLeavedはtimeOptions引数を宣言・contextへ記録するが、actualStartTime、actualEndTime、actualBreakMinutes、actualIsStartNextDayへ適用しない。
- toArrivedとtoLeavedは `confirmedAt` ではなく存在が確認できない `confirmAt` を参照するため、通常は現在日時でconfirmedAtを再設定する候補がある。
- これらの読み取り専用プロパティはtotalWorkMinutesへ影響し、配置通知を稼働実績へ同期する経路では勤務時間データへ波及し得る。

## トリガー・通知境界

- document createのpush用NotificationはshouldNotifyがfalseでない限り作られる。deterministic ID documentを削除・再作成するとonCreateは再度動く。
- status update triggerは遷移元の正当性ではなく「以前と異なり、afterが対象statusか」だけを見る。
- CONFIRMEDへ戻す、ARRIVEDへ戻す、LEAVEDへ再度入り直す操作は、それぞれ新しいNotification documentを作り得る。
- triggerはevent ID、通知済みtransition ID、actorを保存せず、再実行・状態往復による重複通知を抑止しない。
- producerまたは後続配送で失敗してもArrangementNotificationのstatus update自体は既にcommit済みであり、業務状態とpush通知作成・配送が部分的に不一致となり得る。
- onDelete通知はなく、削除自体はpush通知を生成しない。

## 仕様との一致

- ARRANGED、CONFIRMED、ARRIVED、LEAVEDの状態と専用methodを使用する構成は `docs/specification.md` の基本状態遷移と一致する。
- 配置通知がある場合に実勤務時間を稼働実績へ使用するという仕様に対応するfield・読み取り専用プロパティが存在する。
- 配置予定と配置通知が共有するOJT・資格・実勤務時間について通知側を実効値として使えるdataを保持する。
- schedule/worker組合せのdeterministic ID、transaction作成・削除は関連整合性を意識した実装である。
- ただし専用methodは正当な遷移元を強制せず、Rulesも任意field/status updateを許可するため、「専用の状態遷移メソッドを使用する」という仕様をデータ境界で保証しない。
- 実勤務日時計算とtimeOptionsの実装は、実時刻を正しく保持・使用する仕様に一致すると確認できない。

## 矛盾・未使用候補

- class headerはdirect updateをdisabledと説明するが、override updateはstatusに応じてtransitionを書き込み、未知statusではsilent no-opする。
- enum commentはCONFIRMEDからARRANGEDへ戻らない想定とする一方、enum prevはtoArrangedを提供する。
- toArrived/toLeavedの `confirmAt` はclass field・親由来fieldとして確認できず、`confirmedAt` の誤記候補である。
- toLeavedのtimeOptionsはcontext以外で未使用である。
- actualIsStartNextDayは日時計算で未使用である。
- create時actualBreakMinutesはworker.breakMinutes、3transitionでは60固定で一貫しない。
- UI managerが示すtransition以外にRules上の直接updateが可能であり、UI制限は認可境界ではない。
- 管理用componentは4 statusを選択して各transition methodをdispatchし、従業員用componentはnextだけを表示する。どちらもactor/tenant/field allowlist、transaction、audit、server idempotencyを持たず、真正な境界はRules/serverに依存する。
- class commentはupdateを禁止と説明する一方、UI managerは汎用update入口から各transitionを呼ぶ構成を持つ。

## 仮説

- transition enumは利用者へnext/prevだけを提示し、model methodは管理者の訂正操作を柔軟にする意図で前提条件を持たない可能性がある。ただし通常UserもRules上同じwrite権限を持つ。
- timeOptionsは過去または将来のUIから実時刻を渡すため追加されたが、propertyを先にinstanceへ設定するUIへ移行して未使用になった可能性がある。UI本文は未調査である。
- actual日時で予定側のnext-day/spans-next-dayを使うのは、実勤務が予定日の境界構造を変えない前提だった可能性があるが、actualIsStartNextDay fieldの存在と矛盾する。

## ユーザー確認済みactor・field方針

- 2026-08-11: 本人は自己配置連絡の確認・到着・上番・下番に必要な時刻・statusだけを変更できる。
- 配置管理者は同一会社内で任意status・time・qualification・OJTを変更できる。具体的role名はauthorization design確定時に決め、当面はprovisional permissionを使う。
- Generatorは対象schedule所属通知だけをLEAVED化できる。その他fieldとnotification生成はdedicated server processingへ限定する。
- payload field allowlist・length・array count・URL、recipient/batch上限を検証し、actor・changedAt・before/afterを監査記録する。
- 2026-08-11: status transition historyはappend-onlyとする。過去確定時刻を消去・上書きせず、correctionのbefore・after・actor・reasonを記録する。reverseだけでは自動再送せず、resendはmanagerがreason付きで明示実行する。同status再進行でも自動duplicate sendを行わず、User normal forwardとmanager correctionをaudit上区別する。
- 2026-08-11: actual日時のbase dateはschedule dateとし、`actualIsStartNextDay`を明示する。end <= startは翌日、actual値優先、scheduled値はfallback/defaultだけとする。fixed 60分はactual breakへ自動確定せずscheduled defaultだけとし、scheduled/actual breakを別保持して保存前に検証する。
- 2026-08-11: client direct deleteは禁止する。unsent・unconfirmedだけをschedule edit内で除去可能とし、それ以降はcancel state/historyを残す。schedule変更・削除とcancelはatomicまたはdedicated server processingとし、取消通知はmanager explicit action、repairはaudited admin processに限定する。

## 将来要対応

- FUT-0012へ、状態往復・document再作成・trigger失敗による重複通知と部分状態の証拠を追記した。
- FUT-0018へ、Rules・model methodともactor role、field、遷移元を強制しない証拠を追記した。
- FUT-0021として状態遷移、timestamp、unknown status処理を登録した。
- FUT-0022としてactual日時・休憩・timeOptionsの整合問題を登録した。
- FUT-0023として直接削除時のschedule flag不整合を登録した。
- FUT-0024としてnotify transaction失敗時のlocal instance rollback不確実性を登録した。

## 質問

- 調査継続を妨げる質問はない。
- 逆遷移・同status再進行時の履歴と再送方針は確認済みである。append-only historyの保存先・保持期間とexplicit resendの具体的権限は未確定である。
- actor別のfield・status境界は確認済みである。配置管理者の具体的role名とpayload・recipient・batchの具体的上限値は未確定である。
- actual日時・breakと取消し・削除方針は確認済みである。validationの具体的制約、cancel status・保持期間、取消通知権限は未確定である。

## 未確認範囲

- transition UI本文、時刻入力がmethod呼出し前にinstanceへどう反映されるか。
- SiteOperationSchedule/OperationDetail/WorkingResultの全field validationとupdate diff契約。
- FireModel transaction、create既存document、listener、rollback、server/client adapterの実装。
- actual timeをOperationResult・Attendance・Billingへ反映する後続変換の詳細。
- ArrangementNotificationの実データ、status履歴、重複通知、外注先通知の運用。
- Rules Emulatorによるactor別writeとfield/status遷移検証。
