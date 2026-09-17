# Operation CRUD簡素化の現行棚卸し

- 確認日: 2026-09-16
- checkpoint: INVENTORY-0915
- 状態: 承認済み仕様とlocal実装の静的棚卸し。製品変更・Dev受入れを意味しない
- 対象: マスタの状態変更・archive/restore、現場稼働予定、稼働実績、稼働請求、請求、配置通知の画面・Manager・Class・Callable・Firestore Rules・後続Trigger
- 正本: 要件は[現行仕様](../specification.md)、通常CRUD移行は[ADR 0071](../decisions/0071-normal-business-manager-and-callable-boundary.md)、archive・物理削除境界は[ADR 0072](../decisions/0072-transaction-delete-client-trigger-boundary.md)、棚卸し解消の進捗は[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md)

## 2026-09-15の実装棚卸し

2026-09-16現行補正: SCR-02の今回差分で、GeneratorはSchemas `SiteOperationSchedule.syncToOperationResult`へ接続済み。最終確定はArrangementNotificationを作成・更新せず、既存通知のactual値を読むだけである。旧`useOperationGenerator`、`saveOperation`の`convert`、notification expectation比較は撤去済み。OperationResult Rulesは同一tenantの有効な本登録Userへ通常read/writeを許可し、field・lock・worker・docIdの業務検証はSchemas／正規applicationへ委譲する。SCR-04へ二重計上しない。

基準はlocal mainの`048e44e9cfd4ca887ec328e7e835c291579e68af`。対象は今回確定したarchive・状態変更・請求・実績lock・実績化・通知・後続Triggerである。実コードとinstalledクラスを読取り、同じ基準でmasterと請求を独立調査した。remote適用状態、実data、画面実操作、送信、runtime testは未確認。以下の優先度は改修順の判断であり、不具合の深刻度や実装承認ではない。

| 対象 | 判定 | 現在の実装と仕様との差 | 最小の改修単位・維持条件 |
|---|---|---|---|
| Customer通常CRUD・取引状態／Outsourcer通常CRUD・取引状態 | 維持 | 単数・複数ManagerがClass.create/updateへ接続済み | 既存の標準保存を作り直さない。Outsourcerで未提供のarchive/restoreを自動追加しない |
| Site・Employee通常CRUD | 大筋一致 | 標準Manager/Class保存は存在するが、状態変更を拒否するRulesが残る | Siteは状態変更工程で必要なRulesを合わせる。Employee退職・訂正の専用保護と退職後の通常情報編集禁止は維持する |
| Customer／Site／Employee archive | SCR-06 Customer・SCR-07 Siteは標準化、SCR-10 Employeeはprelocal実装・検証待ち | Customer／Siteは標準Class.deleteへ移行し、Employeeはread-only preflight後に標準Class.deleteへ接続。既存archive形式は保持 | Customer／SiteのRules・旧形式保持・標準移動を確認。EmployeeはUser連携・予約・lock・lifecycle整合をpreflightで確認し、旧envelopeを標準restoreへ直接渡さない |
| Restore | 提供範囲確認・archiveと同時検討 | client-adapterに標準restoreはあるが、対象masterの通常復旧入口は今回の検索で見つからない | 基盤の存在と製品UI提供を区別する。既存dataの有無・変換要否は未確認で、自動migrationしない |
| Site手動終了・再開 | SCR-03 prelocal実装 | 専用editorをSiteManagerへ接続し、Site schemaの状態遷移検査とRulesのactor／tenant／metadata境界を追加。手動Callable／専用actionは撤去し、自動終了のsystem処理は維持 | security review、直接test、Dev受入れ、Rules実行時構文確認を残す。package／data shape／migrationは変更しない |

## SCR-03 Site手動終了・再開（2026-09-16、PRELOCAL）

- 確認範囲: `components/Site/**`、`components/Sites/**`、Site pages、`schemas/Site.js`、`firestore.rules`、Site lifecycle Functions／API／composableを静的確認した。Installed packageのSiteは終了のみで再開条件を持たないため、root schema subclassで状態遷移・理由・actor UID・工期・予定条件を補完した。
- 実装: 手動終了・再有効化をSiteManagerの標準`update()`へ接続し、標準UIのsubmit・loading・error・listener経路を利用する。TERMINATEDの通常編集禁止、終了時の予定条件、再有効化時のCustomer不変と新工期・理由、同一tenantの有効な本登録Userとactor UID境界を維持する。手動Callable、manual mapper、専用site action／function exportは撤去し、自動終了処理だけをFunctionsに残した。
- 未完了: testerによる直接test、security review、Rulesの実行時構文確認、Local Emulator／UI／Dev受入れは未実施。schemaの予定確認は標準client update前の非atomicな事前検査であり、同時変更を完全に防止するものではない。
- 影響: package／lock／node_modules、Firestore data shape、migration、remote data、外部環境、deployは変更していない。Rules差分はsecurity review承認前のprototypeであり、承認なしにrelease・deployしてはならない。
| Employee退職・訂正 | 標準CRUD化の例外・既存Callable維持 | 2026-09-16コード確認: 退職Callableは予約と実Userを照合してUserなし／本登録を分岐し、仮登録・不整合を拒否する。訂正Callableは最新の完了済み退職・User連携なし・lockを検証する | [SCR-09の個別完了条件](../roadmaps/standard-crud-alignment.md#scr-09-employee退職誤退職訂正の目的と完了条件)に従い、既存証拠と不足を照合する。標準toTerminatedへの置換、Userなしの別保存経路、package改修を前提にしない |
| 稼働請求の編集・取極め・調整・lock／実績の稼働外売上 | SCR-05 prelocal実装・検証待ち | 標準OperationBillingManager／ArticleDetailsManagerとroot OperationBilling schemaへ移行。旧Operation専用Manager、result/articles Callable経路、請求専用Functions分岐を撤去。Rulesはlock中updateを許可し、updateのisLocked型を要求 | operation direct test、SFC runtime、Rules Emulator、Local／Dev受入れ、live Site agreement検証を確認。経理画面アクセス制限とOperationResult／OperationBillingのlock差を維持 |
| 実績ロックのクラス・画面 | 維持する基盤あり | OperationResultはlockを検査。OperationBillingはlock検査を無効にし、toggleLockはupdate、deleteは拒否。稼働請求画面も削除を非提供 | クラスを作り直す根拠は現時点でない。標準保存を妨げるRulesを整合し、画面別操作表を維持する |
| Billings入金予定日 | SCR-01 Completed | 詳細画面はManager/Classの標準update、Rulesはtenant共通の既存update、旧PaymentDateEditor・Callable・expected比較はsourceとDevから撤去済み。標準保存、listener再表示、日付条件・解除、背景writerとの併存をLocal確認し、Devの会社管理者画面で変更・解除・再表示・既存表示維持を受け入れた | 残作業なし。失敗経路は自動test成功を受入証拠とし、backend停止時の画面確認は完了条件外 |
| 請求確定・確定後の編集削除 | 中・未提供UIを含む | 顧客請求のC/U/D handlerがunsupported。詳細の編集入口は入金予定日。Billingにstatus/confirmはあるが確定画面・issuer snapshot保存経路は今回未確認 | 「既存確定ロックの撤去」と誤分類しない。提供UI・標準保存・Rulesを実装する単位。現在の入金予定日編集から分ける |
| 予定から実績化 | 高・要変更 | Generator→SiteOperationSchedule.syncToOperationResult。既存通知のactual値を読み、通知なしは予定値fallback。最終確定では通知を作成・更新しない | 標準sync、OperationResults作成Rules、既存通知の実勤務時間反映・予定との紐付けを整合。旧convert callerと通知期待値比較は撤去済み |
| 配置通知作成 | 維持 | schedule.notifyでClassから通知documentを生成し予定側状態を同じtransactionで更新 | 後続通知生成と送信までclientへ移さない |
| 配置確認・上番・下番／通知編集 | SCR-02 Completed（Dev受入れ完了） | 単数・本人向けManagerはAir ManagerとArrangementNotificationの標準`update()`／遷移methodへ接続し、旧expected比較・patch transaction・再読込経路を撤去した。Schemas `3.0.0-dev.3`をroot/Functionsへ導入し、notify生成の`actualIsStartNextDay` parityをsaveOperationにも反映した。直接対象test、domain-full 1433/1433、Local Emulator 180/180、最終Local T21、TESTERの会社管理者Local UI、ユーザー本人の遷移確認、Generator共通rowのscroll境界補正、source regression test、利用者によるDev受入れを完了した。DEV read-only確認で配置通知2579件と関連予定・勤務実績の整合を確認し、migration/repair不要と判断した | Prod、FCM実配信、backend日付算術、dashboard本人表示は未検証のまま後続範囲とする |
| Notifications生成・FCM・結果記録／実績から請求勤怠等の反映 | 維持 | ArrangementNotifications→Notifications→FCMの二段階Trigger、OperationResultのC/U/D→各projection同期が存在 | 新しい専用層を増やさず既存Triggerを維持。保存完了と後続反映完了を区別して検証する |

### 主な一次根拠

実績化の現行判定はSCR-02で標準syncへ整合済み。下表に残る旧Generator→saveOperation記述は2026-09-15棚卸し時点の履歴であり、現行経路ではない。SCR-04は独立範囲のみを扱い、標準sync・通知不変・旧convert撤去を二重計上しない。

- Master通常保存: `components/Customer/Manager/index.vue`、`components/Site/Manager/index.vue`、`components/Employee/Manager/index.vue`、`components/Outsourcer/Manager/index.vue`と各複数形Manager。Customer／Site／Employee archiveは標準Schema／ClientAdapterへ接続し、Employeeだけread-only preflightを先行する。[Rules](../../firestore.rules)のCustomers/Employees/Sitesおよびarchive matchを照合した。
- Site状態更新: [SiteManager](../../components/Site/Manager/index.vue)からSite schemaの標準`update()`へ接続し、Rulesでtenant／actor UID／状態metadata境界を保護する。自動終了だけは[scheduled lifecycle](../../functions/modules/sites/autoTermination.js)に残す。Employeeの専用入口は[LifecycleActions](../../components/Employee/LifecycleActions.vue)。installed Schemasの`src/Employee.js`のbeforeUpdate/toTerminatedは、状態更新拒否とUser削除を含む。
- 請求・lock: [OperationBilling Manager](../../components/OperationBilling/Manager/index.vue)、[useOperationSubmission](../../composables/application/operation/useOperationSubmission.js)、[operationWriteContract](../../functions/shared/operationWriteContract.js)、[Rules](../../firestore.rules)のisValidOperationResultClientCreate/Update/Delete。installed Schemasの`src/OperationBilling.js`の_shouldCheckLock/delete/toggleLockと`src/OperationResult.js`のhookを照合した。
- 顧客請求: [customerBillingHandlers](../../handlers/customerBillingHandlers.js)、01-05で撤去した旧`updateBillingPaymentDate`のGit履歴、RulesのBillings match。installed Schemasの`src/Billing.js`に確定後update/deleteを一律拒否するhookは今回見つからない。
- 実績化: `components/OperationResult/Generator/index.vue`、installed Schemasの`src/SiteOperationSchedule.js`の`syncToOperationResult`。同ID実績作成と予定更新を同じtransactionで行う。旧composableと旧convertは撤去済み。
- 通知: [標準作成への入口](../../composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js)、[単数Manager](../../components/ArrangementNotification/Manager/index.vue)、[本人向け複数Manager](../../components/ArrangementNotifications/Manager/index.vue)、[下番Manager](../../components/ArrangementNotification/Manager/toLeaved.vue)、[配置通知Trigger](../../functions/triggers/arrangementNotification.js)、[送信・結果記録](../../functions/modules/utils/notifications.js)。
- 実績の後続反映: [OperationResult Trigger](../../functions/triggers/operationResult.js)、[projection同期](../../functions/modules/operations/syncOperationResultProjections.js)。一つのprojectionの失敗で残りを実行せず終える構造ではなく、個別実行後に失敗を集約する。

### 推奨する進め方と確認残

棚卸しを一つずつ解消する順序・checkpoint・確認残の扱いは[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md)を正とする。本書は確認日付きの実装事実を保持し、改修状態や次工程を重複管理しない。

既存testには旧専用経路・client write拒否を期待するものがある。後続実装では`operation-write`、`operation-submission`、`billing-payment-date`、`client-billing-contract-parity`、各master archive、`employee-schema-compatibility`、`operation-result-projections`およびlocal harnessを対象に、旧期待値と新仕様を区別して更新する。今回testは存在・参照の確認だけで、runtime検証は実行していない。製品code、Rules、package、実data、remoteは変更していない。

## SCR-02 Dev受入れ完了の実装状態（2026-09-17）

単数の配置通知編集、本人向け確認・上番・下番を`AirItemManager`／`AirArrayManager`へ接続し、編集対象`ArrangementNotification`の標準`update()`／`toConfirmed()`／`toArrived()`／`toLeaved()`等へ保存を委譲するcodeとtestを準備した。本人向け複数Managerは選択したlistener由来documentを追跡し、同documentのlistener更新時だけ編集中draft全体を最新instanceで置き換える。別documentだけの更新ではdraftを置き換えない。

旧`useNotificationEditor`、`usePersonalNotification`、client／Functionsの`notificationStateContract`は到達元とtestを更新して削除した。`operationCommandContract`／`operationWriteContract`の`notificationExpectation`等は実績化で使用中のため維持する。Firestore Rules、配置通知の作成・状態変更Trigger、Notifications作成、FCM送信・結果記録には製品差分を加えていない。

自動test codeは、標準クラスの4遷移、実勤務時刻・日跨ぎ・勤務時間、manager接続、同一tenant Rules、CONFIRMED／ARRIVED／LEAVED進入時のNotifications生成、同status非生成、`shouldNotify=false`を対象に更新した。listenerによる編集中draft全体の置換、別document更新時の入力維持、失敗時のdialog・入力保持、loadingと連打抑止はTESTERのLocal UIで確認した。Schemas `3.0.0-dev.3`はsource tag・release evidence・registry・root/Functionsのversion、resolved、integrity、installed sourceが一致し、`PostAdoption`は成功した。saveOperationのnotify生成分岐にも`actualIsStartNextDay`の実勤務値引継ぎを反映し、直接対象test、domain-full 1433/1433、Local Emulator 180/180、最終Local T21は成功した。TESTERは会社管理者Local UIでLEAVED通知の取消、必須field validation、一時値保存、listener反映、reload保持、baseline復元を確認し、ユーザー本人は一方向遷移とLEAVED時の「閉じる」のみ表示を確認した。GitHub ActionsによるDevのHosting/Functions反映と会社管理者によるDev UI表示は成功した。DEV read-only確認では配置通知2579件の必要最小fieldを取得し、翌日開始1件と関連予定・勤務実績の整合を確認したためmigration/repair不要と判断した。writeは0件である。Dev受入れ中に上下番確定画面の縦長内容で確定buttonへ到達できない既存UI layout regressionを確認したため、Generator共通rowへ`overflow-hidden`と`min-height: 0`を追加した。source regression testは左右独立scroll、右toolbar/actions固定、外側columnとalert→reload→row順序を固定し、TESTER最終39/39、review finding 0件である。Local UIの左Listと右Detail本文の独立scroll、右側操作部の固定、確定操作への到達、および利用者のDev受入れ報告によりSCR-02を完了した。[Local検証記録](../verification/scr-02-arrangement-notification-local.md)と[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md#scr-02受入れ前-ui-layout-regression-補正)を参照する。

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

一次根拠は01-05で撤去した旧日付contractのGit履歴、[背景Billing同期](../../functions/modules/billings/billingReferencePlan.js)、[背景保存](../../functions/modules/employees/backgroundReferencePlan.js)、installed Billing classとclient-adapterのupdate。現行仕様と食い違うCONF-0036の旧発行後制限は現行標準CRUDへ整合し、再導入しない。remote・実dataは未確認、製品testは未実施。調査・記録はproject-guidance-metadataとしてproject-docsとdiff-checkで検証し、製品suite・環境検証は製品変更がないため対象外とする。要件自体・schema・操作手順は変えないため、仕様version・ADR・manual・運用runbookは更新しない。
記録差分の独立reviewでは、01の証拠限界と02の部品scopeが妥当と確認された。入金model未決の参照先をCONF-0035へ訂正した。02はbeforeEditとhandlerでCREATE/DELETEを拒否し、schema由来componentAttrsを使用する。親SCR-01の製品完了とは区別する。

## SCR-01-02 単数Managerと入力部品（2026-09-15）

基準は `fda620d2dd13ec953bd40f1c2c0c65a1e05c3aa6`。01-01の契約に従い、[CustomerBillingManager](../../components/CustomerBilling/Manager/index.vue)、[CustomInput](../../components/CustomerBilling/CustomInput.vue)、[日付検証](../../composables/domain/customerBilling/paymentDueDateValidation.js)と `test/domain/customer-billing-manager.test.mjs` を追加した。詳細pageには未接続で、既存製品経路は変更していない。

- Billing instanceのmodelValue、UPDATEだけを許すbeforeEditとhandler、activator透過、480px、既定editor・error/loadingを使用する。customInputはschema由来属性で入金予定日を編集し、updatePropertiesでnullへ解除する。
- 日付の共有検証はnullまたは請求日以降を許し、通過後にdraft.updateへ委譲する。expected比較・独自dialog・再取得は追加していない。
- 初回実装時の証拠: `node --test test/domain/customer-billing-manager.test.mjs`: 12/12、exit 0。実handlerのCREATE/DELETE拒否、UPDATE委譲、日付検証拒否・保存reject伝播を検証。installed useItemManagerとのメモリ内接続でdraft変更・null解除・取消再開・失敗時編集維持とloading解除を確認し、Timestamp互換・JST境界を含めた。
- 初回実装時の証拠: `node --test test/domain/*.test.mjs`: 1,477/1,477、exit 0。下記の利用者改修でsource/testが変わったため、最終状態の証拠は再検証結果を使用する。
- 独立review: 初回の文字列testだけでは動作証拠が不足するP2を、handler/base接続test追加で解消。labelとUTF-8 BOMなしCRLFを修正し、最終reviewにblocking指摘なし。disabledは両入力のtemplateと標準部品契約の静的照合であり、ブラウザ実操作の証明ではない。
- 証拠限界: Vue画面のmount、Errors Storeへの実登録、date picker実操作は未検証。base周辺のmode/errors/loading/cloneはtest stubを用いる。Firestore実保存・全値serialization・listener・背景writer・Dev受入れは03以降で検証する。02を単独releaseしない。
- 変更classはui-css-layout、application-logic、文書整合はproject-guidance-metadata。completion gateはproject-docs、domain-full、diff-check。Rules・保存形式・依存package・環境・governance変更がないため、Emulator、UI build、release-only、governance専用gateは省略する。仕様version・ADR・manualは提供画面の変更がないため更新しない。
- rollbackは未接続の4file追加差分を戻す。関連文書の旧方針はbilling-lifecycle-uiをHistoricalと明示し、FUT-0051を現行LWWへ置換した。これは製品移行の得点とはしない。

### 利用者改修の再review・closeout（2026-09-15）

- review基準: local branch codex/standard-crud-alignment、HEAD 5aa1a3d8a2ef3cf98019937848876d1658ae08ecと利用者編集のCustomerBilling 2file。01-02の未接続部品工程を対象とする。
- Managerは基底のupdate eventを同名でattrs転送し、customInputの型判定・関数呼出しを基底へ委譲する。CustomInputはuseDefaultsを使用し、minへBilling.billingDateを直接渡す。利用者の製品codeへ追加修正は行っていない。
- 既存testは削除済みcomputedに依存し初回9成功・3失敗（exit 1）。test/domain/customer-billing-manager.test.mjsのharnessと期待値を更新し、実Billingとコンパイル済みtemplateで日付変更・instance差替えのminとdisabledを検証した。更新後の直接testは13/13、exit 0。
- 最終source/testに対するcoordinator実行: node --test test/domain/*.test.mjs は1,478/1,478、exit 0。初回実装時の旧証拠を最終判定へ再利用しない。
- 独立reviewにblocking指摘なし。attrsの同名event転送、基底のresolver解決、明示props優先のuseDefaults、同constructorによるcloneとBilling getter保持を静的確認した。実Vuetify defaults injection・event伝播のmount、browser/date picker、実保存・listener・Devは未検証。直接testのuseDefaultsはstubであり、そのruntime保証とはしない。
- 01-02を部品・Localとして閉じる。親SCR-01は0点、次は01-03。FUT-0191〜0193はCustomerBillingでの対応を反映し、他箇所の調査・改修を残す。仕様・ADR・manual・CHANGELOG・運用・data contractは提供画面・要件・保存形式を変更しないため更新しない。検証class・省略gate・rollbackは上記の部品工程条件を維持する。

## SCR-01-03 標準保存と画面の接続（2026-09-15、完了）

利用者が[請求詳細page](../../pages/billings/customers/[id].vue)、[CustomerBillingManager](../../components/CustomerBilling/Manager/index.vue)、[CustomInput](../../components/CustomerBilling/CustomInput.vue)の接続と表示を実装し、Codexがreview、日付消去条件、route ID、直接test、文書を整合した。

- listener由来Billing instanceを単数Managerへ渡し、通常更新は検証後に`draft.update()`へ委譲する。詳細pageの従属Customer／Site参照はpage rootの`useFetch("CustomerBillingDetail", true)`へ接続した。
- 単一動的routeのdocument IDは`route.params.id`から直接取得する。現在は請求詳細から別の請求詳細へ直接遷移する画面導線がなく、URL直入力ではpage全体が再読込みされるため、将来の経路だけを想定したpage再生成指定は設けない。実際に詳細間遷移を追加して不具合が生じた場合に、その時点の構成に合わせて解消する。
- 入金予定日の未設定化はdate inputの標準`clearable`を使う。この画面の編集dialogは利用者確認により360pxとし、480pxは全画面固定ではなく原則値として仕様・ADRを訂正した。
- 直接testは`customer-billing-manager.test.mjs` 12/12、`billing-payment-date.test.mjs` 28/28、いずれもexit 0。最終影響範囲の`node --test test/domain/*.test.mjs`は1,477/1,477、project docs checkは323 Markdown・74 ADR・13 roadmap・8 TOMLでexit 0。`git diff --check`もexit 0。
- 01-03の完了範囲は、詳細pageからlistener由来Billingを単数Managerへ接続し、日付変更・null解除を標準draft updateへ渡す製品codeと直接testまでとする。Rules境界は01-04で整合済み。標準adapterによる実保存、listenerによる保存後再表示、browserの日付変更・消去は01-06で確認する。旧専用component・Callable等は01-05の撤去対象として残り、親SCR-01は未完了である。

## SCR-01-04 Billings Rulesの整合（2026-09-15、完了）

[Billings Rules](../../firestore.rules)のclient write全面拒否を、既存documentのupdateだけを許可する境界へ変更した。

- 許可条件は、認証済みで、確認済みメールと会社IDを持ち、その会社に存在する有効な本登録Userであること、保存後の`uid`が操作した本人であること。会社管理者、一般User、role、super-userの区分では分けない。
- createとdeleteはSCR-01の提供範囲外なので拒否を維持する。Billings配下のnested documentも許可せず、既存のCompanies fallback除外を維持する。
- 親Customer／Site／Employeeの存在、日付の前後、status、operationResults、field一覧・型・長さはRulesで検査しない。通常schemaと業務条件はBilling classとManagerの保存境界が担う。背景FunctionsはAdmin SDKを使うためRulesの対象外であり、既存writerは変更していない。
- Local Emulatorでは、役割なし・会社管理者・経理role・super-userの同一tenant update、親Customer／Site不存在、Rulesが通常schemaを検査しないことを確認した。未認証、メール未確認・claim不正、User不存在・不完全、仮登録・disabled、User所属不一致、他tenant、更新者ID偽装、create、delete、nested accessは拒否された。`npm run test:local`は初回に旧全面拒否期待1件を検出し、期待値を新契約へ直した再実行で180/180、exit 0。
- 静的Rules contract testは、明示update条件とcreate/delete拒否、親・schema・日付検査を持たないことを確認した。独立security reviewにblocking指摘はない。同一tenantの有効UserがSDKから通常fieldを変更できることは、通常業務dataをclassで検証する承認済み境界として受容する。
- data shapeと既存dataは変更せず、migrationは不要。rollbackはBillings matchと対応testをclient write全面拒否へ戻し、01-03のclient接続と片側だけを公開しない。実画面からのadapter保存・listener再表示、旧Callable撤去、Dev反映は01-05〜07で確認するため、親SCR-01は未完了である。

## SCR-01-05 旧専用経路の撤去（2026-09-15、完了）

正規詳細画面から到達しなくなった旧入金予定日専用経路を、参照元と公開exportを確認してLocal sourceから撤去した。

- 撤去した製品sourceは旧`PaymentDateEditor`、`useBillingPaymentDate`、client/serverの`billingPaymentContract`、`updateBillingPaymentDate`のAPIとmodule。`functions/apis/index.js`のexportも削除し、Codex用Functions entrypointの公開期待から外した。
- 旧専用経路だけを検証していたclient/server contract同値比較test、transaction・expected比較・独自再読込・競合stateのtestを撤去した。`billing-payment-date.test.mjs`には現行pageがlistener由来Billingを標準Managerへ接続するcompile/source確認を残した。
- Local harnessのEMP05-Cは、旧Callableによる期日変更、stale expected拒否、null保存だけを外した。OperationResultから請求・勤怠・勤務回数・履歴を作る背景処理、raw値保持、Billingsを含むRulesの許可・拒否確認は維持した。背景Billing writer、PDF、日付validation、現行Manager／入力、Rulesは変更していない。
- 残存参照は、現在も使用する`paymentDueDateAt` field、背景集計、PDF、現行Manager testのほか、旧経路を時点付きで説明する履歴文書である。削除対象sourceへの現行Markdown linkは本書とroadmapから除いた。
- remoteのFunction実在状態と削除は未確認・未実施。Devへ以前公開済みと記録された`updateBillingPaymentDate`を01-07の撤去対象とし、固定releaseでclient／Rulesと合わせて扱う。data shape、schema、package、実data、migration、deployは変更していない。
- rollbackは、撤去したcomponent、composable、contract、API、module、exportと対応testを同じGit差分から復元する。公開済み構成へ戻す場合は01-03のManager接続と01-04のRulesも整合した単位で判断し、旧経路だけを正規pageへ部分的に戻さない。
- 変更classはapplication-logicとproject-guidance-metadata。直接testと最終completion gateは実行結果をcheckpoint報告へ記録する。標準adapterの実保存、listener再表示、失敗表示、背景writerとの統合、独立reviewは01-06、remote撤去とDev受入れは01-07の未検証範囲である。

## SCR-01-06 自動検証とLocal画面確認（2026-09-15、完了）

01-02〜05を組み合わせたLocal実装について、会社管理者で実画面を操作し、自動testで保存内容・Rules・背景writerを確認した。

- 利用者が起動したimport-only Emulator、local server、Chromeをそのまま使用した。請求詳細で編集dialogの表示、取消時に変更がないこと、入金予定日の変更後にlistenerで自動反映されること、再読込後も値が残ることを確認した。
- 請求日より前の日付は選択不可、請求日当日は選択・保存可能だった。日付を消去して`未設定`へ保存し、再読込後も維持されることを確認した。確認後は元の入金予定日へ戻し、再読込後の復元を確認した。請求額等の他の値と稼働実績行は操作前後で変わらなかった。
- `customer-billing-manager.test.mjs`、`billing-payment-date.test.mjs`、`codex-local-harness.test.mjs`を現行契約へ揃え、Billing全体のserialization、日付と派生年月、listener反映、取消・失敗・loading、背景集計後の日付保持、認証・tenant境界を覆った。対象domain testは15/15、構文確認はexit 0。Local Emulator suiteは180/180、exit 0。
- Local Emulator suiteの初回実行では、新しい許可確認fixtureが標準保存で必須の`uid`と`updatedAt`を含まず1件失敗した。製品不具合ではなくtest入力の不足であり、標準adapter相当の管理fieldを含めて再実行した。
- browserで実際のbackend停止は起こしていない。保存失敗時にdialogを閉じず編集値とloading/error状態を扱う経路は自動testで確認した。remote Function、Dev、Prod、実data、package、migrationは変更・確認していない。
- user-local Emulator、server、Chromeは停止せず、Emulator dataもexportしていない。別途、loopback限定のCodex専用Emulator suiteを実行した。rollbackは01-03〜05のclient・Rules・旧Callableを整合した一組で戻す。

Local工程の完了時点では、親SCR-01はDev受入れまで0点を維持し、01-07で固定releaseのDev反映、remote旧Function撤去、画面受入れを行う計画としていた。反映結果と残る受入れは次節を正とする。

## SCR-01-07 Dev反映と受入れ（2026-09-15、完了）

release commit `19e44c96141202f0a4ae0bde48f27ea4e74bf797`を`air-guard-v2-dev`へGitHub Actionsで反映した。selectorは`firestore,functions,hosting`を選び、Dev Hosting artifact生成、Firestore／Hostingのdry-runとdeploy、`asia-northeast1`の旧Callable `updateBillingPaymentDate`削除が成功した。反映後のread-only確認では47 Functionsが残り、撤去対象名は存在しなかった。Hosting rootもHTTP 200を返した。

このreleaseにdata migration、既存documentの変更、backup、maintenanceはない。失敗時は既知の変更前source `048e44e9cfd4ca887ec328e7e835c291579e68af`を基準に、旧Function・source・Rules・Hostingを一組で復元する別承認のcorrective releaseを行う。data rollbackは不要である。一時的なFunction削除stepはcleanup commit `ed2887af3760af70017115fa79868157a08d2fe4`で通常workflowへ戻し、後続ActionsではFirebase対象なしとしてdeploy jobがskipされた。利用者LocalのChrome、Emulator、serverには触れていない。

remote反映とpost-checkの詳細は[SCR-01 Dev release記録](../verification/scr-01-billing-payment-date-dev.md)を正とする。Devの会社管理者画面で、入金予定日の変更、listenerによる反映、再読込後の維持、未設定への解除、元の値への復元を確認した。請求額等の他の表示値と画面配置に異常はなかった。請求日より前の日付は入力部品の最小日付により選択できず、保存側の検証も自動testで確認済みである。実際のbackend停止は試していないが、利用者判断により失敗経路は自動test成功を採用し、backend停止時の画面表示は完了条件から外した。これによりSCR-01-07と親SCR-01を完了する。

## 2026-09-15仕様回答の反映と残作業

保存方式と画面別lock条件は[現行仕様](../specification.md#標準crudと後続処理)・[画面別操作表](../specification.md#稼働実績ロックと画面別操作)で確定した。今回の文書変更で製品code・Rules・dataは切り替えていない。以下の確認日付き実装記録を移行済みと読み替えない。

- 請求の保存・確定後の訂正削除、ロックの設定解除、実績化に残る専用経路を標準Manager／Classへ合わせる。稼働請求管理から元の実績を削除する操作は追加しない。
- 実績lockの画面別制約と、現在のRules・クラスhook・Managerの一律拒否条件を照合し、経理側の編集が標準CRUDで成立するよう対象実装工程で揃える。
- 配置通知は既存schedule.notify()でdocumentを作成し、作成・状態変更TriggerがNotificationsを生成、別TriggerがFCM送信と結果記録を行う。標準クラスへの接続整理で後段を撤去しない。
- 実績の作成・更新・削除から請求・勤怠等への既存Triggerを維持し、保存成功と後続処理完了を分けて検証する。
- 2026-09-16訂正: Employee退職・誤退職訂正は既存Callableを維持する例外とし、業務状態更新とAuth変更の別経路化を要求しない。その他のmaster経路は各工程の合意済み範囲で確認する。今回の仕様承認をAuth処理の削除や実装着手・外部操作の承認へ拡張しない。

## 確認済み実装事実（2026-09-14の記録）

1. 現場稼働予定の単数・複数Managerは09で`AirItemManager`／`AirArrayManager`へ戻し、`SiteOperationSchedule` modelの作成・更新・削除を使う。請求には`OperationManager`／`OperationArrayManager`と`saveOperation`が残る。
2. 予定の配置作業員は09で親`SiteOperationSchedule` modelの追加・変更・削除と`update()`へ戻した。実績詳細の作業員は07で通常client保存へ移行済みである。稼働外売上はSCR-05で標準`ArticleDetailsManager`へ接続した。
3. 過去実装では作業員配列を`WorkersManager`／`AirArrayManager`の`v-model`で編集し、submit完了時に親`OperationResult.update()`を実行していた。直近実装で追加された`useOperationResultWriter`とEmployee存在確認transactionはこの復元経路に不要であり、FGA-06-RESULT-CALLABLE-RESTORE-07で撤去した。
4. （履歴）`functions/shared/operationWriteContract.js`は旧時点で`agreement`、`adjusted`、`lock`等を含む一つのcommand契約へ集約していた。SCR-05後の現行Functions契約は`schedule`／`result`の標準操作と通知の残存経路に限定し、稼働請求専用actionは受け付けない。
5. `functions/modules/operations/saveOperation.js`には予定commandとSite `scheduleRevision`処理が互換用に残るが、09の正規予定画面からは到達しない。SCR-05後は稼働請求の取極め・調整・lockをこのserver入口へ接続しない。
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
- （2026-09-16時点の記録）対象test 36/36件、全domain 1,434/1,434件、buildはexit status 0。補正版commit `12f05e5a`をGitHub ActionsでHostingへDev再反映した。当時は配置管理・上下番確定処理そのものの再受入れが未実施だった。2026-09-17の利用者報告により、上下番確定処理のSCR-02重複範囲は解消済みであり、配置管理の受入れだけが現行の残存範囲である。

## SCR-05 稼働請求・実績lock・稼働外売上 prelocal実装（2026-09-16）

- 稼働請求詳細の基本情報・取極め・請求明細は標準`OperationBillingManager`へ接続し、稼働外売上は標準`ArticleDetailsManager`を使う`OperationArticlesManager`へ移行した。子配列の追加・更新・削除は親documentのcloneへ反映して`OperationBilling`／`OperationResult.update()`で保存する。
- `OperationResult`はlock中のUI編集を拒否し、`OperationBilling`はlock中も請求編集を許可する。稼働請求の作成・削除は引き続きUIで提供しない。article行の`ArticleDetail`／`articleId`形状と既存の表示・入力・取消・保存失敗時の入力保持を維持する前提である。
- 旧`OperationManager`、`OperationArrayManager`、`OperationRowsManager`、`OperationEditor`、`useOperationEditor`は正規callerがなくなったため撤去した。`saveOperation`のFunctions契約・dispatchから稼働請求専用の`overview`／`articles`／`agreement`／`adjusted`／`lock`経路と、正規callerのない実績`articles`経路を外し、予定・実績の残存操作と複製・通知経路は維持した。`saveOperation`本体とentrypointは、残存する予定・実績commandのため維持する。
- RulesはOperationResultsの同一tenant境界と、OperationBillingのlock中updateを妨げない境界へ整合した。OperationResultのlock拒否はSchema／UI側で維持する。
- OperationBillingの標準updateは、installed ClientAdapterの実在する`runTransaction`／`fetchDoc({ transaction })`／`update({ transaction })` APIを使い、Siteのlive agreement readとOperationResults writeを同一transactionへ渡す。OperationResultの通常更新は既存の標準update経路を維持する。runtime／Emulatorでの同時変更受入れは未確認である。
- 状態はprelocal実装・検証待ち。schema、data shape、migration、既存data一括変更、remote、Local Emulator、build、Dev／Prodは未確認であり、SCR-05の得点は0のままとする。

## 未確認事項

- Prod、migration、既存data全件、remote派生document全件は確認していない。Devでは作業員を持つ合成実績について作業員CRUDと実績物理削除を確認し、Triggerログにerrorがないことを確認したが、派生document全件は直接列挙していない。
- 最終Local検証は全domain 1446/1446件、Local Emulator 179/179件、固定製品commitの専用UI buildを終了コード0で確認した。[Local検証記録](../verification/fga-06-result-callable-restore-local.md)を参照する。
