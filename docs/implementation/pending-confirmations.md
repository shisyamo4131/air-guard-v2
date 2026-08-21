# 実装調査から得た要確認事項台帳

- 状態: 実装調査・暫定台帳
- 最終確認日: 2026-08-12
- 対象: `docs/implementation/*.md` と `future-actions.md` に残る、実装検証だけでは確定できないユーザー判断
- 運用: 同一判断は既存CONFへ証拠・関連FUTを追記する。回答後はStatusをAnsweredへ変更し、Answerへ日付と回答を記録する。実装だけで確認できる未検証事項は登録しない。

## reconciliation metadata

SPEC-RECONCILE-001で全138 IDを再照合した。既存`Status`と回答本文は変更せず、追加の`Disposition`、canonical question、dependency、superseded関係は[confirmation dependency map](confirmation-dependency-map.md)を正規の再照合索引とする。

- `Answered`: 43件。既存の承認済み回答を保持する。
- `Open-user-decision`: 75件。本当に利用者判断が残るcanonical question。
- `Open-deferred`: 3件。利用者が明示的に保留した事項で、推奨案へ置換しない。
- `Resolved-by-implementation-fact`: 0件。
- `Merge-candidate`: 17件。IDと本文は保持するが、個別には提示せず上位CONFへ統合する候補。
- `Implementation-detail-no-user-question`: 0件。
- `Blocked-by-uninvestigated`: 0件。

## 2026-08-12 優先判断セット

[2026-08-12 source review統合記録](review-reconciliation-2026-08-12.md)を既存138件へ再照合した。実装で答えられる問題はFUTへ統合し、新しいCONFは追加しない。利用者へ提示するときは内部IDの羅列ではなく、次の7テーマを平文で一つずつ確認する。

1. 誰がどのtenant・field・管理操作を実行できるか。
2. 招待された本人であることを、いつ・何で証明するか。
3. 請求確定後とlocked稼働を、訂正・取消・管理者修復する正式手順は何か。
4. 何をbackupし、どの時点まで、どれだけの時間で復旧するか。
5. 個人・勤怠・請求・通知・backup情報を誰が見て、どれだけ保持するか。
6. 非同期処理の部分失敗、重複、順序逆転をどう検知し再実行するか。
7. 編集中競合、error/loading、日付時刻入力、accessibilityの共通UXをどうするか。

対応するcanonical groupは順にG-AUTHZ/G-ONBOARDING、G-BILLING、G-RECOVERY、G-PRIVACY/G-ARCHIVE、CONF-0130、G-SHARED-UX/G-DATA-COMPATである。既存のAnswered 43件、Open-deferred 3件、各Answer本文とStatusは変更しない。

`Open` 95件は削除・Answered化しておらず、部分回答は各`Answer`のまま保持した。今後利用者へ提示するときは、dependency mapのcanonical group単位で行い、Merge-candidateを重複質問しない。

## CONF-0001 pageSettings fail-closed時の未設定route処理

- Status: Open
- Source segment/doc: SPEC-SEG-001/002; `app-shell.md`; `page-access.md`
- Evidence: 未設定の実在pageは現行middlewareで許可される。将来fail-closed化に加え、route一覧との照合により設定漏れ実在pageと存在しないURLを識別する方針は承認済み。4未登録pageのaccess要件は未設計。
- Question: `/auth/reset-password`、`/maintenance`、`/test/user-permission-info`、`/unconfirmedEmail` の各pageを公開/role制限のどちらにするか。
- Why needed: fail-closed実装で正規pageを誤遮断せず、設定漏れも許可しないため。
- Options and impact: route manifest照合＋設定漏れ専用error、全未設定を404、build時検査。運用性と実装量が異なる。
- Current provisional treatment: 現行fail-openを実装事実として記録する。将来はroute一覧と照合し、実在する未設定pageを設定漏れ専用error、存在しないURLを404とする。修正前に4pageの個別accessを確定する。
- Related FUT IDs: FUT-0001, FUT-0002
- Answer: 2026-08-11 部分回答。選択肢1を採用し、route一覧との照合により、実在する未設定pageは設定漏れ専用error、存在しないURLは404とする。4つの未登録page個別のaccess条件は未回答のため、StatusはOpenを維持する。

## CONF-0002 認証初期化のready条件とFCM失敗時UX

- Status: Answered
- Source segment/doc: SPEC-SEG-003/004; `state-initialization.md`
- Evidence: isReadyはUser/Company初期化完了を中心に扱い、FCM登録失敗はlog後に吸収されlogin利用を止めない。
- Question: isReadyを処理終了と利用可能のどちらと定義し、FCM失敗時は通知未準備表示・再試行を行うか。
- Why needed: 認証済み画面の利用可否と通知劣化を一貫表示するため。
- Options and impact: login継続＋通知だけretry、全体error、silent継続。可用性と可観測性が異なる。
- Current provisional treatment: `isReady` は認証初期化処理の終了を表す。loginを継続し、FCM失敗はlogのみとする。
- Related FUT IDs: FUT-0003
- Answer: 2026-08-11 回答済み。`isReady` は「認証初期化処理が終了した」を意味する。FCM失敗時は現状どおりlogだけを残し、loginを継続する。

## CONF-0003 User切替と認証cleanup失敗時の扱い

- Status: Answered
- Source segment/doc: SPEC-SEG-003; `state-initialization.md`
- Evidence: store購読解除・clear順にfailure候補があり、sign-outを挟まないUser切替の保証は未確認。
- Question: User切替を正式対応するか、必ずsign-outを挟む運用とするか。cleanup失敗時にreload・retry・利用停止のどれを行うか。
- Why needed: 前Userのcompany/auth stateやsubscription残留を防ぐため。
- Options and impact: hot switch対応、sign-out必須、強制reload。実装複雑度とUXが異なる。
- Current provisional treatment: User切替は必ずsign-outを挟む。cleanup失敗時は強制reloadする。
- Related FUT IDs: FUT-0004, FUT-0005
- Answer: 2026-08-11 回答済み。User切替は必ずsign-outを挟み、cleanup失敗時は強制reloadする。

## CONF-0004 通知click destinationと既存tab再利用

- Status: Answered
- Source segment/doc: SPEC-SEG-004/005; `pwa-notifications.md`; `notification-delivery.md`
- Evidence: payload destinationをclient/SWが遷移に使うが、許可path、既定page、role access、既存tab方針は未確定。
- Question: notification typeごとのdestination allowlist・fallbackと、既存tabをfocusするか新規openするか。
- Why needed: open redirect、権限外page、予期しない複数tabを防ぐため。
- Options and impact: type別固定route、server allowlist、payload任意。柔軟性と安全性が異なる。
- Current provisional treatment: notification typeごとのapp側固定route allowlistだけを使い、payload任意URLには遷移しない。権限不足・不明通知はdashboardへfallbackし、既存tabがあればfocusして遷移、なければ新規tabを開く。
- Related FUT IDs: FUT-0006
- Answer: 2026-08-11 回答済み。notification typeごとにapp側固定route allowlistを設け、payload任意URLには遷移しない。権限不足・不明通知はdashboardへfallbackする。既存tabがあればfocusして遷移し、なければ新規tabを開く。

## CONF-0005 foreground通知の二重表示UX

- Status: Answered
- Source segment/doc: SPEC-SEG-004; `pwa-notifications.md`
- Evidence: foreground受信時にもOS通知を表示し、アプリ内表示との重複可能性がある。
- Question: foregroundでもOS通知を維持するか、アプリ内通知だけにするか。
- Why needed: 二重通知と見逃し防止のbalanceを決めるため。
- Options and impact: OS＋app、appのみ、設定可能。通知確実性と煩雑さが異なる。
- Current provisional treatment: foregroundはapp内通知だけ、backgroundまたはapp非表示時はOS通知とする。重大通知だけは将来foreground OS通知を選択可能にする余地を残す。
- Related FUT IDs: FUT-0007
- Answer: 2026-08-11 回答済み。foregroundはapp内通知のみ、background・app非表示時はOS通知とする。重大通知だけは将来foreground OS通知を選択可能にする余地を残す。

## CONF-0006 FCM tokenの所有移管・sign-out・cleanup責務

- Status: Answered
- Source segment/doc: SPEC-SEG-004/005; `pwa-notifications.md`; `notification-delivery.md`
- Evidence: 同tokenを後のlogin Userへ保存でき、sign-out削除、invalid token cleanup、auth削除cleanupの正本責務と失敗回収が未確定。
- Question: tokenを最後のlogin Userへ移管してよいか、sign-out時に削除するか、client/server/送信処理のどこをcleanup正本にするか。
- Why needed: 端末共有時の誤通知とorphan tokenを防ぐため。
- Options and impact: login Userへ移管、端末token固定、sign-out削除。通知継続性とprivacyが異なる。
- Current provisional treatment: tokenは現在login中Userだけに紐付け、sign-out時にFirestore紐付けを削除する。次回login時に再取得・再登録する。invalid token最終削除はserver送信処理、Auth User削除時は関連token削除とし、cleanup失敗に備える定期orphan token検査を将来追加する。
- Related FUT IDs: FUT-0008, FUT-0010, FUT-0011, FUT-0012, FUT-0017
- Answer: 2026-08-11 回答済み。tokenは現在login中Userだけに紐付け、sign-out時にFirestore紐付けを削除し、次回login時に再取得・再登録する。invalid tokenの最終削除はserver送信処理が担い、Auth User削除時も関連tokenを削除する。cleanup失敗に備え、定期orphan token検査を将来追加する。

## CONF-0007 FCM token診断logの許容範囲

- Status: Answered
- Source segment/doc: SPEC-SEG-004/005; `pwa-notifications.md`
- Evidence: tokenや識別情報をdiagnostic logへ出す箇所があり、mask長・保持方針は未確定。
- Question: tokenをlogから削除するか、どのmask・識別子・保持期間を許可するか。
- Why needed: 秘密性と障害診断を両立するため。
- Options and impact: 完全削除、短いhash/mask、開発限定。診断容易性と漏えいriskが異なる。
- Current provisional treatment: dev/prodともFCM token全文、User document、notification payload丸ごとをlogしない。調査用は不可逆hash先頭8文字等の照合IDだけとし、prodはuserId・companyId・notificationId等の必要最小限に限定する。
- Related FUT IDs: FUT-0009
- Answer: 2026-08-11 回答済み。FCM token全文をdev/prodともlogしない。調査用は不可逆hash先頭8文字等の照合IDだけを使用し、User document・notification payload丸ごとのlogを禁止する。prodはuserId・companyId・notificationId等の必要最小限とする。保持期間・閲覧権限は監視基盤導入時に別途決定する。

## CONF-0008 Notification配送のretry・重複・結果count契約

- Status: Answered
- Source segment/doc: SPEC-SEG-005; `notification-delivery.md`
- Evidence: 再送回数・重複許容・運用再実行、batch上限超過、Notification countの意味が確定していない。
- Question: 最大試行回数、idempotency、手動再送、failed/completed、countをrecipient/User/tokenのどれで定義するか。
- Why needed: 二重通知と未達を監視・回復するため。
- Options and impact: at-least-once＋dedupe、単発、運用再送。信頼性と複雑度が異なる。
- Current provisional treatment: Notification IDとrecipient User ID単位で冪等化し、一時FCM障害だけ指数backoffで自動retryする。invalid tokenはretryせず削除し、手動再送はfailed recipientsだけを対象とする。複数端末は1台以上FCM受付成功でUser successとし、aggregate countはUser単位、device結果は診断情報とする。retry count・last error・last attemptedAtを記録する。
- Related FUT IDs: FUT-0011, FUT-0012, FUT-0015
- Answer: 2026-08-11 回答済み。Notification ID＋recipient User ID単位でidempotencyを保証する。一時FCM障害だけ指数backoffで自動retryし、invalid tokenはretryせず削除する。手動再送はfailed recipientsだけを対象とする。複数端末は1台以上でFCM受付に成功すればUser successとし、aggregate countはUser単位、device結果は診断情報とする。retry count、last error、last attemptedAtを記録する。

## CONF-0009 remote DEV通知test endpointの存廃

- Status: Answered
- Source segment/doc: SPEC-SEG-005; `notification-delivery.md`
- Evidence: remote DEVで利用可能なtest endpoint候補があり、正式な必要性が未確認。
- Question: 本件のsuper-userを「Firebase Auth custom claim `isSuperUser=true` を持つAirGuardV2運営側システム管理者（全会社横断）で、会社adminとは別」とする意味を確認したうえで、remote DEVでtest endpointを維持するか、Emulator/限定callableへ置換するか。
- Why needed: 通知誤送信・abuse surfaceを減らすため。
- Options and impact: 廃止、強認証で維持、Emulator限定。検証容易性と外部作用riskが異なる。
- Current provisional treatment: 通常はEmulatorで通知生成処理を検証する。実機通知確認が必要な場合だけDEV環境限定Callableを使い、`isSuperUser=true` のAirGuardV2運営側system administratorだけが実行する。App Checkを必須とし、送信先を呼出super-user本人または事前許可済みtest accountに限定し、rate limitと監査logを設ける。PRODではexportせず、unauthenticated HTTP test endpointは廃止する。
- Related FUT IDs: FUT-0013
- Answer: 2026-08-11 回答済み。通常はEmulatorで通知生成処理を検証する。実機通知確認が必要な場合のみDEV環境限定Callableを使用する。実行者はFirebase Auth custom claim `isSuperUser=true` のAirGuardV2運営側system administrator（全会社横断）であり、会社adminとは別とする。App Checkを必須とし、送信先は呼出super-user本人または事前許可済みtest accountだけに限定し、rate limit・監査logを設ける。PRODではexportせず、unauthenticated HTTP test endpointは廃止する。

## CONF-0010 Service Worker更新時の利用者体験

- Status: Answered
- Source segment/doc: SPEC-SEG-004; `pwa-notifications.md`
- Evidence: skipWaiting/clientsClaimにより更新を即時適用するが、reload通知方針は未確定。
- Question: 即時更新を維持するか、利用者へ通知してreload選択を求めるか。
- Why needed: 入力中state消失と更新遅延のtradeoffを決めるため。
- Options and impact: 即時activate、prompt reload、次回起動。鮮度と作業継続性が異なる。
- Current provisional treatment: Service Worker更新を検出したら更新案内を表示し、Userが選択した時点でreloadする。未保存入力があれば警告し、選択しなければ次回app起動時に更新する。security emergencyだけは将来forced update可能にする余地を残す。
- Related FUT IDs: FUT-0016
- Answer: 2026-08-11 回答済み。Service Worker更新検出時に更新案内を表示する。User選択時にreloadし、未保存入力があれば警告する。選択しなければ次回app起動時に更新する。security emergencyだけは将来forced update可能にする余地を残す。

## CONF-0011 Auth User削除時token cleanupの回収方式

- Status: Answered
- Source segment/doc: SPEC-SEG-005; `notification-delivery.md`
- Evidence: cleanup failureはlog後に吸収され、orphan回収がない。
- Question: auth削除trigger全体をretryさせるか、cleanupだけqueue/定期scanで回収するか。
- Why needed: token orphanを残さず他cleanupへの波及も制御するため。
- Options and impact: trigger retry、非同期cleanup、定期repair。結合度と回復性が異なる。
- Current provisional treatment: Auth削除token cleanupを冪等化してFunctionsで自動retryし、既に存在しないtokenはsuccessとする。retry上限超過はmonitoringし、定期orphan scanでも回収する。cleanup failureでAuth deletionはrollbackしない。
- Related FUT IDs: FUT-0017
- Answer: 2026-08-11 回答済み。Auth delete token cleanupをidempotent化し、Functionsで自動retryする。already absentはsuccessとし、retry上限超過はmonitoringする。periodic orphan scanでも回収し、cleanup failureでAuth deletionをrollbackしない。

## CONF-0012 ArrangementNotificationのactor・field・payload認可

- Status: Answered
- Source segment/doc: SPEC-SEG-006〜009; `notification-authorization.md`; `arrangement-notifications.md`; `arrangement-notification-ui.md`
- Evidence: 配置管理者の任意4状態・資格/OJT変更とGeneratorのLEAVED化は承認済み。一方配置管理者の認定permission、本人/管制のfield、payload/recipient上限は未決。
- Question: 配置管理者を何で認定し、本人・管制・管理者が変更できるfield/status、手動通知、payload/件数上限をどう分けるか。
- Why needed: crafted writeからの権限昇格・spamを防ぎつつ承認済み操作を維持するため。
- Options and impact: Rulesでrole/field制御、server callable集約、現行同社全員write。安全性と実装量が異なる。
- Current provisional treatment: 本人は自己配置連絡の確認・到着・上番・下番に必要な時刻とstatusだけを変更できる。配置管理者は同一会社内で任意status・time・qualification・OJTを変更できる。Generatorは対象schedule所属通知だけをLEAVED化できる。その他fieldとnotification生成はdedicated server processingへ限定する。payload allowlist・長さ・配列件数・URL、recipient/batch上限を検証し、actor・changedAt・before/afterを監査記録する。具体的role名はauthorization設計確定まで暫定permissionを使う。
- Related FUT IDs: FUT-0018, FUT-0021
- Answer: 2026-08-11 回答済み。本人は自己配置連絡の確認・到着・上番・下番に必要な時刻・statusだけを変更可能とする。配置管理者は同一会社内で任意status・time・qualification・OJTを変更可能とする。Generatorは対象schedule所属通知だけをLEAVED化できる。その他field・notification生成はdedicated server processingへ限定する。payload field allowlist・length・array count・URL validation、recipient/batch upper limits、actor・changedAt・before/after auditを必須とする。具体的role名はauthorization設計確定時に決め、当面はprovisional permissionを使う。

## CONF-0013 Notification/Recipients履歴の閲覧・手動作成・保持

- Status: Answered
- Source segment/doc: SPEC-SEG-006; `notification-authorization.md`
- Evidence: 通常UserはRules fallbackでread不可、super-userはread/write可。schema commentのFunctions管理と一致しない。
- Question: 誰が送信履歴を閲覧し、super-user手動作成・修復、保持・削除を許すか。
- Why needed: 監査記録の完全性と運用修復を両立するため。
- Options and impact: Functions-only write＋role read、super-user repair callable、client write維持。
- Current provisional treatment: Userは自分宛履歴だけ、配置管理者は同一会社の配置通知履歴・結果を閲覧できる。client direct Notification/Recipient CRUDは禁止し、resendはdedicated server process、super-user repairもreason・audit付き専用処理に限定する。本文・結果は原則1年保持後に削除または匿名集計だけを残し、法令・契約上長期保持が必要な通知は別区分とする。
- Related FUT IDs: FUT-0019
- Answer: 2026-08-11 回答済み。Userは自分宛履歴だけ、配置管理者は同一会社の配置通知履歴・結果を閲覧できる。client direct Notification/Recipient CRUDは禁止する。resendはdedicated server process、super-user repairもreason・audit付き専用処理とする。本文・結果は原則1年保持後に削除または匿名集計だけを残し、法令・契約で長期保持が必要な通知は別区分とする。

## CONF-0014 registered User ID不変条件と管理者変更範囲

- Status: Answered
- Source segment/doc: SPEC-SEG-006; `notification-authorization.md`
- Evidence: registered User document ID=Auth UIDをFunctionsは前提とするがRulesは強制せず、temporary Userも存在する。
- Question: temporary Userのclient作成範囲、registered ID不変条件、管理者が他Userの通知設定等を変更できる範囲。
- Why needed: Auth/User/token対応と権限fieldを保護するため。
- Options and impact: server-only登録、temporaryだけclient可、管理role field allowlist。
- Current provisional treatment: registered User document IDはAuth UID必須とする。temporary Userは別state・identifierで明確化し、conversionはserver-onlyとする。companyId・role・admin・Auth linkはgeneral client変更不可とし、company adminのrole変更もtenant・actor・fieldを検証するCallableに限定する。既存mismatchはmigration前にdetect・listする。
- Related FUT IDs: FUT-0020
- Answer: 2026-08-11 回答済み。registered User document ID = Auth UIDを必須とする。temporary Userは別state・identifierで明確化し、conversionはserver-onlyとする。companyId・role・admin・Auth linkはgeneral client変更不可とする。company adminによるrole変更もtenant・actor・field検証Callableに限定する。既存mismatchはmigration前にdetect・listする。

## CONF-0015 ArrangementNotification逆遷移時のtimestamp・再通知

- Status: Answered
- Source segment/doc: SPEC-SEG-007〜009; `arrangement-notifications.md`; `arrangement-notification-ui.md`
- Evidence: 配置管理者の任意状態変更は承認済みだが、逆遷移時timestamp保持/消去/再記録と通知再送は未決。
- Question: 各逆遷移でtimestampをどう扱い、再通知するか。
- Why needed: 状態履歴・実勤務時刻・通知の一貫性を保つため。
- Options and impact: timestamp保持、遷移先以降をclear、再記録。監査性と訂正容易性が異なる。
- Current provisional treatment: status transition historyはappend-onlyとする。過去確定時刻を消去・上書きせず、correctionのbefore・after・actor・reasonを記録する。reverseだけでは自動再送せず、resendはmanagerがreason付きで明示実行する。同status再進行でも自動duplicate sendをせず、User通常forwardとmanager correctionを監査上区別する。
- Related FUT IDs: FUT-0021
- Answer: 2026-08-11 回答済み。append-only status transition historyを採用する。過去確定時刻は消去・上書きせず、correctionのbefore・after・actor・reasonを記録する。reverseだけでは自動再送せず、resendはmanagerがreason付きで明示実行する。同status再進行で自動duplicate sendを行わず、User normal forwardとmanager correctionをaudit上区別する。

## CONF-0016 actual勤務日時と既定休憩の規則

- Status: Answered
- Source segment/doc: SPEC-SEG-007/008; `arrangement-notifications.md`
- Evidence: actualStartAt/actualEndAtの日跨ぎ基準と60分既定休憩の適用条件が未確定。
- Question: actual日時の基準日・翌日flag・予定値fallback・既定休憩をどう決めるか。
- Why needed: 勤怠・稼働実績へ誤った日時/休憩を渡さないため。
- Options and impact: 明示日付、shift基準自動跨ぎ、予定fallback。入力負荷と誤推定riskが異なる。
- Current provisional treatment: base dateはschedule dateとし、`actualIsStartNextDay`を明示する。end <= startは翌日とする。actual値を優先し、scheduled値はfallback/defaultだけに使う。breakはactual入力・確認値とし、60分固定を自動確定せずscheduled defaultだけにする。scheduled/actual breakを別々に保持し、保存前に日跨ぎを含むdatetime・breakを検証する。
- Related FUT IDs: FUT-0022
- Answer: 2026-08-11 回答済み。base dateはschedule date、開始翌日は`actualIsStartNextDay`で明示し、end <= startは翌日とする。actual値を優先し、scheduled値はfallback/defaultだけに使う。breakはactual入力・確認値とし、固定60分は自動確定値ではなくscheduled defaultだけとする。scheduled breakとactual breakを別々に保持し、保存前に日跨ぎを含むdatetime・breakを検証する。

## CONF-0017 ArrangementNotification直接削除の業務規則

- Status: Answered
- Source segment/doc: SPEC-SEG-007; `arrangement-notifications.md`
- Evidence: client direct deleteが可能で、schedule更新経路限定・取消通知の要否が未確定。
- Question: 単独削除を許可するか、schedule更新経路だけに限定し、取消通知を送るか。
- Why needed: schedule・通知・履歴の孤立を防ぐため。
- Options and impact: direct delete禁止、管理者限定、取消event化。
- Current provisional treatment: client direct deleteは禁止する。未送信・未確認だけをschedule edit内で除去可能とし、送信済み・確認済み・到着以降は物理削除せずcancel state/historyを残す。schedule変更・削除とnotification cancelはatomicまたはdedicated server processで処理する。取消通知はmanagerのexplicit action、repairは監査付きadmin processに限定する。
- Related FUT IDs: FUT-0023
- Answer: 2026-08-11 回答済み。client direct deleteは禁止する。unsent・unconfirmedだけをschedule edit内で除去できる。sent・confirmed・arrived以降は物理削除せずcancel state/historyを使う。schedule change/deleteとnotification cancelはatomicまたはdedicated server processingとする。cancellation noticeはmanagerのexplicit action、repairはaudited admin processに限定する。

## CONF-0018 OperationResult後続trigger失敗の監視・再処理主体

- Status: Answered
- Source segment/doc: SPEC-SEG-009/012/015/016/050; `operation-result-generation.md`; sync文書群; `operation-result-delete-chain.md`
- Evidence: client成功はOperationResult作成までで承認済み。deleteでは4 projectionを直列処理するtriggerとStorage/schedule cleanup triggerが独立発火し、相互順序・共通transactionがない。source削除後のbefore key/scheduleIdを保持するledgerもなく、部分成功し得る。
- Question: 後続失敗を誰が監視し、どのretry/repair手段で再処理するか。
- Why needed: 請求・勤怠・日次集約・現場履歴のstale状態を回復するため。
- Options and impact: 自動retry＋alert、管理画面repair、定期reconciliation。
- Current provisional treatment: UI成功条件はOperationResult document作成のまま維持する。4 projectionとStorage/schedule cleanupを冪等化して自動retryし、result単位・projection別sync statusとdelete前target metadataを保持する。retry枯渇はmonitoringし、adminのper-result reprocessとscheduled reconciliation/repairを提供する。primary success後の後続失敗でnormal Userを失敗扱いにせず、業務影響がある場合だけ警告する。repairはactor・reason・target・resultを監査記録する。
- Related FUT IDs: FUT-0030
- Answer: 2026-08-11 回答済み。UI successはOperationResult document作成のまま維持する。Billing・Attendance・Daily aggregate・Site historyのdownstream projectionはidempotent化して自動retryし、resultごとにsync statusを持つ。retry exhausted failureをmonitoringし、admin per-result reprocessとscheduled reconciliation/repairを提供する。primary success後のnormal Userは失敗扱いにせず、業務影響がある場合だけwarnする。repairはactor・reason・target・resultをauditする。

## CONF-0019 請求稼働の正式な閲覧・調整・lock権限

- Status: Open
- Source segment/doc: SPEC-SEG-010/011; billing実装文書
- Evidence: billings:read pageからOperationResult update/lockへ到達し、OperationResultsとBillings Rulesも同社全員write。権限制御は試作中と確認済み。
- Question: 閲覧・取極め適用・手動調整・OperationResult lock・Billing集計writeをどのpermissionへ分割するか。
- Why needed: read利用者による請求変更を防ぐため。
- Options and impact: read/write/lock分離、請求管理role、現行一体。
- Current provisional treatment: 権限はUserまたはrole presetが持つ機能permissionで判定する。`operation-results:write`はlockされていない稼働実績の編集・削除、`operation-billings:write`は請求項目の編集とlock設定・解除を担う。その他のBilling lifecycle権限は未確定とする。
- Related FUT IDs: FUT-0031
- Answer: 2026-08-13 追加部分回答。特別な「指定管理者」は設けず、対象操作に必要なpermissionを持つUserを権限者とする。`operation-results:write`はlockされていない稼働実績の編集・削除、`operation-billings:write`は請求項目の編集と`isLocked`の設定・解除を許可する。請求書発行・入金・取消等の正式permission modelは未確定のため、StatusはOpenを維持する。

## CONF-0020 請求稼働の手動新規作成要否

- Status: Answered
- Source segment/doc: SPEC-SEG-010/011; `operation-billing-recovery.md`
- Evidence: 既存OperationResultの請求回復経路に加え、OperationResult詳細は`articles[]`のArticleDetailを「稼働外売上」として編集できる。Article masterも稼働外で計上すべき売上品目として実装済みである。
- Question: OperationResultなしの請求稼働を将来手動作成する必要があるか。
- Why needed: UI/APIと監査・重複防止のscopeを決めるため。
- Options and impact: 不要、調整伝票として別model、OperationResultへ紐付け。
- Current provisional treatment: 別Billing child manual-line modelは採用せず、稼働外売上を持つOperationResultと埋込みArticleDetailを正規経路とする。課税区分等の不足fieldは実務に合わせて将来追加する。
- Related FUT IDs: FUT-0033
- Answer: 2026-08-11 回答済み。OperationResultに既に実装された稼働外売上・ArticleDetailを利用する。OperationResult自体がない手動請求も、稼働外売上を持つOperationResultを作成する経路で扱い、別Billing child manual-line modelは採用しない。課税区分等が不足する可能性は認識し、実務に合わせて将来追加実装する。

## CONF-0021 請求手動調整値の負数・0・上限・精度

- Status: Open
- Source segment/doc: SPEC-SEG-011; `billing-access-and-manual-adjustment.md`
- Evidence: model validatorは負数を拒否せず、数量・単価・残業へ極端値を保存可能。
- Question: 値引き/相殺の負数、0円請求、各値の上限・小数精度をどう定義するか。
- Why needed: 異常・意図しない請求額を防ぐため。
- Options and impact: 非負制限、理由付き負数、項目別range。
- Current provisional treatment: 調整明細がCONF-0020の稼働外売上を指す場合も、それ以外の場合も、負数・0・range・tax・rounding等は保留し、現行入力可能範囲を確定仕様としない。
- Related FUT IDs: FUT-0034
- Answer: 2026-08-11 部分回答。調整明細がCONF-0020の稼働外売上を指す場合も、それ以外の場合も方針は保留する。負数、0、上限、精度、tax、rounding等が未回答のため、StatusはOpenを維持する。

## CONF-0022 DailyAttendance逆引き修正時の既存stale data回復

- Status: Answered
- Source segment/doc: SPEC-SEG-012; `daily-attendance-sync.md`
- Evidence: 現行はbefore/afterからkey再構成し、operationResultIds逆引きToDoが残る。
- Question: 修正時に既存stale dataも一括repairするか、今後eventだけを正すか。
- Why needed: 過去不整合を残すか、移行scopeを決めるため。
- Options and impact: 全件repair、期間限定repair、forward-only。
- Current provisional treatment: DEVでfull DailyAttendance rebuild/diffを行い、本適用時にone-time full rebuildする。移行後は`operationResultIds`の`array-contains`逆引きを使う。dry-runでcountとcreate/update/delete候補を冪等に提示し、periodic consistency checkとrepair auditを設ける。
- Related FUT IDs: FUT-0035
- Answer: 2026-08-11 回答済み。DEVでfull DailyAttendance rebuild/diffを実施し、本適用時にone-time full rebuildする。migration後は`operationResultIds`の`array-contains` reverse lookupへ移行する。idempotent dry-runでcountとcreate・update・delete候補を示し、periodic consistency checkとrepair auditを設ける。

## CONF-0023 employee/outsourcer ID namespace

- Status: Answered
- Source segment/doc: SPEC-SEG-012; `daily-attendance-sync.md`
- Evidence: DailyAttendanceはemployee-only domainであり、`details`は`operationResult.workers`ではなく`operationResult.employees`を参照すべきである。employees配列内のemployeeId/id一致filterで足りる。
- Question: 両IDを共通namespaceで一意保証するか、常にworker typeで区別するか。
- Why needed: 外注明細の勤怠混入を防ぐため。
- Options and impact: global unique ID、type discriminator必須、collection別複合key。
- Current provisional treatment: `operationResult.employees`からemployeeId/id一致でfilterする。isEmployee複合namespaceへの全面変更は行わず、同種のemployee-only domainでworkers/id-only filterを使う箇所をmechanical checkする。
- Related FUT IDs: FUT-0036
- Answer: 2026-08-11 回答済み。DailyAttendance.detailsは`operationResult.workers`（employees＋outsourcers）ではなく`operationResult.employees`を参照し、employees配列内でemployeeId/id一致をfilterする。isEmployee複合namespaceへの全面変更は不要とする。同種のemployee-only domainでworkers/id-only filterを使う箇所をmechanical checkする。

## CONF-0024 DailyAttendance aggregate start/endの将来用途

- Status: Answered
- Source segment/doc: SPEC-SEG-012〜014; `daily-attendance-sync.md`; `attendance-export.md`
- Evidence: aggregate HH:mmは混在日跨ぎで誤るが、Calendar/CSVはdetail日時を使い既知consumerへ非到達。
- Question: aggregateを休暇・給与等で使うか、単一区間/複数区間をどう表すか。
- Why needed: getter修正・廃止・data migrationの要否を決めるため。
- Options and impact: 実日時min/max、区間配列、getter廃止。
- Current provisional treatment: 現在の`startTime`/`endTime` public contractを維持し、getter内部だけをdetail.startAt/endAtのDate比較へ修正する。最早開始・最終終了をHH:mmで返し、新getter/deprecationは設けない。
- Related FUT IDs: FUT-0037
- Answer: 2026-08-11 回答済み。現在の`startTime`/`endTime` public contractを維持し、getter内部だけをdetail.startAt/endAtのDate比較へ修正して最早開始・最終終了をHH:mm formatで返す。same-day、single overnight、mixed same-day＋overnight、multiple overnight/JSTをtestする。new getter/deprecationは不要とする。

## CONF-0025 日次集約へfull OperationResult snapshotを保持する価値

- Status: Answered
- Source segment/doc: SPEC-SEG-012/015; daily sync文書群
- Evidence: DailyAttendanceとDailyOperationsByEmployeeがOperationResult全体をembedded保存し容量riskがある。2026-08-11に、これは`FireModel.classProps.customClass`によって配列要素をOperationResult instanceへ復元し、多数のcomponent/composableがinstanceを前提とするため意図した契約だと確認された。限定版OperationResult classはschema間の循環依存懸念から採用されていない。
- Question: full snapshotとOperationResult instance互換性を維持しながら、document容量を安全に管理できる代替または上限運用を採用するか。
- Why needed: document上限・contentionと履歴再現性のtradeoffを決めるため。
- Options and impact: 現行full snapshot＋容量guard、明示的whitelistのpartial plain objectを同じOperationResultへhydrateする方式、互換でなければ日付partition/subcollection。derived subclassは不要で、循環依存を避ける。
- Current provisional treatment: 現行full embedded、`customClass` hydration、既存component/composable互換性を維持する。DEV容量計測とpartial snapshot prototypeの完全な互換性確認が終わるまでmigrationしない。
- Related FUT IDs: FUT-0038
- Answer: 2026-08-11 回答済み。段階的改訂案を採用する。(1) 現行full embedded snapshot、`customClass` hydration、既存consumer互換性を維持する。(2) DEVでdocument件数・平均・最大bytesを測定し、保守的なwarning/monitoringとsize failureの可視化を行う。(3) 明示的whitelistのpartial stored plain objectを同じOperationResultへhydrateするprototypeを作る。(4) `instanceof`、全consumerのfield/getter、欠落field挙動、再serializationで省略fieldが復元されないことを検証する。(5) 完全な互換性確認後だけmigrationする。(6) 非互換ならfull snapshotを維持し、将来date partition/subcollectionを検討する。derived subclassは作らずschema循環依存を避ける。

## CONF-0026 DailyAttendanceの将来clientアクセス境界

- Status: Answered
- Source segment/doc: SPEC-SEG-012/013; `daily-attendance-sync.md`
- Evidence: 現行fallbackは通常User read/write不可、super-user可。将来休暇等でUser write可能性があるが未確定。
- Question: 本人・管理者・Functions・修復者のread/create/update/deleteとfield所有権をどうするか。
- Why needed: 勤怠privacy・改ざん防止と将来休暇入力を両立するため。
- Options and impact: 本人限定field、管理者承認、Functions-only集約＋別申請model。
- Current provisional treatment: 集約由来の勤務明細・時刻はFunctions-only writeとする。本人・同社勤怠管理者のread、別申請model、監査付きserver訂正を前提とし、現行Rulesは未実装の暫定状態として扱う。
- Related FUT IDs: FUT-0039
- Answer: 2026-08-11 回答済み。集約由来の勤務明細・時刻はFunctions-only writeとする。本人は自己勤怠をreadし、勤怠管理者は同一会社をreadする。休暇・振替休日・代休は別application/eventで本人がcreate/cancel、管理者がapprove/rejectし、承認結果を勤怠表示・集約へ反映する。訂正は監査付きserver process、super-user修復も直接writeではなく監査付き専用processとする。

## CONF-0027 freee勤怠管理Plus CSVの対象formatと正式運用条件

- Status: Answered
- Source segment/doc: SPEC-SEG-014/015; `attendance-export.md`
- Evidence: freee勤怠管理Plus向け4列CSVの仮実装だが取込test未実施。実績間gapを休憩にする点は承認済み。
- Question: 対象取込機能/template versionと、互換性確認後に正式運用へ昇格する条件は何か。
- Why needed: 誤取込・拒否を防ぎformatを固定するため。
- Options and impact: 公式template準拠、独自変換、運用手修正。
- Current provisional treatment: 公式のfreee勤怠管理Plus取込対象・templateを確認し、DEV取込検証を完了するまで実験的機能として非表示またはtrial表示にする。
- Related FUT IDs: FUT-0040
- Answer: 2026-08-11 回答済み。公式のfreee勤怠管理Plus取込対象・template確認までは実験扱いとする。exporterへ対象・format versionを持たせ、代表test matrixとDEV test employeeへの取込でerror、丸め、timezone、encodingを検証する。対応versionと確認日を文書化し、検証完了までは非表示またはtrial labelとする。

## CONF-0028 DailyOperationsByEmployeeの閲覧・修復権限

- Status: Answered
- Source segment/doc: SPEC-SEG-015; `daily-operations-sync.md`
- Evidence: 専用Rulesなし。通常同社User read/write不可、super-user全write可。DailyOperationsByEmployeeは売上fieldを含み得るため、本人閲覧要件だけからwhole-document readを許可できない。
- Question: 本人へ見せる勤怠集約結果のfield/path境界、同社管理者の全社閲覧、Functions-only write・修復経路をどう定めるか。
- Why needed: 集約表示要件と改ざん防止を両立するため。
- Options and impact: 本人専用projection/path、field制限可能なserver read、whole-document read。売上fieldを含むdocumentの直接readは情報過剰開示になり得る。
- Current provisional treatment: 本人には自己分の勤務日・開始終了・休憩・勤務分・現場・勤務区分だけをprojectionまたは本人確認済みCallableで返す。whole DailyOperationsByEmployee documentは公開せず、集約writeはFunctions-only、修復は監査付きprocessに限定する。
- Related FUT IDs: FUT-0041
- Answer: 2026-08-11 回答済み。従業員本人は自己の勤務日・開始終了・休憩・勤務分・現場・勤務区分を閲覧でき、他従業員は閲覧できない。売上・単価・請求・顧客取極めは除外し、請求情報は請求権限者だけへ提供する。勤怠・配置管理者は同一会社の勤怠を閲覧できる。whole DailyOperationsByEmployee documentは公開せず、本人用projectionまたは本人確認済みCallableで最小fieldを返す。writeはFunctions-only、修復は監査付きprocessとする。

## CONF-0029 SiteEmployeeHistoriesの閲覧・修復・保持

- Status: Answered
- Source segment/doc: SPEC-SEG-016; `site-employee-history-sync.md`
- Evidence: 専用Rulesなし。通常同社User read/write不可、super-user全write可。FunctionsがOperationResultから再構築する。
- Question: 本人へ見せる現場入場履歴のfield/path・privacy境界、管理者閲覧、Functions write、修復・保持・削除権限をどう定めるか。
- Why needed: 現場従事履歴のprivacy・監査完全性・repairを両立するため。
- Options and impact: role read＋Functions-only write、server repair callable、super-user direct write。
- Current provisional treatment: 本人には自己が入場した現場の現場名・初回/最終入場日だけを、本人確認済みCallableまたはprojectionで返す。whole documentは広く公開せず、writeはFunctions-only、再構築はOperationResultを正本とする監査付きprocessに限定する。
- Related FUT IDs: FUT-0044
- Answer: 2026-08-11 回答済み。従業員本人は自己が入場した現場を閲覧でき、本人向けfieldは現場名・初回入場日・最終入場日に限定する。他従業員履歴、顧客取極め・請求、他配置者は見せない。現場・配置管理者は同一会社の履歴を閲覧できる。本人確認済みCallableまたはprojectionを使い、broad whole-document readを避ける。writeはFunctions-onlyとし、OperationResultからの再構築は監査付きprocessで行う。本履歴はderived dataであり、OperationResultの保持方針は別に定める。

## CONF-0030 ArrangementNotification UIの遷移・失敗・再試行UX

- Status: Answered
- Source segment/doc: SPEC-SEG-008; `arrangement-notification-ui.md`
- Evidence: 未使用timeOptions/逆遷移API候補があり、遷移・notify中の遮断範囲、二重実行、失敗時retry/rollback表示が統一されていない。
- Question: 逆遷移UIを提供するか、操作中は画面全体/対象行のどちらを遮断し、失敗時に自動retryするか利用者操作にするか。
- Why needed: 二重更新と利用者が認識できない部分失敗を防ぐため。
- Options and impact: 対象行lock＋手動retry、画面全体lock、自動retry。操作性と安全性が異なる。
- Current provisional treatment: transition中は対象行だけをlockし全操作をdisabledにする。失敗時はlocal rollback後に最新状態をrefetchしてerror表示し、利用者がrefresh後に明示retryする。state＋notificationの無条件自動retryは行わない。
- Related FUT IDs: FUT-0024, FUT-0025, FUT-0026
- Answer: 2026-08-11 回答済み。transition中は対象行の全操作をdisabledにし、client/server双方でduplicateを拒否する。失敗時はlocal stateをrollbackし、最新状態をrefetchしてerror表示する。state＋notificationは無条件自動retryせず、refresh後の明示的な利用者retryとする。server idempotency keyを設け、lockは対象行だけに限定する。未使用のreverse/timeOptionsは削除候補とする。

## CONF-0031 上下番確定時のLEAVED確定・rollback境界

- Status: Answered
- Source segment/doc: SPEC-SEG-009/010; `operation-result-generation.md`
- Evidence: 画面成功条件はOperationResult作成までと承認済みだが、通知LEAVED更新と実績作成の間にtransactionがなく部分状態となり得る。一方、OperationResultはArrangementNotificationがない場合や配置実績・scheduleなしでもstandalone作成できる承認済み仕様である。
- Question: ArrangementNotification/scheduleが存在する経路とstandalone経路を分け、各pathでLEAVED・schedule link・OperationResult作成の確定点、失敗時の再開・rollbackをどう定めるか。
- Why needed: 通知だけ完了扱い、または実績だけ作成済みとなる再実行不整合を防ぐため。
- Options and impact: 通知ありpathの再開可能workflow、通知なし/standalone path、任意関連だけを条件付きtransaction化。全pathで通知・実績・scheduleを必須atomicにする案はstandalone仕様と両立しない。
- Current provisional treatment: schedule＋notification、scheduleのみ、standaloneの3pathを明示し、存在する関連documentだけを同一transactionへ含める。missing notificationはerrorにせず、standaloneではschedule/notificationを推定しない。
- Related FUT IDs: FUT-0027
- Answer: 2026-08-11 回答済み。3つの作成pathを採用する。(1) schedule＋notifications: 可能な範囲でOperationResult作成、schedule.operationResultId設定、既存notificationのLEAVED化を同一transactionで行い、pushは送らない。(2) scheduleのみ: notification作成は不要で、OperationResult＋schedule linkをatomicにする。入力値を優先し欠損だけschedule fallbackとし、no-notification sourceを記録する。(3) standalone: OperationResultだけを作成し、schedule/notificationを推定せずreason/sourceTypeを記録する。共通でscheduleId/sourceTypeはoptional、schedule単位の重複を防止し、standaloneは専用permissionとauditを要求する。missing notificationはerrorにせず、notificationは存在する場合だけ更新する。

## CONF-0032 SiteEmployeeHistory同日複数実績の代表ID

- Status: Answered
- Source segment/doc: SPEC-SEG-016; `site-employee-history-sync.md`
- Evidence: first/last queryはdateだけでsortし、同日のdocument ID tie-breakがない。日付は同じでも保存するfirst/last OperationResult IDは不定となり得る。同日・同site・同employeeの別OperationResultは運用上発生しない想定だが、防御的な扱いが必要と確認された。
- Question: 同日複数実績時に保存するOperationResult ID配列のfield名、順序、重複排除、first/lastとの互換・migrationをどう定義するか。
- Why needed: navigation・監査で安定した参照を保証するため。
- Options and impact: first/lastごとのID配列、全期間ID配列、既存単一IDとの併存・置換。容量、consumer互換性、migrationが異なる。
- Current provisional treatment: first/last境界日ごとに該当する全OperationResult IDを配列保存し、startAt/endAt/docIdで決定的に並べる。migration中はlegacy scalar read互換を維持し、移行後に廃止する。
- Related FUT IDs: FUT-0043
- Answer: 2026-08-11 回答済み。単一first/last OperationResult IDを、first境界日・last境界日の全OperationResult ID配列へ置き換える。各配列はstartAt、endAt、docIdの順で決定的に並べ、firstDateとlastDateが同じ場合は両配列が同一でもよい。UIは複数IDを扱い、2件以上は運用上想定外としてwarning/auditを残す。migration中はlegacy scalar read互換を維持し、移行完了後にscalarを廃止する。

## CONF-0033 Billing status確定後の再集計・削除規則

- Status: Open
- Source segment/doc: SPEC-SEG-017; `billing-aggregation-sync.md`
- Evidence: BillingはDRAFT/CONFIRMED/PAID/CANCELLEDを持つが、frontendにstatus表示・遷移操作がなく、Functionsはstatusを検査せずresult追加・置換・除去・空Billing削除を行う。これらstatusはDRAFTを含め暫定で、支払処理は未定義と確認された。
- Question: triggerがdraft集計と請求済みBillingをどう識別するかを先に定めた上で、各状態の再集計・削除・訂正・支払処理をどう設計するか。
- Why needed: 確定・支払済み請求額と監査履歴を保護するため。
- Options and impact: 請求済み識別field/status、別collection/path、発行snapshot。識別確定後に再集計・revision・支払workflowを選ぶ。
- Current provisional treatment: 現行statusと全status更新可能な挙動を暫定実装として記録する。DRAFTの正式意味、請求済み識別、revision、paymentはいずれも確定しない。
- Related FUT IDs: FUT-0045, FUT-0049
- Answer: 2026-08-11 部分回答。DRAFTを含むBilling statusは暫定であり、まずtriggerがdraftと請求済みを識別する契約を決める必要がある。支払処理は未定義である。status別再集計・revision推奨は採用せず、状態model・識別・paymentが未決のためOpenを維持する。

## CONF-0034 Billing adjustmentの使用・課税契約

- Status: Answered
- Source segment/doc: SPEC-SEG-017; `billing-aggregation-sync.md`
- Evidence: adjustmentはschema comment上未使用。amountはsubtotal/PDF総額へ加算されるがtaxBreakdown・現場/稼働明細に表示されずdescriptionも帳票へ出ない。
- Question: adjustmentを将来使用するか、使用する場合は課税/非課税、理由、権限、監査、請求書上の表示をどう定義するか。
- Why needed: 調整額と税額の不整合・無監査変更を防ぐため。
- Options and impact: 非課税調整、税率付き調整明細、機能廃止。
- Current provisional treatment: 現行adjustmentは未使用・deprecation候補として扱い、既存data利用を確認するまで削除しない。将来のBilling単位調整は税・理由・監査・表示を明示して再設計する。
- Related FUT IDs: FUT-0048
- Answer: 2026-08-11 回答済み。adjustmentはOperationResultではなくBilling単位の金額調整を想定し、100円以下切捨て等の運用丸めを例とする。ただしclass自身が未使用と明記し詳細仕様はないため、現行propertyはdeprecation候補とする。OperationResultの稼働外売上とは混同しない。既存dataでの使用有無を確認後に現行fieldをdeprecateし、将来必要なら税区分・理由・監査・帳票表示を明示した機能として再設計する。

## CONF-0035 Billingの支払記録・部分入金・PAID判定

- Status: Open
- Source segment/doc: SPEC-SEG-018; `billing-lifecycle-ui.md`
- Evidence: paymentRecordsは空配列fieldだけで未実装。画面はpaymentDueDateAtだけ編集でき、実入金・部分入金・消込・PAID操作がない。
- Question: 入金日・金額・方法・参照・取消をどう記録し、部分入金とPAID判定をどう扱うか。
- Why needed: 支払済み状態と実入金の監査可能な整合を保証するため。
- Options and impact: Billing内ledger、別Payment collection、外部会計を正本にする。
- Current provisional treatment: paymentRecordsとPAIDを正式運用済みとは扱わない。
- Related FUT IDs: FUT-0049
- Answer: 未回答

## CONF-0036 Billing入金予定日の手動変更・監査

- Status: Answered
- Source segment/doc: SPEC-SEG-018; `billing-lifecycle-ui.md`
- Evidence: paymentDueDateAtはCustomer条件から初期算出され、詳細でbillingDateAt以降へ直接変更できる。status制限、理由、actor、履歴はない。
- Question: 誰がどのstatusで入金予定日を変更でき、理由・変更履歴を必要とするか。
- Why needed: 確定後の支払条件変更と回収予定の監査性を保つため。
- Options and impact: DRAFTのみ、権限者＋理由、全status可＋履歴。
- Current provisional treatment: 将来のinvoice-issued trigger前は請求担当者が編集でき、発行後は理由・履歴付き変更だけを許す。paid/cancelledは変更不可とする。現行statusではなく将来の発行境界を使い、`billings:read`単独では許可しない。
- Related FUT IDs: FUT-0031, FUT-0049, FUT-0051
- Answer: 2026-08-11 暫定回答。将来のinvoice-issued trigger前は請求担当者がpaymentDueDateAtを編集できる。発行後はsilent overwriteを禁止し、before/after/reason/actor/timeの履歴を必須とする。paid/cancelledはimmutableとする。Customer支払条件変更は将来のdefaultだけへ反映し、既存Billingを自動変更しない。`billings:read`単独では許可せず、現行暫定statusではなく将来のinvoice-issued境界を使う。本方針は仕様成熟に伴い変更可能だが、現時点の回答としてAnsweredとする。

## CONF-0037 OperationBilling lockの対象範囲

- Status: Answered
- Source segment/doc: SPEC-SEG-018; `billing-lifecycle-ui.md`
- Evidence: isLockedは通常OperationResult編集を止めるがOperationBillingはlock中も請求編集可能。Billing aggregate statusとは連動しない。
- Question: lockを通常稼働編集だけの保護とし請求編集を許すか、請求field/集計も凍結するか。
- Why needed: 利用者のlock認識と実際の変更可能範囲を一致させるため。
- Options and impact: 現行scope、全OperationResult凍結、Billing statusへ統合。
- Current provisional treatment: `isLocked`は`operation-results:write`による管制側の稼働編集・削除を止めるlockであり、`operation-billings:write`によるOperationBilling請求編集とlock設定・解除は許可する。全体immutable lockや請求確定とは表示・文書上で明確に区別する。
- Related FUT IDs: FUT-0050
- Answer: 2026-08-13 補足確定。OperationResultは管制等の稼働実績担当者と請求担当者が共用する。`isLocked`は請求担当者の調整を後続の管制側更新から保護するもので、請求確定、承認済み、全体immutableを意味しない。lock中も`operation-billings:write`による請求編集を許可し、同permissionを持つUserがlockを設定・解除する。追加承認・理由入力UI・変更前後の永続履歴は要求せず、現行classが自動設定する`uid`・`updatedAt`を最終更新者・日時として利用する。新しい履歴collectionは現時点で作成しない。invoice-issued後のBilling lifecycleは別事項として扱う。

## CONF-0038 請求書PDFの必須項目・番号・status別発行

- Status: Answered
- Source segment/doc: SPEC-SEG-019; `billing-invoice-pdf.md`
- Evidence: 単票本文に請求日・支払期日・請求書番号・statusがなく、統合だけ日付を表示する。全statusでdownload可能で発行履歴を保存しない。
- Question: 必須帳票項目、請求書番号規則、発行可能status、再発行/取消表示、保存・監査をどうするか。
- Why needed: 正式請求書の同一性・支払条件・取消/再発行を追跡するため。
- Options and impact: CONFIRMEDのみ発行＋revision、DRAFT見積表示、外部system番号正本。
- Current provisional treatment: 現行PDFはpreview/draftでdraft表示を付け、将来の正式発行actionとinvoice-issued triggerまでは正式請求書と扱わない。
- Related FUT IDs: FUT-0049, FUT-0052
- Answer: 2026-08-11 回答済み。現行PDFはpreview/draftとしdraft表示を付ける。将来、正式発行actionで一意な請求書番号を採番し、請求日・支払期日・番号・発行者・宛先・明細・税率別内訳・合計を必須表示する。発行artifactはrevision・actor・time・hashを保存し、同一artifactの再downloadと訂正版revisionを区別する。cancelled artifactも保持する。invoice-issued triggerが整うまでは正式発行と扱わない。

## CONF-0039 請求書PDFの統合税・負数・adjustment表示

- Status: Answered
- Source segment/doc: SPEC-SEG-019; `billing-invoice-pdf.md`
- Evidence: 統合税は全siteを税率別再集計して丸めるため単票tax合計と異なり得る。0/負quantity行は省略し得る。adjustmentは総額だけに入り内訳へ出ない。
- Question: 統合の正式税額を再計算値/単票合計のどちらにし、負数・0・adjustmentを帳票でどう表示するか。
- Why needed: 請求書内訳と総額・税額を説明可能にするため。
- Options and impact: 統合単位再計算、単票合算、site別請求書のみ。rounding差と法務要件が異なる。
- Current provisional treatment: 統合請求書は全明細を税率別集約後に税計算し、そのinvoice taxを正とする。site subtotalは表示用とし、Company丸め規則を一貫適用する。deprecated adjustmentは除外する。
- Related FUT IDs: FUT-0048, FUT-0054
- Answer: 2026-08-11 回答済み。統合1請求書の税は全明細を税率別に集約してから計算し、site subtotalを表示してもinvoice taxを正式値とする。Companyの丸め設定を一貫適用する。0行は省略し、将来の負数行は意味・理由を明示する。deprecation対象のadjustmentは除外する。正式利用前にaccountantまたはtax professionalが検証する。

## CONF-0040 請求書PDFのfilename・欠損master方針

- Status: Answered
- Source segment/doc: SPEC-SEG-019; `billing-invoice-pdf.md`
- Evidence: customer.nameを未sanitizeでfilenameへ使い、Customer/Company欠損は生成失敗、Site/Article欠損はplaceholderで継続する。
- Question: filename規則と、各master欠損時に生成拒否/placeholder継続のどちらを採るか。
- Why needed: 誤宛名帳票・不正filename・不完全帳票の配布を防ぐため。
- Options and impact: 全必須master検証、明示placeholder＋警告、server発行番号filename。
- Current provisional treatment: 正式filenameはinvoice numberを主とし、sanitize・truncateしたcustomer名を補助にする。正式発行はCompany/Customer必須、Site/Article名は発行時snapshotとし、draftだけmissing表示付きplaceholderを許す。
- Related FUT IDs: FUT-0053
- Answer: 2026-08-11 回答済み。正式filenameはinvoice numberを主とし、共通helperでsanitize・truncateしたcustomer名を補助にする。正式生成ではCompany/Customer欠損を拒否する。Site/Article名は正式発行時にsnapshotし、master削除後も再print可能にする。draftは`DRAFT`と情報欠損表示付きplaceholderを許すが、正式版は`N/A`や空宛名を許可せず、欠損fieldを利用者へ表示する。
## CONF-0041 Customer CRUDの正式権限

- Status: Answered
- Source segment/doc: SPEC-SEG-020; `customer-master.md`
- Evidence: `customers:read` routeからcreate/update/deleteへ到達でき、Rulesは同一会社Userに全writeを許可する。
- Question: Customerの閲覧、作成、基本情報編集、支払条件編集、終了、archive、restoreを誰に許可するか。
- Why needed: 取引先と請求条件の改変を適切に制限し、UIとRulesを一致させるため。
- Options and impact: read/write/delete分離、管理role限定、field別権限。細分化ほど安全だが運用・claimsが増える。
- Current provisional treatment: `customers:read`/`customers:write`の2権限を維持し、writeは作成・編集・支払条件・終了・archive・restoreを含む。UI/Rules/Callableを一致させ、archive/restoreは確認・監査付きとする。
- Related FUT IDs: FUT-0055
- Answer: 2026-08-11 回答済み。Customerは`customers:read`/`customers:write`の2権限だけを維持する。writeは作成、編集、支払条件、終了、archive、restoreを含む。archive/restoreは確認と監査を必須とし、通常の物理deleteは許可しない。Userへpermission presetを提供し、UI・Rules・Callableを同じ境界へ揃える。実需要が生じた場合だけfield別分割を再検討する。

## CONF-0042 Customerの重複・検索・無効候補

- Status: Answered
- Source segment/doc: SPEC-SEG-020; `customer-master.md`
- Evidence: 一意性検証なし。一覧はACTIVE限定、Autocompleteはstatus非限定。tokenはname/nameKanaのみ。
- Question: tenant内の重複判定key、検索対象field、TERMINATED Customerの新規選択可否をどうするか。
- Why needed: 二重masterと無効取引先への新規紐付けを防ぎつつ、過去参照を維持するため。
- Options and impact: code一意、名称警告のみ、重複許容／新規候補ACTIVE限定・過去値は表示／全status選択可。
- Current provisional treatment: name一意制約は設けず、任意Customer codeだけtenant内uniqueとする。類似候補はwarningに留め、正当な同名作成を許す。新規選択はACTIVEだけ、履歴ではTERMINATEDを表示する。
- Related FUT IDs: FUT-0056
- Answer: 2026-08-11 回答済み。名称のhard unique制約は設けない。任意のCustomer codeはtenant内uniqueとする。normalized name/kana/address/phoneによる類似warningを表示するが、正当な同名Customer作成は許可する。新規選択候補はACTIVEだけに限定し、historical referenceではTERMINATEDも表示する。再利用前にはreactivateする。検索はcode/name/kana/phoneを対象とし、addressはprivacy/cost確認後に追加を検討する。類似検索の実現可能性・index・costは実装時に検証する。

## CONF-0043 Customerのarchive・参照・restore policy

- Status: Answered
- Source segment/doc: SPEC-SEG-020; `customer-master.md`
- Evidence: Siteだけを削除guardしlogical archiveする。restore APIはあるがUIなし。Billing PDFはlive Customer取得に依存する。
- Question: どの参照があるCustomerをarchive可能とし、誰がいつrestoreでき、archiveを何期間保持するか。
- Why needed: 参照切れ、帳票再生成失敗、誤削除からの回復と保持義務を定義するため。
- Options and impact: 全参照中禁止、TERMINATEDのみ運用、snapshot後archive可、管理者restore。利便性と監査整合が異なる。
- Current provisional treatment: archiveは例外的な論理削除先で利用者向けごみ箱ではない。通常終了はTERMINATEDを使い、restoreは通常Userへ提供せず、理由・監査付き運営者緊急processだけに限定する。
- Related FUT IDs: FUT-0057
- Answer: 2026-08-11 回答済み。archiveはlogical deletionの保存先でありUser向けrecycle binではない。Userから「削除情報を確認したい」と依頼があれば運営者がarchive情報を調査できる。既存restore機能は緊急時のcontingencyに限定し、通常`customers:write` Userはrestoreできない。通常の契約終了はTERMINATED、archiveは参照確認後の誤登録・重複等の例外に限定する。保持要件が決まるまで自動purgeせず、運営者の閲覧・操作をauditする。例外restoreは通常UIから隔離し、運営者管理・reason/audit必須、active同IDがあればoverwriteせず拒否する。

## CONF-0044 Customer情報の請求snapshot時点

- Status: Answered
- Source segment/doc: SPEC-SEG-020; `customer-master.md`
- Evidence: paymentDueDateAtはBilling作成時保存、PDFのCustomer名称・住所は生成時live参照。
- Question: 支払条件、宛名、住所等を作成時・確定時・発行時のどこで固定し、訂正・再発行をどう扱うか。
- Why needed: 過去請求書の再現性とmaster訂正の反映範囲を確定するため。
- Options and impact: Billing作成snapshot、CONFIRMED snapshot、発行revision、常時live。監査性と訂正容易性が異なる。
- Current provisional treatment: draft作成時にinitial copy、正式発行時にfull snapshotを固定する。再printはsnapshotを使い、master変更は発行済みartifactへ反映しない。訂正はreason/history付きnew revisionとする。
- Related FUT IDs: FUT-0058
- Answer: 2026-08-11 回答済み。draft作成時にinitial copyを保存し、正式発行時にCustomer等のfull snapshotを固定する。再printは発行snapshotを使い、master変更で発行済み請求書を変えない。訂正はreason/historyを伴うnew revisionとする。live masterからのPDF生成はdraftだけに限定する。

## CONF-0045 CustomerのTERMINATEDとarchiveの使い分け

- Status: Answered
- Source segment/doc: SPEC-SEG-020; `customer-master.md`
- Evidence: schemaはACTIVE/TERMINATEDとlogical archiveを持つが、画面はstatus変更不可でarchive deleteのみ到達可能。
- Question: 契約終了、再開、誤登録削除をTERMINATED/archiveのどちらで扱い、再有効化を誰に許可するか。
- Why needed: 履歴を残す通常終了と例外的削除を区別し、検索・参照・復元を一貫させるため。
- Options and impact: 通常はTERMINATED・誤登録のみarchive、archive廃止、管理者のみ再有効化。
- Current provisional treatment: 契約終了・停止はTERMINATED、再開はACTIVEとする。archiveは参照なし確認後の誤登録・重複だけに限定し、通常User restoreと物理delete UIは提供しない。
- Related FUT IDs: FUT-0057, FUT-0059
- Answer: 2026-08-11 回答済み。契約終了・停止はTERMINATED、再開はACTIVEを使う。誤登録・重複は参照がないことを確認した場合だけarchiveする。historical Customerは通常TERMINATEDで保持する。TERMINATEDのreactivateは`customers:write`で許可するが、archive restoreは通常User操作ではなく運営者の例外的contingencyだけとする。archiveへreason/actor/timeを保存し、物理delete UIは設けない。

## CONF-0046 Site CRUD・取極め・終了の正式権限

- Status: Answered
- Source segment/doc: SPEC-SEG-021; `site-master.md`
- Evidence: `sites:read` routeからcreate/update/agreements/terminate/deleteへ到達し、Rulesは同一会社Userに全writeを許す。
- Question: Siteの閲覧、作成、基本情報・取引先・取極め編集、終了、archive、restoreを誰に許可するか。
- Why needed: 配置・請求の基礎masterを改変できる主体を制限しUIとRulesを一致させるため。
- Options and impact: read/write分離、取極め/終了/削除の個別権限、管理role限定。
- Current provisional treatment: `sites:read`/`sites:write`の2権限とし、writeは作成、基本情報、Agreement変更、終了、再有効化、archiveを含む。Customer変更の回答部分は現行仕様の変更禁止と衝突するため、正本変更までは権限があっても許可しない。UI・Rules・Callableとrole presetをこの境界へ揃え、archiveは理由・監査必須、通常利用者のrestoreは禁止する。
- Related FUT IDs: FUT-0060
- Answer: 2026-08-11回答。`sites:read`/`sites:write`の2権限を採用し、細分化しない。`sites:write`は作成、基本情報・Customer・Agreement変更、終了、再有効化、archiveを含む。archiveは理由・監査を必須とし、通常restoreは提供せず、運営operatorの緊急復旧だけに限定する。UI・Rules・Callableを一致させ、role presetから付与する。

## CONF-0047 SiteのCustomer所属変更と仮登録解消

- Status: Answered
- Source segment/doc: SPEC-SEG-021; `site-master.md`
- Evidence: 仮登録からcustomerId設定は可能。設定後unsetは禁止するがA→B変更は可能で、既存下流dataの移管処理は直接経路にない。現行仕様70行は過去請求整合のためCustomer変更を禁止しており、2026-08-11のAnswerは正本へ反映されていない。
- Question: Customer変更をどの条件で許し、既存予定・実績・請求・埋込みCustomerをどう扱うか。
- Why needed: tenant内の所属・請求先整合と履歴再現性を保つため。
- Options and impact: 初回設定後固定、未稼働時のみ変更、明示的移管workflow、全履歴維持で将来分のみ変更。
- Current provisional treatment: Answer履歴は保持するが、implementation台帳だけで現行仕様を上書きしない。別途の仕様変更承認と仕様・ADR・migration・test同期が完了するまでは、初回の仮登録解消後のCustomer変更を禁止する。
- Related FUT IDs: FUT-0061
- Answer: 2026-08-11回答。SiteのCustomer変更を許す。既存OperationResultの`customerId`はsnapshotであり、自動変更しない。現行コードの空updateは再同期せず、`groupKey`変更時だけ同期する。将来は明示的な「Customer/Agreement再適用」method/Callableで対象OperationResultを選択し、変更前後のCustomer/AgreementとBilling影響を表示する。発行済み請求書は除外し、actor・reason・before/afterを監査する。OperationResult update triggerはBillingを旧keyから新keyへ移動する。空updateへ隠れた意味を持たせない。

## CONF-0048 Site終了後の操作と再有効化

- Status: Answered
- Source segment/doc: SPEC-SEG-021; `site-master.md`
- Evidence: TERMINATED詳細でも編集・取極め・削除・再終了UIがあり、Autocompleteもstatus非限定。再有効化経路はない。
- Question: 終了Siteに許す閲覧・編集・新規参照と、誤終了/再開時の再有効化条件をどうするか。
- Why needed: 終了後の不正な新規利用と、必要な訂正・再開を区別するため。
- Options and impact: read-only、限定訂正、管理者再開、常時編集可だが新規選択不可。
- Current provisional treatment: TERMINATEDはread-onlyかつ新規選択不可とし、履歴参照と限定された監査付き訂正だけを許す。同一Customerでの再開は`sites:write`と理由を必須とする。Customer変更は現行仕様どおり許可しない。
- Related FUT IDs: FUT-0062
- Answer: 2026-08-11回答。TERMINATEDはread-only・新規選択不可だが、履歴参照と限定された監査付き訂正を許す。同一Customerでの再開は`sites:write`と理由を伴う再有効化とする。Customerを変更する場合は新Siteを強制せずCONF-0047のCustomer変更方針を使う。Agreementは自動再有効化しない。archiveは誤登録等に限定し、通常利用者のrestoreは提供しない。

## CONF-0049 Site終了・archive・restoreの使い分け

- Status: Open
- Source segment/doc: SPEC-SEG-021; `site-master.md`
- Evidence: terminateとlogical archiveが併存し、restore APIはあるがUIは復元不能と表示する。削除guardは3 collectionのみ。
- Question: 通常終了、誤登録削除、法定/運用保持、restoreをどの機構と権限で扱うか。
- Why needed: 参照整合、履歴保持、誤削除回復、利用者説明を一貫させるため。
- Options and impact: 通常TERMINATED・誤登録のみarchive、archive禁止、管理者restore、保持期間付きarchive。
- Current provisional treatment: 両機構の存在だけを記録し、復元不能表示を正式仕様とはしない。
- Related FUT IDs: FUT-0063
- Answer: 未回答

## CONF-0050 Site情報の下流snapshot時点

- Status: Open
- Source segment/doc: SPEC-SEG-021; `site-master.md`
- Evidence: OperationResultはcustomerId/agreementを保存し、PDFはlive Site名を参照し、Site.customerはCustomer変更時だけ更新される埋込みである。
- Question: Site名、Customer、住所、警備種別、取極め等を予定・実績・Billing・帳票のどの時点で固定するか。
- Why needed: master変更後も履歴と請求書を再現し、訂正範囲を定義するため。
- Options and impact: 作成時snapshot、確定時snapshot、revision方式、常時live参照。
- Current provisional treatment: 現行の時点混在を実装事実として扱い、正式仕様とはしない。
- Related FUT IDs: FUT-0061, FUT-0064
- Answer: 未回答
## CONF-0051 Agreementの正式編集・承認権限

- Status: Open
- Source segment/doc: SPEC-SEG-022; `agreement-master.md`
- Evidence: `sites:read`で取極めCRUDへ到達し、Sites Rulesは同一会社Userに全writeを許す。
- Question: 単価・時間・締日を誰が作成、変更、削除、承認できるか。
- Why needed: 請求額へ直接影響するmasterの改変を制御・監査するため。
- Options and impact: Site編集権限と共通、取極め専用role、作成者+承認者workflow。
- Current provisional treatment: 現行Site権限への従属を暫定実装として記録する。
- Related FUT IDs: FUT-0065
- Answer: 未回答

## CONF-0052 Agreement数値fieldの許容範囲

- Status: Open
- Source segment/doc: SPEC-SEG-022; `agreement-master.md`
- Evidence: 単価は0 defaultで負数等のAgreement固有validationなし。休憩・規定実働は負数のみ拒否。
- Question: 0/負単価、小数精度、最大額、休憩・規定時間の上限と相互関係をどう定義するか。
- Why needed: 不正・異常な請求額を保存前に検出するため。
- Options and impact: 厳格reject、警告付き許可、調整fieldだけ負数許可。値引き運用との整合が必要。
- Current provisional treatment: 現行validationを安全な確定仕様とはしない。
- Related FUT IDs: FUT-0066
- Answer: 未回答

## CONF-0053 適用済みAgreementの訂正・削除・履歴

- Status: Open
- Source segment/doc: SPEC-SEG-022; `agreement-master.md`
- Evidence: 過去Agreementも上書き・削除でき、revision/status/archiveはない。既存OperationResultはsnapshotを保持する。
- Question: 適用済み取極めをlockするか、訂正revisionを作るか、削除を許すか、履歴をどう保持するか。
- Why needed: 過去請求の再現性とmaster訂正を両立するため。
- Options and impact: 過去lock+新revision、理由付き訂正、未使用分のみ削除、現行自由編集。
- Current provisional treatment: 現行自由編集を正式な履歴仕様とは扱わない。
- Related FUT IDs: FUT-0067
- Answer: 未回答

## CONF-0054 Agreement snapshot・再適用・手動override

- Status: Open
- Source segment/doc: SPEC-SEG-022; `agreement-master.md`
- Evidence: 自動適用はdate+shiftTypeで選びOperationResultへsnapshotする。通常master変更には追随せずgroup key変更時は再適用する。適用外手動選択は承認済み。
- Question: snapshotをいつ確定し、どの変更で再適用し、手動overrideの理由・元Agreementをどう記録するか。
- Why needed: 自動・手動・取極めなしの請求根拠を再現可能にするため。
- Options and impact: result作成時固定、上下番確定時固定、lock前再適用可、override metadata保持。
- Current provisional treatment: 現行snapshotと承認済み候補非制限を記録し、監査契約は未確定とする。
- Related FUT IDs: FUT-0068
- Answer: 未回答

## CONF-0055 AgreementV2独立collectionと旧Agreementの存廃

- Status: Open
- Source segment/doc: SPEC-SEG-022; `agreement-master.md`
- Evidence: AgreementV2はcollectionPathを持つがSite埋込みだけが現行UI経路。専用Rulesなし。旧Agreement/deprecated APIも存在する。
- Question: Site埋込みを唯一の正本とし、独立collectionPathと旧classを廃止するか、将来用途を維持するか。
- Why needed: 二重正本、誤った独立CRUD、旧新schema混在を防ぐため。
- Options and impact: 埋込み専用に整理、独立masterへ移行、互換読込のみ維持。
- Current provisional treatment: Site.agreementsV2を現行正本として観察し、廃止判断は行わない。
- Related FUT IDs: FUT-0069
- Answer: 未回答
## CONF-0056 SiteOperationScheduleの正式操作権限

- Status: Open
- Source segment/doc: SPEC-SEG-023、SPEC-SEG-052; `site-operation-schedule.md`、`site-ordering.md`
- Evidence: read権限でCRUD/通知/複製とCompany `siteOrder/scheduleOrder`の並べ替え保存へ到達し、Rulesは同一会社UserにCompany/Schedule全writeを許す。
- Question: 予定閲覧、作成、worker編集、通知、複製、削除、確定解除、配置/予定の表示順変更を誰に許可するか。
- Why needed: 配置・個人情報・通知・実績整合へ影響する操作を分離するため。
- Options and impact: read/write/notify/delete分離、管制role限定、現場担当scope。
- Current provisional treatment: 現行read+全writeを暫定実装として記録する。
- Related FUT IDs: FUT-0070
- Answer: 未回答

## CONF-0057 Schedule同時編集と表示順の競合UX

- Status: Open
- Source segment/doc: SPEC-SEG-023、SPEC-SEG-052; `site-operation-schedule.md`、`site-ordering.md`
- Evidence: displayOrder採番はtransaction外query、schedule更新はversion checkなし。Companyの`siteOrder/scheduleOrder`配列全体更新にもversion/precondition、失敗時rollbackがない。
- Question: 競合時に後勝ち、拒否して再読込、自動mergeのどれを採り、表示順重複をどう解決するか。
- Why needed: 複数管制担当者の同時操作で配置・順序を失わないため。
- Options and impact: optimistic concurrency、server serialized order、後勝ち+警告。
- Current provisional treatment: 現行後勝ち/重複可能性を確定仕様とはしない。
- Related FUT IDs: FUT-0071
- Answer: 未回答

## CONF-0058 OperationResult作成後Scheduleのlock・修復主体

- Status: Open
- Source segment/doc: SPEC-SEG-023; `site-operation-schedule.md`
- Evidence: operationResultIdがあればclient schemaは編集削除を拒否するがRulesは強制しない。
- Question: Result作成後に許す予定操作、Result削除時unlock、例外修復を誰がどう行うか。
- Why needed: schedule/result 1対1整合と正式な訂正手続きを両立するため。
- Options and impact: 完全lock、Result側workflowのみ、管理者repair callable。
- Current provisional treatment: client lockを実装事実として扱い、安全な認可境界とはしない。
- Related FUT IDs: FUT-0072
- Answer: 未回答

## CONF-0059 Schedule通知失敗時の利用者向け再試行契約

- Status: Open
- Source segment/doc: SPEC-SEG-023; `site-operation-schedule.md`
- Evidence: transaction失敗時instance rollback不能の場合があり、application actionはerrorを吸収する。
- Question: 失敗後に自動再読込/自動retry/手動retryのどれを採り、通知済み表示をいつ確定するか。
- Why needed: 二重通知と未通知放置を防ぎ、利用者が結果を判断できるようにするため。
- Options and impact: server idempotency+auto retry、再fetch+手動retry、管理画面reconcile。
- Current provisional treatment: transaction原子性だけを確認済みとし、UX成功条件は未確定。
- Related FUT IDs: FUT-0073
- Answer: 未回答

## CONF-0060 Schedule複製・過去変更・不足許容規則

- Status: Open
- Source segment/doc: SPEC-SEG-023; `site-operation-schedule.md`
- Evidence: locked元も複製可、既存groupへ追加可、Resultなしなら過去変更可、人数/資格不足は保存阻止しない。
- Question: 実績済み元の複製、既存group重複、過去予定訂正、人数・資格不足の警告/拒否をどう定義するか。
- Why needed: 柔軟な配置運用を維持しつつ誤予定・不足配置を検出するため。
- Options and impact: 常時許可+警告、日付/status別制限、承認override、厳格reject。
- Current provisional treatment: 現行許容を実装事実とし、承認済み業務仕様とはしない。
- Related FUT IDs: FUT-0074
- Answer: 未回答
## CONF-0061 Employee個人情報の閲覧・編集・保持権限

- Status: Open
- Source segment/doc: SPEC-SEG-024、SPEC-SEG-051; `employee-master.md`、`employee-insurance.md`
- Evidence: employees:readと同一会社全read/writeで高感度fieldとarchiveへアクセス可能。保険番号・加入/喪失日/理由・履歴も追加write guardなしでEmployee詳細に表示・更新され、RESIGNED Employeeでも操作可能。historyにactor/timeはなくrollbackはentryをpopする。
- Question: 本人、管制、雇用/労務、管理者がどのfield（保険番号・加入喪失履歴を含む）を閲覧・変更でき、管理目的、監査、保持、訂正/rollbackをどう扱うか。
- Why needed: 個人情報の最小権限、目的限定、改ざん防止を満たすため。
- Options and impact: field別read model、本人+労務限定、管理者のみ、機能別document分割。
- Current provisional treatment: 現行境界を暫定実装とし、安全な確定仕様とはしない。
- Related FUT IDs: FUT-0075、FUT-0159
- Answer: 未回答

## CONF-0062 EmployeeとUser/Authの一意性・削除主体

- Status: Open
- Source segment/doc: SPEC-SEG-024; `employee-master.md`
- Evidence: User.employeeIdはoptional/非一意で、退職・delete cleanupはquery先頭だけを扱う。
- Question: 1 Employeeに許すUser数、User/Auth削除またはdisabledの主体・時点、admin例外をどうするか。
- Why needed: 退職・削除後の不正loginとorphan Userを防ぐため。
- Options and impact: 厳格1対1、複数account許可で全disable、Authは保持しUser role剥奪。
- Current provisional treatment: 1件前提の現行実装を不変条件とはしない。
- Related FUT IDs: FUT-0076
- Answer: 未回答

## CONF-0063 将来退職・復職・再雇用の状態model

- Status: Open
- Source segment/doc: SPEC-SEG-024; `employee-master.md`
- Evidence: future退職日でも即RESIGNED/User削除、復職methodなし。
- Question: 退職予定を別statusで持つか、effective date到来時に切替えるか、復職/再雇用時に同じEmployee IDを使うか。
- Why needed: worker候補、login、勤怠期間と雇用契約日を一致させるため。
- Options and impact: scheduled status、即時status+日付filter、再雇用は新ID、同ID revision。
- Current provisional treatment: 即時RESIGNEDを実装事実として記録し、正式運用とはしない。
- Related FUT IDs: FUT-0077
- Answer: 未回答

## CONF-0064 Employee退職・archive・匿名化・restore policy

- Status: Open
- Source segment/doc: SPEC-SEG-024; `employee-master.md`
- Evidence: RESIGNEDとlogical archiveが併存し、guard外勤怠/履歴参照があり、UI restoreなし。
- Question: 通常退職、誤登録削除、法定保持後匿名化、restoreをどう使い分けるか。
- Why needed: 個人情報削除要求と勤怠・請求・監査履歴保持を両立するため。
- Options and impact: 退職者保持、期限後field匿名化、誤登録のみarchive、管理者restore。
- Current provisional treatment: 現行RESIGNED/archiveを実装事実とし、保持policyは未確定。
- Related FUT IDs: FUT-0078
- Answer: 未回答

## CONF-0065 Employee code・表示名・退職者候補の規則

- Status: Open
- Source segment/doc: SPEC-SEG-024; `employee-master.md`
- Evidence: code非一意、displayNameKana自動同期なし、汎用Autocompleteはstatus非限定。
- Question: codeの採番/一意性、表示名と法的氏名・カナの関係、退職者を選べる用途をどう定義するか。
- Why needed: 従業員識別、検索、帳票表示、新規配置候補を一貫させるため。
- Options and impact: tenant連番、手動一意code、通称別field、通常候補ACTIVE限定+履歴表示は全status。
- Current provisional treatment: 現行自由code/保存表示名/status非限定検索を確定仕様とはしない。
- Related FUT IDs: FUT-0079
- Answer: 未回答

## CONF-0066 User/Auth管理の正式権限と本人操作範囲

- Status: Answered
- Source segment/doc: SPEC-SEG-025; `user-auth-lifecycle.md`
- Evidence: UIはadmin向けだがUser Rulesとcallableのserver認可はより広く、権限設計は暫定実装である。
- Question: User閲覧、仮登録、role変更、有効化、削除、管理者移譲を誰に許し、本人が変更できるfieldをどこまでとするか。
- Why needed: account乗っ取り、権限昇格、個人情報閲覧をserver境界で防ぐため。
- Options and impact: admin専用、操作別permission、本人設定field分離、super-user repair専用。
- Current provisional treatment: 仮登録Userの作成・削除は`users:provision`、role・通知等の管理は`users:write`へ分離し、本登録User lifecycleとEmployee本人readの具体field/pathは後続専用ゲートで扱う。
- Related FUT IDs: FUT-0080
- Answer: 2026-08-16 回答済み、2026-08-21改訂。Userは単独UserとEmployee連携Userに分け、仮登録・本登録等は別の状態軸とする。会社管理者と`users:provision`保有者が同社の仮登録Userを作成・削除する。managerへ`users:provision`と`users:write`、human-resourceへ`users:provision`だけを明示付与し、provision-only actorは作成時roleを設定できない。`employees:write`だけからUser管理権限を派生させない。単独仮UserとEmployee連携仮Userは公開作成操作を分け、Employee連携は同社Employee存在、未紐付け、1 Employee対最大1 Userをserver検証する。Employee連携User本人の公開field/path、本登録User削除、退職連携は後続gateで扱う。

## CONF-0067 事前登録・招待・account setupの正式workflow

- Status: Open
- Source segment/doc: SPEC-SEG-025; `user-auth-lifecycle.md`
- Evidence: 現行は招待メールなしの仮User作成、email検索、client Auth作成、Firestore移行、claims設定で、後段失敗を自動回復しない。SEC-002で通常clientがemail verification前にsetupへ進めることを確認した。token email一致はmailbox所有や一回限りinvite proofにならず、第三者による仮account取得を防がない。
- Question: 招待の通知・期限・本人確認、重複、取消、再送、失敗復旧、Auth-only accountの扱いをどう定義するか。
- Why needed: 正しい本人だけをtenantへ参加させ、部分状態から安全に復旧するため。
- Options and impact: one-time invite token、email事前登録継続+repair、管理者発行link、support手動復旧。
- Current provisional treatment: 現行email一致方式を実装事実とし、正式な招待保証とは扱わない。
- Related FUT IDs: FUT-0081、FUT-0082
- Answer: 未回答

## CONF-0068 無効化・削除・退職・管理者移譲のaccount保持方針

- Status: Open
- Source segment/doc: SPEC-SEG-025; `user-auth-lifecycle.md`
- Evidence: disabled/deleteはFirestore先行trigger同期、User.deleteはadmin拒否、退職との詳細時点は未確定。
- Question: 退職/利用停止でAuthをdisabled・delete・保持のどれにし、復職、監査、誤操作復旧、最後の管理者をどう扱うか。
- Why needed: 不正login防止と監査・復旧可能性を両立するため。
- Options and impact: 原則disabled+期限後delete、即delete、User archive+Auth保持、管理者移譲必須guard。
- Current provisional treatment: 現行非同期同期を実装事実とし、保持policyとはしない。
- Related FUT IDs: FUT-0083、FUT-0076、FUT-0077
- Answer: 未回答

## CONF-0069 未認証事前登録確認の列挙・abuse防御

- Status: Partially answered
- Source segment/doc: SPEC-SEG-025; `user-auth-lifecycle.md`
- Evidence: 2026-08-16にclientへ返す情報を`isPreRegistered`だけへ縮小し、companyId、displayName、roles、tempUserIdの匿名公開と複数一致時の先頭採用を廃止した。存在有無の応答差、App Check、rate limit、招待tokenは未解決である。
- Question: 残る存在有無の列挙に対し、招待token、App Check、rate limit、同一response化をどこまで必須とするか。
- Why needed: account/email列挙と所属・role情報漏えいを抑えるため。
- Options and impact: opaque token、App Check+rate limit、setup callable内部だけで解決、boolean応答の維持。
- Current provisional treatment: booleanだけを返し、複数一致を拒否する。列挙・abuse防御は未確定のため未認証入口を最終security policyとは扱わない。
- Related FUT IDs: FUT-0084
- Answer: 2026-08-16にboolean最小応答を採用。App Check、rate limit、招待token、同一response化は保留。

## CONF-0070 Outsourcerマスターの正式操作権限

- Status: Open
- Source segment/doc: SPEC-SEG-026; `outsourcer-master.md`
- Evidence: read permissionでCRUDへ到達し、Rulesは同一会社Userにlive/archive全writeを許す。
- Question: 外注先の閲覧、登録、編集、契約終了、archive、restoreを誰に許可するか。
- Why needed: 配置候補と過去実績の表示元を無権限で改変されないようにするため。
- Options and impact: 管理者専用、管制/契約担当分離、操作別permission、super-user repair専用。
- Current provisional treatment: 現行境界を暫定実装として記録し、確定権限とはしない。
- Related FUT IDs: FUT-0085
- Answer: 未回答

## CONF-0071 外注警備員を個人単位で管理するか

- Status: Open
- Source segment/doc: SPEC-SEG-026; `outsourcer-master.md`
- Evidence: 現行Outsourcerは会社だけで、複数人を外注先ID+indexとして扱い、個人の永続IDや所属を持たない。
- Question: 外注警備員の氏名、資格、連絡、所属、在籍状態、実績を個人単位で管理する必要があるか。人数単位の匿名運用を正式維持するか。
- Why needed: Schedule/Notification/Resultのworker identityと個人情報責任を定義するため。
- Options and impact: 個人master新設、会社配下subcollection、必要時だけsnapshot入力、現行人数単位維持。
- Current provisional treatment: Outsourcerを会社master、indexを一時的な人数識別として扱う。
- Related FUT IDs: FUT-0086
- Answer: 未回答

## CONF-0072 外注先の契約終了・archive・過去参照policy

- Status: Open
- Source segment/doc: SPEC-SEG-026; `outsourcer-master.md`
- Evidence: 終了は日付なしstatus、archiveはlive doc削除。guardはSchedule/Resultのみでrestore UIなし。
- Question: 契約終了後の新規選択、過去表示、訂正、archive時点、restore、保持期間をどう定義するか。
- Why needed: 終了先の誤選択を防ぎつつ、過去予定・通知・実績を再現するため。
- Options and impact: 終了日effective filter、終了は保持し誤登録のみarchive、snapshot fallback、管理者restore。
- Current provisional treatment: ACTIVE限定rangeと現行archiveを実装事実とし、正式保持policyとはしない。
- Related FUT IDs: FUT-0087
- Answer: 未回答

## CONF-0073 Outsourcer code・検索・終了済み候補の規則

- Status: Open
- Source segment/doc: SPEC-SEG-026; `outsourcer-master.md`
- Evidence: codeは任意/非一意/検索token外。配置rangeはACTIVE限定だが汎用Autocompleteはstatus非限定。契約期間fieldなし。
- Question: codeを採番・一意化するか。新規操作と過去訂正でTERMINATED候補をどう表示し、契約期間を持つか。
- Why needed: 外注先識別と候補選択を用途ごとに一貫させるため。
- Options and impact: tenant連番、手動一意code、active default+明示的終了表示、effective date管理、現行statusのみ。
- Current provisional treatment: 新規配置はACTIVEを基本とし、Autocomplete非限定は確定仕様としない。
- Related FUT IDs: FUT-0088、FUT-0089
- Answer: 未回答

## CONF-0074 Company設定の正式権限とserver-owned field

- Status: Open
- Source segment/doc: SPEC-SEG-027; `company-settings.md`
- Evidence: admin画面に対しRulesは同一会社Userへ全write。銀行、請求、取極め、運用設定、Stripe/subscription、maintenanceが同一docに混在する。
- Question: 各fieldを誰が閲覧・編集し、Stripe/subscription/maintenanceをFunctions専用にするか。
- Why needed: tenant設定・請求先・利用制限・maintenanceの権限昇格と改ざんを防ぐため。
- Options and impact: field別document分割、admin callable、操作別permission、server-owned field write deny。
- Current provisional treatment: 現行UI/Rulesを暫定実装として記録し、確定権限とはしない。
- Related FUT IDs: FUT-0090
- Answer: 未回答

## CONF-0075 Company停止・削除・tenant修復policy

- Status: Open
- Source segment/doc: SPEC-SEG-027; `company-settings.md`
- Evidence: Company status/archive/guardなし。UIはdelete不可だがRulesはdelete可で、claim/doc/subcollectionsがtenant identityを分担する。
- Question: 解約・停止・誤登録・法的削除をどう区別し、Company root削除、subcollection保持、復元、tenant移転を誰が行うか。
- Why needed: tenant root欠損、orphan data、誤削除から安全に復旧するため。
- Options and impact: root永久保持+status、server cascade/匿名化、論理停止、super-user repairのみ。
- Current provisional treatment: Companyを削除不能なanchorとして扱うが、Rulesは未強制。
- Related FUT IDs: FUT-0090、FUT-0091
- Answer: 未回答

## CONF-0076 Company基本・口座・請求設定の必須/validation

- Status: Open
- Source segment/doc: SPEC-SEG-027; `company-settings.md`
- Evidence: 初期作成は会社名/カナだけ。complete getterは住所/電話も要求するが画面editorは住所構成field全部を含まない。口座・invoiceは任意。
- Question: 運用開始・請求書発行に必要なfield、番号形式、口座完全性、minute/round/attendance設定の許容値をどう定義するか。
- Why needed: 不完全・不正な会社情報が帳票や勤怠・請求計算へ到達するのを防ぐため。
- Options and impact: 機能利用時validation、設定保存時strict validation、警告付き段階入力、server schema enforcement。
- Current provisional treatment: schema default/requiredを実装事実とし、業務上の完全条件とは確定しない。
- Related FUT IDs: FUT-0092
- Answer: 未回答

## CONF-0077 確定帳票でのCompany情報snapshotと再発行

- Status: Open
- Source segment/doc: SPEC-SEG-027; `company-settings.md`
- Evidence: Billing PDFは生成時のlive Company名称・住所・電話・登録番号・口座を参照する。
- Question: 請求確定時に発行者Company情報をsnapshotし、再生成で当時値を維持するか。訂正・再発行時はどう扱うか。
- Why needed: 過去帳票の再現性と会社情報変更を両立するため。
- Options and impact: Billing確定snapshot、PDF artifact保存、常にlive、revision付き再発行。
- Current provisional treatment: live参照を実装事実とし、確定帳票仕様とはしない。
- Related FUT IDs: FUT-0093
- Answer: 未回答

## CONF-0078 Company設定変更の監査・同時編集方針

- Status: Open
- Source segment/doc: SPEC-SEG-027; `company-settings.md`
- Evidence: 画面、並び順action、Stripe webhookが同じCompany docを更新し、version/preconditionと設定変更監査は確認できない。
- Question: 銀行・invoice・端数・勤怠設定・取極め変更の履歴を残すか。同時更新時に拒否、merge、後勝ちのどれを採るか。
- Why needed: 請求・勤怠結果の根拠と、外部同期を含む競合更新を追跡するため。
- Options and impact: revision+audit log、field別documents、optimistic concurrency、後勝ち+通知。
- Current provisional treatment: 現行更新を実装事実とし、監査・競合policyは未確定。
- Related FUT IDs: FUT-0090、FUT-0092、FUT-0093
- Answer: 未回答

## CONF-0079 Maintenance中に停止するserver処理の範囲

- Status: Open
- Source segment/doc: SPEC-SEG-028; `system-maintenance.md`
- Evidence: 現行maintenanceはroute redirectだけで、Rules/Functions/background writeを止めないがbackup/restoreは排他前提にする。
- Question: System/Company maintenance中にread、write、Callable、trigger、通知、scheduled処理のどれを停止し、開始済み処理をどうdrainするか。
- Why needed: 保守・restore中のdata競合を防ぎ、停止範囲を利用者へ正確に伝えるため。
- Options and impact: 全write停止、対象collectionだけ停止、read-only mode、UI表示のみ。background処理の扱いが異なる。
- Current provisional treatment: route制御を実装事実とし、server排他が成立するとみなさない。
- Related FUT IDs: FUT-0095
- Answer: 未回答

## CONF-0080 Maintenance中の例外actor・route・復旧操作

- Status: Open
- Source segment/doc: SPEC-SEG-028; `system-maintenance.md`
- Evidence: 全roleをmaintenance pageへ送り、logout/refresh/admin bypassなし。SystemはAdmin SDK、Companyも運用上Admin SDKで切替える。
- Question: super-user/admin/developerのどれにstatus確認・解除・修復を許し、一般Userへlogoutやread-only routeを提供するか。
- Why needed: 安全なbreak-glass復旧と、保守中の権限迂回防止を両立するため。
- Options and impact: CLI専用、super-user専用route、署名済みbreak-glass、全員完全遮断+logoutのみ。
- Current provisional treatment: 例外なしroute制御を実装事実とし、正式復旧policyとはしない。
- Related FUT IDs: FUT-0095、FUT-0098
- Answer: 未回答

## CONF-0081 System/Company状態不明時のfail-open/closedと復旧UX

- Status: Open
- Source segment/doc: SPEC-SEG-028; `system-maintenance.md`
- Evidence: System初回fetch失敗はfail-closed固定、Company fetch失敗はcompany modeを認識できず、retry UIなし。
- Question: 初回障害、購読断、offline、Company欠損でunknownとなった際にアクセスを止めるか、last-known状態を使うか。再試行をどう提供するか。
- Why needed: 可用性と保守安全性のtrade-offを一貫させるため。
- Options and impact: 常にfail-closed、自動retry後closed、署名済みlast-known、限定read-only。
- Current provisional treatment: 現行のSystem closed/Company open候補を確定仕様とはしない。
- Related FUT IDs: FUT-0096
- Answer: 未回答

## CONF-0082 Maintenance metadata・期間・利用者表示

- Status: Open
- Source segment/doc: SPEC-SEG-028; `system-maintenance.md`
- Evidence: boolean即時切替で予定期間なし。Company開始時刻field名がschema/CLIで不一致。pageは固定文言のみ。
- Question: 理由、開始/予定終了/実終了、更新者、対象範囲、連絡先を保存・監査・表示するか。予約maintenanceを必要とするか。
- Why needed: 利用者案内、運用監査、誤設定診断、予定停止を可能にするため。
- Options and impact: current state+history collection、予約window、最小booleanのみ、status APIで詳細提供。
- Current provisional treatment: boolean OR判定だけを確認済みとし、metadata仕様は未確定。
- Related FUT IDs: FUT-0097
- Answer: 未回答

## CONF-0083 Stripe機能の有効環境・公開条件

- Status: Open
- Source segment/doc: SPEC-SEG-029; `subscription-stripe.md`
- Evidence: Stripe moduleはFunctions indexでコメントアウトされる一方、checkout pageは利用可能な前提でStripeDataを作成する。
- Question: DEVでStripe機能を有効化するか。いつ、どの環境・mode・secret/webhook準備を満たしてUI/Functionsを公開するか。
- Why needed: 未接続UIの無期限待機と、準備前の外部課金作用を防ぐため。
- Options and impact: 機能flagで閉鎖、DEV test modeのみ、Emulator stub、準備完了後export。
- Current provisional treatment: Functions未公開を現在の実装事実とし、Stripe外部作用は実行しない。
- Related FUT IDs: FUT-0099
- Answer: 未回答

## CONF-0084 Subscription購入・管理actorとplan選択

- Status: Open
- Source segment/doc: SPEC-SEG-029; `subscription-stripe.md`
- Evidence: pageはsuper-user、Rulesは同一会社User全create。clientが固定priceを送るがserver allowlistなし。Portal/解約UIなし。
- Question: 購入、plan変更、支払方法、解約、再開を誰に許し、提供plan/priceをどう選ぶか。
- Why needed: 課金権限、誤購入、plan改ざんを防ぎ、正式な契約管理導線を定めるため。
- Options and impact: Company adminのみ、billing permission、super-user代行、server catalog+Customer Portal。
- Current provisional treatment: 現行page/Rulesを暫定実装とし、正式課金権限とはしない。
- Related FUT IDs: FUT-0100
- Answer: 未回答

## CONF-0085 Company・Stripe Customer・Subscriptionの一意性と再契約

- Status: Open
- Source segment/doc: SPEC-SEG-029; `subscription-stripe.md`
- Evidence: Customer/session作成にidempotency/lockなし。webhookはcustomer IDでCompany先頭1件を更新し、旧deleteが新契約をclearし得る。
- Question: 1 Companyに許すCustomer/active Subscription数、再契約・plan変更時のID継続、重複時の正本をどう定義するか。
- Why needed: 外部/Firestore mappingとwebhook収束を一意にするため。
- Options and impact: 1:1厳格、Customer 1:Subscription history複数、active 1件、複数plan併存。
- Current provisional treatment: 1 Customer/1 current subscription前提の実装を不変条件とはしない。
- Related FUT IDs: FUT-0101、FUT-0102
- Answer: 未回答

## CONF-0086 Subscription status・trial・grace・employeeLimit仕様

- Status: Open
- Source segment/doc: SPEC-SEG-029; `subscription-stripe.md`
- Evidence: active/trialingをpaid、past_due/unpaid/canceledをexpired、その他freeとし、metadata欠損limitは0、delete後freeになる。
- Question: 各Stripe status、期間終了、cancel-at-period-end、支払失敗grace、trial、plan別employeeLimitで許す機能をどう定義するか。
- Why needed: 契約stateとentitlementを安全かつ利用者に予測可能にするため。
- Options and impact: server entitlement table、即時停止、grace/read-only、free downgrade、employee超過時既存保持。
- Current provisional treatment: 現行customerTypeを実装事実とし、正式state/entitlement仕様とはしない。
- Related FUT IDs: FUT-0102、FUT-0103
- Answer: 未回答

## CONF-0087 Checkout成功条件・表示情報・保存期間

- Status: Open
- Source segment/doc: SPEC-SEG-029; `subscription-stripe.md`
- Evidence: query successだけで完了表示し、StripeDataにsession URL/customer ID/errorを残して同一会社User全readとする。
- Question: 成功をCheckout完了、webhook Company同期、entitlement反映のどこで確定し、intent情報を誰に何日見せるか。
- Why needed: 虚偽成功・stale表示と課金識別情報の過剰保持を防ぐため。
- Options and impact: server verify+poll、webhook完了待ち、pending state、owner/admin限定read+TTL。
- Current provisional treatment: query表示を実装事実とし、契約成立の確定条件とはしない。
- Related FUT IDs: FUT-0104
- Answer: 未回答

## CONF-0088 警備報告を写真共有または構造化提出書類のどちらとするか

- Status: Open
- Source segment/doc: SPEC-SEG-030; `security-report.md`
- Evidence: 現行はStorage写真群と件数索引だけで、本文、署名、状態、提出/承認遷移がない。
- Question: 警備報告は写真共有だけで完結するか、本文・項目・署名・提出/承認/差戻しを持つ報告書にするか。
- Why needed: データモデル、画面、保持、監査、権限の設計範囲を確定するため。
- Options and impact: 写真のみ維持、稼働単位report+添付、日次/site単位report、外部帳票連携。
- Current provisional treatment: 現行の写真共有だけを実装事実とし、提出ライフサイクルは存在しないと扱う。
- Related FUT IDs: FUT-0106
- Answer: 未回答

## CONF-0089 警備日報の閲覧・追加・削除・提出actor

- Status: Open
- Source segment/doc: SPEC-SEG-030; `security-report.md`
- Evidence: 複数の管理/実績/請求画面が共通Managerを使い、Storage Rulesは全認証Userに全path read/writeを許す。
- Question: 同社従業員、配置管理者、請求担当、外注、super-userの誰に閲覧、追加、削除、将来の提出/承認を許すか。
- Why needed: tenant分離修正と操作別認可を実装するため。
- Options and impact: uploader本人+管理者、稼働担当者、permission分割、確定後管理者のみ、super-user break-glass。
- Current provisional treatment: 親画面の到達性とStorageの認証のみ許可を暫定実装として記録し、正式権限とはしない。
- Related FUT IDs: FUT-0105、FUT-0106、FUT-0108
- Answer: 未回答

## CONF-0090 警備日報の保持・削除・親稼働削除時の扱い

- Status: Open
- Source segment/doc: SPEC-SEG-030; `security-report.md`
- Evidence: UIから即時物理削除でき、予定/実績削除triggerもfolderを連鎖削除する。履歴、lock、復元はない。
- Question: 何年間保持し、提出/請求/事故対応後の削除を許すか。親稼働削除時に画像を削除、archive、匿名化のどれとするか。
- Why needed: 証拠画像の不可逆損失とorphanを防ぐため。
- Options and impact: immutable retention、soft delete+期限後purge、親とcascade、独立archive、bucket versioning。
- Current provisional treatment: 現行の即時物理削除を実装事実とし、正式保持policyとはしない。
- Related FUT IDs: FUT-0108、FUT-0109
- Answer: 未回答

## CONF-0091 警備日報画像の形式・上限・件数・品質

- Status: Open
- Source segment/doc: SPEC-SEG-030; `security-report.md`
- Evidence: UIはimage/*、client圧縮1 MB/1920、thumbnail 400x400 JPEGだが、Rulesにtype/size/count制限がない。
- Question: 許可形式、原本保持、最大size/寸法/件数、圧縮品質、HEIC等の変換、offline再試行をどう定義するか。
- Why needed: 容量、端末互換性、証拠品質、decoder安全性、表示性能を両立するため。
- Options and impact: JPEG限定server再encode、複数形式保持、原本+派生、件数quota、offline queue。
- Current provisional treatment: client圧縮値を実装事実とし、server保証または正式上限とはしない。
- Related FUT IDs: FUT-0107、FUT-0110
- Answer: 未回答

## CONF-0092 警備報告の作成者・署名・改訂監査

- Status: Open
- Source segment/doc: SPEC-SEG-030; `security-report.md`
- Evidence: uploadedBy metadataは保存するがUI表示・認可に使わず、署名、revision、提出時刻、承認者、変更履歴がない。
- Question: 作成者/撮影者、提出者、承認者、電子署名、時刻、改訂履歴をどの粒度で保持・表示するか。
- Why needed: 報告責任と事後監査を成立させるため。
- Options and impact: Storage metadataのみ、report document snapshot、append-only audit、署名付きversion。
- Current provisional treatment: uploadedByだけを低水準metadataとして扱い、業務上の署名・監査とはみなさない。
- Related FUT IDs: FUT-0106、FUT-0108
- Answer: 未回答

## CONF-0093 Operationを抽象概念のまま維持するか独立entity化するか

- Status: Open
- Source segment/doc: SPEC-SEG-031; `operation-management.md`
- Evidence: OperationはSiteOperationSchedule/OperationResultの抽象基底で直接CRUD不能。独立page/Rules/Functionsはなく、StorageだけがOperations名を使う。
- Question: Operationは今後も共通schema概念だけとするか、予定と実績を一貫したID/状態で束ねる独立entityを設けるか。
- Why needed: collectionPath、用語、写真ID、予定から実績へのidentityと保持設計を一意にするため。
- Options and impact: 抽象base維持、共通Operation root+予定/実績substate、名前変更してStorage namespaceのみ維持。
- Current provisional treatment: 独立entityは存在せず、予定と実績を別documentとして扱う現行実装を記録する。
- Related FUT IDs: FUT-0111、FUT-0108、FUT-0109
- Answer: 未回答

## CONF-0094 master取得cacheのfreshnessと共有範囲

- Status: Open
- Source segment/doc: SPEC-SEG-032; `data-management-composables.md`
- Evidence: item cacheはTTL/refresh/update/delete同期なし。page originがsubtree共有する一方、data-layerにもorigin=true利用がある。
- Question: Article/Customer/Employee/Outsourcer/Siteをどの期間freshとみなし、どのcomponent境界で共有・破棄・再取得するか。
- Why needed: stale master表示と重複readのtrade-offを一貫させるため。
- Options and impact: page lifetime、TTL、CRUD invalidation、realtime subscription、global normalized cache。
- Current provisional treatment: composable instance lifetimeのone-shot cacheを実装事実とし、freshness保証とはしない。
- Related FUT IDs: FUT-0114
- Answer: 未回答

## CONF-0095 汎用取得失敗を画面とcallerへどう通知するか

- Status: Open
- Source segment/doc: SPEC-SEG-032; `data-management-composables.md`
- Evidence: fetch/searchはerrorをloggerへ記録してrejectせず、null/空配列を返し、not-foundと障害をreturn contractで区別しない。
- Question: permission/network/offline/not-foundを区別し、blocking error、inline retry、toast、silent fallbackのどれで扱うか。
- Why needed: 保存判断に必要なmaster欠損と一時障害を誤認しないため。
- Options and impact: typed Result、exception伝播、global error store+status、用途別policy。
- Current provisional treatment: logger吸収を現行実装として記録し、成功を意味するとは扱わない。
- Related FUT IDs: FUT-0113
- Answer: 未回答

## CONF-0096 共通UIのaccessibility対応基準

- Status: Open
- Source segment/doc: SPEC-SEG-033; `shared-ui-components.md`
- Evidence: icon-only操作、drag、floating windowで明示label/keyboard代替が揃わず、外部component defaultに依存する。
- Question: WCAG level、対象browser/device、screen reader、keyboard、focus、zoom、touchの受入基準をどこまで要求するか。
- Why needed: 共通componentの改善順と全画面へ適用する完了条件を定めるため。
- Options and impact: WCAG 2.2 AA、主要操作限定AA、段階導入、Vuetify default準拠のみ。
- Current provisional treatment: 静的に確認できる属性だけを実装事実とし、適合済みとは扱わない。
- Related FUT IDs: FUT-0115
- Answer: 未回答

## CONF-0097 Autocompleteでの新規master作成とerror/empty表示

- Status: Open
- Source segment/doc: SPEC-SEG-033; `shared-ui-components.md`
- Evidence: entityによりcreatable有無が異なり、managerをfield内に内包する。取得errorは空候補へ畳み込まれ、作成iconはplain v-iconである。
- Question: autocomplete内で新規作成を許すentity/actorと、検索中・0件・障害・作成失敗をどう表示するか。
- Why needed: 権限を迂回したmaster作成と、障害時の誤作成・誤選択を防ぐため。
- Options and impact: 全て親画面へ分離、permission付きinline create、read-only候補、typed error+retry。
- Current provisional treatment: 現行creatable propと空結果表示を実装事実とし、正式UX/権限とはしない。
- Related FUT IDs: FUT-0116、FUT-0113
- Answer: 未回答

## CONF-0098 Shellの戻る操作を履歴または設定済み親のどちらとするか

- Status: Open
- Source segment/doc: SPEC-SEG-034; `layout-navigation-components.md`
- Evidence: pageSettingsで親有無を判定してbutton表示するが、clickは`router.go(-1)`でparent pathを使わない。
- Question: 戻るbuttonはbrowser履歴、pageSettingsの親、または履歴優先+親fallbackのどれにするか。
- Why needed: direct entry、外部referrer、編集完了後も予測可能で安全な遷移にするため。
- Options and impact: 常に親、常にhistory、同一app historyのみback、page別override。
- Current provisional treatment: 履歴backを現行実装とし、親への遷移保証とはしない。
- Related FUT IDs: FUT-0118
- Answer: 未回答

## CONF-0099 User menu・logout・global shell feedbackの正式範囲

- Status: Open
- Source segment/doc: SPEC-SEG-034; `layout-navigation-components.md`
- Evidence: defaultはUserSetting activatorとlogoutを持つがcomponent出所不明。guestはsnackbarを表示せず、通知indicatorはない。
- Question: user menuに必要な設定/action、logout中UX、全layoutで維持するmessage/error/loading、通知indicatorの要否をどう定義するか。
- Why needed: shell共通feedbackとaccount操作を欠損・重複なく提供するため。
- Options and impact: 共通ShellFeedback host、layout別host、user menu app実装、外部package component、通知badge追加/不要。
- Current provisional treatment: default layoutで確認できるaccount activator/signoutだけを実装事実とする。
- Related FUT IDs: FUT-0120
- Answer: 未回答

## CONF-0100 Article masterの管理actor・重複・archive運用

- Status: Open
- Source segment/doc: SPEC-SEG-035; `article-master.md`
- Evidence: UIはdeveloper、Rulesは同社全User全CRUD。code/name重複guard、archive一覧/restore UI、参照guardがない。
- Question: 誰が品目を管理し、code/name一意性、無効化、archive、復元、参照中削除をどう扱うか。
- Why needed: 請求用masterの改変・欠損と権限境界を確定するため。
- Options and impact: billing permission、admin、developerのみ、code一意、論理無効化、参照中archive禁止/許可。
- Current provisional treatment: 現行UI/Rules/logical deleteを実装事実とし、正式権限・削除policyとはしない。
- Related FUT IDs: FUT-0121、FUT-0123
- Answer: 未回答

## CONF-0101 Articleの単価・数量・単位・税契約

- Status: Open
- Source segment/doc: SPEC-SEG-035; `article-master.md`
- Evidence: priceは負数可、quantityは正の小数可。unit/tax/rate/currency/rounding fieldなし。
- Question: 負額・0・小数数量を許すか。単位、税区分、税込/税抜、端数処理、値引きをどのmodelで表すか。
- Why needed: 品目請求額と帳票・会計上の意味を一意にするため。
- Options and impact: 非負整数、decimal quantity+unit、negative adjustment許可、tax category snapshot、別Adjustment model。
- Current provisional treatment: number validationだけを現行実装とし、正式金額domainとはしない。
- Related FUT IDs: FUT-0122
- Answer: 未回答

## CONF-0102 Article情報の請求snapshot時点とmaster変更影響

- Status: Open
- Source segment/doc: SPEC-SEG-035; `article-master.md`
- Evidence: price/quantityは実績明細へcopyするがcode/nameはPDF生成時のlive master。archive/欠損時はplaceholderになる。
- Question: code/name/unit/taxを実績作成、請求対象化、請求確定のどこでsnapshotし、訂正・再発行時にどのversionを使うか。
- Why needed: 過去請求書の再現性とmaster訂正を両立するため。
- Options and impact: OperationResult作成snapshot、Billing確定snapshot、PDF artifact保存、常にlive+archive fallback。
- Current provisional treatment: price/quantity snapshot・code/name live参照を実装事実とし、確定帳票保証とはしない。
- Related FUT IDs: FUT-0123
- Answer: 未回答

## CONF-0103 配置で要求・判定する資格の粒度とmanual override

- Status: Open
- Source segment/doc: SPEC-SEG-036; `qualification-management.md`
- Evidence: 現場要件とworker適格性はいずれもbooleanで、資格type/level/期限を見ない。通知編集でboolean変更可能。
- Question: 現場ごとに必要な資格type/級/人数をどう指定し、誰が理由付きでmanual overrideできるか。
- Why needed: 法令・契約上必要な資格と配置booleanを一致させるため。
- Options and impact: type+level+人数、任意資格1名、警告のみ、hard block、管理者override+監査。
- Current provisional treatment: manual booleanとGenerator警告を実装事実とし、有資格保証とはしない。
- Related FUT IDs: FUT-0124
- Answer: 未回答

## CONF-0104 Certification identity・期限・更新履歴

- Status: Open
- Source segment/doc: SPEC-SEG-036; `qualification-management.md`
- Evidence: nameをkeyとし、type/取得日/期限/番号を埋込み保存するが、失効判定・重複・更新履歴なし。
- Question: 資格を何で一意識別し、期限当日、期限なし、更新、取消、同名別級/発行元をどう扱うか。
- Why needed: 正確な有効性判定と履歴・配置根拠を維持するため。
- Options and impact: UUID instance、資格catalog ID+certificate ID、serial一意、履歴append、currentのみ上書き。
- Current provisional treatment: name keyと表示上の期限だけを現行実装とし、有効status保証とはしない。
- Related FUT IDs: FUT-0124、FUT-0125
- Answer: 未回答

## CONF-0105 従業員資格・警備員登録・機微情報の閲覧編集actor

- Status: Open
- Source segment/doc: SPEC-SEG-036; `qualification-management.md`
- Evidence: employees:read pageから編集UIへ到達し、Rulesは同社全Userへ資格番号、本籍、緊急連絡先を含むdocument全体writeを許す。
- Question: HR、管制、法務、本人、管理者の誰に各fieldの閲覧・編集・確認・overrideを許すか。
- Why needed: 個人情報保護と配置に必要な最小情報アクセスを両立するため。
- Options and impact: field別document/permission、HR専用、管制は有効flagのみ、本人申請+管理者承認、全管理者。
- Current provisional treatment: 現行page/Rulesを暫定実装とし、正式権限とはしない。
- Related FUT IDs: FUT-0126
- Answer: 未回答

## CONF-0106 AirGuardで管理する警備教育・OJT履歴の範囲

- Status: Open
- Source segment/doc: SPEC-SEG-037; `ojt-education.md`
- Evidence: Employeeに教育履歴はなく、isOjtは稼働単位boolean、TRAININGは独立稼働種別である。
- Question: 新任/現任/OJT等の教育区分、日時・時間、指導者、修了、期限、証跡をAirGuardで正本管理するか。
- Why needed: 計算flagと法定/業務教育記録を混同せず、必要なdata modelと保持範囲を決めるため。
- Options and impact: AirGuard正本、外部system参照、最小修了flag/date、管理対象外。
- Current provisional treatment: 教育履歴は存在せず、isOjtを稼働計算flagとしてのみ扱う。
- Related FUT IDs: FUT-0127
- Answer: 未回答

## CONF-0107 OJTの人数・勤怠・給与・請求・外注費の扱い

- Status: Open
- Source segment/doc: SPEC-SEG-037; `ojt-education.md`
- Evidence: OJTは配置人数0、status件数には含む、実勤務統計を別保持、従業員売上0円。外注にもflagを設定可能。
- Question: OJTを各domainで人数/時間/金額へどう算入し、TRAINING稼働やqualified OJTをどう扱うか。
- Why needed: 一つのbooleanによるdomain横断の誤計算を防ぐため。
- Options and impact: 全て0、配置のみ0、給与あり請求なし、契約別、employee/outsourcer別policy。
- Current provisional treatment: 直接getterで確認した0人/0円/別統計だけを現行実装とし、全domain仕様とはしない。
- Related FUT IDs: FUT-0129
- Answer: 未回答

## CONF-0108 OJT指定・override・実績訂正のactorと監査

- Status: Open
- Source segment/doc: SPEC-SEG-037; `ojt-education.md`
- Evidence: schedule/notification/resultでboolean編集可能。配置管理者の通知同時編集は承認済みだが、理由/actor/sourceをsnapshotしない。
- Question: 誰が各段階でOJTを指定・解除・訂正でき、理由、指導者、教育session、変更履歴を必須にするか。
- Why needed: 人数・売上へ影響する変更の正当性と再現性を確保するため。
- Options and impact: 管制のみ、配置管理者、本人申請+承認、実績確定後lock、理由付きoverride。
- Current provisional treatment: 現行manual editを実装事実とし、正式actor/監査契約とはしない。
- Related FUT IDs: FUT-0128
- Answer: 未回答

## CONF-0109 手動勤怠訂正・振替休日・代休・休暇のworkflowと保存先

- Status: Open
- Source segment/doc: SPEC-SEG-038; `attendance-ui.md`
- Evidence: 現在の`/attendances`は同期済みDailyAttendanceのread-only表示で、create/edit/delete、時刻・休憩訂正、振替休日・代休・休暇操作を持たない。DailyAttendanceはOperationResult同期が再生成する。
- Question: 誰が勤務時刻・休憩を訂正し、誰が振替休日・代休・休暇を申請・承認・取消しできるか。それらをDailyAttendance、別event、OperationResult補正のどこへ保存するか。
- Why needed: 同期による上書き・消失を防ぎ、勤務実績と休暇、actor、承認、監査、exportの所有権を分離するため。
- Options and impact: 別AttendanceAdjustment/Leave event、DailyAttendanceにsource別明細、OperationResult訂正workflow、外部system正本参照。
- Current provisional treatment: 現画面をread-onlyとし、将来の認証User read/write可能性を確定仕様にしない。
- Related FUT IDs: FUT-0039、FUT-0132
- Answer: 未回答

## CONF-0110 勤怠閲覧画面のresponsive・詳細表示要件

- Status: Open
- Source segment/doc: SPEC-SEG-038; `attendance-ui.md`
- Evidence: 固定幅左右paneと中央calendarを並べ、mobile分岐、event click/detail、keyboard actionを持たない。日跨ぎは開始日の時刻labelだけを表示する。
- Question: mobile/tabletでどのpaneを優先し、calendar eventから現場・勤務区分・休憩・複数実績等のどこまで詳細表示し、keyboard/screen reader/zoomをどの基準まで保証するか。
- Why needed: 勤怠情報を画面幅や入力手段にかかわらず誤認なく確認できる完了条件を定めるため。
- Options and impact: responsive pane切替、list-first、event detail dialog/drawer、desktop専用、WCAG基準適用。
- Current provisional treatment: desktop向け3 paneの静的実装事実だけを記録し、mobile対応済みとは扱わない。
- Related FUT IDs: FUT-0131、FUT-0115
- Answer: 未回答

## CONF-0111 正式なrole・permission matrixとspecial roleの意味

- Status: Open
- Source segment/doc: SPEC-SEG-039; `authorization-model.md`
- Evidence: 6業務preset、直接permission、admin、super-user、developerが混在し、現在の分割は試作段階である。clientとserverは同じcatalogを共有しない。SEC-002とschema reviewで、同一tenant一般UserによるCompany/User/locked OperationResult write、global `admin_users` write、Storageのcross-tenant object操作、UI wildcardとRulesのadditive super-user override差を確認した。
- Question: 正式に残すroleとpermission、各actorの操作・tenant scope、およびadmin/super-user/developerの用途・運用者・強制境界をどう定義するか。
- Why needed: UI、Rules、Functionsを同じ最小権限matrixへ揃え、暫定roleを確定仕様として固定しないため。
- Options and impact: preset中心、permission中心、role+scope、admin全権/限定権、developer非production、super-user緊急運用。
- Current provisional treatment: 現行presetとspecial roleを実装事実としてのみ記録する。
- Related FUT IDs: FUT-0133、FUT-0134、既存の各業務認可FUT
- Answer: 未回答

## CONF-0112 複数required permission・admin override・denyの判定意味

- Status: Open
- Source segment/doc: SPEC-SEG-039; `authorization-model.md`
- Evidence: 通常required配列はORだがsuper-user/developerを含む場合は先行guardとなり、adminはそれら以外を全許可する。store permissionにはadmin overrideがない。denyはない。
- Question: page/actionが複数条件を持つ場合をOR、AND、all/any明示のどれにし、admin overrideと明示denyをどう扱うか。
- Why needed: route、navigation、button、serverで同じ許可結果を保証するため。
- Options and impact: any/all operator明示、単一permission限定、admin wildcard、adminもmatrix準拠、deny優先。
- Current provisional treatment: 現行helperの結果を実装事実とし、意図されたauthorization algebraとは扱わない。
- Related FUT IDs: FUT-0133
- Answer: 未回答

## CONF-0113 role・claim変更の反映時期とcompany切替方針

- Status: Open
- Source segment/doc: SPEC-SEG-039; `authorization-model.md`
- Evidence: User roles/isAdminは購読更新、special role/companyIdはsession初期化時token claimから取得する。token change listener、role revision、company switch protocolは確認できない。
- Question: 権限付与・剥奪をいつ反映し、強制logout/reauthを要求するか。同一Auth userのcompany変更・切替を許すか。
- Why needed: 剥奪済み権限の残存、付与遅延、tenant prefixとclaimの不一致を防ぐため。
- Options and impact: 即時token revoke+reauth、次回token refresh、session再初期化、company immutable、明示switch+全state reset。
- Current provisional treatment: User購読とlogin/session初期化の現行差を記録し、即時反映を保証しない。
- Related FUT IDs: FUT-0135、FUT-0081
- Answer: 未回答

## CONF-0114 利用者feedback・error伝播・route resetの標準

- Status: Open
- Source segment/doc: SPEC-SEG-040; `error-logging-feedback.md`
- Evidence: errorはlogger設定によりsnackbar有無が変わり、catch後のswallow/null/rethrowが混在する。guestにsnackbarがなく、route遷移はErrorsだけclearしてMessagesを残す。UI package reviewではmanager errorがraw causeを保持し、step final validation、submit single-flight、dirty conflict、async latest-winsがないことも確認した。
- Question: blocking/non-blocking error、成功、警告、retryをどのUIで示し、どの層がerrorを吸収・再throwし、route遷移時に何を保持するか。
- Why needed: 失敗を成功や空dataと誤認せず、全layoutで一貫した回復導線を提供するため。
- Options and impact: typed Result+inline、exception+global snackbar、page error boundary、toastは補助のみ、route owner付きmessage。
- Current provisional treatment: 現行caller別挙動を実装事実とし、logger.errorが必ず利用者通知・失敗伝播するとは扱わない。
- Related FUT IDs: FUT-0136、FUT-0139、FUT-0113
- Answer: 未回答

## CONF-0115 production log・監視・privacy・保持基準

- Status: Open
- Source segment/doc: SPEC-SEG-040; `error-logging-feedback.md`
- Evidence: consoleだけで環境filter/redaction/correlation/remote monitoringがなく、payloadやobjectを直接出す箇所がある。notification FunctionsはFCM send resultに含まれるraw tokenをlogし、UI clone/managerとContextualErrorは個人・勤務・請求object全体を出し得る。Admin restoreはtemporary passwordをconsoleと平文artifactへ出す。
- Question: productionで許可するlevel/data、mask対象、監視service、correlation context、保持期間、閲覧者、利用者への開示をどう定めるか。
- Why needed: 個人・勤怠・請求・通知情報を保護しながら、障害を検知・追跡・監査するため。
- Options and impact: production error/warnのみ、structured allowlist、remote監視、local console禁止、短期保持、tenant pseudonymization。
- Current provisional treatment: console出力の存在だけを記録し、安全なproduction loggingとは扱わない。
- Related FUT IDs: FUT-0138
- Answer: 未回答

## CONF-0116 global loadingのblocking・priority・取消し契約

- Status: Open
- Source segment/doc: SPEC-SEG-040; `error-logging-feedback.md`
- Evidence: key queueを全layoutのloading dialogへ渡すが、reference count、owner、priority、cancel、timeoutがない。interaction blockは外部componentへ依存する。
- Question: global loadingは画面全体をblockするか、どの処理を表示し、複数処理のpriority・cancel・timeout・messageをどう扱うか。
- Why needed: 並行処理で早く消える/残り続ける問題を防ぎ、利用者が待機・取消し・再試行を判断できるようにするため。
- Options and impact: modal global blocker、non-blocking progress、operation token+reference count、最新/最重要message、cancelable task。
- Current provisional treatment: queue非空時の外部dialog表示を実装事実とし、blocking/cancel保証とは扱わない。
- Related FUT IDs: FUT-0137
- Answer: 未回答

## CONF-0117 geocoding失敗時の保存可否とlocation必須用途

- Status: Open
- Source segment/doc: SPEC-SEG-041; `address-geocoding.md`
- Evidence: create/update前geocodingが失敗してもlocation=nullで保存を継続し、callerへ失敗を伝えない。location/geopointの直接業務用途は本範囲で未確認。
- Question: Customer/Site/Employee/Companyごとにlocationを必須とするか。失敗時に保存block、warning付き保存、後続retryのどれを採用するか。
- Why needed: 住所保存の可用性と、座標を使う将来機能の整合・品質を両立するため。
- Options and impact: 全て任意、Siteのみ必須、warning+pending status、background retry、手動座標確認。
- Current provisional treatment: location欠損でも保存可能な現行実装を記録し、成功保証とは扱わない。
- Related FUT IDs: FUT-0141
- Answer: 未回答

## CONF-0118 郵便番号検索provider・正規化・候補選択契約

- Status: Open
- Source segment/doc: SPEC-SEG-041; `address-geocoding.md`
- Evidence: `air-postal-code`の結果をprefCode/city/addressへ反映するが、provider、format、0/複数候補、cache/error/rate contractは本repoから確認できない。
- Question: 使用providerと利用条件、7桁/hyphen/全半角のcanonical format、複数候補選択、手入力override、failure表示をどう定めるか。
- Why needed: 外部依存と住所表記を再現可能にし、誤補完・quota・provider変更へ対応するため。
- Options and impact: 国内7桁hyphenなし、表示時hyphen、候補dialog、自動先頭、手入力優先、provider差替えadapter。
- Current provisional treatment: component event contractだけを記録し、providerや正規化済みとは扱わない。
- Related FUT IDs: FUT-0142
- Answer: 未回答

## CONF-0119 fullAddressの粒度と建物・郵便番号・正規化住所の扱い

- Status: Open
- Source segment/doc: SPEC-SEG-041; `address-geocoding.md`
- Evidence: fullAddressはprefecture+city+addressでzipcode/buildingを除外するが、Site commentは含むと記す。provider formattedAddressはlocation内だけに保存する。
- Question: 表示住所、geocode query、検索token、帳票住所へzipcode/building/provider正規化住所をどこまで含め、どれを正本とするか。
- Why needed: geocode精度、表示、帳票、検索、住所変更検知を一貫させるため。
- Options and impact: field正本+用途別formatter、provider正規化正本、buildingは表示のみ、buildingまでgeocode、zipcodeをquery hintにする。
- Current provisional treatment: 共通accessorの3field結合を現行実装とし、Site commentを確定仕様としない。
- Related FUT IDs: FUT-0142
- Answer: 未回答

## CONF-0120 Employee個人住所geocodingの目的・同意・保持

- Status: Open
- Source segment/doc: SPEC-SEG-041; `address-geocoding.md`
- Evidence: EmployeeもGeocodableMixinを継承し、自宅fullAddressを外部providerへ送信して精密座標を保存する。logへ住所/座標が出る経路がある。
- Question: 従業員自宅座標を何の目的で必要とし、本人通知・同意、precision、provider送信、保存期間、閲覧者、削除、logをどう扱うか。
- Why needed: 高感度な居住地情報を必要最小限・目的限定で扱うため。
- Options and impact: geocodingしない、都道府県/市区町村まで、精密座標を限定roleのみ、本人同意、短期/退職時削除。
- Current provisional treatment: 現行自動geocodingを実装事実とし、privacy上承認済みとは扱わない。
- Related FUT IDs: FUT-0143、FUT-0075、FUT-0138
- Answer: 未回答

## CONF-0121 active同ID存在時のrestore conflict policy

- Status: Open
- Source segment/doc: SPEC-SEG-042; `archive-restore.md`
- Evidence: 共通restoreはactive同IDを確認せずarchive dataで全documentを上書きする。ID再利用・並行createを拒否しない。
- Question: active同IDが存在する場合、restoreを拒否、activeをarchiveへ退避、merge、新IDで復元、利用者選択のどれにするか。
- Why needed: 新しいactive dataを過去archiveで不可逆に失わず、ID参照の意味を保つため。
- Options and impact: fail-closed、revision一致時のみ、swap、new ID+参照移行、field merge禁止。
- Current provisional treatment: overwrite可能な現行実装を記録し、安全なrestore仕様とは扱わない。
- Related FUT IDs: FUT-0145
- Answer: 未回答

## CONF-0122 archive・restore時のFunctions triggerと副作用契約

- Status: Open
- Source segment/doc: SPEC-SEG-042; `archive-restore.md`
- Evidence: active→archiveはactive delete、restoreはactive create相当となり得る。Employee deleteはUser cleanupを開始し、Customerはupdate同期だけでcreate restoreを補完しない。共通APIにtrigger suppression/reconcileはない。
- Question: archive/restoreを通常delete/createと同じ業務eventとして扱うか。Auth cleanup、dependent snapshot、通知等を抑止・再構築・補償するか。
- Why needed: 復元しても関連account/dataが戻らない、または二重副作用が起きる部分状態を防ぐため。
- Options and impact: 通常trigger実行、archive専用server command、event reasonで分岐、restore後reconcile、特定masterはrestore禁止。
- Current provisional treatment: Firestore path eventが発火する可能性を実装境界として記録し、業務復元完了を保証しない。
- Related FUT IDs: FUT-0145、FUT-0078、FUT-0081
- Answer: 未回答

## CONF-0123 共通archive metadata・保持・匿名化・purge運用

- Status: Open
- Source segment/doc: SPEC-SEG-042; `archive-restore.md`
- Evidence: 元dataを同IDでcopyするだけでactor/reason/time/retention metadataがなく、同社全Userがarchive全read/writeできる。UI/commandによるrestore/purge/holdはない。
- Question: 全master共通で必要な削除理由・actor・時刻・revision、閲覧/復元/purge actor、保持期間、legal hold、匿名化、subcollection処理をどう定めるか。
- Why needed: 誤削除復旧、個人・取引data保持、監査、法令、storage削減を一貫運用するため。
- Options and impact: metadata envelope、audit ledger、master別retention、期限後匿名化/purge、legal hold、server-only operations。
- Current provisional treatment: archiveを無期限・無metadataの別collection copyとして記録し、正式な保持・復旧制度とは扱わない。
- Related FUT IDs: FUT-0146、FUT-0057、FUT-0063、FUT-0078、FUT-0087、FUT-0123
- Answer: 未回答

## CONF-0124 正式backup scope・復旧時点・RPO/RTO

- Status: Open
- Source segment/doc: SPEC-SEG-043; `admin-backup-recovery.md`
- Evidence: Admin SDKは固定catalogの一階層Firestore subcollectionと一部Auth情報だけを逐次取得し、catalog外collection、nested subcollection、Storage、System、Rules/index/configを含めない。Authもpassword hash、provider/MFA、session/revoke stateを含まず、単一consistent snapshotでもない。
- Question: 正式なbackup対象、再生成可能対象、Auth/Storage/nested data、整合した復旧点、必要RPO/RTOをどう定めるか。
- Why needed: 「完全backup」の完了条件と災害復旧後のデータ整合を検証可能にするため。
- Options and impact: 全tenant data+Auth+Storage、業務正本だけ+派生再構築、Firestore managed export併用、短期snapshot+長期世代、RPO/RTO別tier。
- Current provisional treatment: 現行catalog artifactを限定的なAdmin SDK exportとし、完全な災害復旧backupとは扱わない。
- Related FUT IDs: FUT-0147、FUT-0146
- Answer: 未回答

## CONF-0125 差分・選択・完全復旧の正式semanticsとtrigger方針

- Status: Open
- Source segment/doc: SPEC-SEG-043; `admin-backup-recovery.md`
- Evidence: restoreDiffはsnapshot変更とbackup削除復元を混在、restoreSelectiveはmerge、restore-completeはcatalogを破壊置換する。通常Functions triggerが発火し、待機値は全0である。
- Question: 各commandをbackup時点rollback、snapshot時点復元、merge repair、forward recoveryのどれとし、Functionsを抑止・通常発火・復旧後reconcileのどれにするか。
- Why needed: 期待する復旧点、削除/残存field、派生再生成、再実行の正否を一意にするため。
- Options and impact: immutable point-in-time replace、collection merge repair、event suppression+rebuild、通常trigger+idempotency ledger、blue/green tenant swap。
- Current provisional treatment: 現行動作を実装事実として記録し、command名どおりの安全なrollback/full restoreとは扱わない。
- Related FUT IDs: FUT-0148、FUT-0150、FUT-0095、FUT-0145
- Answer: 未回答

## CONF-0126 Backup artifact・仮credentialの保存と破棄

- Status: Open
- Source segment/doc: SPEC-SEG-043; `admin-backup-recovery.md`
- Evidence: 機微dataをlocal/Storageへ平文JSON保存し、完全復旧の仮passwordをconsoleと固定JSONへ平文出力する。SDK内にartifact version、checksum/signature、complete marker、暗号化、retention、secure deletion、immutable generationがない。
- Question: artifactの保存場所、暗号化鍵、閲覧者、保持世代/期間、改変検知、仮credentialの安全な配送・期限・破棄をどう定めるか。
- Why needed: backup自体からの大量漏えい・account takeoverと、改変artifactによるsilent corruptionを防ぐため。
- Options and impact: managed encrypted export、customer-managed key、immutable bucket、offline encrypted copy、passwordを作らずreset/invite、one-time secret delivery。
- Current provisional treatment: 現行artifactを高機密temporary dataとし、安全な長期保管・credential配送が保証されたものとは扱わない。
- Related FUT IDs: FUT-0149、FUT-0138
- Answer: 未回答

## CONF-0127 PROD復旧の実行権限・承認・audit・drill

- Status: Open
- Source segment/doc: SPEC-SEG-043; `admin-backup-recovery.md`
- Evidence: Admin credential保有者がRulesを迂回し、skip-confirmationで破壊確認を省略できる。claims変更、company全削除、Auth repair、restore、locked result migrationにtarget claim/company、self/last-admin、operation actor/reason、二者承認、durable audit、resume/rollback、定期restore testがない。
- Question: PROD復旧を誰が、どの承認・maintenance・監査・検証・解除条件で実行し、どの頻度でrestore drillするか。
- Why needed: 誤環境/誤tenantへの破壊操作と、未検証backupを緊急時に初めて使うriskを下げるため。
- Options and impact: break-glass二者承認、CI/CD限定service identity、change ticket必須、isolated restore drill、検証完了までmaintenance保持。
- Current provisional treatment: DEVあり・PROD未用意の現状を踏まえ、production-ready運用は未確定とする。
- Related FUT IDs: FUT-0148、FUT-0149、FUT-0095
- Answer: 未回答

## CONF-0128 Cloud Functionsの正式deployment surface管理

- Status: Open
- Source segment/doc: SPEC-SEG-044; `cloud-functions-catalog.md`
- Evidence: entryのstar exportで25 Function objectとplain helper 3件が到達し、Stripeはcomment、migration/test HTTPは未exportである。status/owner/environmentを示すmanifestはない。
- Question: 本番・DEVへdeployすべきfunction、停止中/dev-only/廃止functionをどう定め、stale remote functionとroot helper exportをどう管理するか。
- Why needed: 意図しないendpoint公開・必要trigger欠落・remote残存をreview/CIで検知するため。
- Options and impact: explicit named exports+manifest、environment別entry、全環境同一surface、feature flag、廃止tombstoneと削除手順。
- Current provisional treatment: 現在entryから到達するFunction objectをdeployment candidateとし、実deploy済みとは断定しない。
- Related FUT IDs: FUT-0152
- Answer: 未回答

## CONF-0129 匿名・管理Callableのactor／tenant／App Check方針

- Status: Open
- Source segment/doc: SPEC-SEG-044、SPEC-SEG-049、SPEC-SEG-056; `cloud-functions-catalog.md`、`callable-authorization.md`、`super-user-operations-ui.md`
- Evidence: 2026-08-16までにdisable/enable/changeAdminはcaller UID/company、会社管理者、target User/Authを、2つの再構築Callableは同社の有効なスーパーユーザーと要求会社一致を、`checkEmailAvailabilityGlobal`は有効な同社会社管理者をserver検証するよう改修した。createAdminAccountはメール確認、現在Auth、有効状態、token/current claim、既存User/Company所属を検証し、整合した再実行だけを許可する。`checkEmailAvailability`は初期管理者signup専用の未認証email事前確認となり、Authと全Userを確認してclient指定policy区分を無視する。一般User signupはpre-registrationだけを使用し、booleanだけを受け取り複数一致を拒否する。`geocoding`を含む未認証入口にApp Check/rate limit宣言はなく、Users/Companies Rulesのfield単位・actor単位制約も未完了である。
- Question: 各callableを匿名、認証User、company admin、super-userの誰に許可し、tenant一致、App Check、rate limit、列挙防止をどう強制するか。
- Why needed: signup UXを維持しつつ、他社操作、管理権限昇格、個人情報列挙、quota abuseを防ぐため。
- Options and impact: anonymous最小応答+App Check、authenticated onboarding token、admin/super-user guard、server-generated invitation、per-IP/UID quota。
- Current provisional treatment: 現行入口認証とtarget解決を実装事実とし、未認証操作を承認済みsecurity policyとは扱わない。`setupUserAccount`、createAdmin、disable/enable/changeAdmin、再構築2件、global email確認のguardと、管理者signup事前確認のclient非選択policyは確認済みだが、匿名signup入口、App Check、rate limit、Rulesのfield/actor制約を含む全体方針を確定する根拠にはしない。
- Related FUT IDs: FUT-0151、FUT-0163、FUT-0140、FUT-0133
- Answer: 未回答

## CONF-0130 Function別runtime・retry・SLO・再実行運用

- Status: Open
- Source segment/doc: SPEC-SEG-044; `cloud-functions-catalog.md`
- Evidence: global region/Nodeと1 timeout以外のruntime optionをほぼ明示せず、scheduled/customer syncはerrorを吸収する。OperationResult同期はBilling、DailyAttendance、DailyOperationByEmployee、SiteEmployeeHistoryを別々に順次更新し、後段失敗で前段だけが残る。dedupe、event revision、DLQ、correlation、cross-family reconcile、manual replay契約は入口にない。
- Question: trigger/callable/scheduled別にtimeout、memory、concurrency、instances、retry、idempotency、alert、手動再実行、成功条件をどう定めるか。
- Why needed: 負荷と費用を制御し、部分失敗を検知・安全に再処理し、重複副作用を防ぐため。
- Options and impact: no-retry+durable queue、bounded retry+ledger、scheduled per-task result、DLQ/replay、function class別標準profile。
- Current provisional treatment: repositoryで明示されたoptionsだけを実装事実とし、platform defaultや安全なretryを保証しない。
- Related FUT IDs: FUT-0153、FUT-0136、FUT-0138
- Answer: 未回答

## CONF-0131 OperationResult汎用CSVのconsumer・source・列・監査契約

- Status: Open
- Source segment/doc: SPEC-SEG-046; `operation-result-ui-export.md`
- Evidence: 唯一の入口はBilling groupで、Billing埋込みOperationResultを53列へ出す。OperationResult一覧からは出さず、日跨ぎflag/実datetimeなし、siteNumber空、formula neutralizationなし、UTC実行日filenameである。
- Question: 誰が何へ取り込むCSVか。live resultとBilling snapshotのどちらを正本とし、必要列、日跨ぎ/timezone、formula対策、対象group/期間/revision、filename、download履歴をどう定めるか。
- Why needed: 外部取込互換、請求snapshotの再現、夜勤意味、CSV injection、誤group/誤期間の持出しを防ぐため。
- Options and impact: Billing確定snapshot export、live OperationResult exportを別機能化、version付き2形式、ISO datetime追加、formula prefix無害化、監査record/件数確認。
- Current provisional treatment: 現行53列をBilling groupからdownloadする実装事実とし、汎用・正式取込formatとは扱わない。
- Related FUT IDs: FUT-0154、FUT-0031、FUT-0049
- Answer: 未回答

## CONF-0132 Dashboardの対象actor・widget・calendar・稼働数定義

- Status: Open
- Source segment/doc: SPEC-SEG-047; `dashboard.md`
- Evidence: 全認証Userがrouteへ入れるが、employeeId向け配置/calendarとadmin+developer向けgraph/site alertsだけがあり、他userは空。calendarは未結線。graphは予定必要人数と実績人数を同一系列へ混在する。
- Question: dashboardをどのactor向けにし、各roleへ何を表示するか。calendarのdata/action、稼働数を予定・実績・確定のどれとしてどう区別するか、対象外userのdefault experienceをどうするか。
- Why needed: 空画面・権限誤解・未完成widgetと、予定/実績混在KPIによる業務判断誤りを防ぐため。
- Options and impact: employee/admin別dashboard、permission-based widget、対象外は業務homeへredirect、calendar廃止/配置連携、予定と実績を別series/別widget、status filter/as-of表示。
- Current provisional treatment: 現行conditional表示と7日client集計を実装事実とし、正式KPI・完成dashboardとは扱わない。
- Related FUT IDs: FUT-0155、FUT-0156、FUT-0133
- Answer: 未回答

## CONF-0133 配置表PDFの利用者・必須field・配布・保存/監査契約

- Status: Open
- Source segment/doc: SPEC-SEG-048; `arrangement-sheet-pdf.md`
- Evidence: 現行PDFは取引先/現場住所/名称、予定時間/人数、従業員・外注の表示名をbrowser openする。資格/OJT/外注区分/日跨ぎ/companyなし、filename/専用権限/audit/storage/sendなしである。
- Question: 誰が誰へ何の目的で配置表を配布し、必須field、日跨ぎ、資格/OJT/外注表示、予定時snapshot、帳票番号/filename、preview/download、保存期間、watermark、監査をどう定めるか。
- Why needed: 現場配置の誤認、夜勤/要員属性の欠落、個人名・住所の無監査持出し、再生成差異を防ぐため。
- Options and impact: 社内管制用最小帳票、現場責任者配布版、個人名mask版、日付付きdatetime、資格/OJT印、version/revision付きdownload、生成履歴/期限付きStorage。
- Current provisional treatment: 現行日別browser-open PDFを実装事実とし、正式配布帳票・保存記録とは扱わない。
- Related FUT IDs: FUT-0157、FUT-0158、FUT-0075
- Answer: 未回答

## CONF-0134 RoundSettingの正式な適用単位・時点・履歴契約

- Status: Open
- Source segment/doc: SPEC-SEG-053; `rounding-and-time-calculation.md`
- Evidence: Companyは単一modeを持ち、実装は基本/残業・通常/資格を個別丸めした後、稼働外売上を加えてsalesAmountを再丸めし、税率別集約後の税も丸める。時間minutesは丸めず、時間quantityは小数のまま金額化する。clientはCompany mode、Functionsはdefault ROUND、DailyOperationByEmployeeは固定Math.roundを使い得る。税率はOperationResult日付の固定履歴表からlive算出し、Articleも同率、adjustmentは課税対象外で、tax rate/mode/versionは正式snapshotされない。
- Question: Company丸め設定を売上・税・時間/数量のどの単位と時点へ適用し、負数をどう扱い、設定変更後の過去実績・請求を再計算するか。client/Functionsで必ず同じmode/versionを使う契約とするか。
- Why needed: 経路、category分割、設定変更時点による1円以上の差と、請求・派生集計・CSVの再現不能を防ぐため。
- Options and impact: raw合計後1回、category/明細別、税率group別、時間quantityのprecision指定、負数は数学方向/絶対値方向、作成時snapshot/請求確定時snapshot/live再計算。いずれも既存金額とのmigration/diffが必要になり得る。
- Current provisional treatment: 現行の単一Company mode、client global static、部分別+最終丸め、時間非適用、server固定ROUND候補を実装事実として扱い、正式会計仕様とはしない。CONF-0039で承認済みの統合invoice税率別集約後丸めは維持する。
- Related FUT IDs: FUT-0160、FUT-0162、FUT-0048、FUT-0057
- Answer: 未回答

## CONF-0135 Site自動終了の条件・関連予定・再有効化・監査契約

- Status: Open
- Source segment/doc: SPEC-SEG-054; `site-auto-termination.md`
- Evidence: scheduled処理は工期終了から3か月超かつACTIVEだけで全tenant SiteをTERMINATEDへし、手動終了と異なり将来scheduleを確認しない。Agreement/予定/通知/User等は変更せず、reason/actor/source/historyを保存しない。query後の再有効化・工期変更・予定作成をpreconditionなしで上書きし得る。
- Question: 自動終了を維持するか。維持する場合、猶予期間・境界日、将来予定がある時のskip/取消/警告、Agreement・新規選択・通知への作用、再有効化との優先、利用者通知と監査をどう定めるか。
- Why needed: 有効な予定を持つSiteの誤終了、終了・再開race、契約/配置への予期しない影響、終了理由を説明できない状態を防ぐため。
- Options and impact: future scheduleがあればskip+alert、手動同等guard、予定を明示取消後に終了、自動終了を候補通知だけに変更、3か月固定/Company設定化、transaction precondition、reason/source/history保存。運用負荷と誤終了riskが異なる。
- Current provisional treatment: 現行3か月strict条件と将来予定非確認を実装事実として扱う。CONF-0046/0048の`sites:write`・TERMINATED read-only・理由付き再有効化方針は維持するが、自動終了固有仕様は未確定とする。
- Related FUT IDs: FUT-0161、FUT-0060、FUT-0062
- Answer: 未回答

## CONF-0136 Test / development routeのproduction運用方針

- Status: Open
- Source segment/doc: SPEC-SEG-057; `test-development-routes.md`
- Evidence: 5 test routeはproduction build除外がなく、4 routeはclient developer guardだけ、1 routeは未登録fail-openである。Firestore read、権限/個人情報表示、global RoundSetting変更、非transactionのOperationResult rollbackを含む。
- Question: test/dev routeをproduction成果物から全除外するか。必要な保守機能を残す場合、誰がどの環境で実行し、server authorization、App Check、確認、監査、復旧をどう必須化するか。
- Why needed: client roleだけに依存する開発surface、情報露出、誤削除、部分状態をproductionで防ぐため。
- Options and impact: production buildから全除外、read-only診断のみoperator専用へ分離、破壊操作を監査付きCallableへ移行。開発容易性とattack/misoperation surfaceが異なる。
- Current provisional treatment: 全5 routeを開発/test候補として扱い、production安全性・正式保守機能とはみなさない。外部/runtime検証には使用しない。
- Related FUT IDs: FUT-0164、FUT-0001、FUT-0160
- Answer: 未回答

## CONF-0137 Enumのunknown・deprecated・旧data互換方針

- Status: Open
- Source segment/doc: SPEC-SEG-060; `enum-field-input-contracts.md`
- Evidence: 保存enumはUI optionsとdefaultを持つが集合validatorを欠くものが多く、unknown時の表示はERROR、例外、空へ分岐する。deprecated alias/version/migration mapはない。
- Question: unknown/廃止enumを新規writeでrejectしつつ、既存dataをどの期間・方法で表示、mapping、修正するか。安全なfallbackを許すdomainと、hard errorにするdomainをどう分けるか。
- Why needed: 旧dataを破壊せず、typoや新規不正値を防ぎ、集計・請求・表示のsilent fallbackを避けるため。
- Options and impact: strict reject+事前migration、legacy alias/read-only表示、UNKNOWN sentinel、domain別fallback。migration負荷と業務継続性が異なる。
- Current provisional treatment: 現行value/options/defaultを実装事実とし、unknown値を正規値や承認済みfallbackとは扱わない。新規コード変更前に既存data dry-runを要求する。
- Related FUT IDs: FUT-0166
- Answer: 未回答

## CONF-0138 共通日付範囲のtimezone・包含境界・最大期間・更新UX

- Status: Open
- Source segment/doc: SPEC-SEG-061; `date-range-performance-utilities.md`
- Evidence: 現行useDateRangeはAsia/TokyoのstartOf(day)〜endOf(day)を両端包含し、UIは即時、queryはdefault 500ms debounceで更新する。dayCount/offsetのinteger・finite・最大値を強制せず、invalid処理もutilityごとに異なる。
- Question: 業務画面共通rangeをJST暦日・両端包含で固定するか。最大日数、月移動、invalid時の拒否/fallback、操作中の旧data表示・loadingをどう定めるか。
- Why needed: 画面別off-by-one、巨大query、見出しとdataの期間差、timezone誤認を防ぐため。
- Options and impact: JST inclusive＋上限、用途別上限、UTC instant API＋JST表示、debounce中stale表示/overlay/cancel。検索自由度、費用、UXが異なる。
- Current provisional treatment: 現行JST start/end両端包含と500ms query delayを実装事実とし、無制限rangeやsilent fallbackを承認済み仕様とは扱わない。
- Related FUT IDs: FUT-0167
- Answer: 未回答
