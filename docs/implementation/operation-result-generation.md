# 上下番確定からOperationResult作成までの実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-009 — 上下番確定からOperationResult作成
- 最終確認日: 2026-09-04（DEV再観測と関連error経路の静的照合。上下番確定全経路の最終静的調査は2026-08-10）
- 根拠ファイル: `pages/operation-results/generator.vue`、`utils/pageSettings.js` の該当設定、`composables/dataLayers/useUnconfirmedSiteOperationSchedules.js`、`components/OperationResult/Generator/index.vue`・`List.vue`・`Detail.vue`、直接使用するArrangementNotification manager、schemas `SiteOperationSchedule.syncToOperationResult`、`OperationResult`・`OperationResultDetail`・`Operation`・`Site.getValidAgreement` の直接契約、`functions/triggers/operationResult.js` とBilling/Attendance入口コメント

Generator 3 componentsを含むOperationResult component 14 filesの公開契約、duplicate/lock、並行性のfile単位確認は[OperationResult components deep review](operation-result-components-deep-review.md)を参照する。

## 承認済み挙動

- OperationResult Generatorは、配置通知の現在状態にかかわらず直接LEAVEDへ変更できる。
- 配置管理者はArrangementNotificationを任意の4状態へ変更でき、同じ編集で資格・OJTも変更できる。
- 上下番確定は作業完了後の処理であり、外部push通知を送る必要はない。missing ArrangementNotificationの作成に失敗しても、予定値fallbackで確定を続行してよい。
- OperationResultはArrangementNotificationが存在しない場合にも作成でき、配置実績・scheduleを伴わないstandalone作成も許可する。過去のArrangementNotification必須設計はcomponent複雑化のため廃止されており、通知・OperationResult・scheduleを常にatomic更新する設計は採用しない。
- 2026-08-11に3pathを確定した。schedule＋notificationsでは可能な範囲でOperationResult作成、schedule.operationResultId、既存notification LEAVEDを同一transactionにしpushしない。scheduleのみではnotificationを作らずOperationResult＋schedule linkをatomic化し、入力値優先・欠損schedule fallback・no-notification sourceを記録する。standaloneではOperationResultだけを作り、schedule/notificationを推定せずreason/sourceTypeを記録する。scheduleId/sourceTypeはoptionalとし、schedule単位の重複防止、standalone専用permission/audit、missing notification非error、存在するnotificationだけの更新を共通契約とする。
- 取極めなしで作成したOperationResultは、請求稼働管理から後で取極め・請求締日を設定して請求対象へする。
- OperationResult自体がない手動請求は、稼働外売上を持つOperationResultと埋込みArticleDetailを正規経路として扱う。別Billing child manual-line modelは採用せず、課税区分等の不足fieldは実務に合わせて将来追加する。
- 画面の成功条件はOperationResult documentと予定側linkのtransactionが成功すること。後続FunctionsによるBilling・勤怠等の完了は含めない。
- 後続のBilling・Attendance・Daily aggregate・Site history projectionは冪等化して自動retryし、result単位のsync statusを持つ。retry exhaustedをmonitoringし、admin per-result reprocessとscheduled reconciliation/repairを提供する。primary success後のnormal Userは失敗扱いにせず、業務影響がある場合だけwarnする。repairはactor・reason・target・resultをauditする。
- 上下番確定処理pageが実装上要求するpermissionは `site-operation-schedules:read` である。このpermission名を業務上の配置管理者roleと同一とは断定しない。

## 対象選択と入力

- pageは `operationResultId == null` かつ日付が現在日より前のSiteOperationScheduleを購読する。今日・未来の予定は対象外である。
- 一覧は日付、shiftType順に表示し、単一選択を `selectedSchedule` へ直接代入する。
- 選択scheduleにhasNotification=falseのworkerがいれば `schedule.notify(false)` で配置通知作成を試み、その後にschedule IDで配置通知を購読する。引数falseは作成するArrangementNotificationのshouldNotifyをfalseにし、onCreate triggerの外部push生成を抑止する。
- workerごとの鉛筆buttonはArrangementNotification managerを開き、編集開始時にstatusをLEAVEDへ設定する。actual時刻・休憩・翌日開始、資格、OJTを編集できる。
- 仮登録現場または資格必須なのに資格者がいない場合は確定buttonをdisabledにする。資格判定は通知値を優先し、通知がなければ予定worker値へfallbackする。

## 入力・値決定表

| OperationResult側の値 | 決定元 |
|---|---|
| docId | 元SiteOperationScheduleのdocIdと同一 |
| siteOperationScheduleId | 元scheduleのdocId |
| schedule共通field | `SiteOperationSchedule.toObject()` |
| employee/outsourcer startTime | 対応notification.actualStartTime。通知なしなら予定startTime |
| endTime | notification.actualEndTime。通知なしなら予定endTime |
| breakMinutes | notification.actualBreakMinutes。通知なしなら予定breakMinutes |
| isStartNextDay | notification.actualIsStartNextDay。通知なしなら予定flag |
| isQualified / isOjt | notification値。通知なしなら予定worker値 |
| worker detail型 | schedule detailをcloneし、上記worker固有値を置換。OperationResult初期化後はOperation/OperationResultDetail契約で保持 |
| customerId | create前にSiteをfetchし、そのcustomerIdを同期 |
| agreement | SiteのagreementsV2からshiftType一致、date以下で最も新しいもの。該当なしはnull |
| billingDate/isBillable | agreement等からOperationResultが導出。agreementなしでもOperationResult作成自体は許容され、Billing入口はisBillable=falseならskip |

SiteのCustomer変更後も既存OperationResultの`customerId`はsnapshotとして自動変更しない。空updateは再同期せず、`groupKey`変更時だけ同期する現行事実を維持する。将来の再適用は対象を選択する明示的method/Callableとし、発行済み請求書を除外してold/new Customer・Agreement・Billing影響と監査を残す。

`allowEmptyAgreement` はOperationBillingのコメントにだけ現れ、OperationResult/OperationBillingのfield・処理としては存在しない。実際の契約は「agreementがnullでもOperationResult作成を止めず、isBillableでBilling作成を分岐する」である。

## 処理シーケンス

1. 必要なら、選択watcherが未通知worker用ArrangementNotificationをpushなしで作成する。
2. 利用者がworkerごとの通知を編集し、各documentを個別にLEAVEDへ更新する。この更新は最終確定transactionより前である。
3. 確定buttonがSiteOperationSchedulesManagerのupdateを起動し、beforeEditから `schedule.syncToOperationResult(notificationsMap)` を呼ぶ。
4. methodはschedule docIdを検査し、Siteをfetchして不存在・仮登録を拒否する。
5. schedule workerをcloneし、対応する通知があるfieldだけactual値・資格・OJTへ置換する。
6. OperationResultを作り、create前hookがSiteを再fetchしてcustomerIdとagreementを適用する。
7. Firestore transaction内でOperationResultを元scheduleと同じdocIdへcreateし、そのdocument IDをschedule.operationResultIdへ設定してscheduleをupdateする。
8. client transaction成功後、成功messageを表示してselectedScheduleをnullにする。
9. OperationResult onDocumentWritten triggerが別の非同期境界でBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoriesを順次更新する。

## 整合性・transaction

- OperationResult createとschedule.operationResultId updateは同一transactionである。一方、Siteの存在・agreement取得はそのtransactionへ明示的に渡されず、外側fetchである。
- client adapterのcreateは同一IDの存在preconditionを持たないtransaction `set`である。schedule linkが欠損・staleでも`OperationResults/{scheduleId}`が既存なら上書き可能なsource契約であり、承認済みのschedule重複拒否は未実装である。
- workerごとのArrangementNotification LEAVED更新、事前notify、OperationResult transactionは一つのtransactionではない。
- scheduleは既存operationResultIdがあるとupdate/deleteを拒否する。購読queryもoperationResultId=nullだけを対象とする。
- 同一docIdのOperationResult createはコメント上「既存なら上書き」だが、既にoperationResultIdを持つscheduleのupdateが拒否されるため、通常の再実行transactionはabortする。
- notification mapは購読時点のclient stateであり、transaction内でnotificationを再読・LEAVED検証しない。

## 失敗・再試行・画面状態

- 事前notifyが失敗するとerror messageを表示するが、そのまま配置通知購読へ進む。通知が欠けたまま予定worker値へfallbackしてOperationResultを作成できる挙動は承認済みである。
- worker通知をLEAVEDへ更新した後に最終transactionが失敗すると、通知はLEAVEDのまま、OperationResultとschedule linkは作成されない。画面上の専用rollbackはない。
- 最終transaction失敗時、beforeEditはfinallyでglobal loadingを解除するが、自身ではerror messageを出さず、selectedScheduleを保持する。上位managerの表示契約は未確認である。
- 最終submit buttonはmanagerのisLoading中disabled/loadingになる。しかし左側Listにはloading/disabledが渡されず、処理中も別scheduleを選択できる実装である。
- 成功時は `selectedSchedule = null`。処理中に別対象を選べた場合、その新しい選択も成功完了時に解除され得る。

## 後続作用境界

- OperationResult作成commit後にFirestore triggerが非同期起動するため、clientの「上下番を確定しました」はBilling/Attendance等の完了を待たない。この成功境界は承認済みである。
- triggerはBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoriesを順番にawaitするが、全作用を包む共通transactionはない。途中失敗はlog後にthrowされる。
- Billing入口はisBillable=falseをskipする。agreementなしでもOperationResult自体は残る。
- DailyAttendance同期入口は内部transactionを使うとコメントされる。各次段module本文・retry設定・最終整合性は未確認である。

## 仕様との一致

- 任意の現在状態からLEAVEDへするUIは承認済み仕様と一致する。
- 通知のactual時間・休憩・翌日flag・資格・OJTをOperationResult workerへ優先反映する。
- OperationResultと予定側linkを同一transactionで作る1対1処理はclass commentと一致する。

## 矛盾・未使用候補

- `allowEmptyAgreement` はOperationBillingコメントに記載されるが実field/APIはなく、実装はisBillableで分岐する。
- Generator冒頭コメントはnotify後にnull docを避ける意図を示すが、notify errorをcatch後も処理を継続するためnullを排除できない。
- notificationsMapのcomputed説明はnotificationKey keyとするが、実装はdocIdをkeyにする。現在のdeterministic docIdとworker.notificationKeyが同値なら動くが、その不変条件に依存する。
- Listの選択index keyは配列sort/更新時にidentityを安定させない候補だが、実害は未確認である。

## 仮説

- async選択watcherは取消し・世代管理がなく、以前の非null scheduleを購読解除してから次へ進む処理もない。選択を素早く変えると古いnotify完了後に古いscheduleの購読を設定する制御flowが成立する。実際の購読置換結果はadapter/runtime未確認である。
- Site/agreementをtransaction外で読むため、同時にSite取極めが変更されると、確定時点と異なる組合せを保存する可能性がある。
- Functions後続処理は途中成功後のretryで再実行される。各helperの置換・冪等処理は一部コメントで示されるが、全経路の冪等性は未確認である。

## 将来要対応

- 承認済み3path、条件付きtransaction、schedule重複防止、standalone permission/audit、source記録を実装する（FUT-0027）。
- 事前notify失敗時の予定値fallbackは承認済みであり、外部pushを送らない境界を回帰testで固定する（FUT-0028）。
- 処理中のList選択とasync watcherを対象ID・世代tokenで固定する（FUT-0026）。
- agreementなし確定と請求稼働管理からの回復経路を回帰testで固定し、古いallowEmptyAgreement記述を整理する（FUT-0029）。
- 後続triggerの部分成功・retry・再調整を別セグメントで検証する（FUT-0030）。

## 2026-08-31 DEV観測（原因未確定）

- 利用者がDEVで上下番確定を実行し、OperationResult登録は成功した一方、処理時に「予期しないエラー」趣旨のSnackbarを観測した。
- 同じ時間帯にFcmTokens登録の403 permission-denied、SecurityReports thumbnailの404、Chrome message channel errorも観測された。上下番確定との因果関係は確認できておらず、別問題の可能性を維持する。
- ArrangementNotificationのLEAVED更新で一部errorが発生し、OperationResult作成後にSnackbarだけが表示された可能性は調査仮説であり、現時点の原因とは断定しない。現行静的調査ではworker通知の個別更新が最終OperationResult transactionより前にあるため、実際のruntime順序、別経路、非同期例外、Snackbar発生元を次回改修時に再追跡する。
- 次回はbuttonからOperationResult作成、SiteOperationSchedule link、対象通知全件のLEAVED更新までを追跡し、await、例外伝播、部分成功、再実行、既にLEAVED、通知なし、複数worker、一部失敗を確認する。成功時はerror Snackbarなし、失敗時は失敗resourceを特定できるmessageまたはlogを残し、FcmTokens失敗は確定処理の成否へ影響させない。
- 共有logに含まれるFCM token等の機密値は本記録・test dataへ転記しない。原因調査と再現testには合成dataを使用する。詳細な調査・検証条件は[FUT-0027](future-actions.md#fut-0027-上下番確定の通知更新とoperationresult作成を再開可能にする)へ統合した。

## 2026-09-04 DEV再観測（原因未確定）

- 利用者がDEVで上下番確定を再度実行し、最初のclickで不明なerrorを示す趣旨のSnackbarを観測した。今回のOperationResult、schedule link、通知状態の最終値は照合しておらず、上下番確定自体の成否と発生源は確認できていない。
- 同じ時間帯にFcmTokens登録のHTTP 403 permission-denied、SecurityReports thumbnailのHTTP 404、deprecated warningが観測された。時間的に並行した事象であり、上下番確定との因果関係は確認できていない。
- 静的照合では、上下番確定の最終処理からFCM登録を直接呼んでいない。FCM登録はsession初期化経路で実行され、失敗をcatchした後に共通のglobal error通知へ渡り得るため、同じSnackbarとして見えた可能性はあるが、今回のruntime順序と発生源は未確認である。
- thumbnail取得失敗は静的にはcatchされ、thumbnailなしで元画像へfallbackする。確認した経路からglobal error通知へ直接渡す処理は見つからず、今回のSnackbar原因とは断定しない。
- この再観測は新しいissueを作らず、FUT-0027の次回上下番確定改修で、実resourceの最終状態とSnackbar発生元を分離して追跡するためのdated deltaとして保持する。機密値、個人・会社・project・resource・document・storageの識別子、保存先、URL、stack、raw message、処理時間は転記していない。

## 質問

- なし。

## 未確認範囲

- SiteOperationSchedulesManager/AirItemManagerのerror message・排他の基底実装。
- Firestore RulesによるOperationResult createとschedule updateの実認可。
- Agreement、Billing、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoriesの内部処理とretry設定。
- Emulatorでのtransaction競合、notify失敗、二重click、選択race、Functions部分失敗。
- 2026-09-04再観測時のOperationResult、schedule link、通知状態、runtime順序、Snackbar発生元。
