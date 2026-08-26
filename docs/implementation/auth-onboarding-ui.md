# Auth onboarding UI

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-058、SPEC-DEEP-039a、SPEC-DEEP-041
- 最終確認日: 2026-08-16
- 根拠ファイル: `pages/auth/*.vue`、`pages/unconfirmedEmail.vue`、`composables/useCreateNormalUser.js`、`composables/useCreateAdminUser.js`、`composables/auth/useAuthFunctions.js`、`composables/application/auth/useAuthActions.js`、`middleware/auth.global.js`、`utils/pageSettings.js`
- 制約: runtime、実メール、外部Firebase、実dataは確認していない。Callable内部認可は既存`callable-authorization.md`を参照する。

## route・guard

| route | layout / pageSettings | 主な入口・遷移 |
| --- | --- | --- |
| `/auth/sign-in` | `auth` / public | email/password login。成功後`auth.isReady`を最大15秒待ち`/dashboard` |
| `/auth/sign-up` | `auth` / public | 仮Userの事前登録確認後、一般Userを本登録し`/unconfirmedEmail` |
| `/auth/sign-up-admin` | `auth` / public | Auth作成と確認メール送信後、`/unconfirmedEmail`で初回admin設定を完了 |
| `/auth/reset-password` | `auth` / pageSettings未登録 | Firebase password reset mail送信 |
| `/unconfirmedEmail` | `auth` / pageSettings未登録 | verification mail再送、3秒pollで認証完了後`/dashboard` |

global middlewareは未認証Userにpublic pageだけを許す設計だが、設定なしpageを非publicとしてsign-inへredirectするため、未認証Userは`/auth/reset-password`へ直接到達できない実装候補である。認証済みUserはpublicなsign-in/signup/admin signupからdashboardへredirectされる。未認証で`/unconfirmedEmail`へ入ることもできず、メール未認証のsigned-in Userだけがmiddlewareにより同routeへ誘導される。

## login・disabled・resume

sign-inはFirebase `signInWithEmailAndPassword`を呼び、成功message後にglobal loading文言を接続待ちへ変更する。`auth/user-disabled`等の一部codeを日本語へmappingし、その他はlogger/error storeへ渡す。button自身にloading/disabledやform submit handlerはなく、連打防止はglobal overlayの実装に依存する。

認証後session初期化はtoken claims、User、Companyを取得・購読し、FCM登録完了段階まで待機する。ただしFCM登録失敗は内部でlog後に吸収される確認済み方針である。初期化errorも`setUser`がlog後に吸収して`isReady=true`とするため、sign-in handlerはdashboardへ進み得る。refresh後はauth plugin/middlewareがsessionを復元するが、入力中signup step、password、error、事前登録確認済み状態は永続化しない。

logout UIはこのscopeのauth pagesにはなく、app shell側の`useAuthActions.signOut`境界である。disabled UserはFirebase sign-in errorで拒否されるが、disable反映遅延や既存session失効は既存User lifecycle文書の未確認範囲である。

## 一般User signup・事前登録

1. emailを入力し、未認証Callable `checkUserPreRegistration`で仮Userを検索する。
2. 結果が1件なら確認済みbooleanだけを保持し、汎用の利用者表示を行う。会社ID、表示名、role、仮User IDは受け取らない。
3. password/confirm（6文字以上・一致）を入力する。
4. submit時にcomposableが事前登録を再確認する。管理者signup用`checkEmailAvailability`は呼ばない。
5. Firebase Auth Userを作成し自動sign-inする。
6. verification mailを送信する。
7. verification待ちへ遷移し、メール確認後に`setupUserAccount`が確認済みtoken emailから仮Userを一意解決して本Userへ変換し、claimsを設定する。
8. token refreshとsession初期化後、dashboardへ遷移する。

step中はlocal loadingにより戻る/次へ/作成buttonをdisabledにする。前stepへ戻ると事前登録確認済み状態を破棄する。仮登録emailの複数一致は事前登録確認と本登録の双方で拒否し、匿名応答のmetadata公開は解消した。存在有無の列挙、App Check、rate limit、招待tokenはFUT-0084、CONF-0069の未完了範囲である。

Auth作成後のmail/setup/token refresh失敗ではAuth Userが残る。画面はUID付きsupport案内を出すが、自動rollback、resume、同一account再実行、orphan検出はない。再度signupすると既存emailにより進めない候補である。

## 初回admin signup

3 stepでemail/password、Company名/カナ、6文字以内のdisplayNameを入力する。displayName超過はVuetifyの`rules`でfield下部に表示し、値を切り捨てず作成buttonを無効化する。step 1でemailだけを未認証`checkEmailAvailability`へ渡し、Authenticationと全会社Userの重複を事前確認する。submitは確認済みとしてcheckをskipするため、確認から作成までの競合はFirebase Auth作成が最終的に検出する。この確認はUX用であり、`createAdminAccount`のserver検証を代替しない。

Auth User作成、verification mail、verification待ちへの遷移、メール確認後の`createAdminAccount`によるCompany/User/claims作成、token refresh、`setUser`再初期化の順である。Company入力は同じbrowserのsession storageに保持し、完了時に削除する。Callableはtoken/current Authと既存所属を検証し、claims設定だけが失敗して同じUIDの有効な初期管理者User/Companyが残った場合は既存状態から再開する。別browser・別端末、session storage消失、不整合な部分状態のrepair UIはない。

## password reset・email confirmation

password resetはemail required inputとFirebase `sendPasswordResetEmail`を持つ。送信成功message/errorをstoreへ出すが、button loading/disabled、form validation state、送信cooldown、成功後email maskはない。pageSettings未登録により未認証到達がmiddlewareと矛盾する候補である。メール送信はFirebase Authの外部作用で、実送信は実行していない。

verification待ちはcurrent Auth Userへ`sendEmailVerification`を直接呼ぶ。再送buttonにloading/disabled/cooldownはなく、連打時は複数外部送信要求になり得る。3秒ごとに`currentUser.reload()`し、verifiedなら`setUser`後dashboardへ遷移する。interval callbackにtry/catchやsingle-flight guardがなく、network errorは画面error storeへ結線されず、reloadが3秒を超えると重複実行し得る。unmount時はintervalをclearする。

middlewareは未認証をsign-inへ、認証済み未確認Userをverification待ちへ、確認済みUserをdashboardへredirectする。verification画面の「メール認証済みの場合 サインイン」はsign-outせずsign-in routeへpushするため、middlewareにより未確認なら同画面へ戻る候補である。

## error・loading・double submit

- signup 2画面はlocal loadingとglobal loadingをfinallyで解除し、主要buttonをdisabledにする。
- sign-in/reset/resendはglobal loadingだけでbutton固有disabledを持たない。
- signup/reset/resendはraw Firebase/Callable error messageをerror storeで表示する。sign-inだけ一部codeを日本語化する。
- consoleへsignup/setup error objectを出力する。個人情報・credential本文の転記は確認していないが、production logging方針は既存error文書の課題である。
- password fieldはreload/back復元を明示せず、resume tokenやsetup progress表示はない。

## duplicate・orphan・unused候補

- 旧`checkEmailAvailabilityGlobal`はpublic APIから除外済みである。`checkEmailAvailability`は初回admin signupだけが使用する。
- 一般signupはpageで事前登録を確認した後、composableが同じ事前登録確認を再実行する。安全側の再確認だがrequestは重複する。
- admin signupは確認後submitまでemail変更をdisabledにする一方、競合予約やidempotency keyはない。
- verification済みUser向けsign-in buttonは現在sessionをclearせず、意味のある復帰操作にならない候補である。
- password resetとunconfirmedEmailはpageSettings設定漏れである。

## 将来要対応・要確認事項

- FUT-0001: 未設定実在pageの専用error方針を適用する際、reset/verificationの必要到達性を先に確定する。
- FUT-0081: Auth・Firestore・claims・mailの部分状態をidempotentにrepair可能にする。
- FUT-0082/FUT-0084/FUT-0151: 事前登録不変条件、匿名応答最小化、Callable認可/App Check/rate limit。
- FUT-0165: onboarding UIの二重送信、poll error、resume/recoveryを統一する。
- 正式workflowはCONF-0067、公開情報はCONF-0069、匿名Callable防御はCONF-0129へ統合し、新規CONFは追加しない。

## 未確認範囲

- verification/reset mail template、action URL、continue URL、language、expiry、Firebase console設定、delivery/bounce。
- browser reload/back/offline、rate limit、actual error code、global overlayがclickを遮断するruntime挙動。
- Callable内部の全transaction/rollbackは既存文書を参照し再調査していない。
- account recovery support手順、実orphan/duplicate件数、disabled sessionの失効時点。

## SPEC-DEEP-039a addendum

- 一般signup pageは事前登録結果を`preRegData`へ保持するが、submit時にその結果やone-time proofを`signupUser`へ渡さない。composableはemailで事前登録を再検索し、その時点の先頭結果を使うため、表示確認とsetup targetの間に同一性・revision bindingがない。
- `setupUserAccount`はverification mail送信後ではあるが`email_verified`成立前に呼ばれる。token email一致だけではmailbox所有を証明しない既知のinvitation takeover境界を、通常clientの実行順で再確認した。
- Auth作成後の後段失敗messageはFirebase Auth UIDを画面へ表示する。support correlationとして使う意図はあるが、利用者向けerrorへ内部identityを直接出す必要性・mask・監査は定義されていない。
- 初回admin signupもAuth作成、mail、Company/User transaction、claims、token refresh、`setUser`を直列実行し、後段失敗時はrollback/resumeせずUID案内だけを返す。

## Auth Callable adapter追加確認（SPEC-DEEP-041）

- `useAuthFunctions`は10 callable名を毎回`httpsCallable`で生成し、入力をそのまま渡して`result.data`を返す薄いadapterである。client側のshape/tenant/actor validation、timeout、App Check token状態、typed error/result normalization、retry、request generationはない。
- 呼出し元はsignup、User/Employee管理、admin変更dialogへ到達する。従ってUIの入力制約やbutton表示はCallable authorizationではなく、Functions側検査が唯一のserver境界である。
- adapterの製品exportに`checkEmailAvailabilityGlobal`はない。Employee/User作成UIは専用の単独・Employee連携仮登録作成Callableへ接続する。
