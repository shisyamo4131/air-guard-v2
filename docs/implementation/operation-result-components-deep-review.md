# OperationResult components deep review

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-030
- 最終確認日: 2026-09-16
- 対象: `components/OperationResult/**` 14 files
- 根拠: 対象14 filesの全文、直接callerであるOperationResult詳細・Generator page、直接使用するhandler/composable/service、schemasのOperationResult/Detailと`SiteOperationSchedule.syncToOperationResult`、client adapterのcreate契約
- 制約: runtime、Emulator、実data、Rules実行、Air manager package内部、後続Functions本文は未実行・未再調査

2026-09-16現行補正: Generatorの最終確定は`SiteOperationSchedule.syncToOperationResult`を呼び、ArrangementNotificationを作成・更新しない。既存通知のactual値を読むだけで、通知なしは予定値へfallbackする。worker鉛筆の個別編集だけが既存通知をLEAVEDへ標準updateする。旧通知補完、`useOperationGenerator`、`convert`、notification expectation競合比較は現行契約ではない。

## file別責務と公開契約

| file | 公開契約・責務 | 確認した境界 |
| --- | --- | --- |
| `Activator/Base.vue` | 必須`OperationResult item`を表示し、`customInput`をexpose | Site/Customerはlive cache表示。cache欠損・loading・errorを区別せず「読み込み中...」。financial/statisticsは表示しない |
| `CustomInput/index.vue` | 基本稼働fieldを編集。`componentAttrs`、`item`、`updateProperties` | `item` validatorは`Operation`まで許容。Site変更時securityType同期と取極め定時copyを持つ |
| `Duplicator/index.vue` | dialogを開く`set`をexposeし、成功時`duplicated` emit | locked sourceは拒否。1日だけ選択。duplicate失敗時はdialog維持 |
| `Duplicator/useIndex.js` | duplicate実行中のlocal/global loadingとerror log | errorは吸収して`null`を返す。専用利用者messageはない |
| `Generator/index.vue` | schedule選択、既存通知の購読、個別LEAVED編集、標準syncによるResult生成を調整 | `selectedSchedule`等をprovide。最終確定は通知を作成・更新せず、通知なしworkerは予定値へfallback |
| `Generator/List.vue` | scheduleの単一選択list | index key。`loading` propでmanagerの`isLoading || confirming`中をdisabledにし、computed setterでも処理中の選択変更を拒否する。preparing/`!ready`中は選択可能 |
| `Generator/Detail.vue` | worker actual値・SecurityReport・確定button | `click:submit` emit。cache未取得Siteをtemporaryと判定できず、schema側再fetchで最終拒否 |
| `LockIcon.vue` | lock表示tooltip | 表示専用。明示`aria-label`なし |
| `Manager/index.vue` | create/update/delete manager | `toCreate`/`toUpdate`/`toDelete`をexpose。locked時submit/deleteをdisabled。custom inputを正しく結線 |
| `Worker/CustomInput.vue` | employee/outsourcer、実時間、休憩、資格、OJT入力 | `componentAttrs.isEmployee.modelValue`を必須前提で参照。worker種別は起動buttonが決める |
| `Workers/Manager/index.vue` | OperationResultDetail array編集 | `workerId`をitem keyにし、親defaultをcreate時にcopy。保存は親pageの`doc.update()`へ委譲 |
| `Workers/Manager/Toolbar.vue` | employee/outsourcer追加入口 | `isEmployee` true/falseを初期値へ渡す |
| `Workers/Manager/BtnAddEmployee.vue` | employee追加button | attrsをroot buttonへfallthrough。visible labelあり |
| `Workers/Manager/BtnAddOutsourcer.vue` | outsourcer追加button | attrsをroot buttonへfallthrough。visible labelあり |

対象14 filesに固有のunit/component testはrepo内検索で見つからなかった。auto-import componentのため、静的な明示importがないcallerもある。

## 基本稼働・時間・worker・article境界

- 基本編集はSite、警備種別、日付、曜日、勤務区分、予定開始終了、翌日flag、休憩、規定時間、必要人数、資格要否、作業内容、備考を同じOperationResult draftへ書く。
- worker入力の`startTime`、`endTime`、`isStartNextDay`、`breakMinutes`、`regulationMinutes`はResult detailの確定実績値である。Schedule由来のdefaultを新規workerへcopyするが、予定値とactual値を二重保持するUIではない。
- 日跨ぎ、実働、通常・残業時間はschemaの`WorkingResult`/`WorkTimeBase`が日時化する。componentは文字列とflagを渡し、日時整合を独自再計算しない。
- worker managerはarray draftを編集し、完了後に詳細pageがResult全体を`doc.update()`する。articlesも別managerから別の`doc.update()`を行うため、基本・worker・articleは一つの画面でも共通transactionではない。
- `Activator/Base`はagreement snapshot、statistics、worker/article sales、taxを表示しない。これらはOperationResult schemaのsnapshot/ゲッターとBilling側UIの責務である。
- OperationResultの`statistics`はOJTを通常base/qualifiedとは別の`ojt` bucketへ集計する。target componentは集計値を変更せず、workerの`isQualified`/`isOjt`を保存する入口だけを持つ。

## Generator処理とtransaction境界（現行）

1. scheduleを選ぶと、generation tokenで以前の非同期処理を無効化し、以前の購読を解除してからschedule IDでArrangementNotificationを購読する。未通知workerの作成処理は現行経路にない。
2. workerごとのmanagerからactual時間・休憩・資格・OJTを読み、worker鉛筆の個別編集時だけ既存通知をLEAVEDへ標準updateする。
3. 確定時に`schedule.syncToOperationResult(notificationsMap)`を呼ぶ。通知があればactual値、なければschedule値をOperationResultDetailへ写す。最終確定はArrangementNotificationを作成・更新しない。
4. client adapterのtransactionで`OperationResults/{scheduleId}`へ`set`し、同じtransactionで`schedule.operationResultId`を更新する。
5. Result commit後のBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistory同期は別Cloud Functions境界であり、画面成功条件に含まれない。

確認済みの重要な境界は、worker鉛筆による既存通知の個別LEAVED更新が最終Result/schedule transactionの外側であることと、adapter createが同一IDの存在preconditionを持たない`set`であることである。schedule側linkが欠損・staleのまま同じIDのResultが既に存在すると、現行sourceは既存Resultを上書きできる。通常経路で必ず発生するとは断定せず、Result存在preconditionの独立課題として扱う。2026-09-15以前の`notify(false)`・全通知LEAVED・承認済み3pathを前提にした分析はHistorical/Supersededであり、現行契約ではない。

## standalone作成・duplicate・lock

- 一覧のcreateと詳細update/deleteはOperationResult managerが行い、operation serviceのbefore handler後にmodel CRUDを呼ぶ。component自身にrole、tenant、field allowlist、version preconditionはない。
- developer表示のduplicateはsource全体を`toObject()`でcloneし、日付変更とschedule link除去後、選択日分を一transactionでcreateする。同一日、既存同内容、sourceType/reason/provenanceを検査しない。UIのdeveloper判定はserver enforcementではない。
- lock中は基本manager、worker、article、deleteを無効化し、duplicator内部も拒否する。SecurityReport managerはlockと結線されず操作可能である。これはlockがResult全体の不変化ではなくcontroller/operation edit lockである既存方針と整合するが、画面上の意味の明示は必要である。
- 各更新はcurrent documentのversion/preconditionを渡さないため、別tabや基本・worker・article間の同時保存はlast-write-wins候補である。runtimeのsubscription merge挙動は未確認である。

## loading・error・rollback・並行性

- Generator final submitはloading中disabledで、schedule Listにも`isLoading || confirming`が結線される。preparing中は次の選択を許すが、generation token・購読解除・latest-selection確認で古い応答が現行選択を置換しない。配置通知fetch/readiness失敗時は予定再選択または画面再表示を案内する。confirming中はListとworker鉛筆をdisabledにし、永続ダイアログで確定中であることを表示する。runtimeのoverlay・Air manager内部lockは未確認である。
- `useSetRegularTime`は専用loading/catchを持たず、agreement取得errorがcallerへ伝播する。copy buttonの二重click防止もない。
- Site変更watcherは、その時点でcache済みのSiteにtruthyなsecurityTypeがある場合だけdraftを書き換える。cache完了を待たず、取得失敗/未取得時に以前のSiteの値をclearしない。before handlerもcurrent値がUNSETの時だけSite値を補うため、staleな非UNSET値は保存され得る。
- workers/articlesの保存失敗は各manager/error基盤に委ねられ、別managerで先に成功した変更をrollbackする画面transactionはない。

## permission・validation・accessibility

- Generator・一覧・詳細routeは既存page permissionを入口にするが、target component内にwrite roleの再検査はない。duplicateのdeveloper表示もFunctions/Rulesの専用guardではない。
- schema validationとAir managerのsubmit lockが最終防御であり、target componentはtenant、lockのserver強制、field allowlistを実装しない。
- visible textを持つ追加/確定buttonはあるが、pencil iconとLockIconは明示的なaccessible nameをcomponent自身では付与しない。keyboard/focus returnはVuetify/Air manager境界で未確認である。

## 矛盾・未使用・comment不一致

- Generator commentには旧通知作成後のnull document回避意図が残るが、notify(false)は現行経路にないため、旧分析のHistorical/Superseded記述として扱う。
- `notificationsMap`の説明はnotificationKey keyだが実装はnotification docId keyであり、両者同値の不変条件に依存する。
- DetailのcommentはcacheからSiteを読めなければtemporary扱いとするが、実装は`undefined`を返してsubmit disabledにしない。schema側fetchで最終拒否するため、UI事前guardと保存guardが一致しない。
- `CustomInput.item`はOperationResultでなく基底Operationを許容する。現callersではOperationResultを渡すが、公開validatorはcomponent責務より広い。
- target 14 filesに静的未参照と断定できるfileはない。auto-importと`defineExpose`経由があるため、明示import 0だけでunusedとは判定しない。

## 将来要対応と確認事項

- Generatorのruntime再現、通知/Result部分状態、ArrangementNotificationのtransition・notify失敗処理はFUT-0026/0027へ統合する。List lockとgeneration stale防止はSCR-02でsource実装済みであり、FUT-0028のnotify(false)作成失敗課題はSupersededである。
- schedule ID Resultの存在precondition、duplicate provenance/permissionはFUT-0027へ統合する。承認済み3pathはHistorical/Supersededであり、現行の将来対応ではない。
- component update後の派生同期失敗はFUT-0030、read routeからwriteへ到達する認可はFUT-0031、lock UI意味と並行toggleはFUT-0050で管理する。
- Site変更時のsecurityType同期を最新選択へ収束させる課題をFUT-0175へ登録する。
- 新規CONFは追加しない。正式actor/permissionは既存authorization判断、後続同期はCONF-0018、lock意味はCONF-0037の回答へ統合済みである。3pathは現行の将来対応ではなくHistorical/Supersededである。

## 未確認範囲

runtime/Emulator、Rules enforcement、AirItemManager/AirArrayManager内部のsubmit lock・validation・focus、Firestore concurrent transaction、rapid selection、offline/retry、実dataの重複/stale link、実際のtrigger retry、全schema deep review、component unit testは未確認である。sourceから保証できる制御flowと、runtime依存の発生可能性は区別した。
