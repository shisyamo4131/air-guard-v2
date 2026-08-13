# FCMサーバー送信・FcmToken・無効トークン処理の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-005 — FCMサーバー送信・FcmToken・無効トークン処理
- 最終確認日: 2026-08-10
- 根拠ファイル: `functions/modules/utils/notifications.js`、`functions/triggers/arrangementNotification.js`、`functions/modules/notifications/createNotificationForArrangement.js`、`functions/modules/notifications/createNotificationForConfirmedArrangement.js`、`functions/modules/notifications/createNotificationForArrivedArrangement.js`、`functions/modules/notifications/createNotificationForLeavedArrangement.js`、`functions/modules/auth-v2.js` のAuthentication削除時FcmToken処理、`functions/index.js` の通知export、`firestore.rules` の `FcmTokens` match、`air-guard-v2-schemas/src/FcmToken.js`、同schemasの `index.js`

この文書は指定された通知配送境界から観察できる実装事実を記録する。環境値、実token、実データは読み取らず、外部通知やFunctionsを実行していない。通知以外のFunctions、Rules全体、他モデルは調査していない。

## データ契約

### FcmToken

- collection pathはルート直下の `FcmTokens` で、`usePrefix = false` のグローバルcollectionである。
- ドキュメントIDはFCM tokenそのものを前提とし、schemaの `create` は `docId` 必須を検査する。
- 保存fieldは `token`、Firebase Authentication UIDを想定する `uid`、`companyId`、既定値が現在日時の `updatedAt` で、すべてhidden指定である。
- class commentには `employeeId` の記述があるが、`classProps` にemployeeIdはない。
- instance `update` は常に例外をthrowし、新tokenのdocument作成を要求する。
- `deleteByUid` はuidでqueryし、該当instanceを並列deleteして削除件数を返す。uid未指定は例外、0件は0を返す。
- ルートアプリとFunctionsは同じ schemas version range `^2.4.2-dev.164` を宣言する。実際に解決された導入版は確認していない。

### Notification

送信triggerが直接利用するfieldは次のとおりである。

| field | 用途 |
|---|---|
| `title`、`body`、`imageUrl` | FCM notification payload |
| `data` | FCM data payload。送信前に各値を `String` へ変換 |
| `recipientUserIds` | 対象User文書IDの配列。未指定時は空配列 |
| `status` | `pending` からtriggerが `processing`、最終的に `completed` または `failed` へ更新 |
| `totalCount`、`successCount`、`failureCount` | recipient User単位の集計 |

`Companies/{companyId}/Notifications/{notificationId}/Recipients/{userId}` には `notificationId`、`userId`、`status`、`sentAt`、`error` を保存する。送信前は `pending`、送信後は1tokenでも成功すれば `sent`、それ以外は `failed` になる。

### 配置通知由来のpayload

- 配置通知作成時はemployeeIdに一致する同一会社のUser文書IDをrecipientにし、title「配置通知」、日付を含むbodyを作る。
- 配置状態がCONFIRMED、ARRIVED、LEAVEDへ変わった時は同一会社のEmployeeとSiteを取得し、それぞれ `receiveConfirmedArrangementNotification`、`receiveArrivedArrangementNotification`、`receiveLeavedArrangementNotification` がtrueのUser文書IDをrecipientにする。
- 状態通知のtitleはSite名、bodyはEmployee表示名と確認・上番・下番の状態を含む。
- いずれもdataに `type: "arrangement"`、arrangement notification ID、site ID、shift typeを入れ、source typeとsource IDもNotification documentへ保存する。

## 送信シーケンス

1. 配置通知のFirestore create/update triggerが条件を満たすと、対象Userを選定して会社配下へNotification documentを追加する。
2. exported `onNotificationCreated` が `Companies/{companyId}/Notifications/{notificationId}` の作成で起動する。
3. Notificationを `processing` へ更新する。
4. recipientUserIdsを順に処理し、同じ会社配下のUser documentが実在することを確認する。
5. User document IDをuidとして、グローバル `FcmTokens` を `uid == userId` かつ `companyId == event companyId` でqueryする。
6. Userごとのtoken配列と、存在・件数・mask済みtoken sampleの診断情報を作る。
7. 全recipientについてRecipients documentを `pending` でbatch作成する。
8. 全tokenをSetで重複排除する。
9. tokenが0件なら全Recipientsを `failed`、Notificationを `completed`、成功0・失敗recipient数として終了する。
10. custom dataの全値を文字列化し、全tokenへ同じnotification/data payloadを送る。
11. `sendMulticastNotification` はtokenを500件ずつに分割し、chunkを直列に `sendEachForMulticast` へ渡す。
12. tokenごとのsuccess、messageId、error message、error codeをresponse配列へ保存し、無効tokenを抽出する。
13. tokenからUserへの逆引きを作り、Userに1件でも成功responseがあればUser結果をsuccessとする。
14. Recipientsを `sent` または `failed` へbatch更新し、server timestampとerrorを保存する。
15. 無効tokenがあればAdmin SDKのbatchで `FcmTokens/{token}` を削除する。
16. Notificationを `completed` とし、User単位のtotal・success・failure countを保存する。
17. 途中でthrowされた場合はloggerへ記録し、Notification statusだけを `failed` へ更新する。

### 単体・batch helper

- `sendNotification` は単一tokenへnotificationと任意dataを送り、成功時messageId、失敗時error messageを返す。error codeと無効token分類は返さない。
- `sendBatchNotifications` は異なるmessageを最大500件だけ `sendEach` へ送り、超過分を切り捨てる。成功・失敗件数と無効tokenを返し、chunk分割はしない。
- `sendMulticastNotification` は500件超をchunk分割するが、chunkは順次送信する。
- 3 helperは `functions/index.js` の `export *` を通してmodule exportされる。Firebaseがplain helper exportをdeployment endpointとして扱うかは未確認である。

## 認証・認可

### 配送trigger

- `onNotificationCreated` はFirestore create triggerであり、callable/HTTPのrequest authを直接検査しない。
- companyIdはtrigger document pathから取得し、User、Notification、Recipientsは同じ会社pathを使用する。
- token選定はuidだけでなくFcmToken.companyIdもevent companyIdへ一致させる。
- Notification documentを誰がどの条件で作成できるかは、今回許可されたFcmToken match外のRulesと作成経路を調査していないため未確認である。
- Admin SDKでのtoken読取・削除とNotification/Recipients更新はクライアントRulesを経由しない。

### FcmTokens Rules

- client readは常に拒否される。
- create/updateは認証済みで、書込み後documentのuidがrequest auth UIDと同じ場合に許可される。
- deleteは認証済みで、既存documentのuidがrequest auth UIDと同じ場合に許可される。
- create/update時にcompanyIdが認証Userの所属会社と一致すること、token fieldがdocument IDと一致すること、許可fieldだけであること、updatedAtの型や値はRulesで検査しない。
- updateは既存documentの所有uid一致を要求せず、書込み後uidの一致だけを要求する。このためtoken document IDを知る別の認証Userが、自分のuidと任意companyIdへ所有情報を書き換えることをRules上は拒否しない。
- schema instanceの `update` 禁止とRulesのupdate許可は異なる。Rules commentは同じdeviceで別Userがログインした時の上書きを意図した動作としている。

### Authentication User削除

- Authentication v1 onDelete triggerが `FcmToken.deleteByUid(user.uid)` を呼び、該当UIDの全tokenを削除する。
- 削除件数をログへ記録する。
- 削除失敗はloggerへ記録して吸収し、Authentication削除trigger自体を失敗させないため、失敗時にはorphan tokenが残り得る。

## 失敗・再試行・削除

### エラー分類

- multicastは `messaging/registration-token-not-registered`、`messaging/invalid-registration-token`、`messaging/invalid-argument` を無効tokenとして分類する。
- batchは最初の2コードだけを無効tokenとして分類し、`messaging/invalid-argument` は含めない。
- 単体送信はerror messageだけを返し、分類しない。
- tokenなしはFCM送信を行わず、各recipientをfailed、Notification自体をcompletedとして集計する。
- User documentなしもtokenなしとして診断し、最終的にそのrecipientをfailedにする。

### 削除責務

- 通常配送ではserver triggerがFCM responseから無効tokenを分類し、Admin SDKで削除する。
- Authentication User削除時はschemasの `deleteByUid` が全tokenを削除する。
- client Rulesは所有User本人によるdeleteを許可するが、既調査のclient実装にはdelete呼出しがない。

### 再試行と冪等性

- trigger optionにretry指定はなく、アプリケーション独自の再試行queue、backoff、再送回数、次回実行時刻はない。
- Notification statusを `processing` にするが、既にprocessing/completedかを確認して送信を抑止する処理、event IDの処理済み記録、FCM messageのdeduplication keyはない。
- 複数chunkの途中でsendがthrowすると、それ以前のchunkは送信済みでも後続のRecipients集計へ進まず、catchでNotificationだけがfailedになる可能性がある。
- Recipients更新後に無効token削除またはNotification最終更新が失敗すると、配送結果は保存済みでもNotificationはfailedになり得る。
- 再実行された場合に送信済みtokenを除外する処理がないため、重複通知候補がある。

## クライアントとの境界

- clientはtoken、Authentication UID、companyIdをグローバルFcmTokensへ作成する。serverはuidとcompanyIdでqueryし、document IDを送信tokenとして使う。
- serverが送るnotification payloadは、backgroundではFirebase Messagingにより表示され、foregroundではclient pluginが `showNotification` する構成である。
- serverは配置通知dataへ遷移候補となるtype、arrangement notification ID、site ID、shift typeを入れる。しかしclient Service Workerのnotificationclickはdataを参照せず、常に `/` を開くため、payload destinationは現在接続されていない。
- serverはnotificationとdataを同じmessageへ含める。foreground/backgroundの表示経路は分かれているが、SDK挙動を含む二重通知の有無は実機未検証である。
- invalid-token ownershipは通常配送serverとAuthentication削除triggerが担う実装を確認した。client側削除はRulesで許可されるが実装は確認されていない。
- clientの `registFCMToken` は例外を内部で捕捉して伝播しない。認証初期化は登録完了をawaitするが、token登録成功をセッション成功条件にしない。

## 仕様との一致

- clientだけで送信を完結させず、Admin SDKを使うFirestore triggerが送信する点は `docs/specification.md` と一致する。
- User・会社に関連付けたtokenを選定し、tokenごとのresponseからUser単位の送信結果をRecipientsとNotificationへ記録する点は、送信成否追跡の仕様と整合する。
- FCMが無効と返したtokenをserverが削除し、Authentication削除時にもUID単位でcleanupする点は無効token追跡・cleanupの仕様と整合する。
- 会社pathとFcmToken.companyIdの両方を使うtarget選定はtenant境界を意識した実装である。ただしclient RulesのcompanyId整合検査不足により、保存時のtenant境界は十分とは確認できない。
- 非同期処理の重複実行と部分失敗を考慮するという仕様に対し、結果記録はあるが、送信の冪等性・部分送信再開・明示再試行は確認できない。

## 矛盾・未使用候補

- FcmToken class commentはemployeeId propertyを記載するが、classPropsにemployeeIdはない。
- schemaはinstance updateを常に禁止する一方、Rulesはupdateを許可し、同tokenを別User情報で上書きする意図をコメントする。`create` が既存documentをどう扱うかは基底model未確認である。
- Rulesのcreate/updateはcompanyId、token/docId一致、field allowlistを検証しないため、認証済みUserによる任意companyId設定と、token IDを知るUserによる所有権上書き候補がある。
- multicastだけが `messaging/invalid-argument` を無効token扱いする。payload全体の不正でも発生し得るコードであれば、有効tokenを一括削除する候補がある。batchとの分類も不一致である。
- `console.log("Send result:", JSON.stringify(result...))` はresponse内のtoken全体をログへ出す。emulator時の単体送信警告もtoken全体をloggerへ渡す。
- local `testNotification` HTTP handlerはexportされていないため現在のFunctions exportには含まれないが、認証・認可がなく、token全体をlogとHTTP responseへ含める。再export時に重大な漏えい・外部送信経路となる休眠コード候補である。
- `sendBatchNotifications` は入力が500件を超えても例外や残件情報を返さず、先頭500件だけ送る。
- 配送triggerのrecipientUserIdsに重複がある場合、RecipientsはUser IDごとに上書きされる一方、total/failure計算は配列長を使うため集計不整合候補がある。
- tokenが複数recipientへ重複した場合、tokenUserMapは最後のUserで上書きされる。診断警告はあるが、先行ownerはfailedとなる候補がある。
- 配置通知作成系の `createdBy` は空文字固定である。
- exported `sendNotification` と `sendBatchNotifications` の、この調査範囲内での呼出しは見つからなかった。module helperまたは将来用途の可能性がある。

## 仮説

- FcmTokensをグローバルcollectionにするのは、tokenをdocument IDとして全会社横断で一意にし、同一browser/deviceで最後にログインしたUserへ所有を移す意図と考えられる。
- User document IDをAuthentication UIDとして扱う修正コメントから、recipientUserIdsとFcmToken.uidを直接一致させることが現行データ契約と考えられる。ただしUser schemaと作成処理は未調査である。
- Notification/Recipientsは送信要求と結果の監査記録を兼ねる意図と考えられるが、保持期間と再送運用は未確認である。

## ユーザー確認済み方針

- 2026-08-11: tokenは現在login中Userだけに紐付け、sign-out時にFirestore紐付けを削除し、次回login時に再取得・再登録する。別Userへの所有移管は行わない。
- 2026-08-11: invalid tokenの最終削除はserver送信処理が担い、Auth User削除時も関連tokenを削除する。cleanup失敗に備え、定期orphan token検査を将来追加する。
- 2026-08-11: 通知クリックはapp側のnotification type別固定route allowlistを使用し、payload任意URLへ遷移しない。権限不足・不明通知はdashboardへfallbackする。
- 2026-08-11: Notification ID＋recipient User ID単位で冪等化し、一時FCM障害だけ指数backoffで自動retryする。invalid tokenはretryせず削除し、手動再送はfailed recipientsだけに限定する。複数端末は1台以上でFCM受付に成功すればUser successとし、aggregate countはUser単位、device結果は診断情報とする。retry count・last error・last attemptedAtを記録する。
- 2026-08-11: dev/prodともFCM token全文、User document、notification payload丸ごとのlogを禁止する。調査用は不可逆hash先頭8文字等の照合IDだけとし、prodはuserId・companyId・notificationId等の必要最小限に限定する。
- 2026-08-11: 通常の通知生成検証はEmulatorで行う。実機通知確認が必要な場合だけDEV限定Callableを使用し、App Checkと `isSuperUser=true` のAirGuardV2運営側system administratorを必須とする。送信先は呼出super-user本人または事前許可済みtest accountに限定し、rate limit・監査logを設ける。PRODではexportせず、unauthenticated HTTP test endpointは廃止する。
- 2026-08-11: Auth delete token cleanupを冪等化してFunctionsで自動retryし、already absentをsuccessとする。retry上限超過をmonitoringし、periodic orphan scanでも回収する。cleanup failureでAuth deletionをrollbackしない。

## 将来修正候補

このセグメントでは実装しない。

- FcmTokens RulesでcompanyIdと認証Userの所属会社を検証し、token fieldとdocument IDの一致、field allowlist、型を検査する。
- 同tokenを別Userへ移管せず、sign-out時にFirestore紐付けを削除して次回login時に再取得・再登録する境界をclientとRulesで強制する。
- FCM error codeを共通分類し、payload不正とtoken固有不正を分け、`invalid-argument` で有効tokenを削除しないことを公式仕様とテストで確認する。
- token全体を含む送信結果・emulator・test handlerのlog/responseを削除する。調査用は不可逆hash先頭8文字等の照合IDだけ、prod contextは必要最小限にする。
- unauthenticated HTTP test handlerを廃止する。通常はEmulatorで検証し、必要な場合だけApp Check・`isSuperUser=true`・DEV環境・許可recipient・rate limit・監査logを強制するCallableを用意し、PRODではexportしない。
- Notification ID＋recipient User ID単位の一意処理記録、状態による再入防止、chunk単位checkpointを設計する。一時FCM障害だけ指数backoffで自動retryし、invalid tokenはretryせず削除する。手動再送はfailed recipientsだけに限定する。
- RecipientsとNotification最終状態、invalid-token削除を部分失敗から回復できる順序または再調整処理を設計する。
- recipientUserIdsを事前に重複排除し、aggregate countをUser単位にする。複数端末は1台以上のFCM受付成功でUser successとし、device結果を診断情報として分離する。
- batch helperは500件超を拒否するかchunk化し、未送信件数を明示する。
- client notificationclickをnotification type別のapp側固定route allowlistへ接続し、payload任意URLを拒否する。権限不足・不明通知はdashboardへfallbackする。
- Authentication削除時のtoken cleanupを冪等化してFunctionsで自動retryし、already absentをsuccessとする。retry上限超過をmonitoringし、定期orphan scanでも回収する。cleanup failureはAuth deletionをrollbackしない。

## 質問

- 調査継続を妨げる質問はない。
- token ownership、sign-out、再login、invalid token、Auth User削除時の責務分担は確認済みである。定期orphan token検査の間隔・保持・監査条件は未確定である。
- 冪等key、自動retry対象、invalid token、手動再送対象、User単位count、記録fieldは確認済みである。最大試行回数・backoff上限・手動再送権限は未確定である。
- payload任意URLを使わずnotification type別固定route allowlistを使い、権限不足・不明通知をdashboardへfallbackする方針は確認済みである。typeごとの具体的route一覧は未確定である。

## 未確認範囲

- Notification collectionとRecipientsに対するFirestore Rules、作成者の認証・認可。
- User document IDとAuthentication UIDの生成・不変条件。
- FireModelのcreate/update/delete、既存document create、server adapter、batch上限の契約。
- Firebase Messagingのerror code意味、retry特性、重複排除、background表示の公式挙動。
- Functions platformの実際のretry設定、deployment export認識、稼働中version、監視・alert。
- 通知送信の他のproducer、手動Notification作成経路、実データ上の重複recipient/token。
- 実token、環境設定、DEVでの送信結果、PROD環境。
