# Cloud Functions 稼働カタログ（実装調査）

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-044
- 最終確認日: 2026-08-15
- 根拠ファイル: `functions/index.js`、`functions/package.json`、`functions/modules/firebase.init.js`、`functions/apis/*.js`、entryから直接re-exportされるmodules/triggers/apisの宣言部
- 調査方法: entryのstar exportを起点にexport名を列挙し、各宣言のtrigger/optionsと入口認証の狭い範囲だけを確認した。業務処理本文は既存実装文書を参照し、再調査していない。

## entry / export構造

`functions/index.js`はdayjsをAsia/Tokyoへ初期化し、`firebase.init.js`でAdmin app、FireModel server adapter、geocoding callbackを初期化した後、次をstar exportする。

- modules: maintenance、dependentSync、geocoding、Employees、operationCleanup、utils/notifications
- triggers: arrangementNotification、auth、operationResult、user、securityReport
- APIs: `apis/index.js`

Stripe moduleのstar exportはcomment outされる。migration moduleもentryからimport/exportされない。package runtimeはNode.js 22、`setGlobalOptions({region:"asia-northeast1"})`が全体既定である。

## deployed-candidate catalog

entryから到達するFirebase Function objectは25件である。明示のないmemory、CPU、concurrency、min/max instances、timeout、retry、invoker、service account、secrets、App Checkはplatform/default設定に委ねられ、repository宣言から確定しない。

### Callable / HTTP相当

| export名 | trigger / options | 1行責務 | 入口認証 |
| --- | --- | --- | --- |
| `geocoding` | v2 callable | addressを座標へ変換 | なし。address stringのみ検証し、App Check、length、rate limit、quota制御なし。FUT-0140参照。 |
| `checkEmailAvailabilityGlobal` | v2 callable | 全Usersでemail重複確認 | verified email、正常な会社claim、現在の有効なAuth User、同社の有効な本登録会社管理者。`isSuperUser`単独では不可。 |
| `checkEmailAvailability` | v2 callable | Auth/Usersの登録可否確認 | なし。caller指定`isAdmin`で分岐。 |
| `createAdminAccount` | v2 callable | 新Companyと最初のadmin User/claimsを作成 | 認証必須。既存role/claimによる管理者許可は入口にない。 |
| `checkUserPreRegistration` | v2 callable | emailから仮登録Userを検索 | なし。companyId、displayName、roles、tempUserIdを返し得る。 |
| `setupUserAccount` | v2 callable | 仮Userを認証UIDのUserへ変換しclaims設定 | 認証必須。入力companyId/tempUserIdとtoken emailを照合。 |
| `disableUser` | v2 callable | 同社の本登録非管理者Userを無効化 | 認証、caller UID/company claim、有効な本登録会社管理者、別UIDの同社target、target Auth UID/company claimを必須化。 |
| `enableUser` | v2 callable | 同社の本登録非管理者Userを有効化 | disableと同じactor・company・target境界。 |
| `changeAdminUser` | v2 callable | 同社のactive本登録Userへadminを移譲 | 認証、caller UID/company claim、from=caller、会社管理者1人、from/to User/Auth company・UID・disabled整合を必須化。 |
| `rebuildAllHistories` | v2 callable | 指定companyのSiteEmployeeHistories全再構築 | verified email、token/current Auth双方の同社会社claim・`isSuperUser`・有効状態、同社の有効な本登録User、要求company一致。`site-employee-history-sync.md`参照。 |
| `rebuildSecurityReportIndexes` | v2 callable、timeout 540秒 | StorageからSecurityReportIndexes再構築 | rebuildAllHistoriesと同じ共有認可。恒久的な他社指定は不可。 |

公開された`onRequest` endpointはない。comment outされた`testNotification`とStripe webhookはunexportedである。

### ユーザー確認済み通知test方針

- 2026-08-11: 通常はEmulatorで通知生成処理を検証する。実機通知確認が必要な場合だけDEV環境限定Callableを使用し、PRODではexportしない。
- CallableはApp CheckとFirebase Auth custom claim `isSuperUser=true` を必須とする。このsuper-userはAirGuardV2運営側system administrator（全会社横断）であり、会社adminとは別である。
- 送信先は呼出super-user本人または事前許可済みtest accountだけに限定し、rate limit・監査logを設ける。unauthenticated HTTP test endpointは廃止する。

### Firestore / Auth triggers

| export名 | event path / generation | 1行責務 | 主な既存文書 |
| --- | --- | --- | --- |
| `onUpdateCustomer` | Customer update、Firestore importはv1互換API | Customer snapshotをSitesへ同期 | `customer-master.md` |
| `onEmployeeDeleted` | Employee delete、v2 | 対応User/Auth cleanup | `employee-master.md`、`user-auth-lifecycle.md` |
| `onArrangementNotificationCreated` | ArrangementNotification create、v2 | 通知document作成境界 | `arrangement-notifications.md`、`notification-authorization.md` |
| `onArrangementNotificationUpdated` | ArrangementNotification update、v2 | 状態に応じ通知document作成 | 同上 |
| `onOperationResultChange` | OperationResult write、v2 | Billing/DailyAttendance/DailyOperations/SiteEmployeeHistory同期の入口 | 各`*-sync.md` |
| `onUserUpdated` | User update、v2 | displayName/disabledをAuthへ反映 | `user-auth-lifecycle.md` |
| `onUserDeleted` | User delete、v2 | 対応Auth user削除 | 同上 |
| `onSiteOperationScheduleDeleted` | SiteOperationSchedule delete、v2 | 未実績予定に紐づくSecurityReport storageをcleanup | `site-operation-schedule.md`、`operation-management.md` |
| `onOperationResultDeleted` | OperationResult delete、v2 | SecurityReport storageと元scheduleをcleanup | `operation-result-generation.md`、`operation-management.md` |
| `onNotificationCreated` | Notification create、v2 | FCM token取得・multicast送信・無効token処理 | `notification-delivery.md`、`notification-authorization.md` |
| `onAuthUserDeleted` | Firebase Auth user delete、gen1、region明示 | UIDのFcmTokenを削除 | `notification-delivery.md`、`user-auth-lifecycle.md` |

event triggerにcallable型のcaller authはない。信頼境界はevent source document/objectを誰が作成・更新・削除できるか、およびhandler内検証である。

### Storage triggers

| export名 | event | 1行責務 |
| --- | --- | --- |
| `onSecurityReportUploaded` | object finalized、v2、region明示 | SecurityReport pathを解析しindex同期とthumbnail生成 |
| `onSecurityReportDeleted` | object deleted、v2、region明示 | SecurityReport indexを現在Storage状態へ同期 |

対象pathは`Companies/{companyId}/Operations/{operationId}/SecurityReports/{uuid}.jpg`形式をparserで選別し、thumbnail自身をskipする。詳細は`security-report.md`、`operation-management.md`を参照する。

### Scheduled

| export名 | schedule | 1行責務 |
| --- | --- | --- |
| `runDailyTask` | `every day 00:00`、Asia/Tokyo | 期限切れSiteOperationSchedules cleanupとSites自動終了 |

handlerは全体をtry/catchし、errorをlog後rethrowしないため、実処理失敗でもinvocation成功として終了し得る。

## unexported catalog

| 候補 | 状態 | deployment surfaceとの差 |
| --- | --- | --- |
| `modules/stripe.js`: `webhooks`、`onCreateCheckoutSession` | `index.js`のexportがcomment out | 実装ファイルと依存はあるが現entryからdeploy候補でない。署名検証はあるがevent ledger/order protectionはなく、checkout外部作用にもidempotency keyがない。`subscription-stripe.md`参照。 |
| `modules/migration.js`: `testGeopointMigration` | entryから未import | callable実装はあるがdeploy候補でない。名称上test/dev-only候補。 |
| `modules/utils/notifications.js`: `testNotification` | constでexport comment out | onRequest objectは作られるmodule codeだがentry export名がない。承認済み方針ではunauthenticated HTTP版を廃止し、必要時だけDEV限定・App Check必須・super-user限定Callableへ置換する。 |
| 各modules配下のexport async helper | entryから直接star exportされないもの | trigger内部libraryでありdeployment surfaceではない。 |

一方、`sendNotification`、`sendMulticastNotification`、`sendBatchNotifications`は`utils/notifications.js`から通常exportされ、entryのstar exportを通る。これらはFirebase Function objectではなくplain async helperである。deployment discoveryでの扱いは実行未確認だが、公開entryと内部library APIの境界が混在している。

## trigger chain map

- ArrangementNotification create/update → Notification作成 → `onNotificationCreated` → FCM送信。詳細は通知系文書。
- OperationResult write → Billing、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistories同期。delete時は別`onOperationResultDeleted`も発火し、Storage/schedule cleanupへ進む。詳細は個別sync文書。
- User update/delete ↔ Auth update/delete。Auth delete → FcmToken削除。詳細はUser/Auth文書。
- SecurityReport Storage finalize/delete → index同期、finalize時thumbnail生成。詳細はSecurityReport文書。
- scheduled maintenance → schedule cleanup/delete trigger、site自動終了。全連鎖・実行順の完全性は本segmentで再検証していない。

## runtime / options

- Node.js 22、global region `asia-northeast1`。storage/arrangement/cleanup/notificationは同regionを局所明示し、gen1 Auth triggerも`.region()`を明示する。
- `rebuildSecurityReportIndexes`だけtimeout 540秒を明示する。他はtimeout/memory/concurrency/instances/retry等を明示しない。
- v1互換とv2 APIが混在する。`onUpdateCustomer`は`firebase-functions/firestore`、`onAuthUserDeleted`はgen1 namespace、他の列挙入口はv2 builderである。
- App Check enforcement、custom service account、VPC、ingress、invoker、secret bindingは列挙入口で確認できない。
- deploy target filteringやenvironment別export分岐はない。commentの有無がStripe等のsurfaceを決める。

## auth / security

未認証callableはgeocoding、checkEmailAvailability、checkUserPreRegistrationである。sign-up前用途を持つが、App Check/rate limitはない。`checkEmailAvailabilityGlobal`は有効な同社会社管理者、2つの再構築Callableは有効な同社スーパーユーザーと要求会社一致をserverで検証する。

認証必須のcreateAdminAccountは既存所属・再実行境界が未解決である。disableUser、enableUser、changeAdminUserは2026-08-14〜15の最小segmentで会社管理者、caller company、target User/Authをserver検証するよう変更した。UI非表示は引き続きserver authorizationを代替せず、Users Rulesの直接write境界も別途未解決である。詳細は`user-auth-lifecycle.md`、`authorization-model.md`を参照する。

## retry / observability

明示retry option、event ID ledger、dedupe key、dead-letter、trace/correlation IDは入口宣言にない。trigger retry/idempotencyは各handlerと下流契約に依存する。logger/consoleは使われるが、統一したstructured audit、tenant-safe redaction、alert/SLOは入口から確認できない。詳細は`error-logging-feedback.md`。

scheduled handlerはerrorを吸収する。onUpdateCustomerも内部同期errorをcatchしてlog後終了する。その他のtrigger/callableにはrethrow/partial successが混在し得るが、本segmentでは業務本文を深掘りしていない。

## 矛盾・未使用候補

- 再構築2件は共有認可へ統一したが、App Check、rate limit、idempotency、監査は未実装である。
- sign-up前callableがglobal email/User情報を照会し、App Check/rate limitがない。
- disable/enable/change-admin等の名称上管理操作が認証のみ、またはcaller admin未確認である。
- Stripe/migration/test HTTPは実装されるがentry未export。意図的停止、dev-only、dead codeの区別はcode上のcommentだけでは確定しない。
- plain notification helper 3件がroot entryへexportされ、deployed Function objectと内部APIのexport boundaryが混在する。
- v1/v2、global/local region、runtime option、failure伝播が統一されない。
- direct function catalog/manifest testは確認できず、star export変更がdeployment surfaceを暗黙に変える。

## 将来要対応

- FUT-0140: geocoding auth/App Check/rate limitは既登録。
- FUT-0151: disable/enable/changeAdminのactor・tenant・target guardは実装済み。createAdmin・匿名signup入口等の残存guard、App Check、abuse防止、Rulesをserverで強制する。
- FUT-0152: deployment manifestとexport contract testを設け、plain helper/unexported候補を分離する。
- FUT-0153: runtime options、retry/idempotency、failure/observability契約を入口別に明示する。

## 要確認事項

- CONF-0128: 正式なCloud Functions deployment surfaceとdev/test/停止中functionの管理方法。
- CONF-0129: sign-up前匿名callableと管理callableのactor、tenant、App Check、rate limit方針。
- CONF-0130: function別SLO、timeout/memory/concurrency/retry、scheduled failure、監視・再実行方針。

## 未確認範囲

Firebase CLI、deploy、emulator、外部API、secret/env、実dataを使用していない。実deploy済みfunction一覧、Google Cloud側runtime overrides、IAM/invoker/App Check enforcement、retry policy、logs/metrics、traffic、cold start、quotaは未確認である。各handlerの業務algorithm、全error path、下流trigger完了順は既存個別文書の範囲を超えて再読していない。
