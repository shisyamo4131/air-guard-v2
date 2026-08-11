# error・logging・user feedback基盤（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-040
- 最終確認日: 2026-08-11
- 根拠ファイル: `composables/useLogger.js`、`stores/useErrorsStore.js`、`stores/useMessagesStore.js`、`stores/useLoadingsStore.js`、`layouts/default.vue`、`layouts/auth.vue`、`layouts/guest.vue`、`middleware/auth.global.js`、代表利用箇所 `useFetchBase.js`、`useSiteShiftTypeOrderActions.js`、`useDuplicate.js`、`plugins/02.firebase.auth.js`、`plugins/03.air-firebase.init.js`、`plugins/08.firebase-messaging.client.js`
- 関連調査: `layout-navigation-components.md`、`data-management-composables.md`、`attendance-ui.md`

## 対象・API表

| 対象 | 公開API・state | 責務 |
| --- | --- | --- |
| `useLogger(sender, errorsStore?)` | `debug/log/info/warn/error({message,data,error})`、`clearError()` | sender prefix付きconsole出力。error時だけ任意Errors storeへ登録。 |
| `useErrorsStore` | `list`、`hasError`、`add(error)`、`clear()` | Errorをmemory保持し、追加時にerror色のglobal messageを作る。 |
| `useMessagesStore` | `queue`、`add(string|object)` | snackbar queue。stringはsuccess色へ変換する。clear/remove/duplicate制御はない。 |
| `useLoadingsStore` | `queue`、`add`、`remove`、`clear`、`has`、`replace` | key付きglobal loading messageを管理する。counterではなくkeyごと1件のqueue。 |
| default/auth layout | loading dialog、snackbar queue | defaultは上部snackbar、authもsnackbarを表示する。 |
| guest layout | loading dialogのみ | snackbar hostを持たない。 |

独立した`useError`、`useSnackbar`、global error pluginは確認できず、各storeと`useLogger`が直接組み合わされる。

## error flow

```text
caught Error
  ├─ logger.error(errorsStoreあり)
  │    ├─ console.error(prefix + message)
  │    └─ errors.add(error)
  │          ├─ errors.listへ保持
  │          └─ messages.add({ text: userMessage || message, color: error })
  │                    └─ default/auth layout snackbar
  ├─ logger.error(errorsStoreなし) → consoleだけ
  ├─ console.error直接呼出し → consoleだけ
  └─ rethrow / null return / swallow → callerごとに異なる
```

- message normalizationは`message`引数、なければ`error.message`、なければ`No message`である。
- user feedbackは`error.userMessage || error.message || String(error)`を使う。error code、cause、HTTP/Firebase分類、locale変換はない。
- Errors storeは直前1件と`message`・`stack`が同じ場合だけ重複抑止する。`userMessage`で表示しても比較は保存objectの`message`を使う。
- error以外のlog levelはErrors/Message storeへ入らない。
- catch後の契約は統一されない。例として`useDuplicate`はerrorを記録して`null`を返し、`useFetchBase`はfetch errorを吸収してPromiseをresolveし、layoutのsignOut handlerは記録後に戻る。別箇所では直接console出力もある。

Vue/Nuxt error handler、window `error`、`unhandledrejection`のglobal捕捉は確認できない。したがって、catchされないrender errorやPromise rejectionをこのstoreへ必ず集約する契約はない。

## logging sink・level

Functions側の未使用候補`ContextualError`は生成時にcontext全体をloggerへ出し、redactionを行わない。caller指定timestampが自動timestampを上書きでき、formatted contextはstack/causeを含まず、詳細文字列化は循環参照等で失敗し得る。詳細は[Geocoding・Stripe・ContextualError Functions deep review](geocoding-stripe-error-functions-deep-review.md)を参照する。

- sinkはbrowser consoleのみで、remote monitoring、永続log、server転送、buffer、samplingは確認できない。
- levelは`debug`、`log`、`info`、`warn`、`error`。未知typeは内部`send`ではlogへfallbackするが、公開methodは固定される。
- NODE_ENV、DEV/PROD、tenant、user、routeによるlevel filterはなく、`useLogger`経由の全levelが同じ実装でconsoleへ出る。
- timestamp、correlation/request ID、operation ID、release/version、structured context schemaはない。
- `data`がtruthyの場合だけconsoleの第2引数へ出すため、`0`、`false`、空文字はdataとして表示されない。
- error object自体は通常consoleの第2引数へ渡されず、message文字列だけが出る。Errors storeを渡した場合のみoriginal objectをmemory保持する。

## user feedback

- successはcallerが`messages.add("...")`を明示し、既定success色で表示する。
- errorはloggerへErrors storeを渡したcallerだけ自動snackbarになる。同じloggerでもstore省略時はconsoleのみである。
- default/auth layoutは`v-snackbar-queue`を配置するが、guest layoutにはない。guest pageでMessage storeへ追加しても、そのlayout内では表示hostがない。
- Message queueにclear/remove API、routeごとのownership、表示期限・priority・dedupeのapp側契約はない。表示消費はVuetify componentの`v-model`挙動へ依存する。
- auth middlewareはroute changeのたびErrors `list`だけをclearする。Message queueはclearしないため、過去error snackbarとErrors stateのlifecycleは一致しない。

## loading・concurrency

- `add`はstringまたは`{key,text}`を受け、key未指定ならrandom keyを返す。空textは追加せずnullを返す。
- 同じkeyが既にあれば2件目を追加せず、reference countも増やさない。どちらか一方が`remove(key)`すると、もう一方が進行中でもdialogから消える。
- 多くのactionは`const key=add()`、`try/catch/finally`、`remove(key)`を使い、通常終了・errorの両方でcleanupする。
- 一部data layerはboolean loadingをwatchし固定keyをadd/removeする。重複呼出しをcounterで表さないため、boolean自体の並行性に依存する。
- `clear()`は全ownerのmessageを削除できる。owner token、scope disposal、自動timeout、漏れ検出はない。
- layoutはqueue配列全体を`air-loading-dialog`のmodel-valueへ渡す。global loading中に画面操作をどこまでblockするかは外部component契約へ依存し、本調査では未確認。

## lifecycle・reset

- storesはPinia memory stateであり、永続化処理は確認できない。page unmountだけではglobal queue/listを自動clearしない。
- route middlewareが毎遷移時にErrors listをclearする。これは前画面のdiagnostic stateを失う一方、Message queueとconsole logは残り得る。
- loadingは各callerのfinallyに依存し、unmount/cancellation時の共通cleanupはない。
- keep-alive pageや複数tab間でErrors/Messages/Loadingsを共有・同期する仕組みはない。

## privacy・security

- loggerは`data`をmaskせずconsoleへ渡す。型・field allowlist、token/email/doc snapshotのredactionはない。
- 代表的な直接console出力にはFCM foreground payload、Agreement object、Firebase adapter/function object、date range input等がある。これらは通知内容、業務データ、identifierを含み得るため、production consoleへの露出候補である。実値は本書へ転記しない。
- Errors storeのuser feedbackはraw `error.message`へfallbackするため、backend/internal identifierやtechnical detailが利用者に表示される可能性がある。

## ユーザー確認済み通知log方針

- 2026-08-11: FCM token全文をdev/prodともlogしない。調査用は不可逆hash先頭8文字等の照合IDだけを使用する。
- 2026-08-11: User documentとnotification payloadを丸ごとlogしない。prodはuserId・companyId・notificationId等の必要最小限に限定する。
- log保持期間と閲覧権限は、監視基盤導入時に別途決定する。
- remote送信がないため外部監視への漏えいは確認できない一方、利用端末consoleとmemory queueの閲覧者境界、support採取手順は未定義である。

## 代表的利用例

| 例 | loading | error結果 | callerへの伝播 |
| --- | --- | --- | --- |
| default layout sign-out | random key、finally remove | Errors+snackbar | rethrowせずhandler終了 |
| site shift order update | random key、finally remove | Errors+snackbar | swallow。先にlocal orderを書換えるため失敗時rollbackなし |
| OperationResult duplicate | global key+local boolean、finally cleanup | Errors+snackbar | `null`を返す |
| generic fetch | local boolean、同一IDin-flight共有 | Errors+snackbar | fetch単位errorを吸収し全体resolve |
| Firebase auth/plugin | 共通loadingなし | 直接console.error | plugin固有 |

個別処理のrollback・業務整合性は各実装文書を参照し、本書では共通feedback契約だけを扱う。

## 矛盾・未使用候補

- `useLogger`のerrorsStoreはoptionalで、同じ`logger.error`表現でも利用者通知の有無がcaller依存である。
- Errors listをrouteでclearしてもMessage queueはclearせず、`hasError`と表示中snackbarが一致しないことがある。
- guest layoutだけsnackbar hostがなく、layout間でfeedback契約が異なる。
- Loading storeの説明は複数処理を一括管理するとするが、同一keyの並行処理をcounter管理しない。
- Errors storeのlistはUI/debug表示に直接利用される箇所を確認できず、主用途はhasErrorとMessage queueへの橋渡しである。
- global error/unhandled rejection handler、remote monitoring、correlation ID、production log policyは存在を確認できない。

## 将来要対応

- FUT-0136: error型・伝播・user message・retry contractを統一する。
- FUT-0137: global loadingをowner/reference-countedにし、並行・取消し・unmountを安全にする。
- FUT-0138: production logging、redaction、monitoring、correlation policyを設計する。
- FUT-0139: layout間のsnackbarとErrors/Messages lifecycleを統一する。

## 要確認事項

- CONF-0114: 利用者feedbackとerror伝播の標準。
- CONF-0115: production log・監視・privacy基準。
- CONF-0116: global loadingのblocking・priority・取消し契約。

## 未確認範囲

- 全業務catch、全console出力、air-loading-dialogとVuetify snackbar内部、SSR/server console。
- production build実行時のconsole削除有無、browser extension/devtools、外部監視導入予定。
- Emulator/実network error、unhandled rejection、複数tab、keep-alive/unmount中処理のruntime検証。
