# Auth / settings / super-user pages deep review

- 状態: 実装調査（deep review）
- 対象セグメント: SPEC-DEEP-004
- 最終確認日: 2026-08-11
- 対象: 12 route files
- 注記: deep-review-planの`pages/dashboard.vue`表記は実在path `pages/dashboard/index.vue`として精査した

## ページ別公開契約

| route / file | meta・guard | handlers / validation / state | side effect・failure boundary |
| --- | --- | --- | --- |
| `/auth/reset-password` — `pages/auth/reset-password.vue` | `layout: auth`。pageSettings明示登録なし | email refをFirebaseへ渡す。errors clear、global loading、成功message | password reset email送信。button固有disabled/loadingと送信cooldownなし |
| `/auth/sign-in` — `pages/auth/sign-in.vue` | `layout: auth`、public設定 | email/passwordで`signIn`、認証初期化を最大15秒待ちdashboardへ | Auth errorの一部を日本語化。global loadingはfinally解除。button固有二重押下guardなし |
| `/auth/sign-up` — `pages/auth/sign-up.vue` | `layout: auth`、public設定 | email事前登録・重複確認後、6文字以上かつ一致passwordで本登録 | Auth/Firestore/Callableを跨ぐ。local loadingでstep/button抑止。consoleへerror object出力 |
| `/auth/sign-up-admin` — `pages/auth/sign-up-admin.vue` | `layout: auth`、public設定 | email確認後、会社名/カナ/表示名を各40文字以下で初回admin作成 | Auth、Company/User、claimsを跨ぐ。`skipEmailCheck:true`で事前check結果を信頼。consoleへerror object出力 |
| `/` — `pages/index.vue` | `layout: guest`、public設定 | sign-in/sign-up/admin signupへの3 navigation handler | 外部画像URLを表示。データwriteなし |
| `/maintenance` — `pages/maintenance.vue` | `layout: auth`、pageSettings未登録。middleware専用分岐 | 静的messageのみ | refresh/logout/status/reason/終了予定/復旧操作なし |
| `/settings/checkout` — `pages/settings/checkout.vue` | `layout: default`、pageSettingsはsuper-user、navigation false | companyId確認、固定price/success/cancel URLでStripeData document作成、snapshot購読 | Firestore create後に外部Stripe URLへlocation遷移。unmount/error時unsubscribe。hard-coded price、timeout/cancel、再試行専用処理なし |
| `/settings/company` — `pages/settings/company.vue` | pageSettings admin、metaなし | Company manager 3領域とAgreements managerを配置。agreement submit完了で`doc.update()` | page自身はloading/error/try-catchを持たずchild/store/modelへ委譲。Company全体write境界 |
| `/settings/users` — `pages/settings/users.vue` | pageSettings admin、metaなし | `useDocuments("User")`をempty時全件fetchしemail昇順managerへ渡す | search refはdata layerへ渡す。page自身のloading/error/validationなし。User CRUDはchildへ委譲 |
| `/super-user` — `pages/super-user/index.vue` | pageSettings super-user、navigation true、metaなし | current auth companyIdで履歴・SecurityReport index rebuild callableを実行 | global loading/loggerあり。確認、対象tenant選択、button disabled、reason/audit/idempotency keyなし。履歴subtitle「全会社」と実際の1社が不一致 |
| `/unconfirmedEmail` — `pages/unconfirmedEmail.vue` | `layout: auth`、pageSettings未登録。middlewareメール未確認分岐 | verification再送、3秒intervalでAuth reload、確認後setUser→dashboard | 再送cooldown/disabledなし。poll callbackにcatch/single-flightなし。unmountでinterval clear |
| `/dashboard` — `pages/dashboard/index.vue` | pageSettingsは認証User全員、navigation true | employee rowとadmin+developer rowを条件表示。3 data composableは条件外Userでもsetup時実行 | route自身にloading/error/refreshなし。該当条件なしUserは空container。Site alertsは非表示でも購読開始 |

## Route・Callable・Rules境界

page metaはlayoutだけで認可を表さず、pageSettingsとglobal middlewareがclient route guardを担う。`/auth/reset-password`、`/maintenance`、`/unconfirmedEmail`は明示pageSettingsがなく、親`/`設定へfallbackし得る既知境界である。UI guardはCallable/Firestore Rulesのserver enforcementを代替しない。

一般signupは未認証Callableで事前登録情報とemail availabilityを確認し、admin signupはAuth account作成後に認証必須CallableでCompany/User/claimsを作る。既存callable認可上のApp Check、rate limit、tenant/actor不足は`callable-authorization.md`とFUT-0151で管理する。

Company/User設定pageはadmin向け表示だが、Rulesの同社一般User write境界はより広い。Checkoutは逆にsuper-user表示限定だがStripeData create Rulesは同社Userへ広い。Super-user rebuildの一方はserver super-user guardを持つが、履歴rebuildは既存調査上guardが不足する。

## Loading・error・多重操作

- signup 2画面はlocal `loading`をbuttonのdisabled/loadingへ結線する。sign-in/reset/verificationはglobal loadingを追加するがbutton固有disabledを持たない。
- 各auth formはclick handlerを使い、page側で`@submit.prevent`を定義しない。native submitとの相互作用はbrowser/runtime未検証である。
- Checkoutは`isLoading`で作成buttonを止めるが、snapshotがsessionUrlもerrorも返さない場合はtimeoutせずloadingが継続する。
- Super-userはglobal loading keyを使うが、対象buttonのdisabled/loading表示を持たず、二重click防止をpage契約として保証しない。
- Dashboard/Company/Usersはpageレベルのerror UIを持たず、child/composable/global storeへ委譲する。

## Unused・stub・comment mismatch

- `sign-up-admin.vue`は`useAuthStore`をimportするが参照しない。
- `settings/checkout.vue`の`stripeCustomerId` computedと`doc` importは参照されない。
- `settings/users.vue`のquery options blockはcomment-outされたままである。
- Maintenance pageは静的表示のみ、dashboard calendarは既存調査でdata/action未結線である。
- Super-user履歴rebuildの「全会社」表示とcurrent companyId 1社送信が不一致。
- Checkoutのpriceはsourceへ固定され、コメント自身が設定化TODOを示す。

## Tests・FUT/CONF統合

対象page名・handlerを直接検証する自動testはrepository内検索で確認できなかった。既存FUT-0001/0002、0097/0098、0151、0155/0156、0163、0166とCONF-0001、0111、0129、0132等へ統合し、新規FUT/CONFは追加しない。

## 未確認範囲

- browserでのform submit、double click、interval overlap、Stripe redirect/snapshot timeout
- child manager/composableの内部CRUD・validation（各既存domain文書または後続deep segment）
- runtime Rules/Callable enforcement、App Check、実メール・Stripe・Firestore data
