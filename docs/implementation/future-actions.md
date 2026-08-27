# 将来要対応事項

- 状態: 実装調査から得た暫定バックログ
- 最終更新日: 2026-08-25
- 対象: `docs/implementation/` の調査で確認したバグ、見落とし、セキュリティ・データ整合性・回帰リスク、仕様矛盾、未使用・未到達候補、テスト不足

この文書は確認済み仕様の正本ではない。実装調査で得た事実、仮説、判断待ちを分離し、将来の仕様化・修正・検証候補を累積する。同一原因は既存項目へ証拠を追記し、修正済みの場合も履歴として `Resolved` にする。

## 2026-08-12 調査統合

[2026-08-12 source review統合記録](review-reconciliation-2026-08-12.md)で、認証・Rules・Functions、schema/base/adapters、共通UI、Admin SDKを再照合した。既存原因はFUT-0003、FUT-0004、FUT-0008〜0012、FUT-0018〜0031、FUT-0045〜0052、FUT-0080〜0084、FUT-0090、FUT-0105〜0109、FUT-0113〜0117、FUT-0136〜0153、FUT-0160、FUT-0165〜0167へ統合した。独立した未登録原因だけFUT-0177〜FUT-0183として追加した。

確認済みの主な追加証拠は、verified email前のinvitation takeover、偽造User doc IDからglobal Authへの作用、cross-tenant SecurityReport object操作、unauthenticated history rebuild、locked OperationResultのmodel/Rules/UI bypass、full-set/upsertとprocess-global adapter/config、通知token log、UI managerのdisabled非強制、限定的で平文のAdmin backup/restoreである。runtime・remote・実dataでの発生頻度は未確認のまま保持する。

## FUT-0001 ページアクセスをfail-closedへ変更する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-001、SPEC-SEG-002、SPEC-DEEP-004、SPEC-DEEP-005
- 対象ファイル・シンボル: `middleware/auth.global.js`、`utils/pageSettings.js` の `getPageConfig`・`isPageAllowed`
- 確認済み実装事実: ミドルウェアは設定なしを許可する分岐を持つ。さらに `getPageConfig` は未登録パスを親へ遡り、公開設定の `/` を返し得る。ユーザーは実在ページの設定漏れを許可する挙動は望ましくなく、将来fail-closedへ修正すべきと回答した。2026-08-11に、route一覧と照合し、実在する未設定pageは設定漏れ専用error、存在しないURLは404とする方針を承認した。
- 想定影響と発生条件: 未認証Userが設定漏れの実在ページ、または親探索で公開設定を得るパスへ到達した場合、画面側・Rules側の防御だけに依存する。画面表示だけでデータ保護したとみなせないが、不要な機能露出や二次的アクセスの入口になり得る。
- 未確認点・仮説: route一覧を取得・照合する具体的な実装方法、親権限継承が必要な深いroute、各ページのRules保護は未確認。
- 推奨する将来対応: 承認済みのroute一覧照合と専用error/404分離を実装し、親継承規則を仕様化する。任意pathが `/` を継承しないlookupへ変更する。
- 必要なテスト: 未認証・認証済み・メール未確認・各roleについて、実在設定済み、実在設定漏れ、動的route、深い子route、404、maintenanceのtable-driven route guard test。
- ユーザー判断が必要な事項: 親設定を継承できるrouteの条件。

## FUT-0002 ページファイルとpageSettingsの不一致を解消・自動検出する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-002、SPEC-DEEP-004
- 対象ファイル・シンボル: `utils/pageSettings.js`、`pages/auth/reset-password.vue`、`pages/maintenance.vue`、`pages/test/user-permission-info.vue`、`pages/unconfirmedEmail.vue`、設定path `/settings/user`
- 確認済み実装事実: 実在4ページに完全一致設定がなく、`/settings/user` は設定だけが存在する。開発時validationはファイルとの対応を検査しない。2026-08-11に、route一覧との機械照合により実在する未設定pageを専用errorにし、存在しないURLを404にする方針が承認された。
- 想定影響と発生条件: fail-closed化時に4ページが利用不能になる。現状はroot公開設定を継承し、意図しない公開扱いになり得る。stale設定はnavigationや親判定の誤動作要因になる。
- 未確認点・仮説: 4ページの期待role、`/settings/user` が旧設定か将来設定かは未確定。
- 推奨する将来対応: 各ページの公開・role要件を確定して明示登録し、stale設定を削除または用途明記する。ファイルrouteと設定pathを機械照合する。
- 必要なテスト: 設定漏れ、対応ファイルなし、重複path、動的segment、末尾slashの静的整合test。
- ユーザー判断が必要な事項: 4ページのaccess要件と `/settings/user` の扱い。

## FUT-0003 認証初期化の処理完了と利用可能状態を分離する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-003、SPEC-SEG-004、SPEC-DEEP-005、SPEC-DEEP-006
- 対象ファイル・シンボル: `composables/application/auth/useAuthActions.js` の `setUser`・`initializeSession`、`stores/useAuthStore.js` の `isReady`
- 確認済み実装事実: UID・claims設定後のUser fetch、Company fetch、購読で例外が伝播しても `setUser` はlogger記録後に吸収し、finallyで `isReady = true` にする。FCM登録は完了をawaitするが、`registFCMToken` が例外を内部吸収するためセッション失敗としては伝播しない。2026-08-11に、`isReady` は認証初期化処理の終了を意味し、FCM失敗時はlogだけを残してloginを継続する方針が承認された。
- 想定影響と発生条件: User/Company取得・購読失敗時、partial stateでmiddlewareが再開し、表示・権限・tenant状態が不完全なまま利用可能に見える可能性がある。
- 未確認点・仮説: User・Company失敗時の利用可能範囲、model操作の例外条件、UIのerror表示は未確認。
- 推奨する将来対応: auth observer処理完了、基本session利用可能、通知登録状態、初期化errorを別状態として定義し、failure時の遷移・retryを仕様化する。
- 必要なテスト: token claim、User fetch、Company fetch、各subscribe失敗と復旧、middleware timeout、FCM登録失敗を個別に注入する結合test。
- ユーザー判断が必要な事項: User・Company初期化failure時に利用を止める範囲。

SPEC-DEEP-040追加根拠: `composables/application/auth/useAuthActions.js` の `setUser` はUser/Company取得・購読開始の失敗をcatchした後も必ず `isReady=true` にする。missing companyId時は認証状態を維持したままmodelをclearし、prefixを `Companies/unknown` にするため、処理終了と利用可能状態が区別されていない。

## FUT-0004 User切替時の購読置換を保証する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-003、SPEC-DEEP-005、SPEC-DEEP-006
- 対象ファイル・シンボル: `useAuthActions.initializeSession`、User/Company modelの `subscribe`・`unsubscribe`
- 確認済み実装事実: 未認証状態を挟まないUser AからUser Bへの初期化冒頭では、既存User・Company購読を明示解除せず新しいsubscribeを呼ぶ。2026-08-11に、User切替は必ずsign-outを挟む方針が承認された。
- 想定影響と発生条件: model側が既存listenerを置換しない場合、旧tenant/Userのlistener残存、重複更新、情報混在、購読リークが起こり得る。
- 未確認点・仮説: modelのsubscribeが既存購読を自動解除する可能性があり、現時点でbugとは断定しない。
- 推奨する将来対応: sign-outを経ないUser切替を許可しない境界を実装・検証し、sign-out時に旧購読が確実に解除されることを確認する。
- 必要なテスト: 未認証を挟まないUser/会社切替、rapid auth callback、listener件数、旧document更新が新sessionへ反映されないこと。
- ユーザー判断が必要な事項: なし。

SPEC-DEEP-040追加根拠: application auth actionのsign-outはstore session cleanupを待つが、FCM token documentの削除・端末sessionとの切離しは行わない。

## FUT-0005 サインアウト完了条件へmodel cleanupを含める

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-003、SPEC-DEEP-005
- 対象ファイル・シンボル: `useAuthActions.clearSession`・`signOut`、`useAuthStore.waitUntilSessionCleared`
- 確認済み実装事実: clearSessionはauth scalarを先に初期化してからUser/Company unsubscribe・initializeを行う。後段例外はsetUserが吸収し、待機条件 `uid === null && isReady` はmodel cleanup失敗でも成立し得る。2026-08-11に、cleanup失敗時は強制reloadする方針が承認された。2026-08-15のlocal Emulator・Chrome検証では、旧管理者のsign-outから新管理者のsign-inへ移る間にFirestore listener由来のpermission-deniedが2件発生したが、新管理者の管理者menu、User一覧、管理者移譲dialogの利用に影響せず、その後は再発しなかった。2026-08-24のEmployee詳細からのsign-outでも3件を再現し、`signOut`がAuth sessionを先に解除し、認証observerによる`clearSession`と画面遷移・page listener unmountが後続する現在の順序をrepositoryで確認した。
- 想定影響と発生条件: unsubscribe/initializeがthrowした場合、signOut呼出し側は成功と判断しても旧model stateまたはlistenerが残る可能性がある。
- 未確認点・仮説: model cleanupが実際にthrowするか、初期化が部分適用されるかは未確認。Auth解除後もpage固有・User・Companyのどのlistenerが各errorを出したかはpath単位で特定しておらず、共通の購読終了順序を変更する前に計測が必要である。
- 推奨する将来対応: cleanup完了状態・errorを待機条件へ含め、失敗時はlog後に強制reloadする。
- 必要なテスト: unsubscribe/initialize各failure、二重signOut、timeout、旧listener残存確認。sign-out時のAuth状態変更・User/Company unsubscribe・Firestore listener errorの順序を計測し、正常な画面遷移を維持したままpermission-deniedが解消されることを確認する。
- ユーザー判断が必要な事項: なし。

## FUT-0006 通知クリックを安全なpayload遷移と既存client再利用へ変更する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-004、SPEC-SEG-005
- 対象ファイル・シンボル: `service-worker/sw.js` の `notificationclick`、配置通知producerのdata payload
- 確認済み実装事実: serverはtype、arrangement notification ID、site ID、shift typeをdataへ入れるが、Service Workerはdataを参照せず常に `clients.openWindow("/")` を実行する。既存clientの検索・focusもない。
- 想定影響と発生条件: 通知クリックが対象業務へ遷移せず、アプリが開いていても重複tabを作り得る。
- 未確認点・仮説: notification typeごとの具体的な固定route、Firebase SDKのclick handlerとの競合は未確認。
- 推奨する将来対応: app側のnotification type別固定route allowlistを実装し、payload任意URLを拒否する。権限不足・不明通知はdashboardへfallbackし、既存clientをfocus/navigate、存在しなければopenWindowする。SDK listener順を確認する。
- 必要なテスト: app open/closed、複数tab、無効・外部URL payload、権限なし、各配置status、SDK click競合。
- ユーザー判断が必要な事項: notification typeごとの具体的な固定route一覧。

## FUT-0007 FCM client listenerと表示の重複を検証・cleanupする

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-004、SPEC-SEG-005、SPEC-DEEP-006
- 対象ファイル・シンボル: `plugins/08.firebase-messaging.client.js` の `onMessage`、`service-worker/sw.js` のFirebase Messaging初期化・click listener
- 確認済み実装事実: foregroundはonMessageから明示showNotificationし、backgroundはFirebase Messagingへ委譲する。onMessage解除関数は保持しない。独自click listenerはSDK初期化後に登録される。
- 想定影響と発生条件: HMR/plugin再実行やSDK handler競合、payload形式によってlistener・表示・遷移が重複する可能性がある。
- 未確認点・仮説: 通常起動でpluginが一度だけなら問題がない可能性がある。SDK内部のhandler順は未確認。
- 推奨する将来対応: foregroundはapp内通知だけ、background・app非表示時はOS通知だけとする。listener lifetimeを明示してcleanup可能にし、SDK公式契約に合わせてhandler登録順を統一する。将来、重大通知だけforeground OS通知を選択可能にする拡張余地を保つ。
- 必要なテスト: foreground/background、notification/data-only、HMR、worker update、clickの組合せmatrix。
- ユーザー判断が必要な事項: 重大通知として扱うnotification typeと、foreground OS通知を選択可能にする時期。

## FUT-0008 FCM token lifecycleと登録失敗の再試行を設計する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-003、SPEC-SEG-004、SPEC-SEG-005、SPEC-DEEP-035
- 対象ファイル・シンボル: `plugins/08.firebase-messaging.client.js` のService Worker初期化、`composables/useNotification.js` のpermission・`registFCMToken`、`FcmToken`、server invalid-token cleanup
- 確認済み実装事実: permission stateはcomposableごとのrefで自動refreshしない。ログイン後にpermissionを許可してもtoken登録を自動再実行しない。clientにdeleteToken・token refresh監視・FcmToken削除呼出しはない。serverは送信時無効tokenとAuth User削除時tokenを削除する。SPEC-DEEP-035で、User設定componentのpermission request/token登録にlocal loading、single-flight、error/retry表示がなく、denied時の回復案内もないことを確認した。2026-08-25の起動停止調査では、async pluginが`navigator.serviceWorker.register()`と通知許可済み時の`navigator.serviceWorker.ready`をapp-level timeoutなしでawaitし、認証初期化も`serviceWorker.ready`、`getToken()`、FcmToken writeを有限時間で打ち切らないことを確認した。Promiseがrejectせずpendingのままならcatchへ到達しない。
- 想定影響と発生条件: 後から許可した端末が未登録、token rotation後の旧token残存、sign-out後も最後の所有情報が残る、登録失敗が利用者に見えず通知欠落となる可能性がある。Service WorkerまたはMessaging SDKがpendingのままになると、任意機能である通知準備がNuxt mountまたは認証readyを止め、起動templateの固定や初期navigation失敗として現れ得る。
- 未確認点・仮説: Firebase SDKのrotation契約、他UIからの再登録呼出し、server cleanup頻度は未確認。
- 推奨する将来対応: tokenを現在login中Userだけに紐付け、sign-out時にFirestore紐付けを削除し、次回login時に再取得・再登録する。permission grant、rotation、browser data消去、登録失敗ごとのretryを追加設計する。通知初期化はapp mountと基本認証readyの必須条件から外し、mount後の非blocking処理へ移して有限timeout・状態・明示retryを持たせる。Service Workerの自動登録と手動登録の正を一本化する。invalid token最終削除はserver送信処理、Auth User削除時は関連token削除とし、定期orphan token検査を追加する。
- 必要なテスト: permission default/denied/granted遷移、offline、getToken/create failure、rotation、複数端末、User切替、Auth削除、`serviceWorker.register`・`serviceWorker.ready`・`getToken`の永久pending時にもVue mountと基本認証readyが有限時間内に完了すること。
- ユーザー判断が必要な事項: 通知未準備のUI、登録retry回数、定期orphan token検査の間隔・保持期限。

SPEC-DEEP-039b追加根拠: client token登録はgetToken/FcmToken createを含む全errorをcatchしてrethrowせず、認証初期化callerは登録失敗を成功完了と区別できない。

## FUT-0009 tokenとUser情報をログへ出さない

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-004、SPEC-SEG-005、SPEC-DEEP-006、SPEC-DEEP-007
- 対象ファイル・シンボル: `composables/useNotification.js` のdevelopment log、`functions/modules/utils/notifications.js` のsend result・emulator・test log/response
- 確認済み実装事実: client development logはtoken全体とraw Userをlogger dataへ渡す。serverはmulticast responseをJSON化してtoken全体をconsoleへ出し、単体emulator warningもtokenを含む。未export test handlerはtokenをlogとresponseへ含める。
- 想定影響と発生条件: development/emulator/Functions logまたはtest handler有効化時に、通知送信能力に関わるtokenやUser情報がlog閲覧者・HTTP呼出し元へ露出する。
- 未確認点・仮説: loggerの保存・送信先、log retention、token単体で悪用可能な範囲は未確認。
- 推奨する将来対応: dev/prodともtoken全文・一部・token由来識別子、User document、notification payload丸ごとをlogしない。UWB-07/08 release gateの通知処理はoperationId、件数、allowlist済みdomain error codeだけに限定し、test responseからもtokenを除去する。
- 必要なテスト: log captureでraw・partial・token由来識別子、email、User属性、通知本文、custom dataが含まれないこと、error pathとemulator pathのsnapshot検査。
- ユーザー判断が必要な事項: 監視基盤導入時のlog保持期間と閲覧権限。

SPEC-DEEP-039b追加根拠: `useNotification`はdevelopment時にraw User objectとFCM token全文を`useLogger` dataへ渡し、loggerにはfield redactionがない。

## FUT-0010 FcmTokens Rulesのtenant・所有権・field検証を強化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-005
- 対象ファイル・シンボル: `firestore.rules` の `match /FcmTokens/{token}`、schemas `FcmToken`
- 確認済み実装事実: create/updateはrequest後uidとAuth UIDの一致だけを検査し、active registered Userの存在・disabled/temporary状態、companyIdの所属整合、token fieldとdocument ID一致、field allowlist、既存owner一致を検査しない。readは拒否、deleteは既存uid本人だけを許可する。
- 想定影響と発生条件: 認証済みUserがtoken document IDを知る場合、ownerを自分へ上書きし任意companyIdを設定できる。誤ったcompanyIdで別tenantの送信targetに混入・欠落する可能性がある。
- 未確認点・仮説: token IDの推測困難性、custom claimsで利用可能なcompanyId、createの既存document挙動は未確認。
- 推奨する将来対応: current Authと同じUIDのactive registered User、User/token/tenant claimのcompanyId一致、token/docId一致、field・型制限をRulesへ追加する。disabled・temporary・User不在を拒否し、client updateと別Userへのowner上書きを全面拒否する。sign-out時に旧owner documentを削除し、次回login Userは削除成功後に同tokenをcreateする。削除失敗はserver cleanup対象とする。
- 必要なテスト: 未認証、User不在、disabled、temporary、他UID、他company、全update、既存owner上書き、余分field、token不一致、旧owner delete成功後だけ許可する同device User切替のRules emulator test。
- ユーザー判断が必要な事項: なし。

## FUT-0011 FCM error分類で有効tokenを削除しない

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-005、SPEC-DEEP-007
- 対象ファイル・シンボル: `sendMulticastNotification`、`sendBatchNotifications`
- 確認済み実装事実: multicastは `messaging/invalid-argument` も無効tokenとして削除候補へ入れるが、batchはregistration-token-not-registeredとinvalid-registration-tokenだけを入れる。Notification onCreateはtitle、body、imageUrl、dataの型・長さ・許可値を検証せず、そのままmulticast payloadへ渡す。
- 想定影響と発生条件: invalid-argumentがpayload全体の不正でも返る場合、未検証Notification documentから正常なtokenを一括削除し、以後の通知が届かなくなる可能性がある。
- 未確認点・仮説: Firebase Admin SDKの当該codeがtoken固有・message固有のどちらで返るか、response単位の意味は公式仕様未確認。
- 推奨する将来対応: 公式error分類を確認し、invalid tokenはretryせずserver送信処理で削除する。一時FCM障害だけを指数backoff retryし、payload errorは送信要求のfailureとして保持する。
- 必要なテスト: malformed token、unregistered token、invalid data value、invalid image/payload、混在multicastで削除対象を検証。
- ユーザー判断が必要な事項: 不明errorを一時障害・invalid token・payload errorのどれへ分類するかの安全側規則。

## FUT-0012 通知配送を冪等・再試行可能にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-005、SPEC-DEEP-007
- 対象ファイル・シンボル: `onNotificationCreated`、`sendMulticastNotification`、Notification/Recipients status
- 確認済み実装事実: triggerはprocessing/completedの再入確認、event処理済みID、token単位checkpoint、backoffを持たない。chunk途中や結果保存途中で失敗すると既送信と未送信が混在し、catchはNotificationだけfailedへする。再実行時に送信済みtokenを除外しない。入力recipient件数に上限がなく、作成actorもNotificationへ記録されない。ArrangementNotificationはdeterministic IDで再作成でき、statusをCONFIRMED・ARRIVED・LEAVEDへ往復させるたびに新しいNotification作成triggerが動き得る。
- 想定影響と発生条件: Functionsの再実行、timeout、network error、Firestore batch failureで、重複通知、未送信、Recipients pending残留、statusと実配送の不一致が起こり得る。
- 未確認点・仮説: platform retryの実設定、FCM側deduplication、指数backoffの上限・最大試行回数は未確認。
- 推奨する将来対応: Notification ID＋recipient User IDを冪等keyとし、一時FCM障害だけ指数backoffで自動retryする。invalid tokenはretryせず削除し、手動再送はfailed recipientsだけに限定する。retry count・last error・last attemptedAtを記録する。
- 必要なテスト: chunk 1成功後chunk 2 throw、Recipients更新失敗、invalid削除失敗、final update失敗、同一event二重実行、手動retry。
- ユーザー判断が必要な事項: 自動retryの最大試行回数・backoff上限、failed recipients手動再送の実行権限。

## FUT-0013 休眠test通知handlerを除去または保護する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-005、SPEC-DEEP-007
- 対象ファイル・シンボル: `functions/modules/utils/notifications.js` のlocal `testNotification`
- 確認済み実装事実: handlerは現在exportされずdeployment exportに含まれないが、認証・認可・環境拒否がなく、queryのUser/companyへ実通知を送り、tokenをlogとresponseへ含めるコードが残る。
- 想定影響と発生条件: コメント解除やexport追加だけで外部から通知送信とtoken取得が可能なendpointになり得る。
- 未確認点・仮説: build toolが未export local handlerを登録しないことはdeployment artifactで未検証。
- 推奨する将来対応: unauthenticated HTTP test endpointを廃止する。通常検証はEmulatorとし、実機確認が必要な場合だけDEV限定Callableを用意する。CallableはApp Checkと `isSuperUser=true` を必須とし、会社adminを許可せず、送信先を呼出super-user本人または事前許可済みtest accountに限定する。rate limit・監査logを設け、PRODではexportしない。
- 必要なテスト: deployment export一覧、未認証・App Checkなし・会社admin・非DEV・PROD拒否、許可外recipient拒否、本人・許可済みtest account成功、rate limit、監査log、response/log非開示。
- ユーザー判断が必要な事項: 事前許可済みtest accountの登録・失効手順、rate limit値、監査log保持期間・閲覧権限。

## FUT-0014 batch送信の500件超切捨てを明示・修正する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-005、SPEC-DEEP-007
- 対象ファイル・シンボル: `sendBatchNotifications`、`onNotificationCreated` のRecipients/invalid-token batch
- 確認済み実装事実: messagesを `slice(0, 500)` して送るが、500件超をrejectせず、未送信件数も返さない。onNotificationCreatedもrecipient数とinvalid token数を上限検証・chunk化せず単一Firestore batchへ積む。
- 想定影響と発生条件: helperへ501件以上を渡すと後続が通知されず、呼出し側が欠落を認識できない。Notification recipientまたはinvalid tokenが500件を超えるとFirestore batch上限で配送結果保存・削除が失敗し、部分状態になり得る。
- 未確認点・仮説: 現在の呼出し元は調査範囲で見つからず、未使用helperの可能性がある。
- 推奨する将来対応: 未使用なら削除する。使用するならmulticast同様にchunk化するか、上限超過を明示errorにする。
- 必要なテスト: 0、1、500、501、1001件とchunk途中failure。
- ユーザー判断が必要な事項: batch helperの将来用途と超過時の契約。

## FUT-0015 recipient重複時の集計・token owner対応を一貫させる

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-005、SPEC-DEEP-007
- 対象ファイル・シンボル: `onNotificationCreated` の `recipientUserIds`、`tokenUserMap`、count計算
- 確認済み実装事実: tokenはSetで重複排除するがrecipientUserIdsは重複排除しない。RecipientsはuserId documentへ上書き、total/failureは元配列長、successはobjectのunique user数を使う。tokenUserMapは同tokenの最後のownerで上書きする。onCreateはrecipientUserIdsが配列か、要素が文字列User IDか、件数上限内かも検証しない。
- 想定影響と発生条件: 手動または別producerが重複recipientを保存した場合、total・failure countがRecipients実数と不一致になる。同tokenが複数ownerに現れた場合、先行ownerがfailedとなり得る。
- 未確認点・仮説: 現行producerのFirestore query結果は通常uniqueであり、実データに重複があるかは未確認。
- 推奨する将来対応: recipientを入力時に重複排除し、aggregate countをUser単位に固定する。複数端末のうち1台以上でFCM受付に成功すればUser successとし、device結果は診断情報として分離する。tokenの複数ownerはdata異常として隔離・修復する。
- 必要なテスト: 重複recipient、複数Userに同token、tokenなし混在、複数tokenの一部成功。
- ユーザー判断が必要な事項: なし。

## FUT-0016 Service Worker更新ライフサイクルを検証する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-004
- 対象ファイル・シンボル: `service-worker/sw.js` のinstall・activate、PWA登録plugin
- 確認済み実装事実: installで `self.skipWaiting()` を呼ぶがPromiseを `event.waitUntil` へ渡さない。activateは `clients.claim()` をwaitUntilする。更新通知・reload制御はない。fetch/cache責務はない。
- 想定影響と発生条件: browser lifecycle次第でskipWaiting完了がinstall event lifetimeに結び付かない、またはworker handler更新が利用者に見えない可能性がある。
- 未確認点・仮説: 実browserで問題が起きるか、PWA plugin生成物との関係は未確認。
- 推奨する将来対応: Service Worker更新検出時に案内し、User選択時に未保存入力を警告してreloadする。選択しない場合は次回app起動時に更新する。security emergencyだけ将来forced update可能にする境界を分離する。併せてskipWaiting Promiseのevent lifetimeを検証する。
- 必要なテスト: worker version更新、既存tab、複数tab、offline/online、install failure、controllerchange。
- ユーザー判断が必要な事項: security emergencyの判定主体・条件とforced update時の未保存入力扱い。

## FUT-0017 Authentication削除時token cleanup失敗を回収する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-005
- 対象ファイル・シンボル: `functions/triggers/auth.js` の `onAuthUserDeleted`、`FcmToken.deleteByUid`
- 確認済み実装事実: token削除失敗はlog後に吸収され、triggerを失敗させない。独立retry・orphan scanは確認できない。
- 想定影響と発生条件: Firestore一時障害やmodel error時、削除済みUserのtokenが残り、同UID対象queryや運用上の不要データとなる可能性がある。
- 未確認点・仮説: Authentication UID再利用可否、保持されたtokenへの実送信経路、監視alertは未確認。
- 推奨する将来対応: Auth delete token cleanupを冪等化してFunctionsで自動retryし、already absentをsuccessとする。retry上限超過をmonitoringし、定期orphan scanでも回収する。cleanup failureでAuth deletionをrollbackしない。
- 必要なテスト: delete query/delete failure、部分削除、already absent、Functions retry、retry上限、monitoring、periodic scan、複数token、Auth deletion非rollback。
- ユーザー判断が必要な事項: retry上限、定期orphan scanの間隔・保持期限、monitoring alert・閲覧権限。

## FUT-0018 ArrangementNotificationからの通知生成をrole・field・入力で制限する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-006、SPEC-DEEP-007
- 対象ファイル・シンボル: `firestore.rules` のArrangementNotifications match、`functions/triggers/arrangementNotification.js`、`createNotificationFor*Arrangement.js`、`onNotificationCreated`
- 確認済み実装事実: 同一会社の任意認証UserはArrangementNotifications全体をread/writeできる。createはshouldNotify未指定をtrueとし、updateは特定status遷移で、Admin SDKがNotificationを作る。Rulesとtriggerはactor role、許可field、本人・対象関係を検証しない。2026-08-10に、配置管理者は任意の4状態への変更と同時の資格・OJT変更を行え、OperationResult Generatorは任意状態からLEAVEDにできると承認された。両pageの実装permissionは `site-operation-schedules:read` だが、これが配置管理者の正式な認定条件かは未決である。SPEC-DEEP-014で、管理component自身にもactor/tenant/field allowlistがなく、従業員componentも渡されたnotificationの本人性を再検証しないことを確認した。onCreateもpayload型・長さ・recipient配列・件数を検証しない。
- 想定影響と発生条件: 自社の通常Userがcrafted documentまたはstatus更新を行うと、権限昇格したtriggerを通じて自社Userへの意図しない通知、spam、大量処理、任意title/body/imageUrl/dataを伴う送信を起こし得る。別会社pathはRulesで拒否される。
- 未確認点・仮説: 具体的な配置管理者role名、暫定permissionから正式authorizationへの移行方法、FCM payloadの具体的上限値は未確認。
- 推奨する将来対応: 本人は自己配置連絡の確認・到着・上番・下番に必要な時刻・statusだけ、配置管理者は同一会社内の任意status・time・qualification・OJT、Generatorは対象schedule所属通知のLEAVED化だけに制限する。その他field・notification生成はdedicated server processingへ限定する。payload field allowlist・length・array count・URL、recipient/batch上限を検証し、actor・changedAt・before/afterを監査記録する。
- 必要なテスト: 一般User・従業員本人・管理role・他社User・super-user別のRules、crafted field、status skip、shouldNotify省略、任意image/data、大量recipient、存在しないUser。
- ユーザー判断が必要な事項: authorization設計確定時の配置管理者role名、payload・recipient・batchの具体的上限値。

## FUT-0019 Notification/Recipientsのclient権限をschema契約と一致させる

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-006、SPEC-DEEP-007
- 対象ファイル・シンボル: `NotificationRecipient` schema comment、`firestore.rules` のCompanies配下fallback、Notifications/Recipients path
- 確認済み実装事実: schemaはRecipientsをFunctionsのみ作成・更新、アプリread-onlyと記載する。専用Rulesはなく、通常会社Userはread/writeとも拒否、super-userはread/writeとも許可される。Notificationも同じfallbackでsuper-userだけread/write可能である。
- 想定影響と発生条件: 通常User向け送信履歴UIを想定する場合はread不能になる。super-user clientがRecipients結果やNotification状態を改変でき、監査記録としての信頼性が低下し得る。
- 未確認点・仮説: 履歴UI、配置管理者の具体的role、法令・契約上長期保持する通知区分は未確認。
- 推奨する将来対応: Userは自分宛履歴だけ、配置管理者は同一会社の配置通知履歴・結果だけをread可能にする。client direct CRUDは禁止し、resendはdedicated server process、super-user repairはreason・audit付き専用処理へ限定する。本文・結果は原則1年後に削除または匿名集計化し、長期保持通知を別区分にする。
- 必要なテスト: 通常User本人・同社他User・管理role・他社・super-userのread/create/update/delete、Recipients改変、Notification status/count改変。
- ユーザー判断が必要な事項: 配置管理者の具体的role、長期保持通知の区分・期間、匿名集計field、削除jobの運用責任者。

## FUT-0020 User document IDとAuthentication UIDの不変条件を保護する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-006
- 対象ファイル・シンボル: `functions/apis/createAdminAccount.js`と`functions/apis/setupUserAccount.js`の管理者・本User作成、Users Rules、通知producerとFcmToken検索
- 確認済み実装事実: 管理者作成と仮Userからの本登録はAuth UIDをUser document IDにする。通知配送もrecipient User document ID = FcmToken.uidを前提とする。一方Users Rulesは同一会社Userによる任意User document ID・fieldのwriteを許可し、この不変条件を強制しない。
- 想定影響と発生条件: client writeで不正IDの本登録相当Userや通知設定を作成・変更できる場合、通知targetとAuthentication/FcmTokenの対応が崩れ、欠落・誤集計・権限データ不整合につながり得る。
- 未確認点・仮説: temporary Userの具体的identifier形式、既存mismatch件数、migration手順は未確認。
- 推奨する将来対応: registered User document ID = Auth UIDを強制し、temporary Userを別state・identifierで明確化する。conversionはserver-only、companyId・role・admin・Auth linkはgeneral client変更不可とする。company adminのrole変更もtenant・actor・field検証Callableへ限定し、migration前に既存mismatchをdetect・listする。
- 必要なテスト: temporary作成、本登録移行、任意doc ID、他User field更新、companyId/roles/通知設定改変、FcmToken照合。
- ユーザー判断が必要な事項: temporary User identifier形式、mismatch migrationの修復優先順位・停止条件。

## FUT-0021 ArrangementNotificationの状態遷移とtimestampを強制する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-007、SPEC-DEEP-038
- 対象ファイル・シンボル: schemas `ArrangementNotification.update`・`toArranged`・`toConfirmed`・`toArrived`・`toLeaved`、status enum、ArrangementNotifications Rules
- 確認済み実装事実: transition methodは現在statusを検査せず任意状態から呼べる。override updateはinstance.statusでdispatchするため事前にstatusを書き換えて任意transitionを選べ、未知statusではsilent no-opする。Rulesも任意status updateを許可する。配置管理UIは4statusをchipで選び対応methodを直接実行し、上下番確定UIは編集開始時にstatusをLEAVEDへ強制するため、順序飛ばし・逆遷移は画面から到達可能である。従業員UIはenum nextによる順方向だけを提示する。SPEC-DEEP-014で、`ArrangementNotificationChip`は未知status時にthrowし得る一方、ListItem/StatusChipは別のfallbackを使う表示契約不一致も確認した。toArrived/toLeavedは存在未確認の `confirmAt` を参照するため、通常のCONFIRMED→ARRIVED→LEAVEDでもconfirmedAtが現在日時へ上書きされ得る。enum commentとCONFIRMED.prevも矛盾する。
- 想定影響と発生条件: 不正順序・直接write・取消し操作でstatusとconfirmed/arrived/leaved timestampが履歴を正しく表さず、通知再送、上下番確定、監査・稼働実績の誤判定につながり得る。
- 未確認点・仮説: append-only historyの保存先・保持期間、配置管理者の具体的role、manager resend UIは未確認。
- 推奨する将来対応: 配置管理者の同一会社内任意status/time/qualification/OJT変更と、Generatorの対象schedule所属通知だけのLEAVED強制を許可する。本人は自己配置連絡の確認・到着・上番・下番に必要な時刻・statusだけに制限する。transition historyはappend-onlyとし、過去確定時刻を消去・上書きせず、correctionのbefore・after・actor・reasonを記録する。reverseや同status再進行では自動再送せず、manager reason付きexplicit resendだけを許可し、User forwardとmanager correctionをaudit上区別する。`confirmAt`を正しいfieldへ修正し、未知statusを拒否する。
- 必要なテスト: 全状態×全transition、直接status write、concurrent update、逆遷移、timestamp保持・reset、未知status、通知発火回数。
- ユーザー判断が必要な事項: authorization設計確定時の配置管理者role名、append-only historyの保持期間、explicit resendの権限・理由区分。

## FUT-0022 ArrangementNotificationの実勤務日時・休憩計算を修正する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-007
- 対象ファイル・シンボル: `actualStartAt`、`actualEndAt`、`totalWorkMinutes`、`actualIsStartNextDay`、3transitionのactual field設定、`toLeaved` timeOptions
- 確認済み実装事実: actual日時はactualIsStartNextDayではなく予定isStartNextDayを使い、終了跨日はactual時刻ではなく予定isSpansNextDayを使う。従業員下番UIと上下番確定UIはactualStartTime、actualIsStartNextDay、actualEndTime、actualBreakMinutesをinstanceへ直接結線してから引数なしでtoLeavedを呼ぶため、timeOptions未使用は現在のUIでは入力喪失の直接原因ではないが、入力したactualIsStartNextDayは日時計算へ反映されない。toArranged/toConfirmed/toArrivedはactualBreakMinutesを予定breakMinutesではなく60へ固定し、配置管理UIからこれらのstatusを選んだ場合にも同じ上書きが起こる。SPEC-DEEP-038では配置Tagだけがactual時刻を`||`で予定へfallbackし、資格・OJTで用いるnullish実効値契約と異なることを確認した。
- 想定影響と発生条件: 実開始・終了が予定と異なる日跨ぎ、翌日開始、休憩変更の場合、totalWorkMinutesが誤り、稼働実績・勤怠・請求へ不正な時間が連携される可能性がある。
- 未確認点・仮説: datetime/break validationの具体的許容範囲、scheduled/actual breakの保存field・migrationは未確認。
- 推奨する将来対応: base dateをschedule dateとし、`actualIsStartNextDay`を明示する。end <= startは翌日とする。actual値を優先し、scheduled値はfallback/defaultだけに使う。breakはactual入力・確認値とし、固定60分を自動確定せずscheduled defaultだけにする。scheduled/actual breakを別保持し、保存前に日跨ぎを含むdatetime・breakを検証する。
- 必要なテスト: 同日、夜勤跨日、翌日開始、実時刻だけ跨日、0/任意休憩、取消し再遷移、OperationResult・Attendanceへの連携。
- ユーザー判断が必要な事項: datetime/break validationの具体的上限・許容規則、既存data migration。

## FUT-0023 ArrangementNotification直接削除によるschedule flag不整合を防ぐ

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-007
- 対象ファイル・シンボル: ArrangementNotifications Rules、`ArrangementNotification.delete`継承、`SiteOperationSchedule.notify`・update・delete、onDelete不存在
- 確認済み実装事実: 正規のworker除外・schedule削除経路はtransactionでhasNotificationを戻しnotificationを削除する。一方Rulesは同一会社の任意認証Userによる直接deleteを許可し、ArrangementNotification onDelete triggerはなく、schedule側flagを戻さない。notifyはhasNotificationがfalseのworkerだけを作成対象にする。
- 想定影響と発生条件: notificationだけを直接削除するとscheduleは通知済みのままとなり、再通知・再作成が行われず、表示と実documentが不一致になる可能性がある。
- 未確認点・仮説: 確認した2つのUI managerはdelete handlerをthrowしbuttonも隠し、検索した画面経路に直接delete呼出しはなかった。基底managerがexposeするtoDeleteの外部ref利用と、直接SDK writeは未確認。
- 推奨する将来対応: client direct deleteを禁止する。unsent・unconfirmedだけをschedule edit内で除去できるようにし、sent・confirmed・arrived以降はcancel state/historyを残す。schedule変更・削除とnotification cancelはatomicまたはdedicated server processで同期する。取消通知はmanagerのexplicit action、repairは監査付きadmin processに限定する。
- 必要なテスト: 正規worker除外、schedule削除、直接delete拒否、transaction failure、既存不整合repair、再通知。
- ユーザー判断が必要な事項: cancel stateの具体的status・保持期間、explicit cancellation noticeの権限・理由区分。

## FUT-0024 notify transaction失敗時のclient instance rollbackを保証する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-007
- 対象ファイル・シンボル: schemas `SiteOperationSchedule.notify` のbackup・transaction・catch
- 確認済み実装事実: notifyはlocal instanceの全worker flagをtrueにしてtransactionを開始し、失敗時にbackupでinitializeする。コードコメント自身がsnapshot再取得で `_beforeData` が更新され、error前状態へ戻せない場合を記載する。Firestore transaction自体はnotification createとschedule updateをまとめる。
- 想定影響と発生条件: transaction retry/失敗とonSnapshot更新が競合すると、DBは未commitでも画面instanceが通知済み表示を残し、再操作を阻害する可能性がある。
- 未確認点・仮説: adapterのtransaction中pending snapshot挙動、実際の再現性、UI reloadで回復するかは未確認。
- 推奨する将来対応: transactionへ渡すcopyと表示stateを分離し、失敗時はlocal stateをrollback後、serverの最新状態をrefetchしてerror表示する。無条件自動retryはせず、refresh後に利用者が明示retryする。
- 必要なテスト: create失敗、schedule update失敗、transaction retry、onSnapshot介入、複数worker一部error、local rollback、最新refetch、明示retry。
- ユーザー判断が必要な事項: なし。失敗時のrollback・refetch・明示retry方針は2026-08-11に確認済み。

## FUT-0025 ArrangementNotification UIの未使用prop・遷移APIを整理する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-008、SPEC-DEEP-030
- 対象ファイル・シンボル: `ArrangementNotification/Manager/toLeaved.vue` の `siteOperationScheduleId`、`TransitionBtn` のprev type、schema `toLeaved` のtimeOptions
- 確認済み実装事実: 従業員下番wrapperはsiteOperationScheduleIdをrequired propとして受けるがtemplate/scriptで使用しない。TransitionBtnはprevを実装するが検索した呼出し元はnextだけを使う。toLeavedのtimeOptionsを渡すUIはなく、actual値をinstanceへ直接結線する。SPEC-DEEP-014で、generic managerがcreate/delete禁止にもかかわらず外部ref向け`toCreate`/`toDelete`をexposeし、確認したcallerは`toUpdate`だけであることも追加確認した。
- 想定影響と発生条件: 保守者がpropや引数に実処理上の意味があると誤認し、変更時に不要な互換性維持や誤った結線を行う可能性がある。
- 未確認点・仮説: 将来UI用に意図的に予約されているか、公開component APIとして外部利用されるかは未確認。
- 推奨する将来対応: 未使用のreverse分岐とtimeOptionsを削除候補として整理する。`siteOperationScheduleId` propは今回の回答対象外のため、利用有無を別途確認する。
- 必要なテスト: component props/emit契約、next/prev表示、toLeaved入力引数と保存値。
- ユーザー判断が必要な事項: なし。reverse/timeOptionsは2026-08-11に削除候補と確認済み。未使用propの扱いは実装確認事項として残す。

## FUT-0026 ArrangementNotification遷移・notifyの多重実行と利用者向け失敗処理を確認する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-008
- 対象ファイル・シンボル: `ArrangementNotifications/Manager` のonUpdateHandler、`TransitionBtn`、`useSiteOperationScheduleActions.notify`、OperationResult Generatorのschedule watcher
- 確認済み実装事実: 従業員managerはtransition中にlocal/global loadingを設定するがTransitionBtnへloading/disabledを渡さない。notify actionもglobal loadingを設定するが、確認した呼出しcardのdisabled結線は未確認である。失敗は主にloggerへ渡し、従業員transitionと配置管理notifyには専用の利用者向け失敗message・retry UIがない。SPEC-DEEP-014で、下番managerとcustom inputのvalidation/loading/errorも基底managerへ委譲され、ListItemのsite cache未準備・日時欠損はplaceholder/current-time表示となることを確認した。SPEC-DEEP-030で、上下番確定の最終submitはloading中disabledになる一方、schedule Listへloading/disabledは結線されず処理中も選択変更できること、async watcherが以前の非null scheduleを先にunsubscribeせず取消し・世代確認も持たないことを確認した。
- 想定影響と発生条件: 基底managerやglobal overlayが入力を遮断しない場合、連打・遅延・選択変更でtransitionやNotification作成が重複し、timestamp上書き、重複push、選択対象との競合が起こり得る。失敗時は利用者が成否を判断できず再操作する可能性がある。
- 未確認点・仮説: `AirItemManager`・`useBaseManager` のsubmit lockとglobal loading overlayのpointer遮断は未確認。List component自体には選択抑止がないが、overlayが実操作を遮断する可能性は残る。
- 推奨する将来対応: transition中は対象行の全操作をdisabledにし、client/server双方でduplicateを拒否する。server idempotency keyを設ける。失敗時はlocal rollback、最新refetch、error表示を行い、state＋notificationは無条件自動retryせずrefresh後の明示retryとする。
- 必要なテスト: transition/notify連打、client/server duplicate拒否、遅延中の対象変更、row-only lock、失敗時rollback/refetch/error、明示retry、offline復帰、複数tab、同一document concurrent update、idempotency key再送。
- ユーザー判断が必要な事項: なし。対象行lockと明示retry方針は2026-08-11に確認済み。

## FUT-0027 上下番確定の通知更新とOperationResult作成を再開可能にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-009、SPEC-DEEP-030
- 対象ファイル・シンボル: OperationResult Generatorのworker編集、`SiteOperationSchedule.syncToOperationResult`
- 確認済み実装事実: workerごとのArrangementNotification LEAVED更新は個別保存され、その後のOperationResult createとschedule.operationResultId updateだけが別の同一transactionで実行される。最終transaction失敗時に通知を元状態へ戻す処理はない。SPEC-DEEP-030で、Result createはschedule docIdを指定し、client adapterが存在preconditionなしのtransaction `set`を行うため、schedule linkが欠損・staleでも同一IDの既存Resultを上書きできるsource契約を確認した。developer duplicateも全snapshotをcloneし、同日・既存内容・sourceType/provenance・server専用permissionを検査しない。
- 想定影響と発生条件: Site/Agreement fetch、OperationResult validation、transaction競合・Rules等で最終確定が失敗すると、配置通知だけがLEAVEDでOperationResult未作成という部分状態が残る。
- 未確認点・仮説: 現行adapterでnotification更新をOperationResult＋schedule linkと同一transactionへ含められる範囲、sourceType/reason schema、standalone専用permission、既存data migrationは未実装・未確認である。
- 推奨する将来対応: 3pathを実装する。(1) schedule＋notificationsは可能な範囲でOperationResult作成、schedule.operationResultId、既存notification LEAVEDを同一transactionにしpushしない。(2) scheduleのみはnotificationを作らずOperationResult＋schedule linkをatomic化し、入力優先・欠損schedule fallback・no-notification sourceを記録する。(3) standaloneはOperationResultのみでreason/sourceTypeを記録する。scheduleId/sourceTypeをoptionalにし、schedule重複防止、standalone専用permission/audit、missing notification非error、存在するnotificationだけ更新を強制する。
- 必要なテスト: 3path、notification 0/1/複数、pushなし、入力優先/fallback、optional scheduleId/sourceType、schedule重複拒否、既存同一ID・stale link時の非上書き、standalone/duplicate permission・provenance・audit、transaction abort/retry、missing notification非error。
- ユーザー判断が必要な事項: 具体的sourceType語彙、standalone permission名、audit保持等の実装詳細。3path契約は2026-08-11に確認済み。

SPEC-DEEP-041追加根拠: developer duplicateのdomain APIは複数日と同日重複を許し、各Resultをrandom IDで同一transactionへcreateする。`beforeCreate`はSiteをtransaction外で再fetchして現在のcustomer/agreementを再適用するため、複製元snapshotの保持、Site変更とのread consistency、同日同内容重複を保証しない。

## FUT-0028 配置通知作成失敗時の上下番確定方針を決める

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-009
- 対象ファイル・シンボル: OperationResult GeneratorのselectedSchedule watcher、`SiteOperationSchedule.syncToOperationResult` converter
- 確認済み実装事実: 未通知workerがいる場合の `notify(false)` errorはmessage表示後に吸収され、購読と編集を続ける。sync converterはnotificationがなければ予定時刻・休憩・翌日flag・資格・OJTへfallbackし、通知全件存在やLEAVEDを検査しない。
- 想定影響と発生条件: 2026-08-10に、上下番確定は作業完了後で外部push不要、missing通知の作成に失敗しても予定値fallbackで続行してよいと承認された。`notify(false)` はshouldNotify=falseでpush生成を抑止する。
- 未確認点・仮説: 仕様判断は解決済み。fallback使用を監査上記録する必要性と、notify transactionの部分失敗可否は未確認。
- 推奨する将来対応: 承認済みfallbackとpush非送信を回帰testで固定する。監査表示が必要なら別途仕様化する。
- 必要なテスト: notify全失敗・一部欠落、購読遅延、非LEAVED通知、予定値fallback、retry後確定。
- ユーザー判断が必要な事項: なし。予定値fallback許可で解決済み。

## FUT-0029 agreementなしOperationResult確定とBilling保留を正式化する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-009
- 対象ファイル・シンボル: schemas `OperationResult._syncCustomerIdAndApplyAgreement`・`isBillable`、`OperationBilling` comment、Functions `addOperationResultToBilling`
- 確認済み実装事実: Site.getValidAgreementがnullでもOperationResult createは拒否しない。2026-08-10に、請求稼働管理から後で請求対象へする手続きがあると確認された。月次一覧は非請求実績も表示し、agreementまたはbillingDateAtを更新するとFunctionsが非請求→請求を検出してBillingへ追加する。`allowEmptyAgreement` はOperationBillingのproperty commentにだけ存在し、field・処理はない。
- 想定影響と発生条件: 取極め未登録のまま実績が確定されるとBillingは作られない。後から取極めを追加してもOperationResultが更新されなければ請求へ自動反映されない可能性がある。古いcommentは実契約を誤認させる。
- 未確認点・仮説: Functions失敗時の再調整運用と未請求検知は未確認。
- 推奨する将来対応: 後日回復手続きの回帰testを追加し、allowEmptyAgreementの古いcommentを実契約へ合わせる。
- 必要なテスト: agreementなし確定、後日agreement追加、再同期、isBillable true/false、未請求一覧・alert。
- ユーザー判断が必要な事項: なし。2026-08-11に取極めなしでも請求日・単価・数量等を個別設定して請求対象にする方針が確認された。

## FUT-0030 OperationResult後続triggerの部分成功と再試行を検証する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-009、SPEC-SEG-050、SPEC-DEEP-002、SPEC-DEEP-003、SPEC-DEEP-030
- 対象ファイル・シンボル: `functions/triggers/operationResult.js` のonOperationResultChangeと4後続module入口
- 確認済み実装事実: OperationResult commit後の`onOperationResultChange`でBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoriesを直列awaitする。deleteでは別exportの`onOperationResultDeleted`も独立発火し、Storage削除後にlinked scheduleを物理deleteする。2 trigger間の順序・共通transaction・成功統合はなく、各内部の途中errorは後段を止めてthrowする。client successはtrigger完了を待たない。SPEC-DEEP-030では詳細画面の基本・worker・article保存が別々のResult全体updateで、それぞれ同じ後続trigger chainを起動することを確認した。
- 想定影響と発生条件: delete後にprojectionだけstale、またはStorage/scheduleだけ残る部分状態が可能である。source削除後はbefore key/scheduleIdを保持するledgerがなく、後日repair対象を完全に再構成できない場合がある。
- 未確認点・仮説: 各projectionのsync status schema、retry上限、業務影響warning条件、reconciliation scheduleは未確認。
- 推奨する将来対応: 4 projectionとStorage/schedule cleanupを冪等化して自動retryし、OperationResult単位のprojection別sync statusとdelete前target metadataを保持する。retry exhaustedをmonitoringし、admin per-result reprocessとscheduled reconciliation/repairを提供する。primary success後のnormal Userを失敗扱いにせず、業務影響がある場合だけwarnする。repairはactor・reason・target・resultをauditする。
- 必要なテスト: 4 projectionとStorage/schedule各段階のthrow、2 trigger順序組合せ、部分保存後retry、同一event二重実行、source消失後repair、client成功後の後続失敗。
- ユーザー判断が必要な事項: retry上限、sync status値、業務影響warning条件、repair実行role、reconciliation頻度。

## FUT-0031 請求稼働管理のread/write権限境界を分離する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-010、SPEC-DEEP-012、SPEC-DEEP-022、SPEC-DEEP-029、SPEC-DEEP-030
- 対象ファイル・シンボル: pageSettingsのbillings operations設定、OperationBilling Manager・lock button、OperationResults/Billings Rules
- 確認済み実装事実: 請求一覧・詳細pageは `billings:read` だけを要求するが、詳細はagreement、billingDate、稼働概要、請求明細、lockをOperationResultへupdateできる。加えて通常のOperationResult一覧・詳細も`operation-results:read`だけでcreate/update/deleteへ到達する。component内に追加write role検査・download監査はない。Rulesは同一会社の任意認証UserへOperationResultsとBillingsのread/writeを全許可し、page permission・role・field・lock・Billing status/集計値を検査しない。2026-08-11に現在の権限制御は試作中の暫定実装で、正式分割は将来決定すると確認された。SPEC-DEEP-012でOperationBilling一覧create、detail Agreement/明細/稼働外売上、Customer Billing期日編集にpage側write guardがないことを再確認した。SPEC-DEEP-022ではPDF/CSV buttonもstatus/permissionをcomponent内で再検査しないことを確認した。SPEC-DEEP-029でOperationBillingの10componentすべてにrole/permission再検査がなく、lock buttonも即時updateすることを確認した。SPEC-DEEP-030ではOperationResultの基本・worker・Generator managerにもwrite role/field allowlistがなく、developer duplicateはUI表示条件だけでserver専用guardではないことを確認した。
- 想定影響と発生条件: readのみを意図した利用者も画面から請求対象化、請求先月移動、金額入力、lock変更へ到達し得る。直接SDK writeではBilling集計document自体の作成・改変・削除も可能である。
- 未確認点・仮説: User管理画面で設定する正式な請求permission model、閲覧・調整・lockの分割、移行時期は未決である。
- 推奨する将来対応: 現行の機能別read/write 2種を暫定実装として扱い、細分化による混乱を避けるusability検証を行って正式modelを再設計する。決定後にpage metadata、UI表示、Rulesを同じ条件へ揃える。
- 必要なテスト: read-only、請求担当、他社、super-user別の表示とOperationResult update/lock、Billing直接create/update/delete。
- ユーザー判断が必要な事項: usability検証後の正式なread/write/lock分割とBilling集計write主体。

## FUT-0032 手動Agreement適用の有効日・勤務区分整合を保証する

- 状態: Resolved
- 重大度: Low
- 発見セグメント: SPEC-SEG-010、SPEC-DEEP-022
- 対象ファイル・シンボル: `OperationBilling/CustomInput/Agreement.vue`、`OperationResult.agreement` setter、`Site.getValidAgreement`
- 確認済み実装事実: AgreementSelectは対象SiteのagreementsV2全件を候補にし、実績日以前・同じshiftTypeへfilterしない。setterはkey変更だけで受け入れてbillingDateを再計算する。日付・勤務区分等のgroupKey変更時だけbeforeUpdateがgetValidAgreementを自動適用する。
- 想定影響と発生条件: 2026-08-11に、個別単価・数量設定が可能なため適用日・勤務区分を強制制限せず、通常適用外も手動選択可能とする方針が確認された。
- 未確認点・仮説: 通常適用外であることの警告・理由記録が運用上必要かは未確認だが、強制拒否はしない。
- 推奨する将来対応: 現行の非制限選択を維持する。必要性が確認された場合だけ、選択を妨げない警告・理由記録を別途仕様化する。
- 必要なテスト: 過去/当日/未来開始、day/night不一致、期限境界、手動請求日、groupKey変更後再適用。
- ユーザー判断が必要な事項: なし。手動適用を許可する方針で解決済み。

## FUT-0033 請求稼働一覧の無効create操作とBilling集約競合を解消する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-010、SPEC-DEEP-022
- 対象ファイル・シンボル: `pages/billings/operations/index.vue` plus button、OperationBillings Manager、`addOperationResultToBilling`・`syncOperationResultToBilling`
- 確認済み実装事実: 一覧plus buttonはtoCreateを呼ぶがmanagerとOperationBilling.createはcreateを拒否する。SPEC-DEEP-022でmanagerの同期throwとmodelのPromise rejectという二重拒否、plusの直接到達をfile単位で再確認した。非請求→請求および同一Billing key更新はBillingをfetchして配列を書き戻す非transaction処理で、同じOperationResult IDは置換する。Billing key移動だけはtransactionを使う。
- 想定影響と発生条件: plus buttonは利用者に必ず失敗する操作を提示する。同じBillingへ複数実績が並行追加・更新されると、read-modify-write競合で一方のembedded resultが失われる可能性がある。
- 未確認点・仮説: adapterのupdateに楽観排他があるか、Functions concurrencyと実際のlost update再現性、稼働外売上専用OperationResult作成UIの具体的入口は未確認。
- 推奨する将来対応: 無効なOperationBilling plus buttonは除去し、手動請求は稼働外売上を持つOperationResult/ArticleDetail経路に統一する。Billing集約更新をtransactionまたはatomicな再構築へ統一し、同一key並行処理を検証する。課税区分等の不足fieldは実務要件に合わせて追加する。
- 必要なテスト: plus click error、同一Billingへ2件同時追加、同一item二重event、既存配列欠落、key移動との競合。
- ユーザー判断が必要な事項: 稼働外売上OperationResult作成UIの入口、追加が必要な課税区分等のfield契約。

## FUT-0034 請求手動調整値の許容範囲を定義・検証する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-011、SPEC-DEEP-029
- 対象ファイル・シンボル: schemas `OperationResult` のadjusted fields・sales、`OperationBilling/CustomInput/Adjust.vue`
- 確認済み実装事実: useAdjusted=trueで基本・資格の数量、残業時間、単価、残業単価を個別保存しsalesAmountへ使う。number validatorは負数・infinity・上限・小数精度を拒否せず、残業時間は15分単位だけを追加検査する。取極めなしでもbillingDateAtとcustomerIdがあればisBillableになる。SPEC-DEEP-029でAdjust componentに独自range validationがなく、originalから4 field単位でcopyすることを再確認した。
- 想定影響と発生条件: 負の数量・単価・残業時間、極端な値、0値を保存すると負額・0円・異常額の請求対象OperationResultとBilling集約を作れる可能性がある。
- 未確認点・仮説: 稼働外売上を含め、負数が値引き・相殺として必要か、上限・小数精度・0円請求・課税区分・roundingの正式要件は未確認。
- 推奨する将来対応: 項目別の最小値・最大値・精度・負数用途を仕様化し、model validationとUI hintを一致させる。例外は理由・権限・監査を設ける。
- 必要なテスト: 負数、0、最大値超過、小数、NaN、残業15分境界、取極めなしadjusted請求、salesAmountとBilling反映。
- ユーザー判断が必要な事項: 稼働外売上とその他調整それぞれの負数・0・range・精度・tax・rounding。

## FUT-0035 DailyAttendance同期をoperationResultIds逆引きへ移行する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-012、SPEC-DEEP-003
- 対象ファイル・シンボル: `fetchDailyAttendancesRelatedOperationResult`、`syncOperationResultToDailyAttendances`、`DailyAttendance.operationResultIds`、AGENTS.md後続ToDo
- 確認済み実装事実: 現行はOperationResultのbefore/after employeesから `${employeeId}_${attendanceDate}` を再構成してpoint fetchする。operationResultIdsのarray-contains queryは使わない。残件update・0件deleteはfetch済み対象には実装されている。AGENTS.mdはarray-contains逆引きへの変更を明示する。
- 想定影響と発生条件: 過去の不整合、壊れたbefore data、employee/date対応変更等でevent dataから旧配置先を再構成できない場合、DailyAttendanceに削除・更新済みOperationResultが残り、勤怠時間・休憩がstaleになる。
- 未確認点・仮説: 現存stale data、adapterのtransaction内query契約、必要indexは未確認。
- 推奨する将来対応: DEVでfull DailyAttendance rebuild/diffを行い、本適用時にone-time full rebuildする。移行後はoperationResultIds array-containsで既存配置先を取得し、afterから算出する新配置先とunionする。対象resultを全旧配置先から除去し、after対象へ追加、残件update・0件deleteを同一transactionで行う。idempotent dry-run/count/candidate出力、periodic consistency check、repair auditを設ける。
- 必要なテスト: employee追加/削除/変更、attendanceDate移動、壊れたbefore、複数旧配置先、残件あり/0件、retry、concurrent event。
- ユーザー判断が必要な事項: 本適用時のmaintenance window、dry-run差分承認者、periodic check頻度・alert閾値。

## FUT-0036 DailyAttendance詳細を従業員明細だけに限定する

- 2026-08-11 SPEC-DEEP-025 evidence: `Employee/ScheduleCalendar`もemployee-only表示で`ArrangementNotification.employeeId`ではなくraw `id == employeeId`をqueryし、`isEmployee`を検査しない。同じraw IDのoutsourcer通知が混入し得るため、同種mechanical checkの実到達箇所である。
- 2026-08-11 SPEC-DEEP-023 evidence: `DailyAttendanceCalendar`、statistics、CSV exporterはいずれも`DailyAttendance.details`を直接consumerにする。したがってworker namespace/ID衝突時の外注明細混入は、表示・統計・出力へ到達し得る。
- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-012、SPEC-DEEP-003
- 対象ファイル・シンボル: schemas `DailyAttendance.details`
- 確認済み実装事実: detailsは各OperationResult.workersをflatMapし、worker.id === employeeIdだけでfilterする。workersはemployeesとoutsourcersの両方を含み、isEmployeeを検査しない。
- 想定影響と発生条件: 同じ会社でoutsourcer.idとemployeeIdが同値の場合、外注明細の勤務・休憩も従業員DailyAttendanceへ混入し、勤怠・重複判定を誤る。
- 未確認点・仮説: 同種のemployee-only domainで`workers`とid-only filterを使う他箇所は未確認。
- 推奨する将来対応: detailsを`operationResult.employees`から抽出し、employees配列内でemployeeId/id一致をfilterする。isEmployee複合namespaceへの全面変更は行わず、employee-only domainのworkers/id-only filterをmechanical checkする。
- 必要なテスト: employee/outsourcer同一ID、複数外注index、従業員のみ、外注のみ、重複時間判定。
- ユーザー判断が必要な事項: なし。

## FUT-0037 DailyAttendance開始終了を実日時で集約する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-012、SPEC-DEEP-003
- 対象ファイル・シンボル: schemas `DailyAttendance.startTime`・`endTime`、OperationResultDetail startAt/endAt/isStartNextDay
- 確認済み実装事実: WorkTimeBaseはstartAtへisStartNextDayを加算し、endTimeがstartAt以下ならendAtを翌日にするため、各detailの日跨ぎは正しい。Calendarと勤怠CSV出力はdetail.startAt/endAtを直接使う。一方DailyAttendance.startTimeはdetail.startTimeのHH:MM最小、endTimeはdetail.endTimeのHH:MM最大である。D 08:00-17:00とD 22:00-翌05:00が同じ勤怠日にあると、aggregateは08:00/17:00となり、実日時上の最遅終了D+1 05:00を選ばない。勤怠CSVは同じ例をD 08:00出勤、D 17:00-D 22:00休憩、D+1 05:00退勤としてdetail実日時から生成するため、この誤集約値は到達しない。
- 想定影響と発生条件: 単一夜勤では22:00/05:00を保持し、確認済みCalendarと勤怠CSVにも問題はない。日跨ぎ明細と同日明細が同一DailyAttendanceに複数あり、未確認のdownstreamがaggregate endTimeを最終終了として使う場合に限り誤った値になる。既知consumerでの到達を確認できなかったため重大度をLowへ下げた。
- 未確認点・仮説: Date比較修正後の既存未確認consumerへの表示影響は未確認。
- 推奨する将来対応: 現在のstartTime/endTime public contractを維持し、getter内部だけdetail.startAt/endAtのDate比較へ修正して最早開始・最終終了をHH:mmで返す。new getter/deprecationは設けない。
- 必要なテスト: same-day、single overnight、mixed same-day＋overnight、multiple overnight、JST境界、同時刻、空details。
- ユーザー判断が必要な事項: なし。

## FUT-0038 embedded集約の重複・容量・並行性を検証する

- 状態: Hypothesis
- 重大度: High
- 発見セグメント: SPEC-SEG-012、SPEC-DEEP-003
- 対象ファイル・シンボル: DailyAttendance/DailyOperationByEmployee/Billingの `operationResults` と各同期module
- 確認済み実装事実: 3集計modelは関連OperationResult全体をembedded配列に保存する。各addはresult IDの置換で逐次retry重複を抑える。DailyAttendanceとDailyOperationsByEmployeeは各同期をtransactionで保存するが、Billingはkey移動以外をtransaction化していない。2026-08-11に、full embeddedは`FireModel.classProps.customClass`によるOperationResult instance復元と、多数のcomponent/composableのinstance互換性を維持するため意図した契約だと確認された。限定版OperationResult classはschema循環依存懸念から採用されていない。
- 想定影響と発生条件: DailyAttendanceでは重複employee/dateによる同一doc複数write候補、Billingでは並行eventのlost update候補がある。全collectionでresult・worker・article増加によるdocument size上限とtransaction/contention増加があり得る。
- 未確認点・仮説: Firestore/adapterの同一transaction複数write挙動、DEVのdocument件数・平均・最大bytes、実データ重複、contention頻度は未確認。partial plain objectをOperationResultへhydrateした場合の全consumer互換性も未検証である。
- 推奨する将来対応: DailyAttendance target docIdを全eventでMap重複排除し、Billingをatomic更新する。現行full snapshotを維持したままDEV容量を測定し、保守的warning/monitoringとsize failure可視化を設ける。次に明示的whitelistのpartial stored plain objectを既存`customClass`でOperationResultへhydrateするprototypeを作り、完全互換の場合だけmigrationする。非互換ならfull snapshotを維持し、date partition/subcollectionを検討する。derived subclassは作らない。
- 必要なテスト: 重複employee/date、同じdoc複数write、多数result・worker・article、1MiB境界、同時create/update/delete、transaction retry、DEV件数/平均/最大bytes、partial objectの`instanceof`、全使用field/getter、欠落field、再serializationで省略fieldが復元されないこと。
- ユーザー判断が必要な事項: prototypeが完全互換と確認された後のmigration承認。非互換時のdate partition/subcollection採用は将来判断する。

## FUT-0039 DailyAttendancesのFunctions専用write境界を正式化する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-012、SPEC-DEEP-003（SPEC-SEG-038、SPEC-DEEP-011でUI到達性の証拠追記）
- 対象ファイル・シンボル: `firestore.rules` のCompanies配下fallback、DailyAttendances専用match不存在、`pages/attendances/index.vue`、`utils/pageSettings.js`
- 確認済み実装事実: DailyAttendances専用Rulesはない。通常の同社認証Userはfallbackでread/writeできず、super-userはclientからread/writeできる。Functions Admin SDKはRulesを迂回する。`/attendances`は暫定的にdeveloper roleへ表示されるが、developerとsuper-userが同一である保証はなく、画面のsnapshot queryが成功する契約になっていない。SPEC-DEEP-011でpage/Indexは全従業員を列挙しcaller UIDによる自己限定を行わないことを確認した。
- 想定影響と発生条件: super-user clientがoperationResults、employeeId、dateを直接改変・削除するとFunctions集約契約を迂回し、勤怠不整合を作れる。通常User向け勤怠閲覧を想定する場合はread不能である。
- 未確認点・仮説: 勤怠管理者を表す具体的role/permission、別application/eventのdata contract・保持期間、既存data移行は未確定である。
- 推奨する将来対応: 集約由来の勤務明細・時刻をFunctions-only writeとし、本人は自己勤怠read、勤怠管理者は同一会社readとする専用Rules/APIを実装する。休暇・振替休日・代休は本人create/cancel・管理者approve/rejectの別application/eventとし、承認結果を表示・集約へ反映する。訂正とsuper-user修復はactor/reasonを残す監査付きserver processに限定する。
- 必要なテスト: 本人・同社勤怠管理者・他社・super-userのread/write、集約field direct write拒否、申請create/cancel/approve/reject、承認反映、監査付き訂正・修復。
- ユーザー判断が必要な事項: 勤怠管理者の具体的role/permissionと、別application/eventの保持・通知等の詳細。

## FUT-0040 freee勤怠管理Plus向けCSV互換性を検証する

- 2026-08-11 SPEC-DEEP-023 evidence: export buttonはEmployee補完loadingとrow有無だけで制御され、DailyAttendance取得中・browser download中のlatch、download例外の画面表示、明示的retryを持たない。対象component/utilityのテストもrepository検索では確認できなかった。
- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-015
- 対象ファイル・シンボル: `createAttendancePunchRows`、`exportAttendancePunchesCsv`、`DailyAttendanceExporter`
- 確認済み実装事実: 現行はemployeeCode、employeeName、punchTypeCode、punchDateTimeの4列をUTF-8 BOM・CRLFでbrowser downloadする。2026-08-11にfreee勤怠管理Plusへ引き渡す想定と確認されたが、仮実装で取込テストは未実施である。同日複数実績間の空きを休憩打刻にする挙動は承認済みである。SPEC-DEEP-045ではbrowser local timeを明示JSTへ変換しないこと、過大・非有限breakの拒否がなく勤務区間外または休憩欠落へなり得ること、employee code/nameのCSV formula neutralizationがないことを確認した。
- 想定影響と発生条件: freee勤怠管理Plusがheader名、code、文字コード、timezone、日跨ぎ、休憩打刻等を異なる形式で要求する場合、取込拒否または誤った勤怠として登録される可能性がある。
- 未確認点・仮説: 公式の対象取込機能・template version、必須列、従業員code対応、DEV取込結果は未確認。
- 推奨する将来対応: exporterへ対象・format versionを持たせ、公式template確定後、同日・夜勤・複数実績・休憩・空値等の代表matrixをstatic testし、DEV test employeeへ取込検証する。error、丸め、timezone、encodingを確認し、対応versionと確認日を文書化する。検証完了までは非表示またはtrial labelとする。
- 必要なテスト: header/encoding/CRLF、従業員照合、打刻code、同日・日跨ぎ、複数実績間休憩、空code/name、重複取込、error report、rounding/timezone、DEV test employee取込。
- ユーザー判断が必要な事項: 公式取込対象・template確認後の対応version確定と、検証結果に基づく正式公開承認。

## FUT-0041 DailyOperationsByEmployeeのclientアクセス境界を正式化する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-015、SPEC-DEEP-003
- 対象ファイル・シンボル: `firestore.rules` Companies配下fallback、`syncOperationResultToDailyOperationsByEmployee`、`DailyOperationsByEmployee`
- 確認済み実装事実: DailyOperationsByEmployee専用Rulesはない。通常の同社認証Userはclient read/writeできず、super-userは全read/writeが可能である。Functions Admin SDKはRulesを迂回し、OperationResult triggerから集約する。
- 想定影響と発生条件: 通常User向け表示を追加すると現在はread不能である。super-user clientがemployee/date/operationResultsを直接変更すると、逆引き・集約契約を迂回してstaleまたは誤集計を作れる。
- 未確認点・仮説: 本人用projection/Callableの具体path・response schema、勤怠/配置管理者と請求権限者の具体的permission、audit保持は未実装・未確定である。
- 推奨する将来対応: 本人確認済みprojection/Callableで自己分の勤務日・開始終了・休憩・勤務分・現場・勤務区分だけを返し、他従業員、売上・単価・請求・顧客取極めを除外する。勤怠/配置管理者は同一会社勤怠read、billing dataは請求権限者だけとする。whole documentを公開せず、writeはFunctions-only、repairは監査付きprocessに限定する。
- 必要なテスト: 本人最小field、他従業員拒否、同社勤怠/配置管理者、他社、billing権限有無、whole-document拒否、client create/update/delete拒否、Functions同期、監査付きrepair。
- ユーザー判断が必要な事項: 具体的permission名とprojection/Callable API、audit保持等の実装詳細。access・field ownership方針は2026-08-11に確認済み。

## FUT-0042 SiteEmployeeHistory削除失敗を成功扱いにしない

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-016、SPEC-DEEP-002
- 対象ファイル・シンボル: `functions/modules/siteEmployeeHistories/rebuildHistory.js` の0件時 `historyRef.delete().catch(() => {})`
- 確認済み実装事実: 対象OperationResultが0件の場合、history deleteの全errorをcatchして破棄し、そのまま成功returnする。create/upsert側のerrorは伝播する。
- 想定影響と発生条件: permission、network、service failure等でdeleteに失敗してもtriggerが成功扱いになり、退場済み・削除済み従業員のstaleな現場履歴が残る。platform retryも要求されない。
- 未確認点・仮説: catchの意図、実運用でのdelete failure、stale履歴監視・repair jobは未確認。
- 推奨する将来対応: not-foundだけを安全に無視し、その他はlogしてthrowする。stale履歴を検出・再構築できる運用または全件repair入口を整備する。
- 必要なテスト: document不存在、permission-denied、unavailable、timeout、delete成功、trigger retry、stale repair。
- ユーザー判断が必要な事項: なし。error分類とretry/repairは実装・運用検証事項である。

## FUT-0043 SiteEmployeeHistory再構築の並行性と決定性を保証する

- 状態: Hypothesis
- 重大度: Medium
- 発見セグメント: SPEC-SEG-016、SPEC-SEG-059、SPEC-DEEP-035
- 対象ファイル・シンボル: `rebuildHistories`、`rebuildHistory`、OperationResult trigger update branch
- 確認済み実装事実: 各employeeを逐次処理し、queryとhistory writeを共通transactionに含めない。同じsite/employeeの並行event間にversion検査はない。dateだけでfirst/lastをsortし同日document IDのtie-breakを指定しない。site同一のdate変更は同じ集合を2回再構築する。
- 想定影響と発生条件: 並行eventで古いquery結果が後からsetされるとfirst/lastがstaleになる可能性がある。同日複数実績ではfirst/last OperationResult IDが再実行で変わり得る。途中failureではemployee間で部分更新となる。
- 未確認点・仮説: Firestore snapshot timingによる再現性、event頻度、必要index、retry設定、配列field名とmigration手順の実装詳細は未確認。同日・同site・同employeeの別OperationResultは運用上発生しない想定だが、強制箇所は未確認である。
- 推奨する将来対応: 同一keyのtransaction/version checkまたはevent後の再調整を設計し、同一siteの重複rebuildを除く。first/last境界日ごとの全OperationResult ID配列へ置換し、startAt/endAt/docIdで決定的に並べる。同一境界日は同じ配列を許可し、UIを複数対応にする。2件以上はwarning/auditし、migration中はlegacy scalar read互換を保って完了後に廃止する。
- 必要なテスト: concurrent create/update/delete、逆順完了、同日複数実績、first/last同日、startAt/endAt/docId順、UI複数表示、warning/audit、legacy scalar read、migration、site/date/employee移動、retry。
- ユーザー判断が必要な事項: 具体的な配列field名、migration rollout・scalar廃止時期等の実装詳細。配列契約は2026-08-11に確認済み。

## FUT-0044 SiteEmployeeHistoriesのclientアクセス境界を正式化する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-016
- 対象ファイル・シンボル: `firestore.rules` Companies配下fallback、`SiteEmployeeHistory`、`rebuildHistory`
- 確認済み実装事実: SiteEmployeeHistories専用Rulesはない。通常の同社認証Userはclient read/writeできず、super-userは全read/write可能である。FunctionsはOperationResultからAdmin SDKで再構築する。SPEC-SEG-059で、`sites:read`のSite detailが`siteId == route id`で全履歴を無制限subscribeし、全従業員名と初回/最終日を表示する一方、通常User向けprojection/CallableがなくRulesでqueryを拒否されることを確認した。SPEC-DEEP-035で、ChipがEmployee欠損・取得失敗を`...loading`へ畳み込み、click tooltipに初回/最終日だけを表示して詳細navigationを持たないことを確認した。
- 想定影響と発生条件: 通常User向け履歴表示は現在read不能で、Site画面にempty/errorの区別なく入場者が表示されない可能性がある。Rulesを単純に同社readへ広げると`sites:read` Userへ全従業員履歴を開示する。super-user clientがfirst/last ID・date等を直接変更すると再構築契約を迂回し、監査・現場従事表示を不整合にできる。
- 未確認点・仮説: 本人用Callable/projectionの具体path・response schema、現場/配置管理者の具体的permission、derived historyの保持・削除期間、audit保持は未実装・未確定である。
- 推奨する将来対応: 本人確認済みCallable/projectionで自己が入場した現場名・初回/最終入場日だけを返し、他従業員履歴、顧客取極め・請求、他配置者を除外する。現場/配置管理者は同一会社履歴をreadできるようにする。whole documentのbroad readを避け、writeはFunctions-only、OperationResultからのrebuildは監査付きprocessとする。OperationResult retentionは別契約で扱う。
- 必要なテスト: 本人最小field、他従業員拒否、顧客/請求/他配置者非表示、同社現場/配置管理者、他社、whole-document拒否、client write拒否、Site detail loading/permission error/empty/stale/missing Employee、大量件数、Functions rebuild、監査付きrepair。
- ユーザー判断が必要な事項: 具体的permission名とCallable/projection API、derived historyとOperationResultそれぞれの保持期間。access・field ownership方針は2026-08-11に確認済み。

## FUT-0045 確定・支払済みBillingの自動再集計境界を強制する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-017、SPEC-DEEP-002
- 対象ファイル・シンボル: `Billing.status`・`confirm`・`markAsPaid`、Functions billings add/remove/sync、Billings Rules
- 確認済み実装事実: BillingはDRAFT/CONFIRMED/PAID/CANCELLED statusを持ち、confirmはDRAFT→CONFIRMED、markAsPaidはCONFIRMED→PAIDだけを許す。一方同期Functionsはstatusを検査せず、全statusでoperationResultsの追加・置換・除去と空Billing削除を行う。frontendにstatus表示・confirm/paid/cancel handlerはなく、Rulesも同社認証Userへstatus・集計fieldの全writeを許す。
- 想定影響と発生条件: 確定・支払済み・取消済みBillingに紐づくOperationResultを後から変更・削除・対象解除すると、確定済み金額・税・明細が変化し、Billing自体が削除され得る。
- 未確認点・仮説: DRAFTを含むstatusの正式な意味、triggerがdraftと請求済みを識別する契約、確定後訂正・再発行・credit・payment処理は未確認。
- 推奨する将来対応: まずtriggerがdraftと請求済みBillingを識別するfield/status/pathを決定する。その後に再集計・削除・訂正・再発行を設計する。現時点でDRAFTのみ再集計やrevision workflowを採用済みと扱わない。
- 推奨する将来対応（Site再適用境界）: SiteのCustomer/Agreementを既存OperationResultへ明示的に再適用する場合、発行済み請求書に含まれる実績を除外し、未発行範囲だけを更新する。
- 必要なテスト: DRAFT/CONFIRMED/PAID/CANCELLEDごとのresult追加・更新・key移動・対象解除・削除、空Billing、直接client write、retry。
- ユーザー判断が必要な事項: draft/請求済み識別、正式status model、その後の再集計・削除・訂正・再発行。

## FUT-0046 非請求OperationResult削除でBilling同期を失敗させない

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-017、SPEC-SEG-050
- 対象ファイル・シンボル: OperationResult delete trigger、`removeOperationResultFromBilling`、`getBillingKey`
- 確認済み実装事実: 非請求OperationResultのcreateとupdate false→falseはskipするが、delete triggerはisBillableを確認せずremoveを呼ぶ。removeはcustomerId/siteId/billingDateを必須とするkey生成を無条件実行する。取極めなし等ではbillingDateがnullとなり得る。
- 想定影響と発生条件: 非請求OperationResultを削除するとkey生成errorでtriggerが失敗し、後段DailyAttendance/DailyOperationsByEmployee/SiteEmployeeHistories同期が実行されずstale dataが残る。
- 未確認点・仮説: Emulator再現、platform retry、既存非請求削除event、stale projection件数、repair運用は未確認。code上はBillingが先頭でthrowするため3後段が同じ実行で未到達となる。
- 推奨する将来対応: delete側もbefore.isBillable=falseならBilling removeをskipする。既存stale後続集約を検出・repairする。
- 必要なテスト: 非請求delete、customerのみ/billingDateのみ欠損、請求対象delete、後続module実行、retry、repair。
- ユーザー判断が必要な事項: なし。承認済みの非請求実績を安全に削除できる整合性修正である。

## FUT-0047 Billingの同一key追加・更新・削除をatomic化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-017
- 対象ファイル・シンボル: `addOperationResultToBilling`、`removeOperationResultFromBilling`、`syncOperationResultToBilling` same-key branch
- 確認済み実装事実: key移動だけold/newをtransactionで処理する。create、対象化/解除、delete、same-key updateはtransaction外でBilling全体をfetchし、operationResults配列を変更してupdate/create/deleteする。同IDfilterは逐次retry重複だけを抑える。
- 想定影響と発生条件: 同じcustomer/site/billingDateへ複数OperationResult eventが並行すると、後勝ちwriteで他eventの追加・更新・削除が失われ、金額・数量・税・summaryが欠落またはstaleになる。
- 未確認点・仮説: Emulator再現、実運用contention、adapter precondition、最大retry、監視は未確認。
- 推奨する将来対応: 全branchをtransactionへ統一し、必要ならOperationResult ID単位subcollection＋集計へ正規化する。conflict/failure injection testを追加する。
- 推奨する将来対応（Site再適用境界）: 明示的なCustomer/Agreement再適用によるOperationResult key変更でも、update triggerがBillingをold keyからnew keyへ移す一連の処理をatomicかつidempotentにする。
- 必要なテスト: concurrent add/add、add/remove、update/update、対象化/解除、same-key/key移動競合、transaction retry、同ID再実行。
- ユーザー判断が必要な事項: なし。整合性保証方式の実装設計・検証事項である。

## FUT-0048 Billing adjustmentの使用・課税契約を決める

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-017
- 対象ファイル・シンボル: schemas `Billing.adjustment`・`subtotal`・`taxBreakdown`
- 確認済み実装事実: adjustmentはamount/descriptionを持つがcomment上は未使用である。amountはsubtotalへ加算される一方、taxBreakdownはoperationResultsだけから作られadjustmentを課税対象に含めない。PDFもsubtotal/totalへadjustmentを含めるが、税率別内訳・現場別合計・稼働明細にadjustment行やdescriptionを表示しない。
- 想定影響と発生条件: 将来adjustmentを値引き・追加請求へ使う場合、課税区分を定義せず入力するとsubtotal・tax・totalが業務期待とずれる可能性がある。
- 未確認点・仮説: 既存dataでadjustmentが使用されているか、deprecation/migration手順、将来の税区分・理由・承認・監査・UI契約は未確認である。
- 推奨する将来対応: 現行未使用fieldの既存data利用を確認し、未使用ならdeprecateする。将来Billing単位の運用丸め等が必要になった時点で、税区分・理由・actor・履歴・帳票表示を明示して再設計する。OperationResultの稼働外売上とは別機能として扱う。
- 必要な請求書生成ではdeprecation対象の現行adjustmentを税・明細・合計から除外し、既存dataがある場合はmigration/警告で意図しない金額差を防ぐ。
- 必要なテスト: 既存data usage scan、deprecation/migration、将来再設計時の正負/0、100円以下等のrounding、課税/非課税、複数税率、理由、権限、監査、帳票表示、稼働外売上との分離。
- ユーザー判断が必要な事項: 将来機能を実装する時点の税・理由・監査・表示詳細。現行fieldのdeprecation方針は2026-08-11に確認済み。

## FUT-0049 Billing status・支払・取消の画面workflowを実装する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-018、SPEC-DEEP-012
- 対象ファイル・シンボル: Billing一覧/詳細、schemas `Billing.status`・`paymentRecords`・`confirm`・`markAsPaid`
- 確認済み実装事実: 一覧/詳細はstatusを表示せず、confirm/markAsPaid/CANCELLEDを呼ぶfrontend handlerがない。paymentRecordsは未実装で、実入金記録・部分入金・消込UIもない。詳細で編集できるのはpaymentDueDateAtだけで、status別disabledもない。
- 想定影響と発生条件: 利用者は請求確定・支払済み・取消を画面で管理できず、statusがDRAFTのままPDF/CSV出力や後続運用が進む、または直接writeで監査なしにstatus変更される可能性がある。
- 未確認点・仮説: DRAFTを含むstatusは暫定で、draft/請求済み識別、支払処理、支払記録、部分入金、取消/再発行、PDF出力条件は未確定。paymentDueDateAt変更方針は確認済みだが、invoice-issued triggerと請求担当permissionは未実装である。
- 推奨する将来対応: まずdraft/請求済みを区別するtrigger・data contractを決め、その後にlifecycle、actor権限、状態表示、許可action、監査、payment処理を設計する。既存status/revision案を採用済みと扱わない。
- 必要なテスト: 全status表示、許可/禁止遷移、発行前期日編集、発行後reason/history、paid/cancelled期日変更拒否、Customer条件変更後の既存Billing不変、権限、二重click、失敗rollback、部分/全額入金、取消/再発行、直接write、PDF/CSV条件。
- ユーザー判断が必要な事項: 確定・支払・取消・訂正のworkflow、支払記録field、部分入金、PAID判定、各actor権限。

SPEC-DEEP-039a追加根拠: Billing詳細managerの未使用`info` computedは未importの`OperationBilling`とBillingにないfieldsを参照し、再利用時に例外または誤model表示となるlatent contractである。

## FUT-0050 OperationBilling lock toggleの失敗・多重実行を安全にする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-018、SPEC-DEEP-029、SPEC-DEEP-030
- 対象ファイル・シンボル: `OperationBilling.toggleLock`、`BtnToggleLock.vue`、`useOperationBillingManager.toggleLock`
- 確認済み実装事実: toggleLockはlocal isLockedを反転してupdateする。buttonは確認dialogなしで実行し、global loadingを登録するが自身のdisabled guardはない。errorはlogするがlocal値をrollbackしない。OperationBillingはlock中も請求編集を許す。SPEC-DEEP-012でOperationResult detailのlockは基本・worker・article・deleteを止める一方、developer duplicateとSecurityReport操作は残ることを確認した。SPEC-DEEP-029でbuttonがdesired value/version/preconditionを渡さず、`$attrs`にも処理中disabledを自動付与しないことを再確認した。SPEC-DEEP-030でduplicator自体はlocked sourceを拒否し、SecurityReport managerだけはResult lockと結線されないことを確認した。
- 想定影響と発生条件: update失敗で画面だけlock/unlock表示が変わる、double clickや別tab同時操作で期待と逆の最終状態になる、利用者がlockを請求全体の凍結と誤認する可能性がある。
- 未確認点・仮説: global loading overlayのclick遮断、subscriptionによる失敗後の自動復元は未確認。lockの業務意味はcontroller/operation edit lockとして確認済みである。
- 推奨する将来対応: 明示するdesired valueとversion/preconditionで更新し、buttonをprocessing中disabledにする。失敗時rollback/refetchと利用者messageを追加する。UIへ「稼働管理者の編集を止めるlockで、請求担当者のOperationBilling編集は可能」と明示し、operationLocked/billingLockedへは強い必要性が生じるまで分割しない。
- 必要なテスト: lock/unlock成功、permission/network failure、double click、two-tab concurrent toggle、subscription復元、lock中請求編集。
- ユーザー判断が必要な事項: なし。controller/operation edit lockとして現行scopeを維持する方針は2026-08-11に確認済み。invoice-issued後immutableは別判断とする。

SPEC-DEEP-039b追加根拠: 旧`useOperationBillingManager`のtoggleLockもerrorを吸収してlocal rollbackせず、静的caller不在で現行button経路とは別のlegacy contractである。

## FUT-0051 Billing client編集とaggregation更新の競合を防ぐ

- 状態: Hypothesis
- 重大度: High
- 発見セグメント: SPEC-SEG-018
- 対象ファイル・シンボル: Billing詳細paymentDueDateAt update、Billing aggregation Functions、server/client adapter update
- 確認済み実装事実: Billing詳細はpaymentDueDateAtをclient updateする。aggregation Functionsも同じBilling documentのoperationResultsを非transaction updateするbranchがある。画面側にversion checkはない。
- 想定影響と発生条件: paymentDueDateAt編集とOperationResult同期が同時に同じBillingをread-modify-writeすると、adapterがfull modelを保存する場合に後勝ちで相手のfieldを古い値へ戻し、支払期日または集計明細を失う可能性がある。
- 未確認点・仮説: client/server adapterのupdate field mask、Emulator再現、競合頻度、subscription後の表示、将来invoice-issued trigger実装は未確認。
- 推奨する将来対応: adapterのwrite payloadを確認し、field ownershipを分離する。invoice-issued前は請求担当者によるfield-level update＋versionを許し、発行後はbefore/after/reason/actor/time履歴付きprocess、paid/cancelledは拒否する。Customer条件変更は既存Billingへ自動反映しない。aggregationはtransaction化する。
- 必要なテスト: paymentDueDateAtとresult add/update/remove同時実行、発行前、発行後reason/history、paid/cancelled拒否、Customer default変更、権限、two-tab期日編集、version conflict、subscription収束、retry。
- ユーザー判断が必要な事項: なし。write契約確認後の整合性実装事項である。

## FUT-0052 請求書PDFの発行必須項目とstatus別発行を仕様化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-019、SPEC-DEEP-022
- 対象ファイル・シンボル: `useBillingPdf.createHeader`・single/consolidated generation、Billing status
- 確認済み実装事実: 単票PDF本文に請求日、支払期日、請求書番号、statusがない。統合だけ各Billingの請求日/入金予定日を表示する。全statusから同じ「ご請求書」を何度でもdownloadでき、発行番号・actor・時刻・revisionを保存しない。SPEC-DEEP-022で一覧PDF buttonにもstatus/permission/processing guardがなく、global loading中も再clickできることを確認した。
- 想定影響と発生条件: DRAFT/CANCELLEDを正式請求書として渡す、支払条件や文書同一性を帳票で確認できない、再発行版を識別できない可能性がある。
- 未確認点・仮説: 一意番号の具体的format/sequence、artifact保存path、hash方式、revision/cancel retention、invoice-issued trigger実装は未確認である。
- 推奨する将来対応: 現行PDFへdraft表示を付ける。将来の正式発行actionで一意番号を採番し、請求日・支払期日・番号・発行者・宛先・明細・税率別内訳・合計を必須表示する。artifactにrevision・actor・time・hashを保存し、同一再downloadと訂正revisionを分け、cancelledも保持する。invoice-issued trigger前は正式発行不可とする。
- 必要なテスト: preview/draft表示、正式発行前拒否、番号一意性、必須field、単票/統合、同一再download、訂正revision、cancelled保持、actor/time/hash、concurrent issue。
- ユーザー判断が必要な事項: 番号format、artifact保存・retention、hash方式等の実装詳細。発行契約は2026-08-11に確認済み。

## FUT-0053 請求書PDF入力・master・filenameを検証する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-019、SPEC-DEEP-022
- 対象ファイル・シンボル: `generateBillingPdf`、`generateConsolidatedBillingPdf`、Customer/Company/Site/Article fetch、filename生成
- 確認済み実装事実: 統合は0件だけ検査し、同一customer/dateを検証しない。標準UIは`customerId_billingDate` groupKeyで入力を作るため通常経路は同一groupだが、生成API自身の防御ではない。Customer/Company欠損は直接property参照で失敗し得る。Site/Articleだけfallback表示する。customer.nameをsanitizeせずfilenameへ入れる。
- 想定影響と発生条件: master欠損・初期化遅延でPDF全体が生成不能、異なるcustomer/date入力で誤宛名、禁止文字・長大名称で不正/曖昧filenameとなる可能性がある。
- 未確認点・仮説: browser/OSごとのfilename正規化、sanitize/truncate helperの具体規則、snapshot保存schema、既存発行data migrationは未確認。
- 推奨する将来対応: 正式filenameをinvoice number主体＋sanitize/truncate customer名とする。正式発行時はCompany/Customerを必須検証し、Site/Article名をsnapshotする。draftだけ`DRAFT`・欠損情報表示付きplaceholderを許し、正式版では`N/A`・空宛名を拒否する。欠損fieldを利用者へ列挙する。
- 必要なテスト: Company/Customer欠損formal拒否、draft placeholder/missing表示、Site/Article snapshot後master削除再print、不正文字、Unicode、長名、truncate、invoice number filename、空宛名/N/A拒否。
- ユーザー判断が必要な事項: sanitize/truncate長、snapshot schema等の実装詳細。filename/master方針は2026-08-11に確認済み。

## FUT-0054 請求書PDFのlayout・改page・金額整合をrender検証する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-019、SPEC-DEEP-022
- 対象ファイル・シンボル: `useBillingPdf` docDefinition/header/tables、NotoSansJP VFS
- 確認済み実装事実: A4固定margin、宛先/発行者absolute配置、現場table後の強制改page、table自動改pageを使う。長文overflow制御はない。0/負quantity行は省略し得る一方summaryは0/負金額を表示する。統合税は全site合算後に丸め、単票税合計と異なり得る。SPEC-DEEP-022でCustomerBillings group summaryも統合PDFと同じ再集約税を表示する一方、各rowはsite別taxを表示するため、画面内でもrow合計との差が生じ得ることを確認した。
- 想定影響と発生条件: 長住所・会社名・銀行情報、大量明細、長い現場/商品名、負数/adjustment、複数税率で文字重なり・欠落・不要改page・内訳と総額の説明不能が起こる可能性がある。
- 未確認点・仮説: 実render、font glyph、viewer差、最大page数、browser memory、accountant/tax professionalによる税務検証は未確認。
- 推奨する将来対応: 匿名fixtureでPDFをrenderし、visual regressionと金額reconciliationを行う。統合invoiceは全明細を税率別集約後にCompany丸め規則で税計算しinvoice taxを正とする。site subtotalは表示用、0行は省略、負数は意味・理由付き、deprecated adjustmentは除外する。正式利用前にaccountant/tax professionalが検証する。
- 必要なテスト: 長い日本語/住所/銀行、複数page、0行省略、意味・理由付き負数、小数、adjustment除外、複数税率、Company丸め、site subtotal対invoice tax、欠損master、font glyph、税務review。
- ユーザー判断が必要な事項: 負数行を導入する場合の具体的種別・理由語彙。統合税・0行・adjustment方針は2026-08-11に確認済み。
## FUT-0055 Customer CRUDの暫定権限を正式化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-020、SPEC-DEEP-010
- 対象ファイル・シンボル: `utils/pageSettings.js` customers routes、`pages/customers/**`、`firestore.rules` Customers match
- 確認済み実装事実: `customers:read`で作成・更新・削除UIまで到達でき、Rulesは同一会社の認証ユーザーまたはsuper-userに全fieldのread/writeを許可する。SPEC-DEEP-010で一覧plus、詳細の基本・支払条件update、delete handlerにwrite permission/status guardがないことを全page本文で再確認した。
- 想定影響と発生条件: 閲覧だけを想定した利用者も取引先・支払条件を変更またはarchiveでき、請求・現場参照へ影響し得る。
- 未確認点・仮説: permission presetの具体構成、Callable/audit schema、既存claims migrationは未実装・未確認である。
- 推奨する将来対応: `customers:read`/`customers:write`を維持し、writeへ作成・編集・支払条件・終了・archive・restoreを含める。archive/restoreは確認・監査付き、通常物理deleteは禁止とする。User向けpermission presetを設け、UI・Rules・Callableを一致させる。実需要が出るまでfield分割しない。
- 必要なテスト: read/write preset、route/button/直接Firestore/Callable、作成・編集・支払条件・終了、archive/restore確認・audit、物理delete拒否、他社path。
- ユーザー判断が必要な事項: preset内容・audit保持等の実装詳細。2権限modelは2026-08-11に確認済み。

## FUT-0056 Customerの重複・検索・status条件を定義する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-020、SPEC-DEEP-021
- 対象ファイル・シンボル: schemas `Customer.tokenFields`、`Customer/Autocomplete.vue`、`Customers/{DataTable,Iterator}/index.vue`、`Site/CustomInput/index.vue`
- 確認済み実装事実: code/name等の一意性検証はなく、一覧はACTIVE限定だがAutocompleteのN-gram検索にはstatus constraintがない。検索tokenはname/nameKanaだけである。SPEC-DEEP-021で、Site create wizardがCustomer候補選択用に渡す`modelValue`/`show-select`/`select-strategy`をCustomersIteratorが内部iteratorへforwardしないことも確認した。
- 想定影響と発生条件: 重複Customer作成、TERMINATED Customerの新規参照選択、codeや略称で検索できない運用差が起き得る。
- 未確認点・仮説: normalized address/phoneを含む類似検索の実現可能性、index数・query cost・privacy、warning閾値は未確認である。
- 推奨する将来対応: 任意codeをtenant内uniqueにし、name hard uniqueは設けない。normalized name/kana/address/phoneの類似候補をwarning表示して同名作成を許す。新規選択はACTIVE限定、履歴はTERMINATED表示、再利用前reactivateとする。検索はcode/name/kana/phoneを先行し、addressはprivacy/cost確認後に判断する。
- 必要なテスト: 同一/空code、同名許可、name/kana/address/phone類似warning、false positive/negative、ACTIVE新規選択、TERMINATED履歴、reactivate、cache後status変更、Site createの既存Customer single select/v-model、tenant分離、index/cost。
- ユーザー判断が必要な事項: warning閾値とaddress検索採否は実現可能性・privacy・cost検証後に決定する。基本方針は2026-08-11に確認済み。

## FUT-0057 Customer archiveと参照整合・復元を設計する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-020
- 対象ファイル・シンボル: schemas `Customer.hasMany/logicalDelete`、client adapter `hasChild/delete/restore`、Customers Rules
- 確認済み実装事実: 削除guardはSite参照だけをtransaction外queryで確認し、元documentをarchiveへcopyして削除する。関連Siteがあればstatusに関係なく拒否する。restore APIはあるがCustomer UI経路は見つからない。
- 想定影響と発生条件: child確認後の競合、見えない非ACTIVE Siteによる削除拒否、Site以外の参照残存、archive後のmaster取得失敗が起き得る。
- 未確認点・仮説: 全参照catalog、法令・契約上の保持期間、運営者inspection/restore API、既存archive dataへのmetadata migrationは未実装・未確認である。
- 推奨する将来対応: 通常終了はTERMINATED、再開は`customers:write`によるACTIVE化とする。archiveは参照なし確認後の誤登録・重複だけに限定しreason/actor/timeを保存する。通常User restoreと物理delete UIを禁止する。運営者は依頼に基づきarchiveを監査付き閲覧でき、restoreは通常UIから隔離した緊急processでreason/audit必須、active同ID存在時は拒否する。保持要件確定まで自動purgeしない。
- 必要なテスト: terminate/reactivate、参照ありarchive拒否、同時参照作成、reason/actor/time、通常User archive閲覧/restore拒否、運営者inspection、緊急restore、active同ID拒否、物理delete UI不存在、保持/purge未設定。
- ユーザー判断が必要な事項: 法令・契約に基づく保持期間・purge。archive/restore運用方針は2026-08-11に確認済み。

## FUT-0058 Customer変更時の請求snapshot境界を確定する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-020
- 対象ファイル・シンボル: schemas `Customer.getPaymentDueDateAt`、Billing作成、請求書PDF Customer取得
- 確認済み実装事実: Billingの支払期日は作成時に保存される一方、請求書PDFの宛名・住所は生成時のlive Customerから取得する。
- 想定影響と発生条件: Customer変更後に既存Billingの期日と再生成PDFのmaster時点が混在し、過去帳票の表示が変化する。archive等でCustomer取得不能ならPDF生成が失敗し得る。
- 未確認点・仮説: initial/full snapshot schema、既存Billing migration、revision storageとartifact hash連携は未実装・未確認である。
- 推奨する将来対応: draft作成時にinitial copy、正式発行時にfull snapshotを保存する。発行済み再printはsnapshotを使い、master変更を反映しない。訂正はreason/history付きnew revisionにし、live master PDFはdraftだけに限定する。
- 必要なテスト: draft initial copy、formal full snapshot、名称・住所・支払条件変更前後、発行済み再print不変、Customer archive後再print、訂正revision/reason/history、既存Billing migration。
- ユーザー判断が必要な事項: snapshot schema・既存data migration・revision保存詳細。snapshot時点方針は2026-08-11に確認済み。

## FUT-0059 Customerの住所・status編集とgeocoding境界を整備する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-020、SPEC-SEG-021、SPEC-SEG-024、SPEC-DEEP-021、SPEC-DEEP-025
- 対象ファイル・シンボル: `Customer/Activator/{Base,Payment}.vue`、`Employee/Activator/Base.vue`、schemas `Customer`、`Site`、`Employee`、`GeocodableMixin`
- 確認済み実装事実: Customerの必須addressとcontractStatusは詳細編集includedKeysにない。SPEC-DEEP-021でBasic/Payment Activatorがpermission/disabled/loadingを自身で判定せず常時edit iconを出すことを確認した。SPEC-DEEP-025でEmployee Baseもrequired addressを表示する一方でincludedKeysへ含めず、detail editorから番地を変更できないことを確認した。Customer、Site、Employeeが共有する住所geocodingは、未注入・失敗時にlocation=nullで保存を継続し、lat/lngのtruthy判定は0座標を欠損扱いする。
- 想定影響と発生条件: 番地訂正や契約終了/再有効化が画面から行えず、住所変更時に座標だけ失われても保存成功として扱われる。
- 未確認点・仮説: status変更UI・auditの実装、座標欠損を許容する業務条件は未確認。
- 推奨する将来対応: 契約終了・停止はTERMINATED、`customers:write`による再開はACTIVEとしてUI・auditを実装する。誤登録・重複archiveとは分離する。address編集、geocoding失敗表示、0を含む座標validationも見直す。
- 必要なテスト: 番地編集、住所各field変更、geocoder未注入/失敗/0座標、terminate/reactivate、保存後表示。
- ユーザー判断が必要な事項: なし。status/archive使い分けは2026-08-11に確認済み。geocoding境界は実装・検証事項として残す。

## FUT-0060 Site CRUD・statusの暫定権限を正式化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-021、SPEC-DEEP-002、SPEC-DEEP-010、SPEC-DEEP-034
- 対象ファイル・シンボル: `utils/pageSettings.js` sites routes、`pages/sites/**`、`components/Site/**`、Sites Rules
- 確認済み実装事実: `sites:read`で作成、全編集、取極め変更、終了、archiveへ到達し、Rulesは同一会社User/super-userに全field writeを許す。SPEC-DEEP-010で6種のSite side effectにpage側write guardがなく、ACTIVE一覧・TERMINATED検索の双方から同じ詳細へ到達することを確認した。SPEC-DEEP-034ではSite Manager/Activator/Autocompleteがpermission・statusを検査せずedit/create入口を公開し、Air managerもdisabledを操作guardとして強制しないことを確認した。
- 想定影響と発生条件: 閲覧利用者が配置・請求の基礎masterや取極めを改変・削除できる可能性がある。
- 未確認点・仮説: role presetの具体的な割当、Callableのactor/field検証、archive監査schema、operator緊急restoreの実装方式は未確認。
- 推奨する将来対応: `sites:read`/`sites:write`の2権限を実装し、writeへ作成、基本情報・Customer・Agreement変更、終了、再有効化、archiveを含める。archiveは理由・監査必須、通常restoreは禁止し、operator緊急restoreを通常UIから分離する。route/button/Rules/Callable/role presetを一致させる。
- 必要なテスト: read/write別route/button/直接write、他社path、Customer/Agreement変更、terminate/reactivate/archive、通常restore拒否、operator緊急restore監査。
- ユーザー判断が必要な事項: なし。CONF-0046で方針確定済み。

## FUT-0061 SiteとCustomerの所属・埋込み整合を保証する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-021、SPEC-DEEP-002、SPEC-DEEP-034、SCHEMA-MASTER-001
- 対象ファイル・シンボル: schemas `Site.customerId/customer/beforeUpdate`、`SiteActivatorCustomer`、`SiteManager`、Customer→Site同期
- 確認済み実装事実: customerId設定後のunsetは禁止するが別Customerへの変更は可能で、詳細UIもcustomerId editorを常時公開する。一覧はlive Customer、詳細等は埋込みCustomerを使う。Customer master更新時は`onUpdateCustomer`が同じcustomerIdのSiteへ埋込みCustomerを300件batchで伝播するが、複数batchはatomicでなくevent version guardもない。現行仕様は過去請求整合のためSite Customer変更を禁止する一方、CONF-0047には変更許可の回答履歴があり、正本と台帳が衝突している。
- 想定影響と発生条件: 現行UI/sourceでA→B変更すると仕様に違反し、schedule/result/billingが異なる所属・条件を保持し得る。通常Customer更新でもout-of-order/partial batchにより同じSiteの取引先表示・締条件が画面別に不一致となり得る。
- 未確認点・仮説: 既存A→B変更data、古いCustomer eventの順序逆転、partial batch件数、正本仕様を変更する正式承認は未確認。
- 推奨する将来対応: 現行仕様を優先し、仮登録の初回Customer設定後はcustomerId変更・unsetをRules/server/schema/UIで拒否する。Customer masterから埋込みsnapshotへの同期はsource revisionを持つ収束可能な処理とし、失敗を監視・再実行する。将来Customer移管を採用する場合は、先に仕様・ADR・migration・Billing影響・rollbackを正式変更する。
- 必要なテスト: 仮登録→初回設定、A→B/unset直接write拒否、同Customer master更新、out-of-order/replay、300件境界、partial failure/reconcile、一覧/詳細整合、既存違反data検出。
- ユーザー判断が必要な事項: CONF-0047の回答履歴と現行仕様のどちらを将来正本とするかはrepository conflictである。変更指示がない限り現行仕様の変更禁止を適用する。

## FUT-0062 Site status lifecycleと検索・編集境界を統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-021、SPEC-DEEP-010、SPEC-DEEP-034
- 対象ファイル・シンボル: schemas `Site.terminate`、`pages/sites/terminated.vue`、`SiteAutocomplete.vue`、`pages/sites/[id].vue`
- 確認済み実装事実: terminateは当日以降scheduleだけを阻止する。TERMINATEDもAutocomplete候補となり、詳細で編集・取引先変更・取極め変更・削除・再終了UIが表示される。再有効化経路はない。SPEC-DEEP-010で終了検索にloading/error/request sequenceがなく、連続検索responseの逆転防止もないことを確認した。SPEC-DEEP-034ではAutocomplete wrapper自体にもstatus constraintがなく、基本情報cardの工期片端欠損時に`null`文字列を表示することを確認した。
- 想定影響と発生条件: 終了Siteへの新規紐付けや終了後master改変、誤終了から回復不能、再終了errorが発生し得る。
- 未確認点・仮説: 限定訂正を許すfieldと監査schema、Agreementを再開時にどう選び直すかは実装設計未確認。
- 推奨する将来対応: TERMINATEDをread-only・新規選択不可とし、履歴表示と限定された監査付き訂正だけを許す。同一Customerでの再有効化は`sites:write`と理由を必須とする。Customer変更時はFUT-0061の方針を使い、Agreementは自動再有効化しない。archiveは誤登録等だけ、通常restoreは禁止する。
- 必要なテスト: ACTIVE→TERMINATED、検索/選択除外、履歴表示、一般編集拒否、限定訂正監査、同一Customer再有効化、Customer変更、Agreement非自動復帰、archive/restore拒否。
- ユーザー判断が必要な事項: なし。CONF-0048で方針確定済み。

## FUT-0063 Site archiveと参照guardを競合安全にする

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-021
- 対象ファイル・シンボル: schemas `Site.hasMany/logicalDelete`、client adapter `hasChild/delete/restore`、Site delete UI
- 確認済み実装事実: schedule/result/arrangement notificationだけをtransaction外queryで確認してarchiveする。adapterにrestore APIがあるがUIは復元不能と表示し、restore入口はない。
- 想定影響と発生条件: 確認後の新規参照とのrace、guard外参照の孤立、誤削除時の運用不能、説明と実装の不一致が起き得る。
- 未確認点・仮説: 全参照集合、保持期間、restore主体、終了とarchiveの使い分けは未決定。
- 推奨する将来対応: 参照policyを確定し、server transaction/lock等の競合安全な削除へ移し、UI説明とrestore運用を揃える。
- 必要なテスト: 各hasMany、guard外参照、同時参照作成、archive/restore、欠損Siteを読む下流。
- ユーザー判断が必要な事項: CONF-0049。

## FUT-0064 Site変更時の下流snapshot/live境界を確定する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-021
- 対象ファイル・シンボル: schemas `Site.getValidAgreement`、OperationResult site同期、Billing PDF Site取得
- 確認済み実装事実: OperationResultは作成等の時点でcustomerId/agreementを保存する一方、PDFのSite名は生成時live masterを使う。Site内Customerはさらに別時点の埋込みである。
- 想定影響と発生条件: Site名、Customer、取極め変更後に過去実績・請求の保存値と再生成帳票が異なる時点を表す。
- 未確認点・仮説: 監査上固定すべきfield、訂正・再発行・移管手続きは未決定。
- 推奨する将来対応: field別snapshot時点とrevision policyを仕様化し、欠損/archived master時も再現可能にする。
- 必要なテスト: Site名/Customer/Agreement変更前後、既存result/billing、PDF再生成、archive/missing master。
- ユーザー判断が必要な事項: CONF-0050。
## FUT-0065 Agreement編集権限とRules validationを正式化する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-022
- 対象ファイル・シンボル: `pages/sites/[id].vue` AgreementsManager、Sites Rules、schemas `Site.agreementsV2`
- 確認済み実装事実: `sites:read`で取極めの作成・更新・削除へ到達し、Rulesは同一会社UserにagreementsV2を含むSite全field writeを許す。SPEC-DEEP-013で、`AgreementsManager`自身にもpermission/field allowlistがなく、callerのSite/Company document全体updateへ委譲することを再確認した。
- 想定影響と発生条件: 閲覧利用者が請求単価・時間・締日を変更し、将来の実績・請求額へ影響できる。
- 未確認点・仮説: 取極め編集の正式role、承認workflow、field別権限は未決定。
- 推奨する将来対応: 取極め専用権限とserver/Rules validation、必要なら承認・監査履歴を設計する。
- 必要なテスト: role別UI/直接write、他社Site、field改変、同時編集。
- ユーザー判断が必要な事項: CONF-0051。

## FUT-0066 Agreementの単価・時間・締日validationを確定する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-022
- 対象ファイル・シンボル: schemas `AgreementV2/RateSet/WorkTimeBase`、Agreement Input
- 確認済み実装事実: 単価はdefault 0かつrequiredだがAgreement固有の負数・上限・精度validationがない。休憩・規定実働は負数のみ拒否し、勤務区間との相互上限を強制しない。SPEC-DEEP-013では0円をListItemが`-`表示する一方、Tableは欠損enum/rate/priceでthrowし得る表示差も確認した。
- 想定影響と発生条件: 負単価、極端な単価・時間、0円、休憩超過等が保存されると請求額が負・過大・意図せず0になり得る。
- 未確認点・仮説: 値引き目的の負単価、0円取極め、丸め精度、長時間勤務の正式許容範囲は未決定。
- 推奨する将来対応: field別範囲・精度・警告/拒否とserver validationを仕様化する。
- 必要なテスト: 負/0/小数/最大値、休憩>勤務、規定実働>勤務、日跨ぎ、4曜日一括入力。
- ユーザー判断が必要な事項: CONF-0052。

## FUT-0067 適用済みAgreementのrevision・削除policyを決める

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-022
- 対象ファイル・シンボル: `AgreementsManager` array CRUD、schemas `Site.agreementsV2/key`
- 確認済み実装事実: 過去日Agreementも直接更新・配列削除でき、status/archive/revision/参照guardがない。既存OperationResultは古いsnapshotを保持する。SPEC-DEEP-013ではcomponent自身に保存中single-flight/rollbackがなく、viewerの配列短縮・shift変更時にcurrent indexが範囲外へ残り得ることも確認した。
- 想定影響と発生条件: master履歴と過去実績の単価・締日が不一致となり、いつ誰が訂正したか追えない。
- 未確認点・仮説: 過去取極め訂正、適用済みlock、取消・改定、監査保持要件は未決定。
- 推奨する将来対応: 適用開始型revision、訂正履歴、削除制限、利用中参照の扱いを仕様化する。
- 必要なテスト: 過去/現在/未来Agreement編集削除、snapshot済み/未確定result、copy改定、同時編集。
- ユーザー判断が必要な事項: CONF-0053。

## FUT-0068 Agreement snapshotと再適用境界を明示・検証する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-022
- 対象ファイル・シンボル: schemas `Site.getValidAgreement`、`OperationResult.agreement/_syncCustomerIdAndApplyAgreement`
- 確認済み実装事実: 自動適用はdate+shiftTypeでSite masterから選び、OperationResultへobject snapshotする。group key変更時は再適用するが、通常のmaster変更には追随しない。
- 想定影響と発生条件: master訂正後も既存resultは旧単価を保持する一方、site/date/shift変更で新masterへ切替わり、請求差が生じる。
- 未確認点・仮説: 再計算・訂正の主体、確定後lock、手動適用外選択時の監査表示は未決定。
- 推奨する将来対応: snapshot確定時点、再適用trigger、手動override由来、再計算workflowを仕様化する。
- 必要なテスト: master変更前後、group key変更、手動適用外、取極めなし、locked result、Billing反映。
- ユーザー判断が必要な事項: CONF-0054。

## FUT-0069 AgreementV2の保存モデルと旧classを整理する

- 状態: Needs decision
- 重大度: Low
- 発見セグメント: SPEC-SEG-022
- 対象ファイル・シンボル: schemas `AgreementV2.collectionPath`、旧`Agreement`、Site embedded `agreementsV2`
- 確認済み実装事実: AgreementV2はcollectionPathを持つが現行UIはSite配列に埋込み保存し、専用Rules/独立CRUDはない。旧Agreement/deprecated APIも残る。
- 想定影響と発生条件: 将来実装が誤って独立collectionを正本と解釈し、二重保存・Rules欠落・旧新契約混在を招き得る。
- 未確認点・仮説: 独立collectionの過去/将来用途とmigration状況は未確認。
- 推奨する将来対応: 保存正本を文書化し、未使用collectionPath/旧classを廃止または明示的互換層にする。
- 必要なテスト: schema serialization、旧data読込、Site保存、migration対象、参照検索。
- ユーザー判断が必要な事項: CONF-0055。
## FUT-0070 SiteOperationSchedule操作権限とRulesを一致させる

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-023、SPEC-DEEP-031、SPEC-DEEP-038
- 対象ファイル・シンボル: operation-schedules pageSettings、schedule managers/actions、SiteOperationSchedules Rules
- 確認済み実装事実: `site-operation-schedules:read`で作成・更新・削除・通知・複製へ到達し、Rulesは同一会社User/super-userに全writeを許す。SPEC-DEEP-015で、ArrangementsManager component群自身にrole/permission検査がなく、worker notification操作もgeneric managerへ直接渡すことを再確認した。SPEC-DEEP-031で、OperationSchedules route/table/selector/order dialogにもwrite role・tenant・field allowlist再検査がなく、Company `scheduleOrder`全体更新とschedule CRUDへ到達することを確認した。SPEC-DEEP-038で、現場詳細pageが`sites:read`だけで予定Manager CRUDへ到達し、WorkerDetailManagerの公開methodにもactor/tenant/permission再検査がないことを確認した。
- 想定影響と発生条件: 閲覧利用者が予定、worker、通知flag、operationResultIdを直接改変できる。
- 未確認点・仮説: 配置編集、通知、削除、確定解除の正式roleは未決定。
- 推奨する将来対応: 操作別権限とfield ownershipを定義し、UI/Rules/server入口を一致させる。
- 必要なテスト: role別route/button/direct write、他社site/worker ID、notify/delete/lock field。
- ユーザー判断が必要な事項: CONF-0056。

## FUT-0071 Schedule displayOrder・SiteShiftTypeOrder・同時編集を競合安全にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-023、SPEC-SEG-052、SPEC-DEEP-024、SPEC-DEEP-031、SPEC-DEEP-035
- 対象ファイル・シンボル: `SiteOperationSchedule.create`、`updateSchedules`、card optimistic update、`Draggable/{OperationSchedules,SiteShiftTypeOrder}`、`useSiteShiftTypeOrderActions.update`、Company `siteOrder/scheduleOrder`
- 確認済み実装事実: 最大displayOrder queryはcreate transaction外で、同時createが同じ+1を採り得る。scheduleのdrag一括更新はtransactionだがversion/preconditionはない。Companyの表示順更新は配列全体をinstanceへ先に代入してCompanyをupdateし、transaction/version/precondition、失敗時rollback、例外再throwがない。保存中もreorder draft自体はdrag可能で、重複保存entry、欠損Site、補完だけのentryを正規化しない。SPEC-DEEP-015で、range facadeのgroupKey indexは同一site/shift/dateの後方scheduleで前方を上書きし、duplicateを画面で明示しないこと、focused date以外のUI disableは同日内・別tabの競合を防がないことを追加確認した。SPEC-DEEP-024で、OperationSchedules dragは並び替えた配列を直ちにemitするだけでdisplayOrder再採番、loading latch、error/rollbackを持たず、SiteShiftTypeOrder dragもattrs透過だけのwrapperであることを確認した。SPEC-DEEP-031で、OperationSchedulesManagerのreorder dialogはerrorを吸収する`update` actionをawaitするためCompany update失敗時もcloseし得ること、public remove-order APIのdisable判定が現在range内のscheduleだけを見ることを確認した。SPEC-DEEP-035で、親prop更新がopen中draftを無通知resetし、loading中もdrag可能、submitはclone・validation・awaitなしで内部配列をemitし、差し替え用fetch propも未使用であることを確認した。
- 想定影響と発生条件: 同一group同時作成・並べ替え・個別編集、別端末のCompany設定/表示順更新、保存失敗で、順序重複・後勝ち上書き・画面だけ更新済みの状態が起き得る。
- 未確認点・仮説: FireModel updateの送信field粒度・暗黙precondition、offline再送、UIの同時利用頻度は未確認。
- 推奨する将来対応: group順序をtransaction内で採番し、Company表示順にはrevision/preconditionまたは専用document/server更新と競合再読込を導入する。保存失敗をcallerへ返して旧値へ戻し、重複・欠損entryの扱いを明示する。
- 必要なテスト: 2client同時create、drag対drag、drag対Company設定更新、保存拒否/timeout/offline、rollback/refetch、重複key、削除/archive Site、transaction retry、同一displayOrder表示。
- ユーザー判断が必要な事項: CONF-0057。

SPEC-DEEP-039b追加根拠: caller不在の旧`useSiteOrderManager`もCompany配列を先に全置換してerrorを吸収し、replacement arrayはinitialize時のadd/change/remove helperをsubscription再初期化まで失う。

SPEC-DEEP-040追加根拠: `siteShiftTypeOrder/useSiteShiftTypeOrderActions.js` もCompanyのorder配列をremote update前に直接変更し、失敗をloggerへ渡して吸収する。rollback・最新値再取得・callerへの失敗結果がない。

SPEC-DEEP-043追加根拠: order data layerは未知typeを空配列へ畳み込み、保存済み重複/invalid entryを保持したままmissing `SiteOrder` instanceを末尾へ連結する。plain objectとinstanceが混在し、Site fetch失敗・削除Site・重複keyを正規化しない。

## FUT-0072 ScheduleのOperationResult lockをserver境界で強制する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-023、SPEC-DEEP-031、SPEC-DEEP-038
- 対象ファイル・シンボル: `SiteOperationSchedule.operationResultId/isEditable/beforeUpdate/beforeDelete`、Rules
- 確認済み実装事実: UI/schemaは_beforeData.operationResultIdでupdate/deleteを拒否するが、RulesはoperationResultId変更やlocked schedule direct writeを制限しない。SPEC-DEEP-031で、Table Selectorはlocked scheduleにもedit/duplicate iconを表示し、component自身はlock/loading/permissionを表示・disableしないことを確認した。manager/schemaの後段拒否に依存する。SPEC-DEEP-038で、WorkerDetailManagerの公開create/update/deleteはschedule lockを再検査せず、SiteOperationSchedulesManagerもAir managerのdisableに依存するため公開submit経路を止めないことを確認した。
- 想定影響と発生条件: 直接writeでlock解除・予定改変・削除を行うとOperationResultとの1対1整合が崩れる。
- 未確認点・仮説: super-user修復、OperationResult削除時unlockの正式主体は未決定。
- 推奨する将来対応: server transaction/RulesでResult存在と許可transitionを検証し、修復経路を分離する。
- 必要なテスト: locked update/delete、operationResultId改変、Result create/delete競合、super-user修復。
- ユーザー判断が必要な事項: CONF-0058。

## FUT-0073 Schedule通知flag・cascade・失敗復旧を保証する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-023、SPEC-DEEP-024、SPEC-DEEP-038
- 対象ファイル・シンボル: `SiteOperationSchedule.update/delete/notify`、application actions、`Draggable/Workers`
- 確認済み実装事実: 通知documentとflag/cascadeはtransaction化されるが、snapshot購読により失敗時instance rollback不能の場合がschema commentにある。actionsはerrorを吸収する。SPEC-DEEP-015で、配置管理facadeはnotify結果を利用者へ表示・返却せず、共通row lock/rollback/refetchを提供しないことを確認した。SPEC-DEEP-024で、Worker dragはinternal schedule mutation例外をloggerへ記録して吸収し、元modelへの明示rollback、callerへのreject/error、再fetch指示を持たないことを確認した。SPEC-DEEP-038でWorkerDetailManagerもschedule instanceを先にmutateしてからupdateし、失敗時にloading解除以外のrollback/refetchを行わないことを確認した。
- 想定影響と発生条件: transaction失敗・retry・競合後、画面が誤った通知済み状態を示し、利用者が再通知/再編集結果を判断できない。
- 未確認点・仮説: subscriptionが常に正本へ収束する時間、UI error表示と手動retry導線は未確認。
- 推奨する将来対応: 失敗時にserver stateを再fetchしてinstanceを置換し、結果をcallerへ返し、idempotent retryを提供する。
- 必要なテスト: notify/update/delete各段階失敗、transaction retry、onSnapshot競合、二重click、再通知。
- ユーザー判断が必要な事項: CONF-0059。

SPEC-DEEP-040追加根拠: application schedule actionsはnotify/update/bulk updateのerrorをloggerへ渡して吸収する。normalizeはtransaction前にschedule instanceを変更するため、remote failure時もlocal objectへ変更が残り得る。

## FUT-0074 Schedule複製・過去変更・worker充足validationを確定する

- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-023、SPEC-DEEP-031、SPEC-DEEP-036、SPEC-DEEP-037
- 対象ファイル・シンボル: `duplicate`、schedule input、Operation personnel getters、Card Actions
- 確認済み実装事実: 実績作成済みscheduleも複製buttonが有効。最大20日、同日除外、既存groupへの追加を許す。OperationResult未作成なら過去予定も変更/削除でき、必要人数・資格不足は表示用で保存を拒否しない。SPEC-DEEP-031で、Selector/duplicatorは`isEditable`を検査せずlocked scheduleをtemplateとして複製でき、同じtransaction内で元linkをnullにした新規scheduleを作ることを確認した。SPEC-DEEP-036で、実効OJT/外注人数を使う過不足iconに対し必要人数avatar色はschedule元値を使い、通知override後に同一card内の表示が食い違い得ることを確認した。SPEC-DEEP-037ではListItemが`workers.length`を配置人数として表示し、OJT除外・外注amountを使う実効人数と一致しないこと、Selectorの編集・複製・作成buttonもlock/permissionを検査しないことを確認した。
- 想定影響と発生条件: 意図しない重複予定、過去配置の改変、資格/人数不足のまま通知・運用が進む可能性がある。
- 未確認点・仮説: 重複予定、実績済みからのtemplate複製、過去訂正、不足許容の正式方針は未決定。
- 推奨する将来対応: 複製元/先、過去日、重複、人数・資格不足の警告/拒否規則を仕様化する。
- 必要なテスト: locked元複製、20/21日、既存group、過去日、0人、不足/超過、資格者0、OJTのみ。
- ユーザー判断が必要な事項: CONF-0060。
SPEC-DEEP-039b追加根拠: root duplicatorはschema duplicate失敗をcatchしてrethrowしないためAir managerがsuccess/quitへ進み得る。公開submitはdisableSubmitを内部強制せず、0/21件のUI制約もprogrammatic pathではguardにならない。

## FUT-0075 Employee個人情報の閲覧・編集権限を最小化する

- 状態: Needs decision
- 重大度: Critical
- 発見セグメント: SPEC-SEG-024、SPEC-SEG-051、SPEC-DEEP-025、SPEC-DEEP-027
- 対象ファイル・シンボル: employees pageSettings/pages、`Employee/Activator/**`、`components/Employees/**`、`components/Insurance/**`、Employees/Employees_archive Rules、Employee全field
- 確認済み実装事実: `employees:read` routeと同一会社User全read/write Rulesで、生年月日、住所、国籍/在留、血液型、緊急連絡先、本籍、保険、退職理由等を閲覧・変更できる。保険Managerにも追加write guardはなく、被保険者番号、加入/喪失日・理由、履歴をEmployee全体と一括で表示・保存する。RESIGNED詳細でも操作可能である。SPEC-DEEP-025でBase/Nationality/SecurityGuardがこれらのPIIをmaskせず表示し、edit action自身にpermission/loading判定がないことをfile単位で確認した。SPEC-DEEP-027でEmployeesManagerのcreate入口と3 Insurance Managerにもwrite permission、mask、audit、single-flightがなく、親のasync保存失敗時にlocal遷移を戻さないことを確認した。
- 想定影響と発生条件: 同一会社の広い利用者へ高感度個人情報が露出し、改ざん・過剰収集・目的外利用のriskがある。
- 未確認点・仮説: 正式role、本人閲覧、field別担当、監査・保持の法的要件は未決定。
- 推奨する将来対応: 最小権限のrole/field/API分割、Rulesまたはserver read model、監査log、archive境界を設計する。
- 必要なテスト: role/本人/労務/管制/管理者別read-write、保険番号/history masking、直接query/update、RESIGNED/archive、他社path、監査。

- ユーザー判断が必要な事項: CONF-0061。

## FUT-0076 Employee/User 1対1と退職・削除cleanupを保証する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-024、SPEC-DEEP-025
- 対象ファイル・シンボル: `Employee.toTerminated`、`EmployeeUserManager`、`onEmployeeDeleted`、`User.employeeId`
- 確認済み実装事実: User.employeeIdはoptionalで一意制約がなく、UI/退職/削除triggerはquery先頭Userだけを扱う。SPEC-DEEP-001で`onEmployeeDeleted`本文を再確認し、複数一致でも`users[0]`だけを削除してreturnし、残件検査/reconcileがないことを確認した。退職検索はtransaction外、物理削除cleanupは後続trigger。SPEC-DEEP-025で、detail pageの退職/Employee削除buttonが購読結果でなく初期空Userの`isAdmin`を参照し、admin紐付きでも事前disableされないこと、削除dialogがUserを「同時に削除」と説明する一方でEmployee archiveとUser trigger cleanupは別eventであることを確認した。
- 想定影響と発生条件: duplicate User、検索後競合、trigger失敗でlogin可能Userだけが残る、admin判定漏れが起き得る。
- 未確認点・仮説: 既存dataの予約欠損・duplicate、Auth account cleanupの実環境状態は未確認。
- 推奨する将来対応: 2026-08-24に確定したUWB-07A/B契約に従い、Employee予約を正本にした0/1関係、`employees:terminate`、会社管理者専用offboarding、統合`LifecycleOperations`、対象lock、本登録UserのAuth削除intent、idempotent cleanup/reconcileを実装する。仮User連携は既存仮登録削除後のEmployee-only再実行を要求し、emailからAuthを推定削除しない。UWB-08のRules閉鎖と同じrelease gateにする。
- 必要なテスト: Employee-only/仮User拒否/本登録User/単独User、予約欠損・複数User、admin/super-user、同時User作成、退職/delete trigger失敗・retry、Auth残存、他tenant email再利用。
- ユーザー判断が必要な事項: actor・target・archive・audit・reconcileのUWB-07仕様は回答済み。保持期間とProd運用条件は別途確定が必要。

## FUT-0077 Employee雇用状態・将来退職・復職workflowを確定する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-024、SPEC-DEEP-011
- 対象ファイル・シンボル: `Employee.toTerminated/beforeUpdate`、resignation UI、employee range queries
- 確認済み実装事実: 退職処理は指定日が将来でも即RESIGNED/User削除となる。復職methodなし。RESIGNEDでも多くのmaster編集・archiveは可能。SPEC-DEEP-011でRESIGNED detailは基本・国籍・保険・警備員・資格updateとdeleteを表示し続け、退職者検索にも共通create actionが残ることを確認した。
- 想定影響と発生条件: 退職予定者が予定日前にlogin/worker候補から外れ、訂正・復職が正式経路で行えない。
- 未確認点・仮説: 将来退職予約、予約取消、実際の退職期間を伴う再雇用時のEmployee ID・雇用期間model、退職後編集範囲は未決定。
- 推奨する将来対応: UWB-07では退職日をserverTodayJST以前に限定し、会社管理者専用UWB-07Cで完了済み退職の誤操作だけを同じEmployee IDのACTIVEへ訂正する。旧User/Authは復元せず、必要なら通常provisioningで新UIDを作成する。将来退職と真の再雇用は別のeffective-date workflowとして設計する。
- 必要なテスト: 当日/過去退職、未来拒否、完了済み退職の訂正、旧User/Auth非復元、期間query、User再provision、真の再雇用を訂正操作が拒否すること。
- ユーザー判断が必要な事項: 誤退職訂正は回答済み。将来退職と実際の再雇用modelはCONF-0063に残る。

## FUT-0078 Employee archiveと全参照保持・復元を設計する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-024
- 対象ファイル・シンボル: `Employee.hasMany/logicalDelete`、client adapter delete、Employees archive Rules
- 確認済み実装事実: delete guardはschedule/result/arrangement notificationだけ。日次勤怠・日次稼働・現場履歴等のemployeeId参照はguard外。child queryはtransaction外で、UI restore経路なし。
- 想定影響と発生条件: guard外履歴の表示名欠損、同時参照追加、誤削除回復不能、保存義務のある個人/勤怠dataとの不整合が起き得る。
- 未確認点・仮説: 通常退職はEmployeeをarchiveせず保持し、誤退職は専用ACTIVE訂正を使う方針を確定した。退職者の保持期間、法定保持後匿名化、誤登録archive、archive restoreは未決定。
- 推奨する将来対応: 参照catalogと退職/削除/匿名化/restore policyを定義し、競合安全なserver処理へ移す。
- 必要なテスト: 全参照collection、同時予定/実績追加、archive/restore、過去勤怠表示、保持期限。
- ユーザー判断が必要な事項: CONF-0064。

## FUT-0079 Employee code・派生氏名・候補statusの整合を保証する

- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-024、SPEC-DEEP-025
- 対象ファイル・シンボル: schemas `Employee.code/displayName/displayNameKana/tokenFields`、Employee Autocomplete/Select/list queries
- 確認済み実装事実: codeは任意・非採番・非一意。姓名はdisplayNameを更新するが姓名カナからdisplayNameKanaを更新するtriggerはない。AutocompleteはRESIGNEDを除外しない。SPEC-DEEP-025で、EmployeeSelectが任意codeへ`localeCompare`を直接呼び、空codeで例外になり得ること、現行唯一のtag callerはcomment内で未到達であることを確認した。
- 想定影響と発生条件: 重複code、検索/並びのstaleカナ、退職者の新規worker選択が起き得る。
- 未確認点・仮説: code一意性、通称の独立編集、退職者選択の正式範囲は未決定。
- 推奨する将来対応: code policy、表示名/カナのsource、用途別candidate statusを仕様化しvalidation/queryを揃える。
- 必要なテスト: code重複/空、姓名/カナ変更、通称、ACTIVE/RESIGNED autocomplete、cache後退職。
- ユーザー判断が必要な事項: CONF-0065。

## FUT-0080 User/Auth管理のserver認可とfield制約を実装する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-025、SPEC-DEEP-035
- 対象ファイル・シンボル: `firestore.rules` Users match、`auth-v2.disableUser/enableUser/changeAdminUser`、UsersManager、`components/organisms/ChangeAdminUserDialog/index.vue`
- 確認済み実装事実: UIはadmin向けだがRulesは同一会社UserにUser全fieldのread/writeを許す。2026-08-14〜15にdisable/enable/changeAdminはcaller UID/company、会社管理者、target User/Authをserver検証するよう改修し、一般User・別tenant・別人from・仮登録・無効・管理者targetを更新前に拒否する。SPEC-DEEP-035で、有効化・無効化UIに確認・理由・監査・single-flightがなく、employee-linked UserのdisableDeleteもAir managerがerror後に処理を続けるため、公開submit経路ではUser/Auth削除連鎖へ到達し得ることを確認した。
- 想定影響と発生条件: Callableの旧actor/tenant経路は修正したが、一般Userの直接Firestore writeによりroles、isAdmin、disabled、employeeId等を改変できる。User管理UIの二重送信、削除連鎖、監査不足も別途残る。
- 未確認点・仮説: 仮登録管理actor、UWB-05の既知preset限定role・本人`displayName`/`tagSize`、UWB-07Bの単独本登録User削除actor・target・物理削除・再作成契約は確定した。既存data不整合、super-user repair権限、UWB-08 Rulesは未確定または未実装である。
- 推奨する将来対応: 2026-08-21に仮登録作成・削除を`users:provision`、role・通知等の管理を`users:write`へ分離した。managerへ両方、human-resourceへprovisionだけを明示付与し、provision-only actorの非空rolesを拒否する。UWB-05でroleを既知presetへ限定し、本人更新を`displayName`・`tagSize`へ限定した。UWB-07Bは会社管理者だけに単独本登録User削除を許可する。後続gateではAdmin SDK CallableとRulesでtenant・permission・doc ID/UID・immutable fieldを強制する。
- 必要なテスト: 一般/admin/super-user、本人/他人/他社UID、roles/isAdmin/companyId/disabled直接write、管理者移譲偽装。
- ユーザー判断が必要な事項: 仮登録管理actor・role値・本人設定fieldはCONF-0066、本登録User削除はCONF-0068で回答済み。super-user repair権限だけを後続gateで個別確認する。

2026-08-15の管理者移譲改修でcaller本人性、唯一の会社管理者、対象disabled/temporary、User/Auth company・UID整合をtransaction更新前に検証するよう変更した。理由・監査の要否とRulesの直接write境界は既存FUT/CONFで継続し、新規FUT/CONFは追加しない。

## FUT-0081 Auth・Firestore・claimsの部分状態を回復可能にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-025
- 対象ファイル・シンボル: `useCreateNormalUser.signupUser`、`useCreateAdminUser.signupAdmin`、`apis/setupUserAccount`、`apis/createAdminAccount`、`apis/checkEmailAvailability`
- 確認済み実装事実: Auth作成、verification mail、Firestore transaction、claims設定はatomicでない。Firestore移行後claims失敗は補償されず、一般User再実行は仮doc消失で失敗する。初期管理者はメール確認後にCompany/User/claimsを作成し、claims失敗後の整合した既存Company/Userを再利用できるが、同時実行競合、Auth-only、不整合な部分状態は残り得る。本登録User削除でもAuth削除成功からemail予約解放までの間に同emailの新Auth UIDが作成され、再登録を阻害するAuth-only部分状態が残り得る。
- 想定影響と発生条件: network/Admin SDK/trigger失敗でAuth-only、Firestore-only、claims欠損のaccountが残り、login初期化やtenant accessが不能・不整合になる。
- 未確認点・仮説: 運用reconcile、監視、既存orphan件数は未確認。
- 推奨する将来対応: idempotent setup state machine、再実行可能なclaims設定、signup leaseまたは同等のserver-verifiable gate、orphan検出・管理者repairを設計する。UWB-07は競合する新UIDをemailから推定削除しない。
- 必要なテスト: 各段階failure、同一request retry、二重click、既存Auth/User/Company組合せ、trigger遅延、Auth削除直後から予約解放までの同email signup競合、新UID非削除とrepair検出。
- ユーザー判断が必要な事項: CONF-0067。

SPEC-DEEP-039a追加根拠: 一般/admin signupとも後段失敗時にrollback/resumeせず、内部UID付きsupport案内だけを返す直列flowを再確認した。

## FUT-0082 User doc ID・仮登録email・Employee linkの不変条件を強制する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-025、SEC-002、SCHEMA-MASTER-001
- 対象ファイル・シンボル: schemas `User`、`setupUserAccount`、Users Rules、`EmployeeUserManager`
- 確認済み実装事実: 本登録処理はdoc ID=Auth UIDを採るがRules/schemaは強制しない。仮User emailとemployeeIdに一意制約がなく、事前登録検索は複数一致の先頭を使用する。SEC-002では、attacker tenantへ別UIDをdoc IDとするUserを作成し、そのglobal UIDをAuth update/delete targetとして扱わせるsource chain、およびemail ownership確認前に通常clientがsetupを呼べるchainを確認した。token email一致は`email_verified`や一回限りinvite proofを代替しない。
- 想定影響と発生条件: 重複仮登録、誤employee紐付け、invitation takeoverに加え、任意doc IDを書けるactorが別tenantのglobal Auth accountをdisable・更新・削除し得る。影響がcross-tenant Auth hard deletionを含むためCriticalとした。
- 未確認点・仮説: 既存重複件数と予約documentの具体path・migrationは未確認である。
- 推奨する将来対応: 2026-08-16に1 Employee対最大1 Userを確定した。単独仮UserとEmployee連携仮Userの公開作成操作を分け、server予約/indexと作成Callableでemail、UID、同一会社Employeeの存在・未紐付け・employeeId一意性をtransactionally検証する。
- 必要なテスト: 同時仮登録、同email複数company、同employee複数User、任意doc ID、本登録競合。
- ユーザー判断が必要な事項: Employee/Userの0/1関係と予約正本はCONF-0062で回答済み。招待・本人確認・既存重複dataはCONF-0067に残る。

SPEC-DEEP-039a追加根拠: pageが表示した`preRegData`をsubmitへ渡さず、composableがemailで先頭docを再検索してverification成立前にsetupする。表示対象・setup対象・mailbox所有を同じone-time proof/revisionへbindしない。

2026-08-15に、確認済みAuth emailへ完全一致する一意の仮登録だけを選ぶpolicy、会社ID・仮User IDをclient入力として受け取らないuse-case、内部識別子を返さないerror mappingを追加し、既存Callableとメール確認後client flowへ接続した。local EmulatorとChromeで一般User本登録を確認済みだが、一般Userのclaims失敗後回復、rate limit/App Check、既存重複dataは未解決である。仮User削除ではAuth削除triggerを停止するが、本登録User doc IDを利用するglobal Auth削除のRules/claim境界は残る。

## FUT-0083 User/Auth同期triggerの失敗と遅延を可視化・修復する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-025
- 対象ファイル・シンボル: `onUserUpdated`、`onUserDeleted`、`switchUserEnabled`、`onAuthUserDeleted`
- 確認済み実装事実: disabled/displayNameはFirestore先行でAuth反映を非同期triggerに委ね、削除もFirestore先行でAuthを後続削除する。SPEC-DEEP-001でUser delete→Auth delete→Auth delete event→FcmToken cleanupの3段chainと、最後のcleanup失敗だけがcatchで吸収されることを本文再確認した。仮User signupではclientがAuthentication accountを直接作成してからFirestore本登録へ進むため、仮登録削除との競合でAuth-only部分状態が残り得る。email・claim不存在・未setup状態だけでは、そのAuthが当該仮登録から作成されたことをserverが証明できない。現行通知dispatcherはUser存在だけで送信しdisabled・temporary・company一致を検査せず、raw tokenを含むprovider responseやtoken断片・payloadをlogへ出す経路がある。FcmTokens Rulesもactive registered Userとcompany一致を要求しない。
- 想定影響と発生条件: trigger失敗・遅延時に無効化したUserがlogin可能、削除済みUserのAuthが残存、表示名差異、token残存が起き得る。
- 未確認点・仮説: Functions retry/alert、定期reconcile、利用者向け反映待ち表示は未確認。
- 推奨する将来対応: 無効化の同期状態と監視を設ける。UWB-07の本登録User物理削除はFirestore先行triggerを主体にせず、統合`LifecycleOperations`、Auth削除intent、idempotent retry/reconcile、明示的FCM cleanupでserver完了を確認する。通知dispatcherとFcmTokens Rulesはactive registered User・company一致を必須にし、token・payload logをallowlist化する。仮登録削除raceで残るAuth-only accountは、signup leaseまたは同等のserver-verifiable provenanceを導入するか、安全な管理者repairとして別途設計し、UWB-07Aからemail検索削除しない。
- 必要なテスト: update/delete trigger失敗・retry、Auth user不存在、連続enable/disable、削除再作成、仮登録削除とsignupの競合、provenance不明Authの非削除、disabled/temporary/company不一致Userのtoken write・通知拒否、queued通知、FCM cleanup失敗、logger token/payload非出力。
- ユーザー判断が必要な事項: 物理削除・退職・誤退職訂正の契約はCONF-0068で回答済み。無効化triggerの監視・repair運用は未確定。

## FUT-0084 未認証の事前登録照会を列挙・abuseから保護する

- 状態: In progress
- 重大度: High
- 発見セグメント: SPEC-SEG-025、SEC-002
- 対象ファイル・シンボル: `checkUserPreRegistration`、`checkEmailAvailability*`
- 確認済み実装事実: 2026-08-16に応答を`isPreRegistered`だけへ縮小し、companyId、displayName、roles、tempUserIdの匿名公開を廃止した。複数temporary Userも先頭採用せず拒否する。`checkEmailAvailability`は初期管理者signup専用となり、emailだけでAuthと全Userを確認するが、登録有無の応答差と、App Check、rate limit、challengeの不在は残る。
- 想定影響と発生条件: email推測・列挙により事前登録の存在有無を判別でき、無制限呼出しでquota abuseとなり得る。所属会社識別子、氏名、role、仮doc IDの直接漏えいは解消済みである。
- 未確認点・仮説: App Check、platform側rate limit、招待secretの別実装は未確認。
- 推奨する将来対応: App Check/rate limit、opaque invitation token、enumeration-resistant responseを検討する。
- 必要なテスト: 未認証列挙、存在/不存在response差、rate limit、期限切れ/再利用token、他社email。
- ユーザー判断が必要な事項: CONF-0069。

## FUT-0085 Outsourcer CRUDの正式権限とRulesを一致させる

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-026、SPEC-DEEP-011、SPEC-DEEP-033
- 対象ファイル・シンボル: outsourcers pageSettings/Manager、`components/Outsourcers/{Manager,Iterator}/index.vue`、Outsourcers/Outsourcers_archive Rules
- 確認済み実装事実: `outsourcers:read`でCRUDへ到達し、Rulesは同一会社Userにlive/archive全read/writeを許す。SPEC-DEEP-011でpageはdefault create/update/deleteをguardなしで公開し、空検索limit 10に対してmanager page size 20を指定することを確認した。SPEC-DEEP-033でManagerが`showCreate=false`でもtoolbar createを常時表示し、component自身にwrite/role/loading/rollback/error契約がないことを再確認した。
- 想定影響と発生条件: 閲覧Userが外注先を作成・改変・終了・archiveし、配置候補や過去表示を変え得る。
- 未確認点・仮説: 正式な外注先管理role、本人/管制/請求担当の必要範囲は未決定。
- 推奨する将来対応: read/create/update/status/archive/restoreを分け、UIとRulesまたはserver APIを一致させる。
- 必要なテスト: role別route/button/direct write、archive直接write、他社path、field別更新。
- ユーザー判断が必要な事項: CONF-0070。

## FUT-0086 外注会社と外注警備員個人のデータモデルを決定する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-026、SPEC-DEEP-024、SPEC-DEEP-033
- 対象ファイル・シンボル: schemas `Outsourcer`、`Operation.outsourcers.add`、ArrangementNotification workerId、`WorkersTable`
- 確認済み実装事実: Outsourcerは会社masterのみ。同一会社の複数人はdoc ID+一時indexで表し、個人の永続ID、氏名、資格、連絡先、所属statusを持たない。SPEC-DEEP-024で、worker結合/mutationは`workerId`を使う一方、WorkersTableのVue keyと表示cacheはraw `id`を使うことを確認した。employee/outsourcerのraw IDが同じ場合、表示行key衝突候補となる。SPEC-DEEP-033で、配置TagとOperationResult worker inputも会社doc IDを名称解決/候補選択に使い、個人識別を追加しないことを確認した。
- 想定影響と発生条件: 個人別資格・通知・実績・監査・同一性が必要になると、indexの再生成や並べ替えで個人を追跡できない。
- 未確認点・仮説: 外注個人をAirGuardで管理する正式要件と個人情報保持責任は未決定。
- 推奨する将来対応: 会社masterと外注警備員masterを分けるか、人数単位運用を維持するかを仕様化し、ID/snapshot/資格/通知契約を決める。
- 必要なテスト: 同一会社複数人、並べ替え、資格/OJT、通知、実績化、退職/所属変更、個人情報権限。
- ユーザー判断が必要な事項: CONF-0071。

## FUT-0087 Outsourcer終了・archive・参照保持を整合させる

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-026
- 対象ファイル・シンボル: `Outsourcer.contractStatus/logicalDelete/hasMany`、client adapter delete、下流ID fetch
- 確認済み実装事実: 終了はstatus変更だけ。削除guardはSchedule/OperationResultのみでNotificationを含まず、archive後はlive ID fetchが失敗し得る。restore UIはない。
- 想定影響と発生条件: 通知のみ参照、guard競合、誤archiveにより名称欠損・候補消失・復旧不能が起き得る。
- 未確認点・仮説: 終了後の過去表示、restore、保持期間、通知参照の正式要件は未決定。
- 推奨する将来対応: 全参照catalog、終了/削除/restore policy、snapshot表示fallback、競合安全なserver guardを設計する。
- 必要なテスト: Schedule/Result/Notification各参照、並行参照作成、終了後表示、archive/restore、欠損master。
- ユーザー判断が必要な事項: CONF-0072。

## FUT-0088 Outsourcer候補のACTIVE制約を利用経路で統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-026、SPEC-DEEP-033
- 対象ファイル・シンボル: `useOutsourcersInRange`、`useFetchOutsourcer.searchOutsourcers`、`OutsourcerAutocomplete`
- 確認済み実装事実: 配置rangeはACTIVE限定だが汎用Autocomplete検索はstatus条件を付けず、終了済み外注先を返し得る。SPEC-DEEP-033でOperationResult worker inputがこのAutocompleteを直接選ぶことを確認した。
- 想定影響と発生条件: status非限定Autocomplete利用画面でTERMINATED外注先を新規予定・実績へ選べる可能性がある。
- 未確認点・仮説: 各Autocomplete利用元が別途制約するか、過去訂正で終了先を選べる必要性は未確認。
- 推奨する将来対応: 用途別`activeOnly/includeTerminated`契約を明示し、defaultを安全側へ統一する。
- 必要なテスト: ACTIVE/TERMINATED検索、cache混入、過去訂正、新規配置、ID指定表示。
- ユーザー判断が必要な事項: CONF-0073。

## FUT-0089 Outsourcer validation・検索・表示の不整合を整理する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-026、SPEC-DEEP-033
- 対象ファイル・シンボル: schemas `Outsourcer`、outsourcers page、`OutsourcerAutocomplete`
- 確認済み実装事実: codeは任意/非一意でtoken検索外。一覧query limit 10と表示20が不一致。AutocompleteはOutsourcer候補にEmployeeListItemを使う。契約日fieldなしでrange引数はfilter未使用。SPEC-DEEP-033でIteratorのdeclared `hideDefaultFooter`がrootへ転送されず、OutsourcerListItemはAutocomplete default rendererにも静的callerにも現れない候補であることを確認した。
- 想定影響と発生条件: 重複識別、期待件数不足、型責務混在、期間指定が効くとの誤解を招く。
- 未確認点・仮説: code採番・一意性、一覧pagination、将来契約期間要件は未決定。
- 推奨する将来対応: code policy、query/page size、専用ListItem、range API名・契約期間modelを整理する。
- 必要なテスト: code空/重複/検索、10件超pagination、Autocomplete表示、期間変更、status sort。
- ユーザー判断が必要な事項: CONF-0073。

## FUT-0090 Company rootの認可・field ownership・削除禁止を強制する

- 状態: In progress
- 重大度: Critical
- 発見セグメント: SPEC-SEG-027
- 対象ファイル・シンボル: Company pageSettings/Manager、`firestore.rules` Companies match、schemas `Company`
- 確認済み実装事実: UIはadmin限定だが、同一会社の有効な本登録UserはCompany全fieldをclientから更新できる。2026-08-27にclient create/deleteを無条件拒否し、初期Company作成をCloud Functions/Admin SDK専用とした。銀行・請求・Stripe/subscription・maintenance・設定・取極めは引き続き同一docにあり、SPEC-SEG-028でcompany maintenance、SPEC-SEG-029でstripeCustomerId/subscription/customerType元データもclientが直接変更可能と確認した。SPEC-DEEP-020でCompanyManager/Activator自身にrole/field ownership guardがなく、直接`item.update(item)`へ委譲することを再確認した。
- 想定影響と発生条件: Company rootのclient作成・削除によるtenant破損は閉じたが、一般Userは依然として口座/請求表示を改ざんし、subscription/maintenanceを偽装できる。
- 未確認点・仮説: 正式な設定担当、server-owned field、super-user repair、各fieldをclient RulesとFunctionsのどちらで更新するかは未決定。
- 推奨する将来対応: CUDを一律Functions化せず、Company機能ごとにactor、field ownership、整合性、監査、同時実行、offline要件を確定し、必要な更新だけをfield/action別Rulesまたは管理Callableへ移す。
- 必要なテスト: role別read/write、口座/請求/Stripe/maintenance直接write、Company delete、他社doc、super-user repair。
- ユーザー判断が必要な事項: CONF-0074、CONF-0075。

## FUT-0091 Company/Auth tenant作成の部分状態とidentityを回復可能にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-027
- 対象ファイル・シンボル: `functions/apis/createAdminAccount.js`、Company/User transaction、custom claims、`useAuthActions`
- 確認済み実装事実: Companyとadmin Userはtransactionだがclaims設定は後続。tenant identityはCompany doc ID/claim/prefixにまたがり、移転・再concile経路はない。
- 想定影響と発生条件: claims失敗・誤Company削除でAuth account、User、Company、subcollectionsのanchorが不一致になる。
- 未確認点・仮説: orphan Company/Userの検出・support修復運用は未確認。
- 推奨する将来対応: idempotent provisioning state、anchor整合検査、repair callable、削除保護を実装する。
- 必要なテスト: claims前後failure、再実行、Company欠損、User欠損、誤claim、同一Auth二重作成。
- ユーザー判断が必要な事項: CONF-0075。

## FUT-0092 Company設定のvalidationと編集fieldを整合させる

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-027
- 対象ファイル・シンボル: Company Activator Base/Bank/Setting、schemas `Company.isCompleteRequiredFields`、Rules
- 確認済み実装事実: 基本editorはzipcode/prefCode/city/buildingを含めないがcomplete getterは住所構成fieldを要求する。数値/enum/口座/請求番号validationは主にUI attrsでRules強制がない。SPEC-DEEP-020でCompanyManagerのdoc validatorはCompany instanceでなくObjectだけ、invoice表示はstored値へ常に`T`を付加、legacy SettingInfoは未知weekdayを直接dereferenceすることを確認した。
- 想定影響と発生条件: 必要住所を画面で補完できない、直接writeで不正設定を保存し、PDF・勤怠・税・時刻UIへ影響する。
- 未確認点・仮説: 正式必須field、invoiceNumberのT保持、銀行口座形式、住所検索UIの意図は未決定。
- 推奨する将来対応: editable/required fieldを仕様化し、server validationと完全な住所editorを揃える。
- 必要なテスト: 初期空Company、住所全field、invoice番号、口座桁/空、minute 0/31、invalid enum、直接write。
- ユーザー判断が必要な事項: CONF-0076。

## FUT-0093 Company master変更と帳票・計算の再現性を保証する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-027
- 対象ファイル・シンボル: `useBillingPdf` Company live参照、Company roundSetting/attendance settings
- 確認済み実装事実: 請求書PDFは生成時のlive Company名・住所・電話・登録番号・口座を使用し、過去BillingのCompany snapshotを使わない。
- 想定影響と発生条件: 会社名・住所・口座・登録番号変更後に過去請求書を再生成すると、当時と異なる帳票となる。
- 未確認点・仮説: 確定請求書の不変性、訂正版、発行者情報snapshot時点は未決定。
- 推奨する将来対応: 帳票確定時snapshot/revisionと再発行policyを仕様化し、live master利用範囲を分ける。
- 必要なテスト: 確定前後のCompany変更、再生成、複数Billing、口座欠損、invoice番号変更、取消/再発行。
- ユーザー判断が必要な事項: CONF-0077。

## FUT-0094 Company.scheduleOrder.addの未定義class参照を修正する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-027
- 対象ファイル・シンボル: schemas `Company.afterInitialize`、`scheduleOrder.add`
- 確認済み実装事実: Company.jsはSiteOrderをimportし、scheduleOrder customClassもSiteOrderだが、`scheduleOrder.add`だけ未定義`ScheduleOrder`をnewする。
- 想定影響と発生条件: `company.scheduleOrder.add()`を呼ぶとReferenceErrorとなり、予定表示順の追加保存に失敗する。
- 未確認点・仮説: SPEC-SEG-052で主要な現行並べ替えUIは配列全置換を使い、このmethodを呼ばないことを確認した。動的呼出しと既存testは未確認。
- 推奨する将来対応: SiteOrderへ統一するかScheduleOrder classを明示導入し、site/schedule order APIの重複を整理する。
- 必要なテスト: scheduleOrder add/duplicate/change/remove/serialize/update、siteOrderとの対称性、UI追加経路。
- ユーザー判断が必要な事項: なし（実装修正と回帰確認が必要）。

## FUT-0095 Maintenanceをroute表示ではなく実データ排他境界として設計する

- 状態: Needs decision
- 重大度: Critical
- 発見セグメント: SPEC-SEG-028、SPEC-DEEP-004、SPEC-DEEP-005
- 対象ファイル・シンボル: `auth.global`、`plugins/07.system`、Firestore Rules、Functions、admin-sdk backup/companies
- 確認済み実装事実: maintenanceはclientをpageへredirectするだけで、Rules/Functions/API writeや進行中requestを拒否しない。Admin SDK backup/restoreはcompany maintenanceを排他前提にする。
- 想定影響と発生条件: 保守・restore中も直接SDK、別client、開始済み操作、background処理がdataを書き、snapshot/restore対象と競合し得る。
- 未確認点・仮説: maintenance中に止める処理、read許可、background trigger、緊急修復actorは未決定。
- 推奨する将来対応: server-side maintenance gate、write停止範囲、drain/lock、admin bypass、開始/終了手順を仕様化する。
- 必要なテスト: client/REST/callable/direct Rules、進行中write、trigger、全体/会社mode、admin repair、restore並行性。
- ユーザー判断が必要な事項: CONF-0079、CONF-0080。

## FUT-0096 Maintenance初期化・購読断のfail-safeと復旧を実装する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-028、SPEC-DEEP-004、SPEC-DEEP-006
- 対象ファイル・シンボル: `useSystemActions.initializeSystem`、System/Company subscriptions、auth session initialization
- 確認済み実装事実: 初回System fetch失敗はlocal trueでfail-closedだがretry/subscribeなし。System初回成功後のsubscription error処理は明示されず、Company fetch失敗時はcompany modeがdefault falseになる。2026-08-25の起動停止調査では、asyncな`plugins/07.system.js`が`initializeSystem()`をawaitし、その内部の`system.fetch()`がFirestore `getDoc`をapp-level timeoutなしで待つことを確認した。Promiseがrejectせずpendingのままならfail-closed用catchにも到達せず、後続pluginとVue mountが進まない。
- 想定影響と発生条件: 一時障害後にmaintenance画面へ固定、またはstale falseのまま保守開始を見逃す可能性がある。初回取得がpendingのままの場合は、静的な起動templateが残り続け、利用者は保守中・通信障害・再試行可否を区別できない。
- 未確認点・仮説: FireModel subscriptionの内部retry/error callback、offline cache挙動は未確認。
- 推奨する将来対応: 状態をloading/active/inactive/unknownへ分け、初回取得に有限deadline、世代または取消し、retry/backoff、last-known state、接続監視と安全な復旧UIを設ける。timeout後に遅れて完了した旧fetchが新しい状態を上書きしないようにし、System未確認中は保護対象pageを表示しない。
- 必要なテスト: doc不存在、permission/network断、永久pending、有限timeout、timeout後の遅延完了、初回/購読後切断、Company fetch失敗、再接続、複数tab、System未確認中に保護pageが表示されないこと。
- ユーザー判断が必要な事項: CONF-0081。

SPEC-DEEP-040追加根拠: `system/useSystemActions.js` は初回fetch失敗時にmaintenance=trueへ倒す点はfail-closedだが、unknown/error区分、利用者向けretry、subscription error channel、明示的teardownを持たない。

## FUT-0097 System/Company maintenance field契約と表示を統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-028、SPEC-DEEP-005
- 対象ファイル・シンボル: schemas `System/Company`、admin-sdk system/companies、`pages/maintenance.vue`
- 確認済み実装事実: Company schemaはmaintenanceStartAtだがCLIはmaintenanceStartedAtを書き、ended fieldsもschema外。System CLIのversion/createdAtもschema外。reason/timestamps/updaterはpageに表示しない。
- 想定影響と発生条件: 開始時刻・監査情報がclient modelで失われ、保守理由/予定を利用者が判断できず、運用・実装が異なるfieldを参照する。
- 未確認点・仮説: どちらの時刻名を正本とするか、終了履歴をcurrent docに残すかは未決定。
- 推奨する将来対応: 共通schema/command契約、migration、監査履歴、利用者向け表示fieldを定義する。
- 必要なテスト: on/off serialize、旧新field migration、System initialize、reason/time display、timezone、missing fields。
- ユーザー判断が必要な事項: CONF-0082。

## FUT-0098 Maintenance例外role・操作と退出導線を定義する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-028
- 対象ファイル・シンボル: `auth.global` maintenance branch、`plugins/07.system`、`pages/maintenance.vue`
- 確認済み実装事実: maintenance trueではrole/auth状態を問わずmaintenance pageだけ許可し、pageにlogout、再試行、管理者修復導線がない。
- 想定影響と発生条件: admin/super-userもアプリ内診断・解除・account切替ができず、誤設定時にCLI以外の復旧経路がない。
- 未確認点・仮説: 緊急修復をCLIだけに限定する意図、閲覧-only許可、logout必要性は未決定。
- 推奨する将来対応: bypass actor/route/action、read-only mode、logout/status refresh、break-glass監査を仕様化する。
- 必要なテスト: unauth/user/admin/developer/super-user、System/company mode、logout/login、誤mode解除、bypass監査。
- ユーザー判断が必要な事項: CONF-0080。

## FUT-0099 Stripe Functionsの公開状態と環境別有効化を整備する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-029、SPEC-DEEP-004
- 対象ファイル・シンボル: `functions/index.js`、`modules/stripe.js`、checkout page
- 確認済み実装事実: Stripe module exportがコメントアウトされ、checkout trigger/webhookがFunctions入口へ接続されない。UIはStripeData更新を無期限に待つ。
- 想定影響と発生条件: checkout button実行後にloadingが継続し、subscription作成・Company同期が動作しない。
- 未確認点・仮説: remote DEVに旧版Functionが残るか、コメントアウト理由、secret/webhook準備状況は未確認。
- 推奨する将来対応: 環境別rollout/disable switch、export、secret/webhook/region、health checkを明示し、未提供時はUIを閉じる。
- 必要なテスト: export一覧、Emulator stub、DEV deploy確認、trigger/webhook health、機能disabled UI、timeout。
- ユーザー判断が必要な事項: CONF-0083。

## FUT-0100 Checkout作成を認可済みserver APIへ移し入力を固定する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-029、SPEC-DEEP-004
- 対象ファイル・シンボル: StripeData Rules、checkout page input、`onCreateCheckoutSession`
- 確認済み実装事実: 同一会社User全員が任意price/success_url/cancel_urlでStripeDataをcreateでき、triggerはactor/role/price/originを検証せずStripeへ渡す。
- 想定影響と発生条件: 無権限checkout、意図しないprice、任意redirect、外部Stripe resource乱造・費用/運用負荷が起き得る。
- 未確認点・仮説: 正式購入actor、許可price、return origin、App Check/rate limitは未決定。
- 推奨する将来対応: 認可callableでplan keyだけを受け、server allowlistからprice/URL/customerを決定しrate limit/idempotencyを適用する。
- 必要なテスト: role/他社、任意price/URL、重複click、rate limit、App Check、disabled plan、open redirect。
- ユーザー判断が必要な事項: CONF-0084。

## FUT-0101 Stripe Customer/Session作成を冪等・競合安全にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-029
- 対象ファイル・シンボル: `onCreateCheckoutSession`、Company.stripeCustomerId、StripeData
- 確認済み実装事実: Stripe API idempotency keyなし。Customer/session作成後のFirestore更新とatomicでなく、並行docは同時にCustomerを作れる。SPEC-DEEP-009でcatchがerrorをtrigger documentへ保存して正常終了するため、通常のplatform retryでは外部成功後の部分状態を回収しないことを本文確認した。
- 想定影響と発生条件: trigger retry・network failure・二重clickで重複Customer/Checkout Sessionが作られ、Companyとの対応が分岐する。
- 未確認点・仮説: Stripe側の暗黙重複抑止、既存重複Customerは未確認。
- 推奨する将来対応: company/intent単位lock、deterministic idempotency key、intent status state machine、reconcileを実装する。
- 必要なテスト: 同時2 session、各外部作用後failure/retry、既存customer欠損、stale intent、cleanup。
- ユーザー判断が必要な事項: CONF-0085。

## FUT-0102 Webhookの重複・順序逆転・再契約を安全に処理する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-029
- 対象ファイル・シンボル: `webhooks/syncCompanySubscription`、Company.subscription
- 確認済み実装事実: event ID/時刻/version/現subscription比較なしでCompanyを上書きし、deleteは無条件clearする。Company未発見は200で同期を捨てる。SPEC-DEEP-009で署名検証済み`event.type`ではなく検証前の`request.body.type`を分岐へ使うことも確認した。
- 想定影響と発生条件: delayed旧eventが新契約を消す、重複event、customer mapping遅延でpaid stateが失われる。
- 未確認点・仮説: 1 Company 1 active subscriptionの正式制約、event retention/replay運用は未決定。
- 推奨する将来対応: processed-event ledger、Stripe object取得による最新state収束、subscription ID/version比較、retryable missing mapping、reconcile jobを設ける。
- 必要なテスト: duplicate/out-of-order create-update-delete、解約直後再契約、mapping遅延、webhook retry、複数subscription。
- ユーザー判断が必要な事項: CONF-0085、CONF-0086。

## FUT-0103 Subscription/customerType/employeeLimit契約を整合させる

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-029
- 対象ファイル・シンボル: Company.subscription、`getCustomerType`、checkout subscription_data、webhook metadata
- 確認済み実装事実: checkoutはemployeeLimit metadataを設定せずwebhookは欠損時0。delete後id nullでfree。未分類statusはfree。period end時刻経過だけではcomputed再評価されない。SPEC-DEEP-045で`currentPeriodEnd.toMillis()`を前提にDate/string等を正規化せず、未知statusを不明状態でなくfreeへ縮退することを確認した。
- 想定影響と発生条件: paid/trialingなのに上限0、失効時state stale、支払異常や解約をfree扱いし、機能制限・案内が不整合になる。
- 未確認点・仮説: plan別上限、trial、grace period、past_due、cancel-at-period-end、free移行の正式仕様は未決定。
- 推奨する将来対応: 正式state machine/plan entitlement、server算出、reactive expiry timer、status/limit validationを定義する。
- 必要なテスト: 全Stripe status、period境界、trial/cancel/reopen、metadata欠損/不正、plan変更、offline stale。
- ユーザー判断が必要な事項: CONF-0086。

## FUT-0104 Checkout成功判定・Customer mapping・error情報を堅牢化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-029
- 対象ファイル・シンボル: checkout query表示、Stripe Customer作成、StripeData output/error
- 確認済み実装事実: `success=true` queryだけで完了表示する。Customer作成はCompany schemaにないemail/name/abbrを参照。error.message/sessionUrl/customerIdを同一会社Userが読めるStripeDataへ保存する。
- 想定影響と発生条件: URL偽装やwebhook遅延で虚偽成功、Customer名称欠損、内部error情報・session URLの過剰共有が起き得る。
- 未確認点・仮説: error内容、session URLの寿命、Company contact email値源は未決定。
- 推奨する将来対応: server-side session verification/status polling、正しいCompany field mapping、sanitized error、owner-only intent readとTTL cleanupを実装する。
- 必要なテスト: query偽装、webhook遅延/失敗、Company名称/email欠損、error sanitization、別User read、TTL削除。
- ユーザー判断が必要な事項: CONF-0087。

## FUT-0105 警備日報Storageをテナント・権限で分離する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-030、SPEC-DEEP-035
- 対象ファイル・シンボル: `storage.rules` SecurityReports match、`uploadSecurityReport`、`deleteSecurityReport`
- 確認済み実装事実: SecurityReports pathは認証のみでread/write可能で、companyId、role、permission、operation、uploaderを検証しない。SPEC-DEEP-045でclient utilityのtenant pathがauth storeのcompanyIdだけに依存し、server-bound actor/reference validationを追加しないことを確認した。
- 想定影響と発生条件: 認証Userが他社pathを知るか推測すると、機微な現場画像を閲覧、追加、上書き、削除できる。
- 未確認点・仮説: remote deployed Rules、operation IDの推測容易性、既存access logは未確認。
- 推奨する将来対応: token companyIdとpathを一致させ、操作別permission/actorとoperation存在をserverまたはRulesで強制する。
- 必要なテスト: unauth、同社/他社、一般User/管理者/super-user、存在しないoperation、直接SDK read/write/delete。
- ユーザー判断が必要な事項: CONF-0089。

## FUT-0106 警備報告のデータモデルと提出ライフサイクルを定義する

- 状態: Needs decision
- 重大度: 未評価
- 発見セグメント: SPEC-SEG-030
- 対象ファイル・シンボル: SecurityReports UI、Storage画像、schemas `SecurityReportIndex`
- 確認済み実装事実: 構造化SecurityReport、draft/submit/approve/reject、本文、署名はなく、写真はupload直後から表示される。
- 想定影響と発生条件: 業務上の警備報告書を期待する場合、提出済み判定、責任者、改訂、監査を表現できない。
- 未確認点・仮説: 写真共有だけが正式要件か、法定/顧客帳票を想定するかは未決定。
- 推奨する将来対応: 必要性を判断し、必要ならreport document、状態機械、actor、revision、signature contractを仕様化する。
- 必要なテスト: 状態別create/edit/submit/reject/approve、権限、再提出、監査、画像との原子性。
- ユーザー判断が必要な事項: CONF-0088、CONF-0089。

## FUT-0107 警備日報画像の検証と安全な変換境界を実装する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-030
- 対象ファイル・シンボル: file input、`uploadSecurityReport`、Storage Rules、`createSecurityReportThumbnail`
- 確認済み実装事実: clientはimage/*を圧縮するが、Rulesはsize/type/nameを検証せず、uploadはcontentTypeを明示せず常に.jpg名を付ける。SPEC-DEEP-008でthumbnail helperも元file全体をmemoryへdownloadし、size、magic bytes、pixel上限を検証せずSharpへ渡すことを本文確認した。
- 想定影響と発生条件: 直接writeまたは形式差異により過大・非画像・偽装fileが保存され、thumbnail失敗、容量消費、content処理リスクが生じる。
- 未確認点・仮説: browser compressorが対応する全形式、bucket level malware scan/retentionは未確認。
- 推奨する将来対応: server-controlled upload、size/MIME/magic bytes/count検証、安全な再encode、metadata正規化を行う。
- 必要なテスト: JPEG/PNG/HEIC/WebP、偽装MIME、巨大画像、壊れたfile、同名、直接SDK、decoder failure。
- ユーザー判断が必要な事項: CONF-0091。

## FUT-0108 警備日報の削除・保持・監査を定義し強制する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-030
- 対象ファイル・シンボル: Manager delete、`operationCleanup`、Storage metadata
- 確認済み実装事実: 確認、status/lock、uploader/role判定、soft delete、履歴なしで削除でき、予定/実績削除時にはfolderを連鎖削除する。SPEC-DEEP-035で、最後の1件を削除した後もManagerの`currentReport`が削除済みreportを保持し、full-size/delete操作がstale URLを参照し続け得ることを確認した。SPEC-DEEP-045で本体とthumbnailを並行削除し、thumbnailのpermission/networkを含む全errorを未存在相当として吸収するためorphanを成功扱いし得ることを確認した。
- 想定影響と発生条件: 誤操作や親doc削除で報告画像が復元不能となり、請求・事故・監査後も証拠を失い得る。
- 未確認点・仮説: 正式保持期間、確定後削除、法務/顧客要件、bucket versioningは未確認。
- 推奨する将来対応: 保持/lock/取消/復元policy、確認UI、audit log、削除権限、親削除guardを仕様化する。
- 必要なテスト: 各actor、確定前後、予定のみ/実績あり、親削除、部分失敗、復元、retention expiry。
- ユーザー判断が必要な事項: CONF-0090。

## FUT-0109 警備日報画像・thumbnail・索引の整合回復を保証する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-030、SPEC-DEEP-035
- 対象ファイル・シンボル: `syncSecurityReportIndex`、`createSecurityReportThumbnail`、`rebuildSecurityReportIndexes`、client delete
- 確認済み実装事実: 絶対件数再計算と再構築はあるが、operation欠損画像とmain欠損thumbnailを削除せず、clientはthumbnail削除失敗を無視する。SPEC-DEEP-001/008でupload triggerがindex同期後にthumbnailを作り、main delete triggerはindex同期だけでthumbnailを直接削除しないこと、rebuildもorphan本体/thumbnailを除去しないことを本文再確認した。同一thumbnail pathへのsaveは再実行で重複fileを増やさないがgeneration preconditionはない。
- 想定影響と発生条件: trigger/削除/親docの部分失敗でorphan、thumbnail欠損、索引と表示の一時不一致、Storage残存が起きる。
- 未確認点・仮説: Eventarc delivery順、bucket lifecycle、定期rebuild運用は未確認。
- 推奨する将来対応: reconcile job、orphan quarantine/cleanup、retry/dead-letter監視、operation existence方針を設ける。
- 必要なテスト: finalize各段failure、delete各段failure、out-of-order/retry、operation欠損、orphan thumbnail、並行upload/delete。
- ユーザー判断が必要な事項: CONF-0090。

## FUT-0110 警備日報操作の失敗表示・再試行・大量件数を整備する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-030
- 対象ファイル・シンボル: `useSecurityReports`、Manager、Storage `listAll`、`rebuildSecurityReportIndexes`
- 確認済み実装事実: upload/list errorはManagerに表示されず、delete errorはconsoleへ吸収される。全件listAllと各file metadata/URL取得を行う。SPEC-DEEP-008で再構築もStorage全件と索引全件をmemoryへ取得し、20件chunkの`Promise.all`が1件失敗すると後続chunkへ進まず、開始済み処理はrollbackされず、failed ID/resume cursorを返さないことを確認した。SPEC-DEEP-035で、Managerが`isListing`、`listError`、`uploadError`を描画せず、loading・permission failure・emptyを同じ表示へ畳み込むこと、宣言した`click:delete`も発火しないことを確認した。
- 想定影響と発生条件: network/permission/trigger障害を利用者が認識・再試行できず、件数増加時に表示遅延と多数requestが発生する。
- 未確認点・仮説: 想定最大枚数、offline要件、URL取得制限は未決定。
- 推奨する将来対応: 明示error/retry/progress、pagination/limit、upload resultと索引処理状態の可視化を実装する。
- 必要なテスト: offline、権限拒否、圧縮/upload/list/delete失敗、100件以上、二重操作、再読込。
- ユーザー判断が必要な事項: CONF-0091。

## FUT-0111 Operation抽象型とStorage namespaceの用語・path境界を明確化する

- 状態: Needs decision
- 重大度: Low
- 発見セグメント: SPEC-SEG-031
- 対象ファイル・シンボル: schemas `Operation.collectionPath`、Storage `Operations/{operationId}`、Firestore Rules
- 確認済み実装事実: Operationは直接instance化不能な基底classで独立CRUDがなく、Firestore RulesにもOperations matchがない。一方、同名Storage folderは予定/実績写真の共通namespaceとして実利用される。
- 想定影響と発生条件: 開発・仕様・保守でFirestore Operation entityが存在すると誤認し、誤ったRules、migration、参照、CRUDを追加する可能性がある。
- 未確認点・仮説: 将来共通Operation entityを作る意図、static collectionPathがframework上必須かは未確認。
- 推奨する将来対応: 抽象型であることを命名・文書・型で明示し、不要ならcollectionPathを除去または非永続base用名称へ変更する。Storage namespaceも用途を明示する。
- 必要なテスト: 抽象instance化拒否、子class collection path、Firestore Operations直接access拒否、写真operationId解決、schema export互換性。
- ユーザー判断が必要な事項: CONF-0093。

## FUT-0112 useFetchのlogger相対importを修正しbuildで保証する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-032
- 対象ファイル・シンボル: `composables/fetch/useFetch.js` useLogger import
- 確認済み実装事実: `../composables/useLogger`は`composables/composables/useLogger`を指すが同pathは存在せず、実体は`composables/useLogger.js`である。
- 想定影響と発生条件: bundlerが通常の相対解決を行うとuseFetch import時にbuild/startが失敗する。
- 未確認点・仮説: Nuxtの特殊resolve、生成cache、実行中artifactが偶然吸収するかは未確認。
- 推奨する将来対応: `../useLogger`またはaliasへ統一し、module resolution testを追加する。
- 必要なテスト: clean install build、Nuxt dev、useFetch import unit、Windows/Linux path解決。
- ユーザー判断が必要な事項: なし。

## FUT-0113 汎用fetchの並行loading・error契約を正確にする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-032、SPEC-DEEP-021
- 対象ファイル・シンボル: `useFetchBase.fetchItems/searchItems`、`isLoading`、logger error absorption、`Customer/Autocomplete.vue`
- 確認済み実装事実: 単一booleanを各呼出しがtrue/falseにし、異なる並行処理の一方が先にfalseへ戻せる。取得errorはrejectせず、null/空結果へ畳み込む。SPEC-DEEP-021でCustomerAutocompleteが検索request取消し・sequence guard・表示用errorを持たずこの共通契約へ直接委譲することを確認した。
- 想定影響と発生条件: 並行fetch/search中にloadingが消え、submit許可や未取得表示が起きる。permission/network障害をnot-found/0件と誤認する。
- 未確認点・仮説: 全callerがlogger storeを必ず表示するか、loadingが保存guardへ使われる到達性は未確認。
- 推奨する将来対応: pending counter/request token、typed result/error、abort/stale response policyを共通化する。
- 必要なテスト: 異なるID並行、fetch+search並行、順序逆転、permission/network/not-found、retry、unmount中完了。
- ユーザー判断が必要な事項: CONF-0095。

## FUT-0114 汎用cacheのfreshness・更新・cleanup契約を整備する

- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-032
- 対象ファイル・シンボル: `useFetchBase` item/search cache、`useFetch` origin/provide
- 確認済み実装事実: item cacheにTTL/force refresh/update/delete同期がなく、検索cacheのみlazy expiry。wrapperはclearSearchCacheを公開せず、data-layerからorigin=trueの利用例もある。
- 想定影響と発生条件: 別画面・別clientでmaster更新後も古いinstanceを表示し、origin重複でcache共有と重複fetchの想定が崩れる。
- 未確認点・仮説: master変更頻度、許容staleness、全CRUD後のmanual cache更新は未確認。
- 推奨する将来対応: entity別freshness、invalidate/update/remove、origin所有者、unmount cleanup、必要箇所のsubscriptionを仕様化する。
- 必要なテスト: create/update/delete/archive後、親子共有、nested origin、TTL境界、clear、複数tab、long-lived page。
- ユーザー判断が必要な事項: CONF-0094。

## FUT-0115 共通icon操作とdrag UIのaccessibilityを整備する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-033、SPEC-DEEP-022、SPEC-DEEP-025、SPEC-DEEP-026、SPEC-DEEP-027、SPEC-DEEP-028、SPEC-DEEP-032、SPEC-DEEP-033
- 対象ファイル・シンボル: MonthSelector icon buttons、Autocomplete create icons、Tag remove、FloatingWindow、WorkerSelector、`components/atoms/icons/{Draggable,HasLicense,HolidayFlag}.vue`、`CustomerBillings/DataTable/GroupSummaryRow.vue`、`components/organisms/{ChangeAdminUserDialog,SiteOrderManager}.vue`、`components/Outsourcer/{Card,Autocomplete}.vue`
- 確認済み実装事実: 複数のicon-only操作に明示aria-labelがなく、FloatingWindow/drag selectorにkeyboard代替が確認できない。SPEC-DEEP-018でDraggableはcursor/iconだけでkeyboard drag代替を持たず、HasLicense/HolidayFlagも独自accessible nameを提供しないことを確認した。SPEC-DEEP-020でCompanyの3 Activatorも無名のicon-only edit buttonを常時表示することを確認した。SPEC-DEEP-022でCustomerBillingsのgroup toggleだけが同画面の他actionと異なりtitle/aria-labelを持たないことを確認した。SPEC-DEEP-025でEmployeeの3 Activator、Cardのselect/edit/detail、Autocompleteのcreate候補も固有label/keyboard代替を追加しないことを確認した。SPEC-DEEP-026でCertification ManagerのplusとEmployeeTagの継承操作も同じ境界にあることを確認した。SPEC-DEEP-027でEmployeesManagerのplusとInsurance Managerのvertical menuもcomponent固有aria-labelを持たないことを確認した。SPEC-DEEP-028でFloatingWindowのclose、MonthSelectorの前後月、Molecules Actionsのbuttonもcomponent固有のaccessible nameを追加しないことを確認した。
- 想定影響と発生条件: screen readerまたはkeyboard-only利用者が操作目的を識別できず、月移動、作成、削除、移動を完了できない。
- 未確認点・仮説: Vuetify/Air componentが自動生成するaccessible name、正式対応基準は未確認。
- 推奨する将来対応: icon control label、focus order/return、keyboard操作、drag代替、live regionを共通規約とcomponent testへ追加する。
- 必要なテスト: axe、screen reader、Tab/Enter/Space/Escape/矢印、dialog focus trap/return、touch、zoom 200%。
- ユーザー判断が必要な事項: CONF-0096。

SPEC-DEEP-032で`ChangeAdminUserDialog`のwindow/chip操作と`SiteOrderManager`のdrag/actionにもcomponent固有のkeyboard、focus、ARIA契約がないことを確認した。共通accessibility backlogの証拠として追記し、新規FUTは追加しない。

SPEC-DEEP-033でOutsourcerCardのselection icon、edit/detail button、およびOutsourcerAutocompleteのcreate iconにもcomponent固有のaccessible name、keyboard/focus return契約がないことを確認した。

SPEC-DEEP-017で、button atomsは`icon`時にtextを除去し自身ではaccessible nameを補わないことを確認した。対象のicon-only callerは明示的なlabelを渡す必要がある。

## FUT-0116 Autocompleteの外注表示・作成・失敗契約を統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-033
- 対象ファイル・シンボル: Article/Customer/Employee/Outsourcer/Site Autocomplete、特に`Outsourcer/Autocomplete.vue`
- 確認済み実装事実: Outsourcerはdefault itemにEmployeeListItemを使い、作成iconはplain v-icon click。検索errorはuseFetch側で空結果へ吸収される。
- 想定影響と発生条件: 外注field表示が欠落/誤表示し、作成iconをkeyboard利用できず、障害を候補0件と誤認する。
- 未確認点・仮説: EmployeeListItemが外注instanceを意図的に兼用可能か、AirAutocompleteApiのerror/keyboard挙動は未確認。
- 推奨する将来対応: typed共通Autocomplete factory、entity別ListItem、button化したcreate action、typed loading/error/empty contractを揃える。
- 必要なテスト: 5 entityの既存key/search/create/returnObject、外注field、network/permission/0件、keyboard、race。
- ユーザー判断が必要な事項: CONF-0097。

## FUT-0117 共通Actionの多重実行と属性分配を明示する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-033、SPEC-DEEP-022、SPEC-DEEP-028
- 対象ファイル・シンボル: Atoms Btns、`useBtns`、Molecules Actions SubmitCancel/SelectCancel/Edit、Customer Billing PDF/CSV buttonsと`useCustomerBillingActions`
- 確認済み実装事実: component自身はclickをemitするだけで、親がloadingを反映するまで再click可能。同じ`$attrs`を複数buttonへ後勝ちmergeする。SPEC-DEEP-017で`useBtns`自身もcomputed `onClick`を生成し、呼出し属性のclick keyを上書きすることを確認した。SPEC-DEEP-022でCustomer BillingのPDF/CSV actionはglobal loadingを追加するが各buttonをdisabledにせず、連打で複数download処理を開始できることを確認した。SPEC-DEEP-028でActionsのdisabled/loading/onClick attrsがcancel・primary双方へmergeされ、`cards/SelectCancel`のmodel update handlerはconst再代入になることを確認した。
- 想定影響と発生条件: async開始前の連打でcreate/updateを多重実行し、個別button用disabled/aria/event属性が意図せず双方へ適用される。
- 未確認点・仮説: Air manager/global overlayが同期的にpointerを遮断するか、全handlerのidempotencyは未確認。
- 推奨する将来対応: synchronous submitting latch、button別attrs、idempotent handler契約、二重click共通testを追加する。
- 必要なテスト: double click/tap/Enter、slow handler、reject/retry、cancel中、button別attrs/event/aria。
- ユーザー判断が必要な事項: なし。

## FUT-0118 Shell route名と戻るnavigationを安全にする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-034、SPEC-DEEP-005
- 対象ファイル・シンボル: `AppNavigationDrawer.normalizeRouteName`、`useAppStore.previousButton`
- 確認済み実装事実: route.nameへnull/type guardなしでendsWithを呼ぶ。親有無はpageSettingsで判定するがclickは親pathでなく`router.go(-1)`。SPEC-DEEP-020でAppNavigationDrawer全文を再確認し、同じnull/type guard欠落と、root attrsへのdrawer state委譲を確認した。
- 想定影響と発生条件: 名称なし/404 routeでdrawer renderが例外になり、外部direct entryや別画面経由では戻る先が親画面と一致しない、またはアプリ外へ出る。
- 未確認点・仮説: Nuxtが全到達routeへ必ずstring nameを付与するか、戻るの正式UXは未決定。
- 推奨する将来対応: route.nameを安全にnormalizeし、parent navigationとhistory backを明確に分け、fallbackを定義する。
- 必要なテスト: 404/名称なし/dynamic route、direct URL、外部referrer、reload、新tab、親/兄弟から遷移。
- ユーザー判断が必要な事項: CONF-0098。

## FUT-0119 Shell icon操作・drawer・focusのaccessibilityを整備する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-034、SPEC-DEEP-005
- 対象ファイル・シンボル: default app bar nav/back/account buttons、AppNavigationDrawer、auth brand
- 確認済み実装事実: icon-only操作に明示日本語aria-label/tooltipがなく、route/dialog/drawer開閉時のfocus移動・復帰をapp側で定義しない。
- 想定影響と発生条件: screen reader/keyboard利用者が操作目的やdrawer状態を理解できず、遷移後focusを見失う。
- 未確認点・仮説: Vuetify/UserSetting内部が付与するARIA、正式accessibility基準は未確認。
- 推奨する将来対応: accessible name、aria-expanded/controls、focus management、skip link、route announcementをshell契約へ追加する。
- 必要なテスト: axe、screen reader、Tab/Escape/Enter、drawer open/close、route/back/logout、mobile/zoom。
- ユーザー判断が必要な事項: CONF-0096。

## FUT-0120 UserSetting解決・logout多重実行・global feedbackを検証する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-034、SPEC-DEEP-006
- 対象ファイル・シンボル: `layouts/default.vue` UserSetting/handleSignOut、guest/auth snackbar差
- 確認済み実装事実: `UserSetting`のrepo内定義は見つからず外部plugin由来か未解決か不明。signout itemはloading中disableせず、guestはmessage snackbarを持たない。
- 想定影響と発生条件: component未解決ならuser menuが描画不能。連打でsignOutを並行実行し、redirect後messageがguest layoutで見えない。
- 未確認点・仮説: AirVuetifyのglobal component登録、signOut idempotency、router後snackbar保持は未確認。
- 推奨する将来対応: component provenanceを明示・build検証し、signout latch/disabled、全layout共通feedback hostを整備する。
- 必要なテスト: clean build、UserSetting render、single/double signout、failure/retry、redirect後message、auth/guest/default切替。
- ユーザー判断が必要な事項: CONF-0099。

## FUT-0121 Article CRUDの権限・validation・重複をserverで強制する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-035、SPEC-DEEP-010
- 対象ファイル・シンボル: Article pageSettings、Firestore Rules Articles/Articles_archive、schemas Article
- 確認済み実装事実: UIはdeveloper限定だが同一会社User全員がactive/archiveをread/write可能。Rulesにfield/type/重複/操作別制約がない。SPEC-DEEP-010でpageは空検索limit 10に対しmanager page size 20を指定し、page自身はloading/errorを受け取らずdefault create/update/deleteへ委ねることを確認した。SPEC-DEEP-016で、Article component群にもrole/tenant/field allowlistやlocal single-flightがなく、明細の親document updateへCRUDを委譲することを再確認した。
- 想定影響と発生条件: 権限のないUserまたは直接SDKが品目・単価を追加改変archiveし、請求表示・金額入力へ影響する。
- 未確認点・仮説: 正式master管理actor、code一意性、archive write主体は未決定。
- 推奨する将来対応: operation別permission、server validation、code/name正規化・一意性、archive/restore専用APIを実装する。
- 必要なテスト: role/他社、直接write、duplicate code/name、invalid/unknown fields、active/archive移動、restore。
- ユーザー判断が必要な事項: CONF-0100。

## FUT-0122 Article/ArticleDetailの金額・数量・税・単位契約を定義する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-035
- 対象ファイル・シンボル: schemas Article.price、ArticleDetail.price/quantity、入力component
- 確認済み実装事実: priceは任意のnumberで負数可、quantityは正数だが整数性なし。unit/tax/rate/currency/丸めfieldはArticleにない。SPEC-DEEP-016で、DataTable/local totalもprice×quantityをそのまま加算し、tax/rounding/currencyを別途扱わないことを再確認した。
- 想定影響と発生条件: 負単価・小数数量・税区分不明の品目が請求額へ入り、計算・表示・会計解釈が不一致になる。
- 未確認点・仮説: 値引き/返金の負額、小数数量、税込/税抜、単位、roundingの正式用途は未決定。
- 推奨する将来対応: 数値domain、scale、上限、unit、tax category、rounding、adjustmentとの責務を仕様化し全層で検証する。
- 必要なテスト: 0/負/小数/巨大/NaN、端数、税率、単位、値引き、PDF/集計一致。
- ユーザー判断が必要な事項: CONF-0101。

## FUT-0123 過去請求のArticle表示をsnapshot・archive安全にする

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-035
- 対象ファイル・シンボル: OperationResult.articles ArticleDetail、DataTable、`useBillingPdf`、Article logical delete
- 確認済み実装事実: articleId/price/quantityのみsnapshotし、code/nameはlive master参照。変更は過去帳票へ遡及し、archive/欠損は`-`/`N/A`になる。逆参照guardは確認できない。SPEC-DEEP-016で、選択時だけlive master priceをcopyし、DataTableの金額はembedded snapshot値を使うことを再確認した。
- 想定影響と発生条件: master改名・archive後に過去請求書を再生成すると品目表示が当時と異なるか欠損し、監査・顧客説明が困難になる。
- 未確認点・仮説: 確定時snapshot、artifact保持、参照中archive可否、復元運用は未決定。
- 推奨する将来対応: 明細へcode/name/unit/tax snapshot、確定revision、参照guardまたはarchive参照fallbackを設ける。
- 必要なテスト: master改名/price変更/archive/delete/restore後の一覧/PDF、確定前後、欠損、同ID再作成。
- ユーザー判断が必要な事項: CONF-0102。

## FUT-0124 保有資格から配置資格判定へ追跡可能な契約を設ける

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-036、SPEC-DEEP-026
- 対象ファイル・シンボル: Employee.securityCertifications、EmployeeCertifications Manager/Table、Operation qualificationRequired、OperationDetail/ArrangementNotification isQualified、Generator
- 確認済み実装事実: 保有資格のtype/期限を参照せず、予定・通知・実績は手動booleanだけで資格者を表す。任意通知値が予定値を上書きする。SPEC-DEEP-026で、資格Manager/Tableも保有資格の編集・表示だけで`isQualified`を導出せず、typeは一覧列にも表示しないことを確認した。
- 想定影響と発生条件: 無資格・期限切れ・別種別のworkerをisQualified=trueにすると要資格配置を充足し、実績/請求にも資格者として残る。
- 未確認点・仮説: manual overrideを許す正式理由、資格種別/級別要件、例外承認者は未決定。
- 推奨する将来対応: required certification IDs/types/levels、有効性判定、override actor/reason、実績時判定snapshotを仕様化する。
- 必要なテスト: 無資格/有効/期限切れ/別type/複数資格、通知override、日付境界、外注、Generator、実績snapshot。
- ユーザー判断が必要な事項: CONF-0103、CONF-0104。

## FUT-0125 Certificationのidentity・重複・期限状態を堅牢化する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-036、SPEC-DEEP-026
- 対象ファイル・シンボル: schemas Certification、EmployeeCertifications Manager/Table
- 確認済み実装事実: keyはmutableなname。重複、serial、日付順序、失効statusを検証せず、期限は表示するだけ。SPEC-DEEP-026で、Tableが必須typeを表示せず、明示delete actionを持たず、items/listenerをroot AirDataTableへのattrs fallthroughに依存することを確認した。
- 想定影響と発生条件: 同名資格の衝突、改名時identity喪失、不正期間、期限切れ資格の見落とし、履歴上書きが起きる。
- 未確認点・仮説: 同名別級/発行機関、期限なし、更新時に旧資格を残す要件は未決定。
- 推奨する将来対応: immutable ID、資格catalog/version、date validation、derived status、renewal history、duplicate ruleを導入する。
- 必要なテスト: 同名/改名、同serial、取得>期限、期限当日/timezone、期限なし、更新/取消/再取得、並行編集。
- ユーザー判断が必要な事項: CONF-0104。

## FUT-0126 従業員資格・機微情報の操作別権限と監査を実装する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-036、SPEC-DEEP-026
- 対象ファイル・シンボル: Employee pageSettings、Employee/Employee_archive Rules、securityCertifications/警備員登録field、EmployeeTag
- 確認済み実装事実: pageはemployees:readで編集UIへ到達し、Rulesは同社全認証Userへ資格番号、本籍、緊急連絡先を含むEmployee全field read/writeを許す。SPEC-DEEP-026で、資格追加actionとEmployeeTagの表示/削除操作に追加permission/auditがなく、SecurityGuard custom inputは空であることを確認した。
- 想定影響と発生条件: 閲覧だけのUserが資格や機微情報を改変・取得し、配置判定や個人情報保護へ影響する。
- 未確認点・仮説: 正式HR/管制/法務actor、field別閲覧範囲、変更監査要件は未決定。
- 推奨する将来対応: read/write permission分離、機微field分割、server validation、監査log、必要最小表示を設計する。
- 必要なテスト: role/他社、資格のみ編集、PII read/write、直接SDK、archive、audit、同時編集。
- ユーザー判断が必要な事項: CONF-0105。

## FUT-0127 OJT計算flagと警備教育履歴modelを分離・定義する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-037
- 対象ファイル・シンボル: Employee schema、OperationDetail.isOjt、securityType TRAINING
- 確認済み実装事実: Employeeに教育履歴fieldはなく、isOjtは稼働worker boolean、TRAININGは独立した稼働種別で相互参照しない。
- 想定影響と発生条件: 法定教育・OJT修了・期限・時間・指導者の証跡を管理できず、計算上OJTであることを教育実施記録と誤認する。
- 未確認点・仮説: AirGuardで法定教育台帳を扱う範囲、外部system正本、必要保持期間は未決定。
- 推奨する将来対応: 教育program/session/attendance/completion modelと、稼働計算flagの名称・参照関係を仕様化する。
- 必要なテスト: 新任/現任/OJT、複数session、時間累積、期限、指導者、修了/取消、稼働とのlink、履歴保持。
- ユーザー判断が必要な事項: CONF-0106。

## FUT-0128 OJT overrideの根拠・actor・snapshotを監査可能にする

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-037
- 対象ファイル・シンボル: schedule/notification/result isOjt editors、effective worker conversion
- 確認済み実装事実: isOjtを各段階で直接編集でき、通知値が予定値を上書きし、実績へbooleanだけcopyする。理由、変更者、教育/指導者IDを残さない。
- 想定影響と発生条件: OJT解除/追加で人数・売上区分が変わっても、誰がなぜ変更したか再現できず、不正・誤操作を検出できない。
- 未確認点・仮説: 配置管理者以外の訂正actor、本人同意、実績確定後lockは未決定。
- 推奨する将来対応: override permission、reason、actor/time、source/revision、教育session/instructor参照をsnapshotする。
- 必要なテスト: schedule→notification true/false override、result編集、同時更新、確定後訂正、audit、権限。
- ユーザー判断が必要な事項: CONF-0108。

## FUT-0129 OJTの人数・勤怠・売上・請求効果を一貫させる

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-037
- 対象ファイル・シンボル: Operation.assignedPersonnelCount、effectiveWorker、OperationResult.statistics、DailyOperationByEmployee sales
- 確認済み実装事実: OJTは必要人数0人、status件数には含む、勤務時間はojt subcategoryへ保持、従業員取極め基準売上は0円。外注OJTも配置人数0となる。
- 想定影響と発生条件: 給与・勤怠・顧客請求・外注費で異なる扱いが必要な場合、0円/0人の一律flagが誤計算や説明不能を生む。
- 未確認点・仮説: OJTの給与支給、請求可否、休憩/残業、外注OJT、TRAININGとの関係は未決定。
- 推奨する将来対応: domain別効果matrixを承認し、人数・勤怠・給与・売上・請求・外注費を別policyで算出する。
- 必要なテスト: employee/outsourcer、qualified OJT、時間/残業/休憩、取極め有無、TRAINING、請求/勤怠/給与各境界。
- ユーザー判断が必要な事項: CONF-0107。

## FUT-0130 勤怠月次snapshot取得の競合・失敗stateを制御する

- 2026-08-11 SPEC-DEEP-023 evidence: `DailyAttendanceIndex`はmonth range watchでsnapshot fetchし、component側にはrequest sequence/cancellation/error stateがない。selectionはloading完了時の候補外clearだけであり、stale docsの識別はしない。
- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-038、SPEC-DEEP-011
- 対象ファイル・シンボル: `useDailyAttendancesInRange.fetchDocs`、`useDailyAttendanceIndexData`
- 確認済み実装事実: 月変更ごとに非同期snapshot queryを開始するが、abort/generation判定がない。取得errorはloggerへ記録して吸収し、既存docsをclearせず、画面にerror/retryを返さない。SPEC-DEEP-011でIndex pageはloadingをemployee選択resetにだけ使い、page/Indexへerror/retry表示を公開しないことを確認した。
- 想定影響と発生条件: 月を素早く切り替えてresponse順が逆転すると旧月queryが後から現在docsを上書きできる。新月取得が失敗すると月表示だけ変わり、旧月勤怠が残って誤認され得る。
- 未確認点・仮説: Firestore応答順が逆転するruntime再現、global error UIで利用者が識別できるかは未確認。
- 推奨する将来対応: request generationまたはabort相当で最新queryだけを採用し、loading/error/empty/staleを分離してinline retryを提供する。
- 必要なテスト: 連続前月/翌月変更、遅延response逆転、permission/network error、retry、選択employee clear、旧data非表示。
- ユーザー判断が必要な事項: error時に旧dataを明示付きで保持するか空にするか。

SPEC-DEEP-040追加根拠: DailyAttendanceとDailyOperationByEmployeeのapplication indexは、projection snapshotとEmployee snapshotを別々に取得し、共通read revision・all-or-nothing境界を持たない。片方だけ成功した場合に新旧snapshotが混在し得る一方、loadingは単一booleanである。

SPEC-DEEP-042追加根拠: DailyAttendance snapshot layerは連続range変更をgeneration/cancelせず、失敗時に旧docsを保持したままerrorをloggerへ吸収する。range validationはtry外で、invalid rangeはwatcherの未処理例外になり得る。

SPEC-DEEP-043追加根拠: DailyOperationByEmployeeとEmployee snapshotも同じ世代管理欠落を持ち、EmployeeはACTIVE/RESIGNEDを直列別queryする。projection・Employee間、Employee二query間の共通read revisionがなく、片方失敗時は前回値を残す。

## FUT-0131 勤怠閲覧のresponsive・詳細・accessibility契約を整備する

- 2026-08-11 SPEC-DEEP-023 evidence: IndexのAutocomplete選択templateはコメントアウトされ、内部`employeeSelect`設定は未到達候補である。calendar event click/detail dialog、event focus/aria説明、対象7 componentのテストは確認できなかった。
- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-038
- 対象ファイル・シンボル: `DailyAttendance/Index/index.vue`、`DailyAttendance/Calendar/index.vue`
- 確認済み実装事実: 画面は固定幅の左右paneと中央calendarを`overflow-hidden`で並べ、mobile分岐を持たない。eventは時刻labelだけでclick/detail/keyboard actionを持たない。
- 想定影響と発生条件: 狭いviewport、詳細確認、keyboard利用では従業員選択・集計・複数実績の内容へ到達しにくい可能性がある。
- 未確認点・仮説: 実端末でのoverflow、AirCalendar内部のaccessibility、必要なdetail項目は未確認・未決定。
- 推奨する将来対応: CONF-0110決定後、mobile pane切替、event detail、focus/label/keyboard、横幅・zoom基準を実装する。
- 必要なテスト: phone/tablet/desktop、200% zoom、keyboard、screen reader、日跨ぎ・同日複数event、長い氏名。
- ユーザー判断が必要な事項: CONF-0110。

## FUT-0132 手動勤怠・休暇操作の所有権と監査を設計する

- 状態: Needs decision
- 重大度: 未評価
- 発見セグメント: SPEC-SEG-038
- 対象ファイル・シンボル: `/attendances` UI、DailyAttendance、OperationResult同期、将来の振替休日・代休・休暇model
- 確認済み実装事実: 現画面はread-onlyで、DailyAttendanceのcreate/edit/delete、時刻・休憩訂正、振替休日・代休・休暇登録を持たない。DailyAttendanceはOperationResult同期が生成する。
- 想定影響と発生条件: 同じ集約documentへ手動値を直接追加すると、OperationResult再同期で上書き・消失する可能性がある。休暇を実績detailと混在させると勤務時間・export意味も曖昧になる。
- 未確認点・仮説: 手動訂正と休暇の保存model、承認、監査、同期優先順位、本人操作範囲は未決定。
- 推奨する将来対応: CONF-0109/CONF-0026を決定し、source別model、field ownership、承認・監査、再集約、取消しを仕様化してから実装する。
- 必要なテスト: 本人/管理者、勤務訂正、休暇種別、部分日、取消し、OperationResult再同期、同時編集、export反映、監査履歴。
- ユーザー判断が必要な事項: CONF-0109、CONF-0026。

## FUT-0133 route・navigation・componentのadmin/special role判定を統一する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-039、SPEC-DEEP-005
- 対象ファイル・シンボル: `pageAccessPolicy.isPageAccessAllowed`、`authorization.getPermissions/hasPermission`、`useAuthStore.hasPermission`
- 確認済み実装事実: routeとnavigationは共有page policy evaluatorへ統一された。一般page policyはsuper-user/developer専用guard後にadminを許可するが、component側の`getPermissions(["admin"])`は`["admin"]`だけを返す。special policyは排他的に評価される。
- 想定影響と発生条件: adminがrouteへ入れてもcomponent permission checkで操作を見られない、または将来の複合required条件が意図と異なる拒否/許可になる。
- 未確認点・仮説: 現在admin route内で実害があるcomponent、special roleを他permissionと混在させる意図は未確認。
- 推奨する将来対応: CONF-0111/0112決定後、現在共有済みのroute・navigationにcomponent判定も整合させ、単一authorization policy/APIとspecial roleの意味を確定する。
- 必要なテスト: preset別、admin/super-user/developer、複数role、required空/単一/複合、route/navigation/buttonの一致。
- ユーザー判断が必要な事項: CONF-0111、CONF-0112。

## FUT-0134 role・permission語彙とunknown処理をcentral validationする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-039、SPEC-DEEP-005
- 対象ファイル・シンボル: `ROLE_PRESETS`、`getPermissions`、`User.roles`、`validatePageSettings`
- 確認済み実装事実: central enum/schema validationがなく、未知roleを同名permissionとして採用する。User rolesは任意string arrayで、development validatorも未知値を拒否せず、`human-resource`を通常role警告listから漏らす。SPEC-DEEP-045でpermission重複を除去せず、page required配列をANDでなくOR評価し、未登録pathが親設定へfallbackすることを再確認した。
- 想定影響と発生条件: typoで権限を失う、page側にも同じtypoがあると意図せず通る、未管理custom permissionが蓄積し、移行・監査不能になる。
- 未確認点・仮説: 実dataの未知role、直接permissionをUserへ保存する正式意図は未確認。
- 推奨する将来対応: version付きrole/permission catalog、schema/server validation、unknown fail-closed、migration/reportを設ける。
- 必要なテスト: 全preset、全page permission、未知/空/重複/非配列、write→read、catalog version migration。
- ユーザー判断が必要な事項: custom direct permissionを許すか、preset限定か、unknown時の扱い。

## FUT-0135 claim・User role変更の反映と失効を保証する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-039
- 対象ファイル・シンボル: `useAuthActions.initializeSession/clearSession`、`useAuthStore.roles`、ID token claims
- 確認済み実装事実: roles/isAdminはUser購読、isSuperUser/isDeveloper/companyIdはsession初期化時の強制token取得から来る。claim変更をsession中に再評価する独立listener、company switch、permission revisionは確認できない。
- 想定影響と発生条件: special権限剥奪後も旧token/session表示が残る、付与後に再login/再初期化まで使えない、company claim変更とFirestore prefixが不一致になる可能性がある。
- 未確認点・仮説: Firebase token自動更新時のauth callback再実行、運用上の強制logout、claim変更頻度は未確認。
- 推奨する将来対応: CONF-0113決定後、token change検知、role revision、強制reauth/logout、company immutabilityまたは明示switch protocolを設計する。
- 必要なテスト: claim付与/剥奪、User role/isAdmin変更、token expiry、複数tab、offline復帰、company claim変更、logout。
- ユーザー判断が必要な事項: CONF-0113。

## FUT-0136 error型・伝播・user feedback・retry契約を統一する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-040、SPEC-DEEP-005、SPEC-DEEP-006、SPEC-DEEP-009
- 対象ファイル・シンボル: `useLogger`、`useErrorsStore`、各application/data-layer catch、Functions `ContextualError`、geocoding callable
- 確認済み実装事実: error normalizationはmessage文字列中心で、loggerへのErrors store指定は任意。catch後はswallow、null、resolve、局所rethrowが混在し、global unhandled error/rejection集約はない。SPEC-DEEP-009でgeocoding callableがprovider errorをgeneric Errorへ変換しcode/retryable情報を失うこと、`ContextualError`は実callerがなくformatted outputにstack/causeを含めないことを確認した。
- 想定影響と発生条件: callerが失敗を成功/0件/not-foundと誤認し、再試行不能、部分状態継続、利用者へのinternal message露出、未捕捉errorの無表示が起き得る。
- 未確認点・仮説: 正式なblocking/recoverable分類、既存global Nuxt既定error UIの到達性は未確認。
- 推奨する将来対応: typed error/result、code/cause/userMessage/retryable、swallow/rethrow規則、global capture、operation単位の成功条件を標準化する。
- 必要なテスト: validation/auth/permission/network/not-found/conflict、swallow/rethrow、retry、partial success、unhandled rejection、user/internal message分離。
- ユーザー判断が必要な事項: CONF-0114。

SPEC-DEEP-039b追加根拠: root composablesでもFCM登録、OperationBilling lock、schedule複製、Company siteOrder更新がerrorをswallowし、callerが成功と失敗を判別できない。`clearError`は共有Errors store全体をclearする。

SPEC-DEEP-040追加根拠: application actionsでも配置表PDF、請求PDF/CSV、schedule notify/update、site shift order更新がerrorをloggerへ渡して吸収し、callerへ成功/失敗を返さない。再試行・重複防止・canonical refreshも統一されていない。

SPEC-DEEP-042追加根拠: generic/range data layersもloading/error/not-found/lastUpdatedを統一せず、同期購読登録errorだけをcatchしてasync listener errorを受けない。`useDocument`はreactive docId対応を文書化しながらRefを拒否し、callback master fetchもawait/cancel/error集約しない。

SPEC-DEEP-043追加根拠: retired Employee/terminated Site検索もrequest generation・cancel・loading/errorを持たず旧responseが新検索を上書きし得る。Outsourcer rangeは期間をqueryに使わず、range変更ごとに全ACTIVEを再購読する。

SPEC-DEEP-044追加根拠: master fetch cacheは同一docIdのin-flight point fetchをdedupeする一方、既存cacheを更新せずTTL/revision/tenant切替clearを持たない。fetch errorとnot-foundをcache missへ畳み込み、searchはlatest-only/cancel/in-flight dedupeがない。

UWB-03追加確定（2026-08-17）: `AirArrayManager`・`AirItemManager`管理下のCRUDはhandlerでerrorを重複捕捉せず、managerから`useBaseManager`、`useLogger`、`useErrorsStore`、`useMessagesStore`へ伝播する。manager外の独立操作はloadingの`try/catch/finally`所有者を明示する。この原則はUWB固有ではなくproject共通運用とする。

## FUT-0137 global loadingをowner・reference count・取消し対応にする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-040、SPEC-DEEP-005、SPEC-DEEP-006
- 対象ファイル・シンボル: `useLoadingsStore.add/remove/clear/replace`、`air-loading-dialog`利用layout
- 確認済み実装事実: queueはkeyごと1件で、同一keyの重複addをcountせず、最初のremoveで消える。全clear可能でowner/scope/timeoutがなく、cleanupは各callerのfinallyに依存する。
- 想定影響と発生条件: 同一key並行処理、unmount/cancel、finally漏れで、処理中にdialogが消える、または永久に残る。別処理のclearも可能である。
- 未確認点・仮説: 外部loading dialogのinteraction block、実際に同一keyが重なる頻度は未確認。
- 推奨する将来対応: unique operation tokenまたはreference count、owner scope、自動finally helper、cancellation/disposal、stale timeout診断を実装する。
- 必要なテスト: 同一/異なるkey並行、順序逆転、throw、cancel、unmount、clear、replace、empty text。
- ユーザー判断が必要な事項: CONF-0116。

SPEC-DEEP-044追加根拠: master fetch/searchは同じ単一`isLoading`を共有し、異なる並行処理の先行完了がfalseへ戻す。ManagedDialogもsubmitのsingle-flightを持たず、SecurityReportはupload/list/deleteで別のboolean/Set/global keyを使い取消し・ownerを統一しない。

UWB-03追加確定（2026-08-17）: manager管理下のCRUDへglobal loadingを理由なく重ねず、manager外の独立操作だけが`useLoadingsStore.add()`と`finally remove()`を所有する。Air manager自身のloading責務分割はFUT-0181と合わせて後続整理する。

## FUT-0138 production logging・redaction・monitoring・相関を設計する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-040、SPEC-DEEP-005、SPEC-DEEP-006、SPEC-DEEP-009
- 対象ファイル・シンボル: `useLogger.send`、直接`console.*`、FCM/auth/adapter/plugin logging、Functions `ContextualError`、geocoding/Stripe logger
- 確認済み実装事実: 全levelを環境filterなしでconsoleへ出し、data redaction、remote sink、永続化、sampling、correlation ID、release contextがない。直接consoleへpayload/objectを渡す代表箇所もある。SPEC-DEEP-009で`ContextualError`が任意contextを生成時にredactionなしでlogし、geocodingが住所・座標・provider response、StripeがCompany/Customer/Subscription識別子とerror objectをlogすることを確認した。
- 想定影響と発生条件: production端末consoleへ通知・業務・識別情報が露出し得る一方、障害時にtenant/operationを安全に相関して検知できない。
- 未確認点・仮説: build toolによるconsole除去、正式な監視service、support log採取、保持要件は未確認。
- 推奨する将来対応: CONF-0115決定後、level/env filter、field allowlist/redaction、structured context、correlation ID、remote monitoring、retention/access controlを実装する。
- 必要なテスト: DEV/PROD各level、token/email/payload redaction、large/circular data、monitoring failure、correlation、retention/access。
- ユーザー判断が必要な事項: CONF-0115。

SPEC-DEEP-039b追加根拠: `useLogger`は環境filterなしで全levelをconsoleへ出し、truthy dataだけを無加工で渡す。redaction・size/circular guard・correlation・structured contextはない。

## FUT-0139 layout間のsnackbarとErrors/Messages lifecycleを統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-040、SPEC-DEEP-006
- 対象ファイル・シンボル: default/auth/guest layouts、`useErrorsStore`、`useMessagesStore`、`auth.global`
- 確認済み実装事実: default/authはsnackbar hostを持つがguestは持たない。route遷移はErrors listだけclearし、Message queueをclearしない。Message storeにclear/remove/dedupe/owner APIはない。
- 想定影響と発生条件: guest routeでfeedbackが見えない、遷移後に前画面messageが出る、`hasError=false`でもerror snackbarが残る、重複messageが連続表示される。
- 未確認点・仮説: guestでMessage storeへ追加する現在の到達経路、Vuetify queueの消費timingは未確認。
- 推奨する将来対応: app-level feedback host、message ID/owner/severity/lifetime、route reset policy、dedupeとaccessibilityを統一する。
- 必要なテスト: 3 layout、route遷移、連続同一error、success/error混在、logout/login、keyboard/screen reader、長文。
- ユーザー判断が必要な事項: CONF-0114。

## FUT-0140 geocoding Callableの認証・濫用・quota境界を実装する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-041
- 対象ファイル・シンボル: `functions/modules/geocoding.js`、`fetchCoordinates`、client geocoding plugin
- 確認済み実装事実: Callableはaddressの存在/stringだけを検査し、auth、tenant、role、App Check、length、rate limitを検証せずGoogle Geocoding APIを呼ぶ。cache/dedupeもない。SPEC-DEEP-009でHTTP status/response.ok/results長、timeout、provider status別retry分類もなく、generic Errorへ変換することを本文確認した。
- 想定影響と発生条件: 未認証または自動化callerが任意addressを大量送信し、provider quota枯渇、費用、正規利用停止、log増大を起こし得る。
- 未確認点・仮説: platform-level App Check/enforcement、provider quota、実公開regionと運用監視は未確認。
- 推奨する将来対応: 認証・tenant・actor、App Check、address長/shape、rate limit、quota budget、cache、abuse alertを入口で強制する。
- 必要なテスト: 未認証/他社/disabled、App Check、空/長大/大量/同一address、quota超過、provider timeout/error。
- ユーザー判断が必要な事項: 利用actor、匿名利用の要否、quota/cost上限。

## FUT-0141 geocoding失敗・location整合・0座標を正しく扱う

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-041
- 対象ファイル・シンボル: `GeocodableMixin.beforeCreate/beforeUpdate/_geocodeAndSetLocation/converter`
- 確認済み実装事実: 失敗はlocation=nullとして保存継続し、clientには失敗を伝えない。`skipGeocoding`は住所変更でも旧locationを保持し得る。lat/lngをtruthy判定するため0座標を拒否する。
- 想定影響と発生条件: location必須機能が欠損に気付かない、migration等のskipで住所と座標がずれる、0緯度/経度の住所がgeopointを持てない。
- 未確認点・仮説: locationを利用する業務、null許容、retry/reconcile運用は未決定・未確認。
- 推奨する将来対応: CONF-0117後にgeocode status/source/address hash/updatedAtを保存し、有限数値validation、retry/reconcile、保存blockまたは明示warningを設ける。
- 必要なテスト: success/zero coordinate/no result/timeout、住所変更、building/zipcode変更、skip、旧location、create/update、retry。
- ユーザー判断が必要な事項: CONF-0117。

## FUT-0142 住所field・fullAddress・郵便番号正規化契約を統一する

- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-041
- 対象ファイル・シンボル: address field definitions、`fullAddress/prefecture` accessors、postal update callback、4 master schemas
- 確認済み実装事実: zipcodeのformat validator/normalizationはなく、fullAddressはprefecture+city+addressだけでbuilding/zipcodeを除外する。Site commentは両方を含むと記す。postal callbackは読み取り専用prefectureも更新する。
- 想定影響と発生条件: 同一住所の表記揺れ、geocode精度差、検索/帳票不一致、誤った設計前提、不要な更新値が生じる。
- 未確認点・仮説: buildingをgeocodingへ含める要否、正式postal provider、海外住所対応は未決定。
- 推奨する将来対応: CONF-0118/0119を決め、canonical field/formatter/validator、display addressとgeocode queryを分離し、schema commentとUIを揃える。
- 必要なテスト: hyphen有無/全半角/空白、prefCode不正、番地/建物、海外/長文、郵便番号0/複数結果、4 master。
- ユーザー判断が必要な事項: CONF-0118、CONF-0119。

## FUT-0143 個人住所・座標のprovider送信とlog privacyを統制する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-041
- 対象ファイル・シンボル: Employee GeocodableMixin、`fetchCoordinates` logging、Callable error
- 確認済み実装事実: Employee自宅を含むfullAddressを外部providerへ送り、成功時座標、失敗時address/provider responseをserver logへ出す経路がある。redaction/retention/consent contractは確認できない。SPEC-DEEP-009でCallableのnull時error messageにも入力addressが入り得ることを再確認した。
- 想定影響と発生条件: 個人の居住地・精密座標がproviderとlogへ不要に開示・保持され、閲覧権限や目的外利用のriskが生じる。
- 未確認点・仮説: geocodingのEmployee業務目的、provider契約、log保持・閲覧者、本人同意は未確認。
- 推奨する将来対応: CONF-0120後、必要性最小化、対象master選別、precision低減、redaction、consent/privacy notice、retention/access auditを設計する。
- 必要なテスト: Employee/業務住所分離、log redaction、provider failure、権限、削除/保持、support export。
- ユーザー判断が必要な事項: CONF-0120、CONF-0115。

## FUT-0144 server adapterのhasMany field契約をschema/clientと一致させる

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-042
- 対象ファイル・シンボル: server adapter `hasChild`、schema `hasMany[].collectionPath`、client adapter `hasChild`
- 確認済み実装事実: schemasとclient adapterは`collectionPath`を使うがserver adapterは`item.collection`を参照する。代表Customer/Site/Employee/OutsourcerはcollectionPathだけを定義する。
- 想定影響と発生条件: Functions/serverからこれらをdeleteするとundefined collection path queryで失敗し、archive不能になる。誤って別propertyが存在する将来schemaではclient/serverが異なる参照をguardし得る。
- 未確認点・仮説: 現Functionsから対象deleteを実行する到達経路とruntime errorは未確認。
- 推奨する将来対応: shared typed hasMany contractを1箇所に定義し、serverをcollectionPathへ統一してadapter contract testを共通fixtureで実行する。
- 必要なテスト: collection/collectionGroup、prefix有無、各代表schema、child 0/1件、server/client parity、invalid definition。
- ユーザー判断が必要な事項: なし。実装修正は関連repo変更承認が必要。

## FUT-0145 restoreのactive conflict・transaction・validation・triggerを安全化する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-042
- 対象ファイル・シンボル: client/server adapter `restore`、active/archive collections
- 確認済み実装事実: 両adapterはactive同ID存在を確認せずarchive dataで全上書きする。serverはarchiveを`txn.get`でなくtransaction外`get`する。restore hook、schema validation、actor/reason、trigger調整はない。
- 想定影響と発生条件: ID再利用後のrestore、並行create/restore、stale archive readで、新しいactive masterを過去dataへ不可逆上書きし、active create/delete trigger副作用と不整合を生む。
- 未確認点・仮説: 実際のrestore caller、ID再利用頻度、trigger retry/補償は未確認。
- 推奨する将来対応: CONF-0121/0122後、archive+activeを同一transaction readし、存在時fail/merge/new-IDを明示、revision/actor/reason/validationとtrigger-safe server APIを設ける。
- 必要なテスト: activeなし/あり、同時create、同時restore、archive edit/delete、transaction retry、trigger成功/失敗、再実行。
- ユーザー判断が必要な事項: CONF-0121、CONF-0122。

## FUT-0146 archive audit metadata・retention・purge・Rulesを共通設計する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-042
- 対象ファイル・シンボル: adapter delete、`*_archive` collections/Rules、master delete UI、admin-sdk collection catalog
- 確認済み実装事実: archiveは元dataだけをcopyし、archivedAt/by/reason/version/retention metadataがない。同社認証User全員がarchive全read/writeでき、UI restore/purgeなし。subcollectionは移動せず、Admin SDKのbackup/完全復旧catalogもArticles_archiveを欠くため同archiveは保守artifactへ含まれない。
- 想定影響と発生条件: 誰がなぜ削除したか追跡不能、個人/取引dataを無期限保持または直接消去、orphan subcollection、backup漏れ、復旧不能が起き得る。
- 未確認点・仮説: 法定保持、legal hold、匿名化、archive閲覧者、subcollection実在は未決定・未確認。
- 推奨する将来対応: CONF-0123とmaster別CONFを決め、metadata envelope、least-privilege server API、retention/hold/anonymize/purge、subcollection/backup catalogを統一する。
- Customerについては通常User restore不可、運営者inspection/緊急restore、reason/actor/time、active同ID拒否、自動purge保留を確認済み制約として共通設計へ反映する。
- 必要なテスト: actor/reason/time、role別archive/restore/purge、retention/hold、PII匿名化、nested subcollection、backup/restore catalog、監査log。
- ユーザー判断が必要な事項: CONF-0123およびmaster別archive CONF。

## FUT-0147 Admin backupのscope catalogとcoverageをversion管理する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-043
- 対象ファイル・シンボル: admin-sdk `COMPANY_SUBCOLLECTIONS`、`collectCompanyData`、`restoreCompany`
- 確認済み実装事実: backup/完全復旧は固定catalogの一階層subcollectionだけを扱う。少なくともArticles_archive、AgreementV2s、DailyOperationsByEmployee、SiteEmployeeHistories、Notifications、Operations、SecurityReportIndexesがcatalog外で、nested subcollection、Storage、Systemも対象外である。
- 想定影響と発生条件: READMEの完全backupを前提に災害復旧すると、catalog外のmaster・集計・通知・報告・archiveが欠落し、復旧後の参照・集計・監査が部分状態になる。
- 未確認点・仮説: 各catalog外collectionの実data有無、再生成可能性、nested subcollection/Storage objectの実在は未確認。
- 推奨する将来対応: CONF-0124後、schema/version付きscope manifest、collection discoveryとの差分検査、nested/Storage/Auth対象、再生成対象を明示し、catalog追加漏れをCIでfailさせる。
- 必要なテスト: 全schema collection coverage、active/archive、nested、空collection、unknown collection、Storage/Auth、version migration、restore後参照整合。
- ユーザー判断が必要な事項: CONF-0124。

## FUT-0148 Admin restoreをpreflight・復旧点・rollback・trigger-safeにする

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-043
- 対象ファイル・シンボル: admin-sdk `restoreDiff`、`restoreSelective`、`restoreCompany`、collection wait settings
- 確認済み実装事実: 差分復旧はsnapshot added/modifiedをsetしbackup deletedも復活させる混合結果、選択復旧はmerge、完全復旧は複数batch/Authにまたがる非transaction処理である。完全復旧のclearは500件超batchに対応せず、maintenance確認なし、全trigger waitは0、部分失敗rollback/revision precondition/complete markerがない。
- 想定影響と発生条件: 大規模collection、同時write、古いdiff、Functions発火、Auth個別失敗で、どの復旧点にも一致しないdata、二重派生、欠損、復旧途中の利用再開が起き得る。
- 未確認点・仮説: 500件超runtime、各triggerのretry/idempotency、正式なrollback/forward recovery方針は未確認。
- 推奨する将来対応: CONF-0125後、復旧semanticsを分離命名し、dry-run/preflight、artifact/company/revision検証、chunked clear、operation ledger、trigger抑止またはreconcile、検証gateとrollback/runbookを実装する。
- 必要なテスト: 0/1/500/501件、added/modified/deleted、同時更新、途中失敗、再実行、全trigger、Auth skip、catalog外data、maintenance on/off。
- ユーザー判断が必要な事項: CONF-0125、CONF-0127。

## FUT-0149 Backup artifactと復旧credentialを機密・integrity管理する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-043
- 対象ファイル・シンボル: local/Firebase storage adapters、backup JSON、`restored_users_passwords.json`、restore console logging
- 確認済み実装事実: artifactは会社・個人・勤怠・請求・Auth/custom claimsを平文JSONで保存し、checksum/signature/encryption/retention/access auditを持たない。完全復旧はemailと仮passwordをconsoleへ出し、UID/email/tempPasswordを固定temporary JSONへ平文保存する。
- 想定影響と発生条件: file/Storage/logへの閲覧、持出し、改変artifact復旧、temporary file残存により大量情報漏えい、account takeover、silent data corruptionが起き得る。
- 未確認点・仮説: OS permission、bucket IAM/retention/encryption、log access、password file削除運用は未確認。
- 推奨する将来対応: CONF-0126後、envelope encryption、署名/checksum、immutable generation、least privilege、retention/secure deletion、secretをlog/fileへ出さないpassword reset/invite flow、access auditを設計する。
- 必要なテスト: artifact改変/欠損、wrong key、permission denied、retention/expiry、log redaction、password delivery/revocation、Storage/local parity。
- ユーザー判断が必要な事項: CONF-0126、CONF-0127。

## FUT-0150 Admin backup CLI・公開API・READMEの実行契約を一致させる

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-043
- 対象ファイル・シンボル: `src/index.js` restore methods、CLI backup commands、README/COMMANDS
- 確認済み実装事実: class/direct APIはcollection配列を内部関数のoptions位置へ渡すが内部は`options.collections.split()`を期待する。CLIはcomma-separatedだがREADMEにspace-separated例があり、`all`展開はない。`restore-full`は全置換でなくmergeで、未知/`all`対象が0件でも成功し得る。
- 想定影響と発生条件: 文書や公開APIどおりに緊急復旧すると例外、0件成功、期待しないmergeとなり、復旧完了を誤判定する。
- 未確認点・仮説: package利用者、既存automation、後方互換要件は未確認。
- 推奨する将来対応: typed optionsへ統一し、all展開/unknown reject/0件fail、明確なreplace対merge命名、dry-runとmachine-readable resultを設け、READMEとcontract testを同期する。
- 必要なテスト: CLI/API両入口、配列/comma/all/unknown/空、merge/replace、0件、README例のsmoke test、backward compatibility。
- ユーザー判断が必要な事項: CONF-0125、既存automation互換の要否。

## FUT-0151 Callableのactor・tenant・App Check・abuse境界を強制する

- 状態: Open
- 重大度: Critical
- 発見セグメント: SPEC-SEG-044、SPEC-SEG-049、SPEC-SEG-056、SPEC-DEEP-004
- 対象ファイル・シンボル: `functions/apis/*.js`、`geocoding`、Users/Companies Rules
- 確認済み実装事実: SPEC-DEEP-001で全auth-v2/API入口本文を再確認した。2026-08-14〜16にdisable/enable/changeAdminはcaller UID/company、会社管理者、target User/Authをserver検証するよう改修した。2つの再構築Callableは同社の有効なスーパーユーザーと要求会社一致を共有認可で強制し、`checkEmailAvailabilityGlobal`は有効な同社会社管理者へ限定した。createAdminAccountはメール確認、現在Auth、有効状態、token/current claim、既存User/Company所属を検証し、整合した再実行だけを許可する。`checkEmailAvailability`は初期管理者signup専用の未認証email事前確認となり、client指定policy区分を信頼しない。pre-registrationも未認証だが、booleanだけを返し複数一致を拒否する。App Check/rate limitは入口にない。Users/Companies Rulesのfield単位・actor単位制約も未完了である。
- 想定影響と発生条件: 修正済みCallableの旧任意操作経路は閉じたが、直接Firestore writeによるUser/admin field変更、残る匿名email/仮登録情報列挙、quota消費が起き得る。
- 未確認点・仮説: Cloud側App Check/IAM override、disabled token失効時期、重複temporary User、各operationの正式actorは未確認。UIはsignup pagesおよびadmin routeのUsers manager/dialogから到達する。
- 推奨する将来対応: callable policy matrixを維持し、保護対象Callableではtoken/current Auth/User/path間のclaim schemaと整合性を共通にfail closedで強制する。続いてApp Check、rate limit、匿名応答minimization、security audit、Users/Companies Rulesのfield/actor制約を揃える。
- 必要なテスト: 未認証、同社/他社、admin/non-admin/super-user、disabled、App Check有無、enumeration/rate、arbitrary companyId/uid。
- ユーザー判断が必要な事項: CONF-0129、権限全体はCONF-0111。

## FUT-0152 Functions deployment surfaceをmanifestとcontract testで固定する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-044、SPEC-DEEP-001、SPEC-DEEP-002、SPEC-DEEP-007
- 対象ファイル・シンボル: `functions/index.js` star exports、Stripe/migration/testNotification、notification helper exports
- 確認済み実装事実: rootはstar exportに依存し、25 Function objectに加えてplain async helper 3件も到達する。Stripeはcomment、migration/test HTTPは未exportで、意図・環境・廃止状態をmachine-readableに管理しない。
- 想定影響と発生条件: helper追加/renameやcomment変更でdeploy surfaceが暗黙に変わり、意図しないendpoint公開、必要function欠落、stale function残存、deploy discovery failureを起こし得る。
- 未確認点・仮説: Firebase deployがplain helperを現在どう扱うか、remoteにstale functionがあるかは未確認。
- 推奨する将来対応: CONF-0128後、rootでFunction objectだけをnamed exportし、environment-independent manifest、owner/status、expected trigger/options、local discovery/CI diffを設ける。
- 必要なテスト: export name/type/path/options snapshot、plain helper拒否、unexported/stale detection、Stripe enable/disable、emulator/deploy dry discovery。
- ユーザー判断が必要な事項: CONF-0128。

## FUT-0153 Function runtime・retry・idempotency・failure観測契約を標準化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-044、SPEC-DEEP-007
- 対象ファイル・シンボル: global/runtime options、`runDailyTask`、`onUpdateCustomer`、event/callable declarations
- 確認済み実装事実: Node/regionと1 callable timeout以外のmemory/concurrency/instances/retryを明示せず、v1/v2が混在する。SPEC-DEEP-001で`runDailyTask`がcleanup→Site自動終了を直列実行し、どの段階のerrorも最外catchで吸収してplatformへ成功returnすることを本文再確認した。OperationResult triggerは逆に部分成功後errorをrethrowする。event ledger/dedupe/dead-letter/correlation IDは入口にない。
- 想定影響と発生条件: 部分失敗を成功扱いして再試行されない、逆にplatform retry/重複eventで副作用を重ねる、負荷急増、timeout、障害検知不能が起き得る。
- 未確認点・仮説: Cloud側override、各handlerの実idempotency、正式SLO/alert/runbookは未確認。
- 推奨する将来対応: CONF-0130後、function別runtime budget/retry、event ID ledger、idempotent write、partial result、structured metrics/alert、manual replay/runbookをmanifest化する。
- 必要なテスト: duplicate/out-of-order、timeout/OOM、concurrency、downstream failure、scheduled partial failure、retry/no-retry、alert/replay。
- ユーザー判断が必要な事項: CONF-0130。

## FUT-0154 OperationResult CSVの安全性・意味・再現性契約を確立する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-046、SPEC-DEEP-022
- 対象ファイル・シンボル: `exportOperationResultsCsv`、`useCustomerBillingActions.downloadCsv`、CustomerBillings group CSV button
- 確認済み実装事実: CSVはBilling groupの埋込みOperationResultを53列へflattenし、live一覧からは出さない。site/customer IDs、site name/code、勤務時間、単価・売上を含む。formula prefixをescapeせず、isStartNextDay/実datetime/worker identityは出さず、siteNumberは常に空、filenameはUTC実行日だけである。SPEC-DEEP-022で標準UIのgroupKeyは同一customerId/billingDateを保証する一方、download actionはstatus/件数確認/processing disable/監査を持たないことを確認した。SPEC-DEEP-045でUTC filenameがJST深夜帯の利用者日付とずれ得ることを確定した。
- 想定影響と発生条件: `=,+,-,@`で始まるmaster文字列をspreadsheetで開くとformula実行候補となる。日跨ぎをCSV単独で復元できず、snapshot時点・customer/期間を識別できないため、外部取込・監査・再生成比較を誤る可能性がある。
- 未確認点・仮説: 正式consumer、agreementDate/siteNumberの要否、Excel等のformula挙動、embedded snapshotの重複、保持/監査要件は未確認。
- 推奨する将来対応: CONF-0131後、consumer version付き列schema、formula neutralization、explicit datetime/timezone/day-crossing、source revision/group/period、deterministic filename、dedupe/件数preview、export auditを実装する。
- 必要なテスト: 53列順、null/0/quote/comma/CRLF/formula、夜勤、worker/outsourcer、missing site、duplicate result、snapshot/live差、timezone境界、大量件数、Excel/import target。
- ユーザー判断が必要な事項: CONF-0131。

## FUT-0155 Dashboardのquery gating・N+1・limit・stale stateを改善する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-047、SPEC-DEEP-004
- 対象ファイル・シンボル: dashboard setup、site alert composables、recent arrangements、WeeklyOperationQuantityBar data layers
- 確認済み実装事実: admin+developerだけに表示するSite警告2 queryを全dashboard訪問者が購読する。chartは表示時にschedule/resultごとのSite/Employee/Outsourcer fetchを起動するが集計には使わない。全queryにlimitがなく、loading/error/last-updatedがない。employeeIdはrecent composable setup時に非reactive captureされる。SPEC-DEEP-019でchart optionsはsetup時のplain objectで`hideLabel`変更に追従せず、公開`label` propも使用しないことを確認した。
- 想定影響と発生条件: 不要read/cost/client memory、月日経過によるSite警告件数増、N+1 latency、初期化raceで配置が空のまま、network障害でstale/空を正常と誤認する可能性がある。
- 未確認点・仮説: adapter cache dedupe、Auth middlewareでemployeeIdが必ずreadyか、実件数/費用、listener error behaviorは未確認。
- 推奨する将来対応: widget permissionと同じ条件でlazy mount/queryし、chart専用minimal query、limit/pagination、reactive identity、loading/error/retry/lastUpdated、query cost monitoringを設ける。
- 必要なテスト: role組合せ、employeeId遅延、0/大量件数、duplicate cache fetch、network断/復旧、unmount、multi-tab、read count。
- ユーザー判断が必要な事項: widget audienceはCONF-0132。

SPEC-DEEP-042追加根拠: `useRecentArrangements`はsetup時のemployeeIdを非reactive captureし、未準備なら以後も購読しない。site alert/recent queriesは日付境界をsetup時に固定し、JST日付跨ぎ、loading/error/retry/lastUpdatedへ追従しない。

## FUT-0156 Dashboardのaudience・calendar・稼働数KPI・empty experienceを仕様化する

- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-047、SPEC-DEEP-004
- 対象ファイル・シンボル: dashboard conditional rows、AirCalendar、WeeklyOperationQuantity aggregation
- 確認済み実装事実: routeは全認証User向けだがemployeeIdまたはadmin+developerの双方を満たさないuserは空画面。Calendarはdata未結線。稼働数は未来schedule.requiredPersonnelとresult.statistics.total.quantityをID一致時だけ置換して同じ7日chartへ混在する。SPEC-DEEP-019で未知securityTypeは既知datasetへ現れず、chartの空/loading/error表示もatom側にはないことを確認した。
- 想定影響と発生条件: 利用者が空dashboardを故障と誤認し、calendarを機能済みと誤解する。予定と実績、手動result/ID不一致、statusを区別しないKPIを業務判断へ使うと人数を過大/過小解釈し得る。
- 未確認点・仮説: admin+developer ANDの設計意図、一般管理者widget、calendar用途、正式KPI/status/time horizonは未決定。
- 推奨する将来対応: CONF-0132後、actor別widget matrix、empty/default navigation、calendar source/action、予定/実績を分離したmetric名・filter・legend・as-ofを仕様化する。
- 必要なテスト: 全role/employeeId組合せ、予定のみ/実績のみ/同ID/異ID/status別、0件、timezone、calendar event/navigation、responsive/accessibility。
- ユーザー判断が必要な事項: CONF-0132。

SPEC-DEEP-041追加根拠: dashboard稼働数transformは`requiredPersonnel`とresult quantityの有限・非負・number型を検査せず、string連結または`NaN`をdatasetへ伝播し得る。欠損/未知securityTypeは既知datasetへ表示されない。

## FUT-0157 配置表PDFのfield・日時・要員属性・再現性・layout契約を確立する

- 状態: Needs decision
- 重大度: Medium
- 発見セグメント: SPEC-SEG-048
- 対象ファイル・シンボル: `useArrangementSheetPdf.fetchData`、mapping/layout/splitWorkers
- 確認済み実装事実: 帳票は取引先、site.address/name、DAY/NIGHT印、必要人数、start/end、worker表示名だけを出す。日跨ぎ、資格/OJT、外注区分、休憩、companyを出さず、live masterで再生成する。長文を文字数切詰め、10人超を主要項目空のblockへ分割し、7block/pageとする。SPEC-DEEP-045でworker amountの有限・非負・整数検証がなく、小数切上げ相当、負数0人、Infinity非終了loop候補となること、master fetch失敗がN/Aへ縮退し得ることを確認した。
- 想定影響と発生条件: 夜勤終了日、資格/OJT/外注要員を帳票で誤認し、master変更で同じ予定の再生成結果が変わる。長文/大人数/欠損masterで識別不能なN/A・切詰め・空blockとなる可能性がある。
- 未確認点・仮説: 正式必須項目、紙への手書き用途、住所field、他shift type、snapshot要否、最大件数は未決定。
- 推奨する将来対応: CONF-0133後、version付きfield mapping、explicit datetime/day-crossing、qualification/OJT/worker type、snapshot/as-of、overflow/continuation label、empty/missing validationを仕様化する。
- 必要なテスト: DAY/NIGHT/他shift、日跨ぎ、employee/outsourcer/資格/OJT、master変更/欠損、0/10/11/70人、8block、全角長文、住所各field。
- ユーザー判断が必要な事項: CONF-0133。

## FUT-0158 配置表PDFの生成権限・file identity・失敗・情報保護を整備する

- 状態: Needs decision
- 重大度: High
- 発見セグメント: SPEC-SEG-048
- 対象ファイル・シンボル: weekday PDF button、`useOpenArrangementSheetPdf`、`pdf.open`
- 確認済み実装事実: schedule read route内の全利用者が個人名・現場住所入りPDFを生成でき、専用permission/確認/auditはない。UIはdownload表記だがfilenameなしでbrowser openし、loading中button guard、success/error message、popup block、保存/送信/retention契約がない。SPEC-DEEP-045で0件でも空contentのPDFをopenしようとし、部分fetch失敗と完全成功を区別しないことを確認した。
- 想定影響と発生条件: 権限過大、誤日付/誤配布、複数popup、利用者が成功を確認できない、保存fileの識別不能、個人・現場情報の無監査持出しが起き得る。
- 未確認点・仮説: 正式利用者、配布先、紙/電子、browser filename、global overlay click遮断、保持/廃棄要件は未確認。
- 推奨する将来対応: CONF-0133後、export permission、対象preview/件数確認、deterministic filename/revision/generatedAt/by、explicit download/open、single-flight、popup fallback、audit/watermark/handling noticeを実装する。
- 必要なテスト: role別、double click、popup blocked、font/fetch failure、0件、filename/timezone、audit、PII masking/watermark、download/open各browser。
- ユーザー判断が必要な事項: CONF-0133。

SPEC-DEEP-039a追加根拠: 配置指示textも現場名・住所・予定時刻・従業員名/役職・外注先名/人数を、専用permission、revision、generatedAt/by、mask、copy/share auditなしで生成し、master取得失敗を`unknown`等へ畳み込む。

SPEC-DEEP-040追加根拠: `useOpenArrangementSheetPdf` はglobal loadingを使うが専用error stateを持たず、生成失敗をloggerへ渡して吸収する。呼出し側はdownload成功と失敗を判別できず、inline retryや生成監査もない。

## FUT-0159 Insurance履歴・監査・validation・遷移を正式化する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-051、SPEC-DEEP-027
- 対象ファイル・シンボル: schema `Insurance`、Employeeの3 Insurance field、`components/Insurance/Transition/**`
- 確認済み実装事実: 3保険はEmployee内に現在値とembedded historyを保持する。履歴entryにactor/time/revisionはなく、加入開始/完了/取消等は記録されない。rollbackは末尾historyをpopする。日付順、番号形式、履歴上限、同時更新guardはなく、processing中lossは許可するがprocessing中exemptは履歴を残さない。JSDocのnumber条件と実装も逆である。SPEC-DEEP-027で、schema methodが元instanceを先にmutationし親のasync保存失敗時にhistory push/popを戻さないこと、Rollback previewだけがbrowser local timezoneを使うこと、Manager/Enrolled inputのdefaults key不一致を確認した。
- 想定影響と発生条件: 誤操作・直接write・rollback・同時編集時に保険状態の根拠と訂正経緯を再現できず、加入/喪失日や番号の不正値、履歴消失、労務情報の不整合が生じ得る。
- 未確認点・仮説: 正式な業務actor、保険番号書式、法定保持期間、processing中lossの業務可否、既存history品質、給与/行政連携要件は未確認。
- 推奨する将来対応: CONF-0061の決定後、append-only event/history、actor/reason/time/before-after、correction方式、日付順・番号format・length、processing遷移、retention、server field allowlistを設計する。rollbackによる履歴popを監査付き訂正へ置換し、コメントを実装契約へ揃える。
- 必要なテスト: 3保険全遷移、processing完了/取消/loss/exempt、invalid/future/order date、number format、rollback複数回、direct write、同時更新、history容量、role/監査。
- ユーザー判断が必要な事項: CONF-0061に統合。正式actor、保持期間、訂正/rollback、管理目的と下流連携。

## FUT-0160 RoundSettingをtenant・client・Functions間で一貫させる

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-053、SPEC-DEEP-006
- 対象ファイル・シンボル: schema `RoundSetting`、`OperationResult.sales/salesAmount`、`Tax`、`DailyOperationByEmployee`、client `10.company-settings.client.js`、Functions派生同期、billing tax utility
- 確認済み実装事実: Companyの単一roundSettingをclient pluginがprocess-global static modeへ設定し、OperationResultの基本/残業各金額と最終salesAmount、税率別税額で適用する。FunctionsにはCompany mode設定の直接参照がなくdefault ROUNDを使い得て、DailyOperationByEmployeeは固定Math.roundである。modeはOperationResultへsnapshotされず、Company変更後の再評価で過去値も変化し得る。developer test routeもglobal modeを変更する。
- 想定影響と発生条件: CompanyがFLOOR/CEILの場合、同じOperationResultからclient表示/PDF、Functions派生document、CSV元getterで金額差が生じ得る。設定変更、warm process、test route利用、部分別二重丸めで過去請求の再現性も失われ得る。
- 未確認点・仮説: Functionsでgetterが評価される全時点、converterの保存値、実data差、cold/warm instance、正式な金額・負数・時間丸め規則は未確認。
- 推奨する将来対応: CONF-0134確定後、global static依存を避けてtenant round modeを計算へ明示注入し、client/server/派生集計を同一pure functionへ統一する。丸め前値・mode・計算versionまたは確定snapshotを保持し、既存data diff/dry-runと再計算方針を設ける。test routeはproduction除外または隔離する。
- 必要なテスト: FLOOR/ROUND/CEIL、正/0/負、小数quantity/単価/残業、category別対最終、税率別、Company設定変更前後、client対Functions対PDF対CSV、cold/warm process、invalid mode、test route隔離。
- ユーザー判断が必要な事項: CONF-0134。

## FUT-0161 Site自動終了を競合安全・再試行可能にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-054、SPEC-DEEP-002
- 対象ファイル・シンボル: `runDailyTask`、`sitesAutoTermination`、schema `Site.terminate/status/constructionPeriodEndAt`
- 確認済み実装事実: 毎日JST 00:00に、ACTIVEかつ工期終了が3か月前のJST日初よりstrictに古い全tenant SiteをcollectionGroupで無制限取得し、500件batchをPromise.allでTERMINATEDへする。将来schedule guard、status precondition、pagination、audit/reason、失敗ID、retry optionはない。cleanupを先に直列実行し、その失敗時は自動終了せず、外側catchがerrorを吸収する。手動terminateだけはJST当日以降scheduleを拒否する。
- 想定影響と発生条件: 将来予定があるSiteの自動終了、再有効化/工期訂正/予定作成との後勝ちrace、複数batch部分成功、cleanup障害による長期未実行、規模増加時のtimeout/quota、終了理由を追跡できない状態が起き得る。
- 未確認点・仮説: 実件数、index/quota、実行時間、監視alert、月末subtractの正式期待、future schedule時の業務判断、自動終了実績は未確認。
- 推奨する将来対応: CONF-0135確定後、eligible判定をpure化し、transaction/preconditionでstatus・工期・future scheduleを再確認する。page/cursorと制御されたbatch commit、失敗checkpoint/retry/reconciliation、run/site単位audit、metric/alertを導入し、cleanupとは失敗境界を分離する。
- 必要なテスト: threshold前/同値/翌日、月末/JST、null/invalid end、ACTIVE/TERMINATED、future schedule、手動終了、再有効化/工期変更race、501件以上、batch部分失敗、cleanup失敗、retry/idempotency、監査/alert、tenant横断。
- ユーザー判断が必要な事項: CONF-0135。

## FUT-0162 Tax・CutoffDate・支払条件のvalidationとsnapshotを統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-055
- 対象ファイル・シンボル: schema `Tax`、`utils/CutoffDate`、`Customer.getPaymentDueDateAt`、`OperationResult.taxRate/refreshBillingDateAt`、`Billing.taxBreakdown`、app `calculateTaxBreakdown`
- 確認済み実装事実: TaxはOperationResult日付の固定履歴表から単一rateをlive算出し、Articleも同率、adjustmentは課税対象外である。CutoffDate.isValidCutoffDateはdefinition object配列へnumberをincludesするため許可値でもfalseとなり、直接callerはない。締日/支払期日計算はvalidatorを呼ばず、invalid Date、未知cutoff、負/非整数paymentMonth等を明示拒否しない。schema/app tax breakdownで負taxRate validationも異なる。tax rate/mode/versionは正式invoice snapshotへ保存されない。SPEC-DEEP-045でapp集約が負・1超・InfinityのtaxRateを許し、string salesAmountを数値化せず連結し得ること、process-global RoundSettingに依存することを確認した。
- 想定影響と発生条件: direct writeや旧dataの不正値で締日・支払期日がrollover/invalidとなる。同日軽減税率・非課税を表現できず、package/Company設定変更後の再生成、client/server、単票/統合で税額を再現できない可能性がある。
- 未確認点・仮説: 実dataのinvalid値、軽減/非課税需要、Tax/CutoffDate consumer全体、正式invoice snapshot schema、package version差は未確認。
- 推奨する将来対応: FUT-0066/CONF-0134と整合させ、許可cutoff/payment rangeとdate型を全入口で検証する。validator bugを直し、Tax/app utilityを共通化する。正式発行時にtax category/rate、round mode、calculation version、payment termsをsnapshotし、既存dataをdry-run検査する。
- 必要なテスト: cutoff全候補/unknown/string/NaN、月末/閏年/年跨ぎ、invalid Date、paymentMonth負/小数/大数、税率改定境界、0/負/1超rate、Article/adjustment/非課税/軽減、client/server、単票/統合、snapshot再印刷。
- ユーザー判断が必要な事項: 税・丸め・snapshotはCONF-0134。支払期日変更はCONF-0036回答済み。validation bug自体は実装修正事項。

## FUT-0163 Super-user保守UIを対象確認・監査・再実行可能にする

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-056、SPEC-DEEP-002、SPEC-DEEP-004
- 対象ファイル・シンボル: `pages/super-user/index.vue`、`rebuildAllHistories`、`rebuildSecurityReportIndexes`と各core
- 確認済み実装事実: super-user pageは2 rebuild buttonだけを持ち、確認dialog、対象Company表示/選択、件数preview、reason、button loading/disabled、idempotency key、run audit、failed IDs/resumeがない。履歴buttonは「全会社」と表示するがcurrent companyId 1社だけを送る。履歴rebuildはpair直列で途中失敗・rollbackなし、現在pairにないstale historyを全scan削除しない。SecurityReport rebuildはStorage/index全件取得、20件並列chunkで部分成功し得る。
- 想定影響と発生条件: 誤Company contextでの1 click実行、二重実行、通常trigger/Storage更新との競合、部分再構築、stale derived data、処理規模によるtimeout/費用、誰が何を修復したか説明不能が起き得る。
- 未確認点・仮説: global overlayのclick遮断、実件数/費用、create既存document挙動、正式operator workflow、二者承認・break-glass要否は未確認。
- 推奨する将来対応: CONF-0111/0129/0130後、対象Company名/IDと影響件数dry-run、明示確認+reason、single-flight/idempotency、server-side actor/tenant guard、run ledger、進捗/部分結果/resume/reconcile、structured audit/alertを共通保守operationとして実装する。表示文言を実scopeへ合わせる。
- 必要なテスト: company context有無/切替、company admin/super-user/unauth、cross-tenant、double click、同時trigger、0/大量件数、各chunk failure、resume/idempotency、stale history削除、Storage orphan、audit/alert、timeout。
- ユーザー判断が必要な事項: operator/tenant scopeはCONF-0111/0129、runtime/replayはCONF-0130へ統合。

## FUT-0164 Test / development routeをproduction surfaceから隔離する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-057
- 対象ファイル・シンボル: `pages/test/*.vue`、`utils/pageSettings.js`、`middleware/auth.global.js`、`nuxt.config.js`
- 確認済み実装事実: 5 test routeはfile-based routeとして存在し、environment別build除外がない。4 routeはclientのdeveloper role guardだけで、`user-permission-info`は未登録fail-openかつ`permissions-test`と重複する。rollback routeはOperationResult delete後に同一docIdのScheduleを別writeし、Rulesはdeveloper roleを強制しない。
- 想定影響と発生条件: productionへ開発診断・個人/権限情報表示・破壊的操作が残り、URL直打ち、client改変、誤ID、2段階目失敗で情報露出、誤削除、部分状態が生じ得る。
- 未確認点・仮説: production artifact、実developer role付与、Hosting、実利用履歴、rollback正式用途は未確認。
- 推奨する将来対応: CONF-0136後、原則build-time除外し、必要な保守操作は認証・App Check・actor/tenant/field guard・reason/audit・idempotencyを持つserver processへ分離する。重複pageと固定IDを除去し、自動testへ移せるものはtest suiteへ移す。
- 必要なテスト: dev/prod route manifest、unauth/general/developer/direct API、cross-tenant、rollback各段階失敗、wrong/missing scheduleId、double click、audit、permission情報非露出。
- ユーザー判断が必要な事項: CONF-0136。

## FUT-0165 Auth onboardingの二重送信・poll・部分状態回復UXを統一する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-058、SPEC-DEEP-004
- 対象ファイル・シンボル: `pages/auth/*.vue`、`pages/unconfirmedEmail.vue`、`useCreateNormalUser`、`useCreateAdminUser`
- 確認済み実装事実: signupはbuttonをlocal loadingで抑止するがAuth作成、mail、Firestore、claimsは非atomicで、後段失敗時はUID案内だけでresume/repairできない。sign-in/reset/resendはbutton固有disabled/cooldownがない。verificationは3秒intervalでreloadし、error handling/single-flightがない。resetとverification pageはpageSettings未登録である。
- 想定影響と発生条件: 連打・slow network・mail quota・途中失敗・reloadにより重複mail、重複request、Auth-only/claims欠損、unhandled rejection、復帰不能、password resetへの未認証到達不能が生じ得る。
- 未確認点・仮説: global overlayのclick遮断、Firebase rate limit/error、実mail設定、browser resume、orphan実数は未確認。
- 推奨する将来対応: CONF-0067/0069/0129確定後、onboarding state machineとidempotent resume/repairを設ける。全actionをsingle-flight化し、resend/reset cooldown、pollのawait再schedule/error表示/backoff、route設定整合、support correlation IDを実装する。
- 必要なテスト: double click、slow/error mail、各setup段階failure、reload/back/offline、poll overlap/error/recovery、verified/unverified/disabled、duplicate/temp missing、reset direct route、anonymous enumeration/rate/App Check。
- ユーザー判断が必要な事項: 正式account setup/recoveryはCONF-0067、公開情報はCONF-0069、匿名防御はCONF-0129。

SPEC-DEEP-039a追加根拠: 一般signupは事前確認結果をsubmitへbindせず再検索し、利用者向けerrorへFirebase Auth UIDを直接表示する。

## FUT-0166 Enum・field validation・unknown表示を単一contractへ揃える

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-SEG-060、SPEC-DEEP-025
- 対象ファイル・シンボル: schemas constants、`defaultDefinition/selectFields`、`VALIDATION_ERRORS`、Article/ArticleDetail required validator、app enum input/chip、`useConstants`
- 確認済み実装事実: enum select fieldの多くはitems/defaultだけで集合validatorがなく、Rulesもallowed setを強制しない。unknown表示はERROR/例外/空が混在する。`VALIDATION_ERRORS`は`REQUIRED_FIELD_ERROR`を定義するが、ArticleとArticleDetailは存在しない`REQUIRED_ERROR()`を呼び、required branchでTypeErrorとなる。Tag variantは大文字をvalidatorで許すがraw classへ使う。SPEC-DEEP-018でBilling/Qualified atom chipsもunknownを`ERROR`表示へフォールバックし、Qualifiedの公開`label`/`variant` propsを表示へ渡していないことを確認した。SPEC-DEEP-019でDayType/ShiftType chipsも`ERROR` fallbackを持つ一方、EmploymentStatus chipは未知値を直接参照し例外になり得る。ShiftType Tabs/RadioGroupは別のoptions/value集合を使う。SPEC-DEEP-020でCompany active Settingはweekday/attendanceにfallbackを持つが、unused候補のTable Settingは未知weekdayを直接参照する差を確認した。SPEC-DEEP-025でEmployeeCardも未知genderを`GENDER[value].color`で直接参照し、表示時に例外となり得ることを確認した。
- 想定影響と発生条件: direct write、旧data、typo、enum廃止、required Article入力によりvalidation crash、集計除外、表示不能、誤default再保存、意図しないstyleとなり得る。
- 未確認点・仮説: 実unknown/legacy data、BaseClass validation時点、AirSelect自由入力、全Rules/Admin経路、他constantsの同種不整合は未確認。
- 推奨する将来対応: CONF-0137後、value集合からoptions/validator/display fallbackを生成し、keyでなく`.value`を検証する。error factory callerをcontract testし、既存data dry-run、legacy mapping、unknown read-only表示、server/Rules validationを段階導入する。
- 必要なテスト: 全enum valid/unknown/null/type違い、direct write/hydration/reserialize、deprecated mapping、Chip fallback、filter-only ALL非保存、Article required、error factory export/caller、Tag大小文字、client/server/Rules。
- ユーザー判断が必要な事項: CONF-0137。error factory欠落自体は実装修正事項。

SPEC-DEEP-039a追加根拠: `useConstants`は`DEFAULT_DEFINITIONS`とWEEK_COLORSを参照のまま公開し、empty custom colorをdefaultへ畳み込み、enum validationを追加しない。

SPEC-DEEP-040追加根拠: `user/useUserSettingsActions.js` のtagSize更新はenumを検査するがUser document全体をupdateする。静的callerは見つからず、現行設定経路との重複・互換性を確認してから統合または廃止する必要がある。

## FUT-0167 Date range・debounce・timer lifecycleを安全な共通contractへ揃える

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-SEG-061
- 対象ファイル・シンボル: `useDateUtil`、`useDateRange`、`useTimedSet`、`usePerformanceOptimization`、`rangeValidator`
- 確認済み実装事実: rangeはJST startOf/endOf dayの両端包含だがdayCount/offsetのinteger・finite・上限とInvalid Dateを統一検証しない。invalidはnull/false/warn/throwに分岐する。dateRange UIとdebounced queryは一時不一致になる。timed set/debounce/batch/frame/memory/lazy observerにunmount cleanupがなく、timed setはremove後再addを旧timerが早期削除し得る。performance exportsはdebounce以外の直接callerがない。
- 想定影響と発生条件: 巨大/小数/invalid rangeでCPU・query・表示不一致、route離脱後callback、timer/observer leak、highlight早期消失、batch重複・error吸収、cache collisionが生じ得る。
- 未確認点・仮説: runtime leak/overlap再現、実range、browser throttling、SSR到達、全callerのflush/paginationは未確認。
- 推奨する将来対応: CONF-0138後、JST包含range value objectとfinite integer/max-span validationを共通化し、invalid error型を統一する。effect scope disposalでtimer/frame/observer/intervalをclearし、TimedSetはkey別generation/timer、batchはsingle-flight＋awaitable flush、memo keyはcollision-safeにする。未使用exportsは削除候補とする。
- 必要なテスト: same-day/month/year/leap/JST、offset文字列/NaN/Infinity/小数/巨大、Invalid Date、inclusive Firestore boundary、rapid move/flush/unmount、remove-readd、batch overlap/error、memo collision/TTL、observer/frame/SSR。
- ユーザー判断が必要な事項: CONF-0138。cleanup/Invalid Date拒否自体は実装修正事項。

## FUT-0168 未使用の運転日報PDF utilityを用途確定後に削除または正式化する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-SEG-062
- 対象ファイル・シンボル: `utils/generateCollectingReport.js`、`generateDrivingLogPdf`
- 確認済み実装事実: file名はcollecting reportだが唯一のexportと帳票内容は運転日報である。repository-wideのsymbol/import/export検索でcallerは0件。plain stopsをPDF化してbrowserでopenし、schema、認証、tenant、loading/error/auditを持たない。module import時に約15.3 MBのVFS fontをstatic loadしglobal pdfMake font設定を書き換える。
- 想定影響と発生条件: 将来誤って再利用すると名称誤認、権限・tenant未検証の所在地/時刻出力、popup/error未処理、large font bundle、他PDFとのglobal設定順依存が生じ得る。現時点ではcaller不在のためruntime影響は未到達候補である。
- 未確認点・仮説: Git履歴、過去利用、production tree shaking、auto-import registry、正式な運転日報/集金報告要件、実bundle容量は未確認。
- 推奨する将来対応: 履歴とproduct ownerに保持理由を確認し、不要ならfont生成物への影響を確認してutilityを削除する。正式採用するなら用途に合う命名・専用route/permission、typed input、tenant/field validation、lazy font、download/filename、loading/error/audit/privacy contractを先に仕様化する。
- 必要なテスト: static caller/build tree shaking、empty/null/malformed/大量/長文input、日本語font、page break、popup block、double call、他PDFとのfont設定順、unauth/cross-tenant/PII、filename/download。
- ユーザー判断が必要な事項: 現時点ではなし。正式機能として採用する場合にのみ運転日報または集金報告の上位要件を確認する。

## FUT-0169 ArrangementsManager SpeedDialの親action接続を修正する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-DEEP-015
- 対象ファイル・シンボル: `components/Arrangements/Manager/SpeedDial.vue`、`Manager/index.vue`、`Manager/useIndex.js`
- 確認済み実装事実: 親は`<SpeedDial v-bind="uiSpeedDial.attrs" />`で`onClick:site-shift-type-order`、`onClick:add-schedule`、`onClick:workers` listenerを渡す。SpeedDialは同名のinternal emitを定義するが、propsを定義せず`$attrs`もrootまたは内部buttonへbindしない。Vueのundeclared listenerはroot `v-fab` attributeへfallthroughし、internal `emit`のlistenerとしては登録されないため、3操作が親handlerへ到達しない構成である。
- 想定影響と発生条件: 配置管理画面のSpeedDialから並び替え、予定追加、作業員選択を押しても、対応するdialog/actionが起動しない。
- 未確認点・仮説: Vuetify `v-fab`が任意の`click:*` listenerを独自にemitするかは未確認。ただしSpeedDial componentのinternal emitとは別経路である。
- 推奨する将来対応: listenerを`defineEmits`のcomponent eventとして明示し、親が`@click:*`で購読するか、`$attrs`を意図したchildへ明示bindする。各actionのloading/disabled/accessibility labelも同時に整備する。
- 必要なテスト: 3つのSpeedDial button clickが各親handlerを1回呼ぶこと、disabled/loading中の抑止、keyboard/accessible name、attr fallthroughなし、dialog open/close。
- ユーザー判断が必要な事項: なし。action到達性は実装修正事項である。

## FUT-0170 一覧componentのcreate・selection/pagination・集計table契約を一致させる

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-DEEP-016、SPEC-DEEP-021、SPEC-DEEP-027、SPEC-DEEP-028、SPEC-DEEP-033、SPEC-DEEP-034、SPEC-DEEP-035、SPEC-DEEP-037
- 対象ファイル・シンボル: `components/Articles/Manager/index.vue`、`Articles/Iterator/index.vue`、`ArticleDetails/DataTable/index.vue`、`components/Customers/Iterator/index.vue`、`Site/{CustomInput,Card}`、`components/Sites/Iterator/index.vue`、`components/Employees/{Manager,Iterator}`、`components/Outsourcers/{Manager,Iterator}/index.vue`、`components/molecules/cards/SelectCancel.vue`、`WorkerSelector.vue`
- 確認済み実装事実: ArticlesManagerは`showCreate` falseでもtoolbarのplusを常時表示する。Managerが渡す`itemsPerPage`と`hideDefaultFooter`はIteratorが定義・透過せず、Article pageの取得limit 10と指定page size 20の差を解消しない。ArticleDetailsDataTableは5 headersに対しfooterで`colspan=5`のlabel cellとtotal cellを出力し、6列相当となる。SPEC-DEEP-021でCustomersIteratorも`modelValue`、`show-select`、`select-strategy`を内部`air-data-iterator`へ転送せず、Site create wizardの既存Customer選択を成立させないことを確認した。SPEC-DEEP-027でEmployeesManagerも`showCreate=false`のtoolbar plusを常時表示し、EmployeesIteratorは宣言した`hideDefaultFooter`をrootへ渡さず、JSDoc記載のitem/footer slotもforwardしないことを確認した。SPEC-DEEP-028でcards/SelectCancelのinternal model updateがconst再代入、WorkerSelectorの`tab-changed`が未発火であることを確認した。
- 想定影響と発生条件: callerがcreate禁止、selection、pagination、footer非表示を指定しても画面挙動が一致せず、Site作成時に既存Customerを選べず取引先未設定の仮登録へ流れるか、一覧件数・table totalの視覚的整列を誤認する。
- 未確認点・仮説: AirDataIterator/AirDataTableが独自にattrを補正するか、実browserでfooterがどのようにrenderされるかは未確認。
- 推奨する将来対応: create actionを明示prop/permissionへ従属させ、selection/v-model、pagination/footer propsを実際のiteratorへ渡す。footerのcolspanをheader数とtotal cellの契約へ合わせ、component contract testを追加する。
- 必要なテスト: showCreate true/false、empty/toolbar create到達性、Customer single select/v-model、limit/page size、footer on/off、5列table total alignment、keyboard/accessibility。
- ユーザー判断が必要な事項: なし。公開component APIとrenderingの実装修正事項である。

SPEC-DEEP-033でOutsourcersManagerも`showCreate=false`を無視してtoolbar plusを表示し、OutsourcersIteratorもdeclared `hideDefaultFooter`をrootへ渡さないことを確認した。`itemsPerPage`はundeclared attrとしてfallthroughし得るため、全propが同じく失われるとは断定しない。

SPEC-DEEP-034では、Site create wizardがselection/v-modelを転送しないCustomersIteratorへ依存することを再確認した。SiteCardはSitesIteratorだけから到達し、そのroute使用はcomment outされている。Card selectionはclickable iconだけでaccessible name/keyboard handlerがなく、公開componentのdynamic/external reachabilityは未確認である。

SPEC-DEEP-035では、Sites/Users Iteratorも宣言した`hideDefaultFooter`を内部iteratorへ渡さず、selection propsはJSDocだけであることを確認した。UsersManagerは`showCreate=false`でもplusを表示し、検索欄はfilter/emitせず、empty create handlerは未定義`toCreate`を参照する。Sites DataTableはCustomer欠損・失敗を`...loading`へ畳み込み、環境localの日付整形を使う。

SPEC-DEEP-037では、SiteOperationSchedule SelectorがListItemへ渡そうとするprepend/title/subtitle 3 slotを子が公開せず、row keyにindexを使うことを確認した。Tableはmissing/permission failure/fetch中を仮登録と区別せず`loading...`へ畳み込む。

## FUT-0171 ArticleDetailの非同期選択を最新値・失敗安全にする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-DEEP-016
- 対象ファイル・シンボル: `components/ArticleDetail/CustomInput/index.vue` の `onArticleSelected`
- 確認済み実装事実: `onArticleSelected`はarticleIdごとに`getArticle`をawaitした後、選択世代確認、AbortController、loading/error catchなしで`updateProperties({ articleId, price })`を実行する。先行requestが後続選択より遅く完了すると、古いarticleIdとpriceが最新選択を上書きし得る。取得失敗時のUI feedback/rollbackはない。
- 想定影響と発生条件: 利用者がautocompleteを短時間に切替、通信が遅延・失敗した場合、保存されるArticleDetailのarticleId/priceが画面上の最終選択と異なるか、Promise rejectionで編集状態が不明となり得る。
- 未確認点・仮説: fetch adapterが同一key requestをdeduplicate/cancelするか、AirArrayManagerがrejectionを捕捉してrollbackするかは未確認。
- 推奨する将来対応: 選択generationまたはcancel tokenで最新responseだけを適用し、loading/失敗message/明示retryと価格fallbackの扱いを定義する。保存直前にarticleId/price整合を再確認する。
- 必要なテスト: A→Bのout-of-order response、clear中response、not found/error/offline、double select、loading中save、latest article/price保存、retry。
- ユーザー判断が必要な事項: なし。非同期編集整合性の実装修正事項である。

## FUT-0172 legacy notification chipの到達性とunknown-status表示を整理する

- 状態: Open
- 重大度: Low
- 発見セグメント: SPEC-DEEP-017
- 対象ファイル・シンボル: `components/atoms/chips/ArrangementNotification.vue`、`components/atoms/chips/isStartNextDay.vue`
- 確認済み実装事実: 両ファイルへの静的caller/importは見つからず、現行の通知表示/翌日入力は別pathのcomponentである。通知atomはmissing notificationには`TEMPORARY` fallbackを返す一方、present notificationの未知`status`は`ArrangementNotification.STATUS`からundefinedとなり、templateで`status.title`を安全に読めない。
- 想定影響と発生条件: dynamic/template経路でlegacy notification atomが使われ、旧値・typo・未知enumを持つ通知を表示するとrender例外になり得る。未到達であれば保守対象と実体がずれる。
- 未確認点・仮説: Nuxt auto-registrationまたは動的component名からの到達性、既存Firestoreに未知statusがあるか、二つのlegacy chipを残す運用意図は未確認。
- 推奨する将来対応: 実利用を静的/DEVで確認して、単一の現行chipへ統合するか、unknown-status safe fallback・明示的なdeprecated方針を追加する。
- 必要なテスト: missing/present/unknown status、click attribute/emit precedence、dynamic component reachability、screen reader label、旧enum表示。
- ユーザー判断が必要な事項: なし。

## FUT-0173 atoms input/displayの防御的contractとdead候補を整理する

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-DEEP-018
- 対象ファイル・シンボル: `components/atoms/HourInput.vue`、`QualifiedTypeChip.vue`、`BillingUnitTypeChip.vue`、`alerts/Warn.vue`、`icons/HolidayFlag.vue`
- 確認済み実装事実: HourInputはnumber型だけを確認してminutesへ丸めるためNaN/infinityをrejectしない。QualifiedTypeChipの`label`/`variant` propsは宣言されるがtemplateへ渡されず、Billing/Qualified chipsは`ERROR` fallbackを表示する。Billing/Qualified/Warn/HolidayFlagにはstatic caller/importが見つからなかった。
- 想定影響と発生条件: 不正numeric値がminute modelへ到達して下流保存/表示を壊し得る。callerがlabel/variantを指定してもQualified chip表示に反映されず、未到達atomを維持すると共通UI契約が分岐する。
- 未確認点・仮説: AirNumberInputがfinite validationを常に実施するか、Nuxt dynamic componentからの到達性、unknown enum/ERRORの実データ発生は未確認。
- 推奨する将来対応: finite/min/max/requiredをatomまたは統一validatorで明示し、Qualified chipの公開propsをbindまたは削除する。DEV/static調査で未到達atomsを単一UIへ統合・deprecated化・削除のいずれかへ決める。
- 必要なテスト: null/number/NaN/infinity/negative/rounding、Qualified label/variant、unknown enum、Warn/dialog attrs/slots、dynamic component reachability、screen reader labels。
- ユーザー判断が必要な事項: なし。

## FUT-0174 OperationBilling専用入力の結線と明細表示契約を修正する

- 状態: Open
- 重大度: High
- 発見セグメント: SPEC-DEEP-029
- 対象ファイル・シンボル: `components/OperationBilling/Manager/index.vue`、3 Activatorの`defineExpose({ customInput })`、Base/Agreement/Adjust CustomInput、BillingDetail
- 確認済み実装事実: Managerは`customInput` propを宣言するがAirItemManagerへ渡さず、詳細pageも指定しない。各Activatorは専用inputをexposeするがManagerにref/参照がない。比較するOperationResult/OperationBillings managersは`:custom-input`を明示する。BillingDetailはworker通常/残業売上だけを表示し、稼働外売上とtaxを含まない一方、card titleは「請求明細」である。
- 想定影響と発生条件: current AirItemManagerに専用inputの自動解決がなければ、取極め・請求日・調整値の意図したdialogへ到達できない。到達できても請求明細をdocument総額と誤認すると、稼働外売上を含む`salesAmount`との差を見落とし得る。
- 未確認点・仮説: AirItemManager packageのdefault/fallback input、runtimeで実際に開くcomponent、稼働外売上が別card表示されることによる利用者理解は未確認。専用inputが完全に非機能とは断定しない。
- 推奨する将来対応: Managerへ`props.customInput`を明示的に渡すか、activatorごとのinputを親から指定する単一契約へ統一する。worker明細・稼働外売上・税・総額の表示範囲をlabelで区別し、不要なexpose/legacy managerを整理する。
- 必要なテスト: 3 cardのedit clickで期待するBase/Agreement/Adjust inputが開くこと、取極め/請求日/adjusted値の保存、cancel/validation/error、稼働外売上ありのworker明細とsalesAmount、permission/lock、keyboard/focus。
- ユーザー判断が必要な事項: なし。既存の承認済み手動調整経路を到達可能にし、表示範囲を明示する実装修正事項である。

## FUT-0175 OperationResult・ScheduleのSite変更時securityTypeを最新選択へ収束させる

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-DEEP-030、SPEC-DEEP-036
- 対象ファイル・シンボル: `components/{OperationResult,SiteOperationSchedule}/CustomInput/index.vue` のSite watcher、`useSetRegularTime`、`services/operation.initializeSecurityType`
- 確認済み実装事実: OperationResultのSite変更watcherは変更時点で`useFetch` cacheに存在し、truthyなsecurityTypeを持つSiteだけをdraftへcopyする。cache取得完了を待つwatchや変更世代tokenはなく、cache未取得・取得失敗時に以前のSiteのsecurityTypeをclearしない。before create/update handlerもcurrent securityTypeがUNSETの場合だけSite値を補うため、以前の非UNSET値を保持する。SPEC-DEEP-036でSiteOperationSchedule CustomInputも同じ同期cache-only watcherを持ち、cacheが後から埋まっても再実行されず、旧Site値を保持し得ることを確認した。
- 想定影響と発生条件: 別Siteへ変更した時に新Siteが未cacheなら、以前のSiteのsecurityTypeが新しいOperationResultまたはSiteOperationScheduleへ保存され、警備種別別の表示・集計・検索が選択Siteと一致しない可能性がある。rapid Site変更では遅い取得結果の適用先も曖昧になる。
- 未確認点・仮説: Site autocompleteが選択前に必ずcacheへ登録するruntime契約、securityTypeを利用者がSite既定値から意図的にoverrideする正式方針、実dataでの発生有無は未確認である。
- 推奨する将来対応: 選択Site IDに対するfetch完了を待ち、latest-selection tokenを確認してから既定値を適用する。未取得/失敗時は保存を止めるかUNSETとしてhandlerで解決し、利用者overrideを保持する条件を明示する。stale値を無言で保存しない。
- 必要なテスト: cache済み/未取得Site変更、取得失敗、A→Bのrapid変更、以前の非UNSET値、同じSite再選択、手動override、create/update handler、集計反映。
- ユーザー判断が必要な事項: なし。現commentとhandlerが示すSite既定値同期を安全に収束させる実装修正として管理し、overrideの詳細は実装時に既存仕様と再照合する。

SPEC-DEEP-039b追加根拠: `useSetRegularTime`もsiteIdに対応するSiteをcacheだけで同期参照し、未cache/取得失敗を「現場を指定してください」へ畳み込みfetchをawaitしない。

## FUT-0176 OperationSchedules Tableのrow actionを到達可能かつ操作可能にする

- 状態: Open
- 重大度: Medium
- 発見セグメント: SPEC-DEEP-031
- 対象ファイル・シンボル: `components/OperationSchedules/Manager/index.vue`、`Table/Body/index.vue`、`AddScheduleIcon.vue`、`RemoveSiteOrderIcon.vue`
- 確認済み実装事実: Table Bodyはrowのadd/remove icon clickから`click:add-schedule`と`click:remove-site-order`をemitするが、`OperationSchedulesManager`は`click:cell`だけをlistenし、両eventのhandlerを渡していない。そのため通常`/operation-schedules` routeではrow iconに状態変更先がない。iconsはclick可能な`v-icon`で、component自身にnative button/keyboard操作/explicit accessible nameを持たない。
- 想定影響と発生条件: 利用者はrow headerの追加・削除iconを操作可能と誤認するが、通常routeでは何も起きない。将来eventを結線しても、keyboard利用者は操作できず、removeでは現在range外のscheduleを考慮しない公開disable契約をそのまま使う可能性がある。
- 未確認点・仮説: Vuetify `v-icon`の実際のpointer/keyboard挙動、別callerが同eventを結線する利用、row add/removeの正式な業務意味は未確認である。
- 推奨する将来対応: row actionを削除するか、Managerでcreate/remove actionを明示結線して確認dialog・loading/error・rangeを超えた参照guardを設ける。操作を残すなら`v-btn`等のsemantic control、accessible name、keyboard/focusを用いる。
- 必要なテスト: route上のrow add/remove到達性、icon click/keyboard、permission/Rules拒否、range内外schedule、remove confirmation/cancel/error、Site cache未取得、mobile/table scroll。
- ユーザー判断が必要な事項: なし。少なくとも公開されたrow操作を実装するか表示しないかは実装修正として決められる。order削除の業務規則は既存CONF-0057へ統合する。

## FUT-0177 admin_users collectionの用途・tenant・actor・field境界を確定しRulesを閉じる

- 状態: Open
- 重大度: 未評価
- 発見セグメント: SEC-002
- 対象ファイル・シンボル: Firestore Rulesの`admin_users` match
- 確認済み実装事実: 現行Rulesはauthenticated userへ`admin_users`のglobal read/writeを許す。調査したapplication/Functionsからcollection-specific caller、用途、tenant key、実data存在は確認できなかった。
- 想定影響と発生条件: collectionに権限・運用者・個人情報等が存在する場合、任意authenticated userによる閲覧・改変につながる。用途とdata不在の場合の実害は小さいため、存在確認前に重大度を断定しない。
- 未確認点・仮説: remote data、外部consumer、document schema、UID/path推測可能性、認可判定への利用は未確認。
- 推奨する将来対応: 用途とownerを棚卸しし、未使用ならRulesをdenyして安全に廃止する。使用中ならtenant/actor/field/old-ownerを明示し、server-onlyまたは最小権限Rulesへ変更する。
- 必要なテスト: unauthenticated/authenticated/tenant admin/super-userのread/create/update/delete、field diff、tenant変更、存在/不存在data migration。
- ユーザー判断が必要な事項: 正式role matrixはCONF-0111へ統合する。用途・data有無の確認は実装調査事項である。

## FUT-0178 Firebase/Nuxt plugin初期化順とruntimeConfig型をfail-fastで検証する

- 状態: Open
- 重大度: High
- 発見セグメント: ARCH-001
- 対象ファイル・シンボル: Firebase/Nuxt plugins、`runtimeConfig`、emulator切替、FireModel adapter初期化、`scripts/run-codex-local-ui-dev.mjs`、Codex専用local UI readiness手順
- 確認済み実装事実: plugin間の暗黙順序、initialize/reuse、adapter設定へ依存し、初期化前利用や設定型誤りを起動時に一意に失敗させるcontractがない。2026-08-27に`firebaseUseEmulator`はbooleanまたは文字列の`true`/`false`だけを受理し、未設定・空文字列をfalse、その他を起動時errorとする厳格parseへ修正し、Devの文字列`false`がremote接続を選ぶ境界を単体testで固定した。local UI起動wrapperはNuxt dev processを開始するだけで、root HTTP 200後にbrowserのclient entryと推移的module graphが評価可能になったことを判定しない。2026-08-25の再現ではroot、Vite client、Nuxt entry、上位pluginがHTTP 200でVite接続済みでも起動templateのままNuxt mountへ到達せず、module warm-up後の通常reload 1回で同じtabがdashboardへ到達した。
- 想定影響と発生条件: plugin順序・環境設定差で別adapter、未初期化service、誤ったemulator/remote接続を選び、errorが後段の業務処理として現れ得る。Windows上のcold dev startではHTTP readyをapplication readyと誤認して初回navigationが起動templateへ固定され、UI testが不安定になる。
- 未確認点・仮説: Nuxtの実際のplugin order保証、各環境の実値、build後の環境選択、初回module graphが完了しないVite/browser内部原因は未確認。
- 推奨する将来対応: dependencyを明示した単一bootstrap、残るruntime configのtyped parse、initialize-once/reuse検証、expected project/environment assertionを起動時に行う。Codex専用dev UIはclient entryの推移的module graphまたは製品landmarkを有限時間で確認するreadiness/warm-up契約を追加し、失敗時は自動反復せず診断情報と一回限定reloadの要否を明示する。
- 必要なテスト: plugin順序、重複初期化、欠落設定、emulator/DEV/PROD build matrix、SSR/client再初期化、cold dev startを複数回行ってreloadなしで製品landmarkへ到達する回帰test、timeout時の停止と診断情報。`firebaseUseEmulator`のboolean・文字列true/falseと不正値拒否の単体testは追加済み。
- ユーザー判断が必要な事項: なし。環境選択の正式値は既存運用文書と照合する。

## FUT-0179 FireModel adapter/configをrequest・tenant単位へscopeしclient/server契約を統一する

- 状態: Open
- 重大度: High
- 発見セグメント: SCHEMA-BASE-001
- 対象ファイル・シンボル: FireModelのstatic `_adapter`/`config`、ClientAdapter、ServerAdapter、Functions migrationの`setConfig`
- 確認済み実装事実: adapterとprefix configはprocess-global mutable stateで、reset/context APIがない。Functions migrationはinvocation中にglobal prefixを変更して復元しない。client/serverは公開method、transaction利用、error型、callback spelling、`hasMany` field名が一致しない。
- 想定影響と発生条件: long-lived SSR/Functions processの並行requestでtenant prefixやadapterが混線し、誤tenant read/writeまたは再現しにくい失敗を起こし得る。server-only method欠落やquery import不足は到達時にruntime failureとなる。
- 未確認点・仮説: 実際の同時実行再現、module instance分離、該当server APIの本番到達頻度は未確認。
- 推奨する将来対応: immutable app/request contextへadapter・tenant routingを注入し、global mutationを除く。client/server共通interfaceとcontract testを定義し、未対応methodは明示拒否または実装する。
- 必要なテスト: concurrent tenant contexts、prefix reset、client/server API parity、transaction read、hasMany、query builder、error/callback契約。
- ユーザー判断が必要な事項: global collectionの正式tenant方針はCONF-0111と既存domain判断へ統合する。

## FUT-0180 FireModelのcreate/update/serialization/validation契約を明示しデータ損失を防ぐ

- 状態: Open
- 重大度: High
- 発見セグメント: SCHEMA-BASE-001、SCHEMA-MASTER-001、SCHEMA-OPS-001、SCHEMA-FINANCE-001
- 対象ファイル・シンボル: FireModel converter/create/update/fromFirestore、BaseClass defaults/validate、schema fieldDefinitions/accessors
- 確認済み実装事実: create/updateはfull set/upsertで存在・versionを確認せず、hydrateで無視したunknown fieldを後続saveで削除し得る。hidden/readOnlyとenumerable accessorは保存制御でなく、snapshot IDをdocument IDから導出しない。mutable default共有、nested class二重構築、type/enum/nested validation不足も確認した。
- 想定影響と発生条件: concurrent editor/trigger、schema version差、未知fieldを含むdocumentでlost update・field消失・派生値の意図しない固定化が起きる。UI metadataだけを信頼した直接writeは不正値を保存できる。
- 未確認点・仮説: 既存unknown/derived fieldの実data、migration互換、document size、全domainでの発生件数は未確認。
- 推奨する将来対応: create-must-not-exist/update-must-exist、field-safe patchまたはversion precondition、明示persistence whitelist、snapshot ID、unknown field policy、deep-cloned defaults、strict/nested validationを段階移行する。
- 必要なテスト: create collision、update missing/version conflict、unknown field preservation、accessor/hidden serialization、shared defaults、nested classes、type/enum/date/numeric boundary、legacy data migration。
- ユーザー判断が必要な事項: overwrite/merge、保存field、legacy compatibilityはCONF-0137ほか既存data compatibility判断へ統合する。

## FUT-0181 Air managerのdisable・validation・single-flight・draft conflictを永続化前に強制する

- 状態: Open
- 重大度: High
- 発見セグメント: UI-BASE-001、UI-MANAGERS-001、SPEC-DEEP-034、SPEC-DEEP-035、SPEC-DEEP-037、SPEC-DEEP-038
- 対象ファイル・シンボル: `useItemManager`、`useArrayManager`、AirItemManager、AirArrayManager、AirEditCard、OperationResult/Schedule manager callers
- 確認済み実装事実: function-valued `disableSubmit`へ`{item, editMode}`を渡す一方callerはitem単体を期待するためlocked result UIが無効化されない。disableUpdate/disableDeleteはerror後もcallbackを実行し、manager.submit自身はdisableを検査しない。step final validation、submit mutex、live parent更新とのdirty conflict、external handler後のcanonical result取込みもない。Site create wizardはstep 3用VForm validatorを実装するが、標準の最終stepはchild `handleGoToNext`を呼ばず直接submitするため、そのvalidatorへ到達しない具体例である。SPEC-DEEP-035でemployee-linked User削除がdisable error後も続行し得る実到達例、SitesManagerの同じCRUD依存、Site order draftの親更新reset・loading中drag・raw array emitを確認した。SPEC-DEEP-037でSiteOperationSchedule ManagerのoperationResultId disableも同じくcallbackを止めず、親docのdeep更新がinternalDoc/draftを再初期化し得る実到達例を確認した。SPEC-DEEP-038でSiteOperationSchedulesManagerとWorkerDetailManagerも同じ公開method・disable・single-flight境界に依存することを確認した。
- 想定影響と発生条件: custom slot/exposed method、double click、subscription更新、server-assigned fieldを伴う保存で、禁止操作、重複処理、stale full update、成功後の古いarray emitが起き得る。UI guardは認可ではないが、model/Rules到達前の誤操作防止も成立しない。
- 未確認点・仮説: Vuetifyのclick抑止、browserでの具体的重複頻度、外部package consumerは未確認。
- 推奨する将来対応: callback signatureを移行し、toX/submit内部で全disableとloadingをfail-closedに検査する。default/step/custom validation、single-flight token、dirty conflict/version reject、handlerのcanonical return契約を実装する。
- 必要なテスト: locked result、linked schedule、boolean/function disable、exposed submit、double submit、final step、live refresh、falsy/missing key、external handler canonical result。
- ユーザー判断が必要な事項: edit conflict、canonical result、validation ownershipはCONF-0114と既存UI判断へ統合する。

UWB-03追加判断（2026-08-17）: 利用者は`AirItemManager`・`AirArrayManager`のerror、loading、dialog、validation、CRUD orchestration等の責務が多岐にわたるため、将来整理する方針を採用した。責務分割の構造整理自体は低優先度とする。既知のdisable継続、single-flight欠如等の安全問題は本FUTのHighを維持し、分割時も現行のmanager→`useBaseManager`→Errors/Message Storeという利用者feedback経路をcontract testなしに破棄しない。

## FUT-0182 共通入力のdebounce・非同期検索・date/time・accessibility契約を統一する

- 状態: Open
- 重大度: Medium
- 発見セグメント: UI-BASE-001、UI-CONTROLS-001、UI-MANAGERS-001、SPEC-DEEP-034
- 対象ファイル・シンボル: AirTextField、AirAutocompleteApi/AirApiLoader、AirPostalCode、AirTimePickerInput、AirDateTimePicker/Input、validation/focus composables
- 確認済み実装事実: TextFieldはvisible valueと遅延emitがずれ、submit/unmount時flushがない。非同期検索と郵便番号lookupはrequest generation/abortがなく、古い結果が新しい入力へ適用され得る。TimePickerInputのfield attrsはdialogへfallthroughし、date/timeはinvalid/null/timezone/secondsを明示しない。required markerとicon操作のaccessibilityも視覚実装に依存する。Site create wizardはAirPostalCodeの`update:address`をlistenせず、現行root appに住所結果consumerがない具体例である。
- 想定影響と発生条件: 高速入力・画面遷移・offline/遅延response・mobile/keyboard利用で、未反映値保存、stale候補、disabled field編集、誤日時、操作不能が起き得る。
- 未確認点・仮説: Vuetify runtime value型、Nuxt auto-import、DST/browser timezone、provider応答、screen reader挙動は未確認。
- 推奨する将来対応: user-input-only synchronous commitまたは明示flush、latest-wins/abort、loading owner分離、strict date/time parse、inputへのattrs routing、ARIA/keyboard/focus contractを実装する。
- 必要なテスト: debounce submit/unmount、reversed requests、clear/null/invalid date、timezone/seconds、disabled/readonly time input、keyboard/screen reader/mobile。
- ユーザー判断が必要な事項: timezone、debounce、provider、accessibility受入基準はCONF-0114、CONF-0116、CONF-0138へ統合する。

## FUT-0183 Admin operator・claims・company破壊・migrationを承認・監査・再開可能な境界へ移す

- 状態: Open
- 重大度: Critical
- 発見セグメント: ADMIN-SDK-001
- 対象ファイル・シンボル: Admin SDK claims/companies/migration/system commands、CLI/library初期化、User/Auth delete/restore paths
- 確認済み実装事実: Admin credential保有者をcode上でactor認証せず、claims変更、company全削除、Auth repair、restore、locked result migrationを実行できる。target claim/company、self/last-admin、artifact company/integrity、二者承認、operation ID、durable audit、resume/rollbackを強制しない。User doc IDをglobal Auth UIDとしてdeleteするchainもある。
- 想定影響と発生条件: 誤環境・誤tenant・改変artifact・破損User document・並行操作により、global Auth、tenant data、locked financial resultを不可逆または部分的に変更し得る。service account/IAMとoperator端末アクセスが前提だが、影響は重大である。
- 未確認点・仮説: 実IAM、service account配布、production利用、last-admin運用、実artifact、drill実績は未確認。
- 推奨する将来対応: least-privilege operator identity、target tenant/claim preflight、two-person approval、maintenance hard gate、immutable audit、backup receipt、dry-run/apply token、cursor/resume/reconcile/rollbackを共通command frameworkで強制する。
- 必要なテスト: actor/target/env matrix、self/last-admin、forged UID、tampered artifact、partial failure、499/500/501件、locked result exception、trigger reconcile、resume/idempotent replay。
- ユーザー判断が必要な事項: PROD operator、company decommission、locked migration例外、restore scope/RPO/RTOはCONF-0111、CONF-0124〜0130へ統合する。
