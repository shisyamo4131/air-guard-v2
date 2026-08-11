# PWA Service Worker・FCMクライアント境界の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-004 — PWA Service Worker・FCMクライアント境界
- 最終確認日: 2026-08-10
- 根拠ファイル: `service-worker/sw.js`、`plugins/08.firebase-messaging.client.js`、`composables/useNotification.js`

この文書は指定されたクライアント境界から観察できる実装事実を記録する。Firebase設定値、実トークン、実データは読み取っていない。Cloud Functions、Security Rules、送信側、モデル内部は未調査であり、外部通知は送信していない。

## イベントフロー

### Service Worker登録と起動

1. client限定の `plugins/08.firebase-messaging.client.js` がブラウザ環境、Notification API、Service Worker APIの順に対応有無を確認する。
2. 開発時は `/dev-sw.js?dev-sw` をmoduleとして、それ以外は `/sw.js` をclassicとしてscope `/` へ手動登録する。
3. 登録失敗時はconsole errorを出して、その後のフォアグラウンド受信登録を行わない。
4. 登録成功後も通知権限が `granted` でなければ終了する。
5. 許可済みなら `navigator.serviceWorker.ready` を待ち、Firebase AppからMessagingを取得して `onMessage` を登録する。

### install・activate・update

1. `install` イベントで `self.skipWaiting()` を呼び、新しいService Workerを待機させずアクティブ化しようとする。
2. `activate` イベントで `clients.claim()` を `event.waitUntil` へ渡し、既存クライアントを直ちに制御対象とする。
3. バージョン番号、更新検出、利用者への更新通知、更新延期、reload、`controllerchange` 処理は確認範囲に存在しない。

### バックグラウンド通知

1. Service Worker moduleの評価時にFirebase Appと `firebase/messaging/sw` のMessagingを初期化する。
2. コードコメントとログは、Firebase Messaging SDKへバックグラウンド通知処理を委譲する構成を示す。
3. 独自の `push` listenerはイベントをconsoleへ記録するだけで、payload解析や `showNotification` を行わない。

### フォアグラウンド通知

1. clientプラグインの `onMessage` がpayloadを受ける。
2. notification titleがなければ「通知」、bodyがなければ空文字、iconがなければ `/icon-192.png` を使用する。
3. payloadのdataをnotification optionsへ渡し、Service Worker registrationの `showNotification` で通知を表示する。
4. `onMessage` 登録後の解除関数は保持・実行していない。

### 通知クリック

1. Service Workerの `notificationclick` listenerが通知を閉じる。
2. payloadのdata、FCM link、現在開いているWindow clientを調べず、`clients.openWindow("/")` を実行する。
3. 既存タブのfocusや目的ページへの遷移は実装されていない。

### 通知権限とFCMトークン登録

1. `useNotification` の `refreshPermission` はNotification APIがあれば現在値を、なければ `not-supported` をcomposableローカルのrefへ設定する。
2. `requestPermission` はブラウザへ権限を要求し、結果を同refへ反映する。非対応時は `not-supported` を返す。
3. `registFCMToken` はFirebase Messaging moduleを動的importし、`isSupported()` を確認する。
4. Messaging、Notification API、通知権限 `granted` のいずれかを満たさない場合、ログを残して書込みを行わず終了する。
5. Service Workerのreadyを待ち、公開runtime configのVAPID keyとregistrationを渡して `getToken` を呼ぶ。
6. tokenが空なら警告して終了する。
7. tokenがあれば `FcmToken` を作り、token、UserのUID、会社IDを設定する。token自体をドキュメントIDとして `create` をawaitする。
8. 処理全体の例外はcomposable内でloggerへ記録し、呼出し元へ再throwしない。

## 責務表

| 対象 | 責務 | 明示的に行わない・未実装の事項 |
|---|---|---|
| `service-worker/sw.js` | Firebase MessagingのService Worker初期化、pushログ、通知クリック、即時activate、client claim | fetch介入、navigation cache、静的asset cache、token管理、payloadに基づく独自背景表示、更新UI |
| `plugins/08.firebase-messaging.client.js` | Service Worker手動登録、対応・権限確認、フォアグラウンド受信と表示 | 権限要求、token取得・保存、listener解除、更新通知、クリック遷移 |
| `useNotification` | 権限状態の取得・要求、対応判定、FCM token取得、`FcmToken`作成 | Service Worker登録、前景・背景受信、token削除、token refresh listener、無効token処理 |
| Firebase Messaging SDK | この実装が委譲するバックグラウンドMessaging処理 | SDK内部挙動は未調査 |

## データ・外部作用

- `requestPermission` はブラウザの通知許可プロンプトを発生させる外部作用である。この調査では呼び出していない。
- `getToken` はFirebase Messagingと通信し、push subscriptionに関わるtokenを取得し得る。この調査では呼び出していない。
- `FcmToken.create` はtokenをドキュメントIDとし、token、UID、会社IDを保存する外部データ書込みである。この調査では呼び出していない。
- `registration.showNotification` とFirebase Messagingの背景処理は端末通知を表示し得る。この調査では通知を受信・表示していない。
- `clients.openWindow("/")` は通知クリック時にブラウザWindowを開く外部作用である。この調査では実行していない。
- Firebase設定はService Workerビルド時のプレースホルダーとNuxtの公開runtime configから供給される。値は確認・転記していない。
- VAPID keyも公開runtime configから取得する。値は確認・転記していない。

## キャッシュ・更新規則

- Service Workerは `fetch` listenerを登録しない。
- Cache Storage API、Workbox routing、navigation request cache、静的asset cache、runtime cacheを使用しない。
- 旧キャッシュ名の列挙・削除処理はない。Service Worker自身がアプリキャッシュを作らないため、この境界に削除対象として管理されるcacheもない。
- navigationとasset配信はFirebase Hosting rewriteおよびHTTP cacheへ委ねるというコメントがある。実際のHosting設定とHTTP cache headerは未調査である。
- `skipWaiting` と `clients.claim` により、新Service Workerを速やかに既存ページへ適用する構成である。
- precacheを使わないことは既調査の `nuxt.config.js` の空 `globPatterns` と一致する。
- 更新利用可能状態を利用者へ知らせる処理、更新前の作業保存、更新後のreloadはない。

## 失敗時挙動

- Service Worker登録失敗はconsole error後にフォアグラウンドMessaging登録を中止する。アプリ起動自体をthrowで停止しない。
- 通知API、Service Worker API、Firebase Messagingが非対応なら、それぞれ処理を終了する。
- 通知権限が `default` または `denied` の場合、プラグインもtoken登録も通知処理を進めない。自動で権限要求はしない。
- フォアグラウンドMessaging初期化・受信登録の例外はconsole errorへ記録して吸収する。
- token取得・保存を含む `registFCMToken` の例外はloggerへ記録して吸収する。
- tokenが得られない場合は警告して終了し、再試行予約や利用者向け状態更新は行わない。

## 仕様との一致

- PWAとFCMを使用し、通知tokenを会社・Userと関連付けて保存するクライアント入口は `docs/specification.md` の通知機能と整合する。
- foreground表示とFirebase Messagingへ委譲したbackground処理を分け、Service Workerをscope `/` へ登録する点はPWA通知境界として整合する。
- クライアントだけで送信権限を完結させないという仕様に対し、この範囲には通知送信処理がなく、token登録と受信だけがある。
- 仕様書は通知送信の成否と無効tokenの追跡を求めるが、このクライアント範囲には送信結果追跡と無効token削除がない。Functionsなどサーバー側で実装される可能性は未確認であり、仕様不一致とは断定しない。
- PWA更新時の古いcache不整合を抑えるという仕様に対し、このService Workerはアプリcacheを作成せず、`skipWaiting` と `clients.claim` を使う。HTTP cacheと実際の更新体験は未確認である。

## 矛盾・未使用候補

- Service Workerの独自 `push` listenerはログ出力だけであり、業務処理には使われていない。診断用途の可能性がある。
- `notificationclick` はpayload dataをnotification optionsへ保存しているにもかかわらず参照せず、常に `/` を新しいWindowで開く。dataはこのクライアント境界では未使用である。
- `clients.matchAll` と既存clientのfocusを行わないため、アプリを開いている状態でも重複タブを作る候補がある。
- Firebase Messaging SDKもnotification click処理を登録する可能性がある一方、独自listenerはSDK import・初期化後に登録される。両者の優先順位や二重遷移の有無はSDK内部を確認しておらず、競合候補である。
- foregroundではpluginが明示的に `showNotification` を呼び、backgroundはFirebase Messagingへ委譲する。通常は表示状況が分離されるが、payload形式やSDK挙動によって二重表示しないことは実機で未検証である。
- `onMessage` の解除関数を保持しない。Nuxt pluginがアプリ起動時に一度だけ実行される通常経路ではアプリ存続期間listenerとして成立するが、HMRやplugin再実行時の重複購読候補がある。
- `permission` refは `null` で開始し、自動refreshしない。各 `useNotification()` 呼出しで個別に作られるため、権限状態の共有正本ではない。
- `requestPermission` は許可後にtoken登録を自動実行しない。ログイン時のtoken登録より後に権限が許可された場合、別の呼出し元が `registFCMToken` を再実行しなければ保存されない候補がある。呼出し元の横断調査は所有範囲外である。
- client側には `deleteToken`、FcmTokenドキュメント削除、token更新監視がない。同一tokenで別Userがログインすると同じドキュメントを上書きする実装コメントがあるが、サインアウト、失効、ブラウザデータ消去後のcleanupは未確認である。
- 開発環境のログは取得したtokenそのものと `toRaw(userInstance)` をdataとして渡す。loggerの出力先次第でtokenやUser情報がログへ残る可能性があり、機密・個人情報境界の確認候補である。
- `install` handlerは `self.skipWaiting()` が返すPromiseを `event.waitUntil` へ渡さない。ブラウザが完了を待つ保証が必要かは未検証である。
- `docs/implementation/state-initialization.md` はFCM登録失敗が `initializeSession` からthrowされ得る含意を含むが、実際の `registFCMToken` は例外を内部で吸収してresolveする。前文書は今回の書込み所有範囲外のため未修正であり、後続の文書統合時に訂正が必要である。

## 仮説

- cacheを一切持たない設計は、過去のnavigation cacheによる白画面を避け、PWAをinstallabilityとpushだけに限定する意図と考えられる。コメント以外の判断記録は未調査である。
- tokenをドキュメントIDにする設計は同一tokenの重複保存を避け、User切替時に所有情報を上書きする意図と考えられる。ただし複数端末、token rotation、旧token cleanupの全体設計は未確認である。
- 即時activateはService Workerにfetch/cache責務がないため互換性リスクを抑えやすい可能性があるが、通知handlerの変更互換性は別途必要である。

## ユーザー確認済み方針

- 2026-08-11: 通知クリックはnotification typeごとのapp側固定route allowlistだけを使い、payload任意URLには遷移しない。権限不足・不明通知はdashboardへfallbackする。既存tabがあればfocusして遷移し、なければ新規tabを開く。
- 2026-08-11: foregroundはapp内通知のみ、background・app非表示時はOS通知とする。重大通知だけは将来foreground OS通知を選択可能にする余地を残す。
- 2026-08-11: tokenは現在login中Userだけに紐付け、sign-out時にFirestore紐付けを削除し、次回login時に再取得・再登録する。invalid tokenの最終削除はserver送信処理、Auth User削除時は関連token削除とし、cleanup失敗に備える定期orphan token検査を将来追加する。
- 2026-08-11: dev/prodともFCM token全文、User document、notification payload丸ごとをlogしない。調査用は不可逆hash先頭8文字等の照合IDだけとし、prodはuserId・companyId・notificationId等の必要最小限に限定する。保持期間・閲覧権限は監視基盤導入時に別途決定する。
- 2026-08-11: Service Worker更新検出時に更新案内を表示し、User選択時にreloadする。未保存入力があれば警告し、選択しなければ次回app起動時に更新する。security emergencyだけは将来forced update可能にする余地を残す。

## 将来修正候補

このセグメントでは実装しない。

- notification type別のapp側固定route allowlistを実装し、payload任意URLを拒否する。権限不足・不明通知はdashboardへfallbackし、既存clientがあればfocus・navigate、なければopenWindowする。
- Firebase Messaging SDKのnotificationclick handlerとの登録順・競合契約を公式仕様とテストで確認し、二重遷移を防止する。
- foregroundはapp内通知だけ、background・app非表示時はOS通知だけとなることを検証する。重大通知だけを将来選択可能にする境界を分離する。
- `onMessage` listenerのアプリ存続期間とHMR時のcleanup方針を明確化する。
- 権限が後から許可された場合のtoken登録とrotationを設計し、sign-out時のFirestore紐付け削除、次回login時の再取得・再登録を実装する。invalid tokenはserver送信処理、Auth User削除時は削除trigger、cleanup失敗は将来の定期orphan検査で回収する。
- token取得・保存失敗を再試行可能な状態として利用者または運用へ示すか検討する。
- dev/prod logからtoken全文、User document、notification payload丸ごとを除外する。調査用は不可逆hash先頭8文字等の照合IDだけとし、prod contextを必要最小限にする。
- `skipWaiting` をinstall eventのライフタイムへ結び付ける必要性をブラウザ仕様と実機で検証する。
- Service Worker更新検出、更新案内、未保存入力警告、選択reload、次回起動時更新を実装する。security emergencyのforced updateは通常更新と分離する。
- `docs/implementation/state-initialization.md` のFCM例外伝播に関する記載を、文書所有範囲が与えられた後に訂正する。

## 質問

- 調査継続を妨げる質問はない。
- notification typeごとの具体的な固定route一覧と重大通知のtypeは未確定である。allowlist、dashboard fallback、既存tab再利用方針は確認済みである。
- token・User・payloadのlog制限は確認済みである。保持期間・閲覧権限は監視基盤導入時に別途決定する。
- sign-out時のFirestore紐付け削除、server送信処理によるinvalid token最終削除、Auth User削除時の関連token削除、将来の定期orphan検査という責務分担は確認済みである。具体的な実装・運用条件は未確認である。

## 未確認範囲

- Firebase Messaging SDKのbackground表示、notificationclick、token rotation、重複排除の内部仕様。
- `FcmToken` schema/modelの保存先、権限、create時の上書き・競合・例外契約。
- Cloud Functionsの送信、送信結果、無効token検出・削除、再試行処理。
- Firestore/Realtime Database/Storage Rulesとtokenデータのテナント境界。
- `useNotification` 各公開関数のリポジトリ全体での呼出し元。
- Hosting rewrite、HTTP cache header、生成されたService Worker、開発用Service Workerの実体。
- 実ブラウザ、PWA install、権限拒否、foreground/background、更新、オフライン時の挙動。
