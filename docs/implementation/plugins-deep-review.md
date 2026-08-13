# Nuxt plugins deep review

- 状態: 実装調査（deep review）
- 対象セグメント: SPEC-DEEP-006
- 最終確認日: 2026-08-11
- 対象: `plugins/**` 11 files
- 登録順: filenameの`01`〜`11`順を前提とする

## Plugin catalog

| order / file | runtime・provide / global mutation | async・error・cleanup | consumers / risks |
| --- | --- | --- | --- |
| 01 `firebase.init.js` | client限定suffixなし。Firebase appとFirestore/Auth/Storage/RTDB/Functionsを初期化し、`$app/$firestore/$auth/$storage/$database/$functions`をprovide | synchronous。emulator flag時はwindow hostname（serverはlocalhost）へ5 serviceを接続。cleanupなし | 全Firebase consumer。既存appでも`initializeFirestore`を毎回呼ぶため再初期化/HMR境界は未防御。public runtime configを使用し値はlogしない |
| 02 `firebase.auth.js` | client限定suffixなし。Firebase Auth observerから`useAuthActions.setUser`へ接続 | callbackをPromise chainで直列化し、失敗をconsole error後、次eventで継続。unsubscribe返値を保持しない | Auth/store/middleware。01未初期化ならplugin setupをthrow。HMR/再登録時のobserver重複cleanupなし |
| 03 `air-firebase.init.js` | FireModel process-global adapterを`$functions`付きClientAdapterへ設定。GeocodableMixinへglobal callable functionを注入 | geocoding errorをconsoleへ出して`null`へ吸収 | 全FireModel CRUD/geocoding。developmentはFunctions/adapter objectをconsole出力。tenant/auth検証はCallable側境界 |
| 04 `vuetify.js` | VuetifyをvueAppへ登録し`$vuetify` provide。theme/locale/directives/component defaultsをglobal設定 | synchronous、cleanupなし | 全UI。VTimePickerは初期10分、locale ja、mobile breakpoint sm |
| 05 `air-vuetify.js` | repository package AirVuetifyをvueAppへglobal登録 | synchronous、provideなし | auto/global component利用。plugin内部はexternal package boundary |
| 06 `dayjs.js` | dayjs process-global locale/plugins/default timezoneをja/UTC/timezone/Asia-Tokyoへ変更 | synchronous、cleanupなし | dayjs全consumer。SSR request間でも同一固定設定 |
| 07 `system.js` | System storeをwatchしmaintenance routeをreplace | watch登録後`initializeSystem()`をawait。fetch失敗はaction内でmaintenance=trueへ吸収。watch stopを保持しない | 全route。Nuxt起動をSystem fetch完了まで待つ。購読断/unknown stateは別表現なし |
| 08 `firebase-messaging.client.js` | client-only。SWを登録し、permission grantedならMessaging `onMessage`を登録 | unsupported/deniedはreturn。SW登録失敗はlogしてreturn、Messaging失敗も吸収。listener unsubscribeを保持しない | foreground payloadごとに`registration.showNotification`でOS通知。payload全体をconsole出力し、承認済みapp内通知のみ/丸ごとlog禁止方針と未一致 |
| 09 `chartjs.client.js` | client-only。Chart.js要素・scale/pluginをprocess-global register | synchronous、cleanupなし | chart components。全登録要素はchart利用境界で有効 |
| 10 `company-settings.client.js` | client-only watchEffect。Vuetify defaultsとRoundSetting staticをCompany値でglobal変更 | immediate相当で実行、stop未保持。error handlingなし | TimePicker/Calendar/全RoundSetting consumer。空Companyではminute interval無制限、ROUND、週日曜へ設定し、04の10分defaultを上書きする |
| 11 `user-settings.client.js` | client-only watch。User tagSizeが有効な時だけVuetify tag defaultsをglobal変更 | immediate、stop未保持。invalid/null時は何もしない | Tag系components。sign-outまたは次Userが未設定の場合に前Userのglobal sizeをresetせずstale preference候補 |

## Registration・client/server境界

数字prefixによりFirebase provide→Auth observer→FireModel adapter→UI基盤→date→System→client-only feature/settingsの順を意図する。01〜07は`.client` suffixがなくSSR側でもsetup候補で、08〜11のうち08/09/10/11だけclient-onlyである。01は`import.meta.client`をhost選択にだけ使い、server setup自体を明示skipしない。

02は01のFirebase app存在を直接検査する。03は01の`$functions`、10/11は04の`$vuetify`へ依存する。順序が崩れるとsetup throwまたはundefined accessになり得るが、dependency manifest/testはない。

## Initialization・reload・cleanup

- Auth callbackは直列Promise chainのためsign-in/sign-outの処理順を保つ。各失敗はchain末尾で吸収して次eventを受けられるが、observer解除・app teardownは実装しない。
- System pluginはinitial fetchをawaitし、fetch error時はmaintenanceへfail-closedする。subscribe後のerror/reconnect/last-known stateはSystem model/adapter境界で、本pluginは監視しない。
- Messaging、Auth、System、Company/User settingsのlistener/watch stopは保持しない。通常app lifetimeでは常駐を意図するがHMR/plugin再setup時の重複は未防御である。
- Company/User settingsはprocess-global UI/schema defaultsを変更する。Companyはempty stateでdefaultへ戻るが、User tag sizeはinvalid/null時にresetしない。

## Logging・privacy・secrets

Firebase configはpublic runtime configから読み、pluginは値自体をconsoleへ出さない。03はdevelopmentでFunctions instanceとadapter.functionsを出力する。08はforeground notification payload全体を常時consoleへ出すため、User document/notification payload丸ごとlog禁止の承認済み方針に反する。Geocoding/SW/Auth errorsもconsoleへ出し、共通logger・redaction・correlation IDへ統合されていない。

## Confirmed conflicts / unused / tests

- Foreground notificationをOS表示する現実装は「foregroundはapp内通知のみ」という確認済み方針と不一致。
- 08の`onMessage` unsubscribe未保持はFCM listener cleanup課題、payload logはprivacy課題へ直接到達する。
- 10は04のVTimePicker 10分defaultをCompany未取得時に無制限へ即時上書きする。
- 11はUser未設定/切替時にdefaultをresetしない。
- 11 filesはNuxt plugin auto-registration対象で、file単位のunused候補はない。03のcallback parameter `app`は未使用である。
- 対象pluginの順序・SSR/client・observer重複・global default resetを直接検証するrepository testは確認できなかった。
- 既存FUT-0003〜0009、0096、0120、0136〜0139、0160へ統合し、新規FUT/CONFは追加しない。

## 未確認範囲

- Nuxt SSR/HMRでの実setup回数、Firebase `initializeFirestore`再実行、observer/watch disposal
- SW/FCM/browser permission、foreground/background実表示、Emulator host接続
- external AirVuetify内部、Firebase remote config/credentials、実payload・token
