# Operation CRUD簡素化の現行棚卸し

- 確認日: 2026-09-15
- checkpoint: INVENTORY-0915
- 状態: 承認済み仕様とlocal実装の静的棚卸し。製品変更・Dev受入れを意味しない
- 対象: マスタの状態変更・archive/restore、現場稼働予定、稼働実績、稼働請求、請求、配置通知の画面・Manager・Class・Callable・Firestore Rules・後続Trigger
- 正本: 要件は[現行仕様](../specification.md)、通常CRUD移行は[ADR 0071](../decisions/0071-normal-business-manager-and-callable-boundary.md)、archive・物理削除境界は[ADR 0072](../decisions/0072-transaction-delete-client-trigger-boundary.md)、棚卸し解消の進捗は[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md)

## 2026-09-15の実装棚卸し

基準はlocal mainの`048e44e9cfd4ca887ec328e7e835c291579e68af`。対象は今回確定したarchive・状態変更・請求・実績lock・実績化・通知・後続Triggerである。実コードとinstalledクラスを読取り、同じ基準でmasterと請求を独立調査した。remote適用状態、実data、画面実操作、送信、runtime testは未確認。以下の優先度は改修順の判断であり、不具合の深刻度や実装承認ではない。

| 対象 | 判定 | 現在の実装と仕様との差 | 最小の改修単位・維持条件 |
|---|---|---|---|
| Customer通常CRUD・取引状態／Outsourcer通常CRUD・取引状態 | 維持 | 単数・複数ManagerがClass.create/updateへ接続済み | 既存の標準保存を作り直さない。Outsourcerで未提供のarchive/restoreを自動追加しない |
| Site・Employee通常CRUD | 大筋一致 | 標準Manager/Class保存は存在するが、状態変更を拒否するRulesが残る | 下記の状態変更工程で必要なRulesだけを合わせる。退職後の通常情報編集禁止など残した業務条件は一括解除しない |
| Customer／Site／Employee archive | 高・要変更 | 専用Callableが独自envelopeを書いて原本をraw delete。標準Class.deleteを迂回し、原本delete・archive writeをRulesで拒否 | 各masterごとに入口、Classの従属検査、Rules、旧archive形式の互換性をまとめる。旧envelopeを標準restoreへ直接渡さない |
| Restore | 提供範囲確認・archiveと同時検討 | client-adapterに標準restoreはあるが、対象masterの通常復旧入口は今回の検索で見つからない | 基盤の存在と製品UI提供を区別する。既存dataの有無・変換要否は未確認で、自動migrationしない |
| Site手動終了・再開 | 高・要変更 | 専用editor→useSiteActions→Callable→server transaction。Rulesにもstatus変更拒否が残る | 手動入口・標準保存・Rulesを一体で整合。Classにはterminateが存在するが再開条件の完全一致は未確認。自動終了のsystem処理は維持 |
| Employee退職・訂正 | 高・Class契約の整理が必要 | 専用Auth lifecycleが業務状態を更新。標準Employee.beforeUpdateもACTIVE→RESIGNEDを拒否し、toTerminatedにはUser.deleteまで含まれる | 単純な接続替えは不可。Classの業務状態更新と認証処理、入口、Rulesの分離を一つの設計単位にする。package変更自体は未承認・未実施 |
| 稼働請求の編集・取極め・調整・lock／実績の稼働外売上 | 高・要変更 | Operation専用ManagerとsaveOperationが残る。Rulesはlock中update・lock変更・articles/調整値変更を拒否。Callableにもrole認可が残る | OperationResultsを共有する画面、標準OperationResult/OperationBilling、Rules、正規callerの撤去とtestを同じ工程で整合。経理画面へのアクセス制限は維持 |
| 実績ロックのクラス・画面 | 維持する基盤あり | OperationResultはlockを検査。OperationBillingはlock検査を無効にし、toggleLockはupdate、deleteは拒否。稼働請求画面も削除を非提供 | クラスを作り直す根拠は現時点でない。標準保存を妨げるRulesを整合し、画面別操作表を維持する |
| Billings入金予定日 | 中〜高・要変更 | 専用PaymentDateEditor→Callable、expected比較とfield限定保存。Billings Rulesはclient write全面拒否 | 提供済み入金予定日編集をManager/Classへ移す。Rulesと旧比較testを同時に整合。server actorは既にtenant中心でありrole撤去を重複計上しない |
| 請求確定・確定後の編集削除 | 中・未提供UIを含む | 顧客請求のC/U/D handlerがunsupported。詳細の編集入口は入金予定日。Billingにstatus/confirmはあるが確定画面・issuer snapshot保存経路は今回未確認 | 「既存確定ロックの撤去」と誤分類しない。提供UI・標準保存・Rulesを実装する単位。現在の入金予定日編集から分ける |
| 予定から実績化 | 高・要変更 | Generator→useOperationGenerator→saveOperation。通知の期待値比較やserver側変換が存在。ClassにはsyncToOperationResultがあるがRules createは予定ID=null・作業員空等を要求 | Generatorとクラス標準実績化、OperationResults作成Rules、旧convert callerを同時に整合。通知の実勤務時間反映・予定との紐付けは維持 |
| 配置通知作成 | 維持 | schedule.notifyでClassから通知documentを生成し予定側状態を同じtransactionで更新 | 後続通知生成と送信までclientへ移さない |
| 配置確認・上番・下番／通知編集 | 中・要変更 | useNotificationEditorが独自transaction、期待値比較、field patch、再読込を実装。Class.update/toConfirmed/toArrived/toLeavedを保存に使っていない | 通知Manager・本人向け操作・入力を標準クラスへ接続。状態ごとの時刻・実勤務値と後続通知条件を検証 |
| Notifications生成・FCM・結果記録／実績から請求勤怠等の反映 | 維持 | ArrangementNotifications→Notifications→FCMの二段階Trigger、OperationResultのC/U/D→各projection同期が存在 | 新しい専用層を増やさず既存Triggerを維持。保存完了と後続反映完了を区別して検証する |

### 主な一次根拠

- Master通常保存: `components/Customer/Manager/index.vue`、`components/Site/Manager/index.vue`、`components/Employee/Manager/index.vue`、`components/Outsourcer/Manager/index.vue`と各複数形Manager。専用archiveは[Customer](../../functions/modules/customer/archiveCustomer.js)、[Site](../../functions/modules/sites/archiveSite.js)、[Employee](../../functions/modules/employees/archiveEmployee.js)。[Rules](../../firestore.rules)のCustomers/Employees/Sitesおよびarchive matchを照合した。
- Site状態更新: [useSiteActions](../../composables/application/site/useSiteActions.js)のterminate/reactivate、[server lifecycle](../../functions/modules/sites/lifecycle.js)。Employeeの専用入口は[LifecycleActions](../../components/Employee/LifecycleActions.vue)。installed Schemasの`src/Employee.js`のbeforeUpdate/toTerminatedは、状態更新拒否とUser削除を含む。
- 請求・lock: [OperationBilling Manager](../../components/OperationBilling/Manager/index.vue)、[useOperationSubmission](../../composables/application/operation/useOperationSubmission.js)、[operationWriteContract](../../functions/shared/operationWriteContract.js)、[Rules](../../firestore.rules)のisValidOperationResultClientCreate/Update/Delete。installed Schemasの`src/OperationBilling.js`の_shouldCheckLock/delete/toggleLockと`src/OperationResult.js`のhookを照合した。
- 顧客請求: [customerBillingHandlers](../../handlers/customerBillingHandlers.js)、[入金予定日server処理](../../functions/modules/billings/updateBillingPaymentDate.js)、RulesのBillings match。installed Schemasの`src/Billing.js`に確定後update/deleteを一律拒否するhookは今回見つからない。
- 実績化: [useOperationGenerator](../../composables/application/operation/useOperationGenerator.js)、[saveOperation](../../functions/modules/operations/saveOperation.js)。installed Schemasの`src/SiteOperationSchedule.js`のsyncToOperationResultは同ID実績作成と予定更新を同じtransactionで行う。
- 通知: [標準作成への入口](../../composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js)、[独自通知editor](../../composables/application/operation/useNotificationEditor.js)、[本人向け操作](../../composables/application/operation/usePersonalNotification.js)、[配置通知Trigger](../../functions/triggers/arrangementNotification.js)、[送信・結果記録](../../functions/modules/utils/notifications.js)。
- 実績の後続反映: [OperationResult Trigger](../../functions/triggers/operationResult.js)、[projection同期](../../functions/modules/operations/syncOperationResultProjections.js)。一つのprojectionの失敗で残りを実行せず終える構造ではなく、個別実行後に失敗を集約する。

### 推奨する進め方と確認残

棚卸しを一つずつ解消する順序・checkpoint・確認残の扱いは[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md)を正とする。本書は確認日付きの実装事実を保持し、改修状態や次工程を重複管理しない。

既存testには旧専用経路・client write拒否を期待するものがある。後続実装では`operation-write`、`operation-submission`、`billing-payment-date`、`client-billing-contract-parity`、各master archive、`employee-schema-compatibility`、`operation-result-projections`およびlocal harnessを対象に、旧期待値と新仕様を区別して更新する。今回testは存在・参照の確認だけで、runtime検証は実行していない。製品code、Rules、package、実data、remoteは変更していない。

## SCR-01-01 保存契約の調査結果（2026-09-15）

調査基準はlocal branchのcommit `7ad8dbb39b02e9c82da4a1fd889a1cc7d01da593`。terra/medium taskのread-only調査をcoordinatorが現物code・診断出力でreviewした。以下は後続実装の契約であり、製品への適用済み記録ではない。

- 入力と保存: 詳細画面が購読するBilling instanceを単数domain Managerへ渡す。AirItemManagerの既定editorとcustomInputで入金予定日変更・null解除だけを提供する。保存はdraftの標準updateへ委譲し、client-adapterがdocument全体、管理field、schema validationを所有する。
- 日付条件: 既存の「nullまたは請求日以降」は維持する。Billing classはDate/nullと派生年月を扱うが前後条件は検証しないため、入力側のminと、保存直前の共有operation contractで既存条件を検証する。日付相関をRulesへ複製せず、expected比較・独自再取得・競合拒否は撤去する。一般schemaをアプリ側へ複製しない。
- 保存内容: status、adjustment、remarks、operationResults、createdAtを往復させ、uid・updatedAtは標準adapterが更新する。paymentDueDateAtからpaymentDueDate・paymentDueMonthをクラスが導出する。背景writerは既存rawと計算結果を合成し、手動の入金予定日を維持する。clientと背景writerの同時更新には現行document単位LWWを適用し、異なるfieldの完全保持を保証しない。
- 互換性: 今回は既存schemaと日付3 fieldのshapeへ保存経路を合わせる。package変更・data変換を必須とする根拠は確認されていない。未知fieldの汎用保持を新要件にしない。privateMetadata等は合成testの例で、実製品writerの必須fieldとは確認されなかった。
- 対象: 02で単数ManagerとcustomInput、03で詳細page・保存接続、04でBillings Rules、05で旧PaymentDateEditor・専用composable・Callable API/export/module・不要contractを整理する。共有helperは残存callerを確認する。直接testは既存billing-payment-date、client-billing-contract-parity、local harnessを関連範囲で更新する。Employee、User/Auth、請求確定UI、背景writerの設計変更は対象外。
- rollback: 02の未接続部品は当該差分を戻せる。03〜05の切替後はclient・Rules・旧Callableを整合した組で戻す。形を変えない通常更新では専用migrationを予定しないが、codeの復元だけで保存済みの値を巻き戻したとは扱わない。旧clientの併存とFunction撤去順は07のrelease確認に含める。
- 検証計画: 02はinstance入力、UPDATEのみ、日付入力・null解除・取消・disabled・base validation/error接続を確認。03〜06は全値のserialization、日付往復、保存成功・失敗・listener、背景集計後の日付保持を確認し、Rulesは認証・同一tenant境界を検証する。実保存の互換性は02開始前の検証済み条件ではなく、03〜06の完了条件である。07で対象Dev受入れを行う。

### 診断とreviewの限界

合成dataによる `node --input-type=module -e …` のメモリ内診断は各exit 0。請求日前とnullがBilling.validateを通ること、nullの派生日付がnullになること、代表的なstatus・adjustment・remarks・管理fieldがtoObjectに残ることを確認した。OperationResultの生成する66個のfield名はBilling内の往復で欠落しなかったが、全値一致・実Firestore保存・画面受入れは未検証である。schema外のunknown fieldは除去された。coordinatorは「未知field保持のためpackage改修必須」という初回判断を、合成例を要件に拡張したものとして差し戻し、必須ではないとの訂正を確認した。

一次根拠は[旧日付contract](../../composables/domain/customerBilling/billingPaymentContract.js)、[背景Billing同期](../../functions/modules/billings/billingReferencePlan.js)、[背景保存](../../functions/modules/employees/backgroundReferencePlan.js)、installed Billing classとclient-adapterのupdate。現行仕様と食い違うCONF-0036の旧発行後制限は現行標準CRUDへ整合し、再導入しない。remote・実dataは未確認、製品testは未実施。調査・記録はproject-guidance-metadataとしてproject-docsとdiff-checkで検証し、製品suite・環境検証は製品変更がないため対象外とする。要件自体・schema・操作手順は変えないため、仕様version・ADR・manual・運用runbookは更新しない。
記録差分の独立reviewでは、01の証拠限界と02の部品scopeが妥当と確認された。入金model未決の参照先をCONF-0035へ訂正した。02はbeforeEditとhandlerでCREATE/DELETEを拒否し、schema由来componentAttrsを使用する。親SCR-01の製品完了とは区別する。

## 2026-09-15仕様回答の反映と残作業

保存方式と画面別lock条件は[現行仕様](../specification.md#標準crudと後続処理)・[画面別操作表](../specification.md#稼働実績ロックと画面別操作)で確定した。今回の文書変更で製品code・Rules・dataは切り替えていない。以下の確認日付き実装記録を移行済みと読み替えない。

- 請求の保存・確定後の訂正削除、ロックの設定解除、実績化に残る専用経路を標準Manager／Classへ合わせる。稼働請求管理から元の実績を削除する操作は追加しない。
- 実績lockの画面別制約と、現在のRules・クラスhook・Managerの一律拒否条件を照合し、経理側の編集が標準CRUDで成立するよう対象実装工程で揃える。
- 配置通知は既存schedule.notify()でdocumentを作成し、作成・状態変更TriggerがNotificationsを生成、別TriggerがFCM送信と結果記録を行う。標準クラスへの接続整理で後段を撤去しない。
- 実績の作成・更新・削除から請求・勤怠等への既存Triggerを維持し、保存成功と後続処理完了を分けて検証する。
- 業務状態更新とAuth変更を併合した旧master経路は、各master工程で分離方法を確認する。今回の仕様承認をAuth処理の削除や実装着手・外部操作の承認へ拡張しない。

## 確認済み実装事実（2026-09-14の記録）

1. 現場稼働予定の単数・複数Managerは09で`AirItemManager`／`AirArrayManager`へ戻し、`SiteOperationSchedule` modelの作成・更新・削除を使う。請求には`OperationManager`／`OperationArrayManager`と`saveOperation`が残る。
2. 予定の配置作業員は09で親`SiteOperationSchedule` modelの追加・変更・削除と`update()`へ戻した。実績詳細の作業員は07で通常client保存へ移行済みだが、稼働外売上は表示・操作・Callable経路を変更していない。
3. 過去実装では作業員配列を`WorkersManager`／`AirArrayManager`の`v-model`で編集し、submit完了時に親`OperationResult.update()`を実行していた。直近実装で追加された`useOperationResultWriter`とEmployee存在確認transactionはこの復元経路に不要であり、FGA-06-RESULT-CALLABLE-RESTORE-07で撤去した。
4. `functions/shared/operationWriteContract.js`が`create`、`duplicate`、`overview`、`workers`、`articles`、`order`、`delete`、`notify`、`convert`、`agreement`、`adjusted`、`lock`を一つのcommand契約へ集約する。
5. `functions/modules/operations/saveOperation.js`には予定commandとSite `scheduleRevision`処理が互換用に残るが、09の正規予定画面からは到達しない。予定から実績への確定と請求の取極め・調整・lockは引き続きserver入口を使う。
6. Firestore Rulesは`SiteOperationSchedules`と`ArrangementNotifications`を同一tenantの有効な本登録Userによる通常read/writeへ開き、Site revision、maintenance、live Site、通常field形状を重複検査しない。未認証、User不在、仮登録、無効User、claim不正、他tenantは拒否する。`OperationResults`の個別境界は08までの実装を維持する。
7. `saveOperation`の実績`create`・`overview`・`workers`・`delete`は正規画面から到達しない旧互換経路であり、入力契約で拒否する。予定の旧分岐は正規画面から外れた互換codeとして残す。実績複製、稼働外売上、請求、予定から実績への確定は変更せず、従来経路を維持する。

## 操作別の予備分類（2026-09-14の履歴）

この表は改訂前の調査記録である。回答済み操作の保存方式は上記の現行仕様を優先し、表中の分類待ち・専用処理候補を再適用しない。特に「技術要件候補」は、現行server処理の存在だけでなく、client transaction・batch・trigger等で満たせない理由を次の設計で確認する。

| 対象 | 現行action | 現行の主な処理 | 予備分類 | 後続で確認する点 |
|---|---|---|---|---|
| 予定 | `create`・`duplicate` | 予定作成、現場参照、表示順 | 09でAir Manager／model保存へLocal復元 | Dev画面受入れ、配置管理エラーの再現 |
| 予定 | `overview`・`workers`・`order` | 予定document更新、配置通知取消し | 09でAir Manager／model保存へLocal復元 | listener収束、配置管理エラーの再現 |
| 予定 | `delete` | 予定documentと関連通知の物理削除 | 09でmodelのclient削除へLocal復元 | 関連通知削除とDev画面受入れ |
| 予定 | `notify` | 配置通知document作成と予定側状態更新 | 09でmodelの既存`notify()`へLocal復元 | 外部通知、再送、配置管理エラーの再現 |
| 予定 | `convert` | 通知値を反映した実績作成、予定を実績化済みに更新 | 技術要件を持つ順序依存operation候補 | atomicity、再実行、通知snapshot、結果不明時の復旧 |
| 実績 | `create` | 実績作成、Site取極めsnapshot | 標準client保存へLocal移行済み | Dev反映、一覧作成・詳細遷移・Triggerの受入れ |
| 実績 | `duplicate` | 既存実績の複製 | 現状維持・後続判定 | 複製元snapshot、作業員参照、lock条件 |
| 実績 | `overview`・`workers` | 実績document内の基本情報・作業員更新 | 最初の通常CRUD簡素化候補 | 単数／複数Manager、document LWW、参照検査、downstream trigger、Rules |
| 実績 | `articles` | 実績document内の稼働外売上行更新 | 現状維持・権限仕様未決 | 現行操作を維持し、権限の追加・撤去をこのphaseから推論しない |
| 実績 | `delete` | 実績documentの物理削除 | client物理削除・Trigger連携 | 実績原本をclient削除へ移し、勤怠・請求・履歴・予定・日報等の削除event chainをTriggerに維持する |
| 請求 | `overview`・`articles`・`adjusted` | OperationResults内の請求情報・稼働外売上・手動調整更新 | 現状維持・業務境界確認待ち | 上流menu制御、提供操作、確定後編集、通常CRUDへ分類できる範囲 |
| 請求 | `agreement` | Site取極め選択と請求snapshot再計算 | 技術要件または通常CRUDの確認候補 | snapshot、再計算、最新Site参照をどこが所有するか |
| 請求 | `lock` | 請求対象実績のlock切替 | 状態遷移の確認候補 | lockの意味、解除、他編集との競合、actor仕様 |

## 現時点の不整合

- FGA-06の初期checkpointはrole依存を緩和したが、専用Operation Manager、Callable、期待値競合、client write全面拒否を維持した。認可緩和の完了記録は有効だが、CRUD簡素化の完了とは扱わない。通常CRUDから過剰Callable接続と連動Rulesを戻すことを後続checkpointより優先する。
- ADR 0069と仕様は当初Air Managerを通常masterへ限定していた。ADR 0071と仕様訂正により通常業務data全般へ適用範囲を広げるが、製品codeは未移行である。
- `saveOperation`は互換用の予定分岐、実績化、請求状態遷移を同じAPIへ残している。09で正規予定callerをmodelへ戻したが、旧予定分岐と専用補助codeの削除は後続整理であり、実績化は現在の上下番確定エラーを再現してから扱う。

## FGA-06-RESULT-MANAGER-CLIENT-04 実装・Dev受入れ結果

lockされていない既存実績の`overview`・`workers`だけを対象に実装した。稼働外売上、実績作成・複製・物理削除、予定、通知、実績化、請求は対象外である。

- listener由来`OperationResult`を単数`OperationResultManager`／`AirItemManager`へ渡し、基本情報をdocument単位last-write-winsで保存する。
- 作業員配列は`OperationResultWorkersManager`／`AirArrayManager`を再利用し、編集後の親`OperationResult`全体を保存する。Employeeマスターの存在確認と、同じ作業員の重複を理由にした追加拒否は行わない。
- Rulesはtenant、active registered User、actor UID、document ID、既存非lock状態、Site・Customer参照を境界とする。未決または専用操作のfieldは同時に開かない。
- 旧画面のカード枠、toolbar、ボタン文言、入力component、760px dialog、lock表示、稼働外売上一覧、物理削除dialogを維持する。固定製品commit `40316475`のsource contract、全domain、Local Emulator、専用UI buildに加え、release commit `138b3a29`のHosting Dev反映と会社管理者・統括によるブラウザ受入れを完了した。[Local検証記録](../verification/fga-06-result-manager-client-local.md)と[Dev受入れ記録](../verification/fga-06-result-manager-client-dev.md)を参照する。

checkpointはDev受入れまで完了した。旧Callableの`overview`・`workers` rollback分岐と、transaction `delete`分岐の撤去は後続の変更単位とする。

## FGA-06-RESULT-DELETE-CLIENT-06 Local実装結果

固定製品commit `07511fb3`で、稼働実績詳細の既存削除dialogを`OperationResultManager`へ接続し、`OperationResult.delete()`の標準client経路へ移した。

- 削除ボタン、確認dialog、文言、詳細画面の配置を維持し、削除時の保存処理だけを差し替えた。
- Rulesは同一tenantの有効な本登録User、document ID一致、既存の非lock状態を要求する。create、locked result、仮登録・無効User、他tenantは拒否する。
- `saveOperation`は実績`delete` commandを入力段階で拒否し、予定deleteは未移行のため維持する。
- 既存のOperationResult削除Triggerが請求、日次勤怠、勤務回数実績、現場従業員履歴を同期し、既存cleanupが予定・日報を扱う構成は変更していない。
- 従業員10名を含む実績のclient削除をLocal Emulatorで確認し、勤務者行を空にしないと汎用errorになる旧経路の症状は新経路では発生しなかった。旧Callable内での個別原因の切り分けは行っていない。
- 全domain 1454件、Local Emulator 180件、固定commitの専用UI buildを完了した。[Local検証記録](../verification/fga-06-result-delete-client-local.md)を参照する。

checkpointは後続07と同じDev release・受入れで完了した。schema変更、data migration、既存data一括変更、Prod変更はない。

## FGA-06-RESULT-CALLABLE-RESTORE-07 実装・Dev受入れ結果

- `OperationResultManager`は専用composableを介さず、draftの標準`update()`／`delete()`を直接使用する。listener由来instance、document単位last-write-wins、非lock条件を維持し、再読込handlerを追加しない。
- 作業員配列は過去実装どおり`WorkersManager`／`AirArrayManager`の`v-model`で編集し、submit完了時に親`OperationResult.update()`で保存する。Employee存在確認transactionを設けない。
- `saveOperation`は実績`overview`／`workers`／`delete`を入力段階で拒否する。実績作成・複製、稼働外売上、請求、予定、通知、実績化は対象外である。
- Rulesは実績updateのSite／Customer存在確認を撤去し、tenant・actor UID・document ID・非lockと、未決または専用operation所有fieldの変更拒否を維持する。
- UIの文言、カード、toolbar、追加・編集・削除button、入力、760px dialog、稼働外売上一覧、削除dialogを変更しない。data shape、migration、既存data一括変更、Prod変更はない。

初回Dev受入れで、作業員追加dialogが親実績の勤務初期値を継承しない差を確認した。過去repositoryでは親OperationResultの値をworkerへ渡していたため、現行`WorkersManager`が既に公開している日付・現場・勤務区分・開始・終了・翌日開始・規定実働・休憩のdefault propsを詳細画面から渡す補正をcommit `8d90d5d1`で行った。UI構造は変更していない。

補正後の会社管理者sessionで、基本情報表示、作業員追加時の勤務初期値継承、OJT更新・再読込、作業員削除・再読込、実績物理削除、一覧0件、既存画面の見た目を確認した。各操作に対応するDev Trigger event後にerrorは記録されていない。`FGA-06-RESULT-DELETE-CLIENT-06`と本checkpointはDev受入れまで完了した。[Dev受入れ記録](../verification/fga-06-result-callable-restore-dev.md)を参照する。

## FGA-06-RESULT-CREATE-CLIENT-08 Local実装結果

- 一覧用の複数形`OperationResultsManager`を`AirArrayManager`へ戻し、`OperationResult.create()`と既存の作成前Site補完へ接続した。
- 760px dialog、既存入力、`キャンセル`／`保存`、一覧toolbar、作成後の詳細遷移を維持する。
- `saveOperation`の実績create入力を拒否し、通常createを同一tenantの有効な本登録Userへrole非依存で開いた。作成時のlive Site／Customer、actor UID、document ID、空の作業員・稼働外売上・調整値、非lock、非予定紐付けをRulesで守る。
- Site archiveとの前後・同時実行をEmulatorで検証し、archive済みSiteに新規実績参照を残さない。
- 実績複製、稼働外売上、請求、lock、予定、通知、実績化、schema、migration、既存data一括変更、Dev・Prodは変更しない。[Local検証記録](../verification/fga-06-result-create-client-local.md)を参照する。

## FGA-06-SCHEDULE-MANAGER-RESTORE-09 Local実装結果

- 単数・複数の予定Managerを`AirItemManager`／`AirArrayManager`へ戻し、予定の作成・更新・削除・並べ替えを`SiteOperationSchedule` modelへ接続した。
- 配置作業員の追加・変更・削除、予定の複製、配置画面からの通常保存と通知をmodelの既存処理へ戻した。正規callerから専用operation editor、optimistic publish、`saveOperation`への接続を外した。
- Rulesは予定と配置通知をtenant共通の通常read/writeへ簡素化し、Site revision、maintenance、live Site、field形状、実績化済み状態の重複検査を撤去した。identityとtenant境界、nested pathの既定拒否は維持する。
- 予定から実績への確定、請求、実績複製、稼働外売上、schema package、data shape、migration、Dev・Prodは変更しない。
- Dev受入れで、上下番確定の左一覧と右詳細・日報写真が表示されず、外枠のManagerだけが表示される不具合を確認した。原因は予定Managerの明示的な`table`表示口と汎用転送の同名表示口の重複であり、汎用転送から`table`を除外するLocal補正と回帰testを追加した。
- 対象test 36/36件、全domain 1,434/1,434件、buildはexit status 0。補正版commit `12f05e5a`をGitHub ActionsでHostingへDev再反映した。配置管理・上下番確定処理そのものの再受入れは未実施であり、エラー解消済みとは扱わない。

## 未確認事項

- Prod、migration、既存data全件、remote派生document全件は確認していない。Devでは作業員を持つ合成実績について作業員CRUDと実績物理削除を確認し、Triggerログにerrorがないことを確認したが、派生document全件は直接列挙していない。
- 最終Local検証は全domain 1446/1446件、Local Emulator 179/179件、固定製品commitの専用UI buildを終了コード0で確認した。[Local検証記録](../verification/fga-06-result-callable-restore-local.md)を参照する。
