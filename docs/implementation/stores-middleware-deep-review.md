# Stores / auth middleware deep review

- 状態: 実装調査（deep review）
- 対象セグメント: SPEC-DEEP-005
- 最終確認日: 2026-08-11
- 対象: `stores/**` 7 files、`middleware/auth.global.js` 1 file

## ファイル別公開契約

| file | state / getters / public API | lifecycle・caller・side effect | error / concurrency / mismatch |
| --- | --- | --- | --- |
| `stores/useAuthStore.js` | `uid`、emailVerified、super/developer、companyId、reactive User、isReady。roles/permissions/tagSize等getter、`waitUntilReady`、`waitUntilSessionCleared`、role/permission判定 | state mutationとUser購読は`useAuthActions`が外部調整。middleware/sign-in/layout/pagesが参照 | `waitUntil`はwatch＋timeoutをfinally cleanup。状態はpublic mutable。isReadyは利用可能性でなく初期化終了を表す |
| `stores/useCompanyStore.js` | reactive Company、subscriptionから`customerType`をcomputed | fetch/subscribe/resetは`useAuthActions`、各page/actionがCompanyを直接更新 | store actionなし。Company objectがpublic mutableでfield ownership/競合制御なし |
| `stores/useSystemStore.js` | reactive System、build時`isDev`、SystemまたはCompany maintenanceのOR | `useSystemActions`がfetch/subscribe。middlewareがisMaintenanceを参照 | loading/unknown/error状態を持たず、未初期化defaultと正常inactiveを区別しない |
| `stores/useAppStore.js` | drawerを内部保持し、appBar/navBar/navIcon/previousButton propsをcomputed公開 | Vuetify breakpointをwatchEffect、route/authからtitle/visibility、router history back | drawer自体は非公開。previousは親設定有無だけで`router.go(-1)`。watch stopはstore scopeへ委譲 |
| `stores/useErrorsStore.js` | error `list`、`hasError`、`add`、`clear` | add時Messagesへerror snackbarも追加。middlewareはroute毎にlistだけclear | 直前errorのmessage+stackだけ重複抑止。clearしてもmessage queueは残る。null inputは想定しない |
| `stores/useLoadingsStore.js` | queue、`add/remove/clear/has/replace` | layoutのloading dialogと多数async callerがkeyをfinally解除 | random key。clearはownerを区別せず全処理を消す。replaceは存在keyのみ。cancel/timeoutなし |
| `stores/useMessagesStore.js` | queue、`add` | stringはsuccess objectへ変換。layout snackbar queueが`v-model`で配列を消費・変更 | store自身にremove/clear/dedupe/schema validationなし。任意objectをそのまま格納 |
| `middleware/auth.global.js` | 全routeでerror clear、maintenance、auth ready、public、email確認、page roleを順次判定 | `navigateTo(..., replace)`でmaintenance/sign-in/unconfirmed/dashboardへ分岐 | maintenanceをauth/system ready待機より先に判定。missing configは認証済みで許可し、getPageConfig親fallbackもある。wait timeoutをcatchしない |

## Auth state・初期化・reset

store自身は認証初期化actionを持たず、`useAuthActions`がAuth UID/claimsを直接代入し、User/Company fetch・subscribeを行う。clear時もscalar reset、User/Company unsubscribe・initializeを外部から実施する。`isReady=true`は処理終了を意味し、User/Company/FCMが利用可能という保証ではない。User切替はsign-outを挟み、cleanup failure時は強制reloadする承認済み方針だが、store API単独ではこれを強制しない。

Systemは別plugin/actionで初期化される。middlewareは`systemStore.isMaintenance`を`auth.waitUntilReady()`より前に読み、System/Companyが未取得ならinactive相当として先へ進み得る。逆に購読後trueならroute遷移ごとにmaintenanceへ送る。

## Route decision

1. 現在のerror listをclearする。
2. maintenanceなら`/maintenance`以外を置換。inactiveならmaintenance pageを`/`へ戻す。
3. auth readyを最大5秒待つ。
4. 未認証は`public`だけ許可し、それ以外をsign-inへ送る。
5. 認証済み未確認はverification pageだけ許可する。
6. 確認済みUserがpublic pageへ来た場合dashboardへ送る。
7. 認証済みでpage configがない場合は許可する。
8. configありでrole/permission不許可ならdashboardへ送る。

commentには未認証の「設定がないページ」も許可とあるが、実分岐は`pageConfig?.public`だけである。ただし`getPageConfig`の親fallbackにより未登録pathがroot public設定を得る場合があり、結果としてfail-openになり得る。承認済み将来方針はroute manifestと照合し、実在設定漏れ専用errorと404を分離することである。

## Feedback / loading ownership

Errorsはinline error listとMessages snackbarを同時に発生させる。route遷移はErrorsだけをclearするため、直前routeのerror snackbarはMessages queue側に残り得る。Messagesの消費・削除はlayout componentの`v-model`動作へ依存する。

Loadingsは複数処理をqueueとして保持するためbooleanより並行処理を表現できるが、owner/reference countはkeyを正しく保持するcaller規約に依存する。任意callerの`clear()`は他ownerのloadingも消す。storeはoperation cancel、timeout、route reset、stale key検出を持たない。

## Validation・security・privacy

Auth storeはclaims/Userから導出したroleをclient表示・route判定に使う。これはRules/Callable認可を代替しない。User/Company/System instanceとauth scalarはstore外から直接変更可能で、store層にtenant/field validationはない。Errors/Messagesへ渡された任意messageは利用者表示され、redactionはlogger/caller責務である。

## Unused・tests

- 8ファイルの公開要素は静的callerを確認し、file単位のdead/unused候補はない。
- `useAppStore`はdrawer refを直接公開せずcomputed props経由だけで操作する点がAGENTS責務と一致する。
- 対象store/middlewareのAPI・route matrixを直接検証するrepository testは確認できなかった。
- 発見事項は既存FUT-0001〜0005、0096/0098、0118/0119、0133〜0139へ統合し、新規FUT/CONFは追加しない。

## 未確認範囲

- Pinia/Vuetify component runtimeでのqueue消費、drawer/focus、store disposal
- Auth/System購読のnetwork断、初期化競合、middleware timeout時Nuxt error表示
- Rules/Callable enforcement、browser navigation matrix、Emulator
