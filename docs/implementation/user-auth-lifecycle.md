# User / Firebase Auth ライフサイクル（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-025、SPEC-DEEP-035、SPEC-DEEP-040
- 最終確認日: 2026-08-20
- 根拠ファイル: `pages/settings/users.vue`、`pages/auth/sign-up.vue`、`components/Users/Manager/index.vue`、`components/Employee/UserManager.vue`、`components/organisms/ChangeAdminUserDialog/index.vue`、`composables/useCreateNormalUser.js`、`composables/useCreateAdminUser.js`、`composables/auth/useAuthFunctions.js`、`functions/apis/*.js`、`functions/triggers/auth.js`、`functions/triggers/user.js`、`functions/modules/auth/*.js`、`firestore.rules`、`utils/pageSettings.js`、schemas `src/User.js`

## 入口と暫定権限

| 入口 | UI上の境界 | server / Rulesの実装境界 |
|---|---|---|
| `/settings/users` | pageSettingsは会社管理者または`users:write` | User Rulesはverified email、正常なcompany claim、同一tenant path、有効な本登録Userを要求するが、同一tenant内のfield・actor制約はUWB-08まで未完了 |
| User仮登録・削除 | UsersManagerから専用Callable。client policyも送信直前に再評価 | serverがactor、tenant、field、email予約、対象予約pointerをtransaction検証 |
| 従業員からUser仮登録・削除 | Employee UserManagerからEmployee連携専用Callable | serverがACTIVE Employee、同社、未紐付け、email/Employee予約をtransaction検証 |
| 有効化・無効化callable | UsersManagerから呼ぶ | `disableUser`/`enableUser`はactor UIDとcompany claimを起点に、transaction内でactor/target User、管理者・有効・本登録状態、自己操作禁止、対象非管理者、対象Auth UID/company claimを検証して`disabled`を更新する |
| 管理者移譲 | UI activatorは`auth.isAdmin`で無効化 | `changeAdminUser`はactor本人が同社の唯一の有効な本登録管理者であること、移譲先が別UIDの有効な本登録非管理者であること、両User/Authのcompany・UID・disabled整合を検証する |

権限設計は試作段階の暫定実装であり、確定仕様として扱わない。

## User / Authデータ契約

SPEC-DEEP-032で、`ChangeAdminUserDialog`は`/settings/users`の`UsersManager`から実到達し、active・非temporary Userを購読して移行元/移行先を選択すること、成功時にdashboardへ戻ることを確認した。移行先のdisabled/temporaryと管理者数はCallableでも再確認する。理由・監査、明示version fieldは未実装である。

- 保存先は`Companies/{companyId}/Users/{userDocId}`。
- User fieldsは`email`（required、CREATE後UI編集不可）、`displayName`（required）、任意`employeeId`、`roles`、`disabled`、`companyId`（required）、`isAdmin`、`isTemporary`（default `true`）、`tagSize`（required）、配置通知受信flag 3種。
- 仮登録Userのdoc IDは通常のFirestore自動ID。本登録時は仮docを削除し、Firebase Auth UIDをdoc IDとする。
- 本登録Userでは、User doc ID = Auth UIDをupdate/delete triggerと有効化処理が前提にする。schema/Rules自体はこの不変条件を強制しない。
- `employeeId`は任意で、Employee連携作成は同社Employee予約により1 Employee対最大1 Userを排他する。従業員画面からEmployee全体を送らず、Employee ID、email、任意rolesだけをCallableへ渡す。
- Employee UserManagerのcomponent単位契約は[Employee components deep review](employee-components-deep-review.md)を参照する。rolesは既知presetを任意選択でき、既定は空配列である。tagSize、通知field、displayNameはEmployee連携作成payloadへ含めない。
- rolesはUser documentに保存される。確認範囲のcustom claimsは`companyId`と`isSuperUser`だけで、roles/isAdminはclaimsへ設定しない。

## 作成・事前登録・本登録フロー

### 一般User

1. 管理画面または従業員詳細が、単独またはEmployee連携の専用作成Callableを呼ぶ。独立したglobal availability preflightは呼ばない。
2. Callableがactorを事前・transaction内で検証し、Authentication email存在も確認したうえで、仮Userとemail予約、必要なEmployee予約を同じtransactionで作成する。この処理は招待メールを送信しないため、実装上は「事前登録」である。
3. 本人のsign-up画面が未認証`checkUserPreRegistration`を呼び、email予約、pointer先仮User、必要なEmployee予約の整合したbooleanだけを受け取る。
4. client Firebase SDKがemail/password Auth accountを作成し、自動sign-inする。
5. clientがverification emailを送り、email確認完了まで本登録を行わない。
6. メール確認後、認証済み`setupUserAccount`がclient dataを受け取らず、確認済みAuth token emailの予約からtemporary Userと会社pathをdirect解決する。
7. Firestore transactionで仮docをAuth UIDの本Userへ変換し、email予約と必要なEmployee予約のpointerもAuth UIDへ更新する。
8. transaction後にAdmin SDKが`companyId`/`isSuperUser:false` claimsを設定し、clientがID tokenを強制refreshする。

Auth account作成、verification mail、Firestore transaction、claims設定は単一transactionではない。後段失敗時、clientはUID付きsupport案内を出すが、自動rollback/reconcileはない。

### 初期管理者

1. clientがemailだけを未認証`checkEmailAvailability`へ渡し、Authとemail予約の重複をadvisory確認してからAuth accountを作り、verification emailを送る。
2. verification待ち画面がメール確認後に`createAdminAccount`を呼ぶ。入力中の会社情報は同じbrowserのsession storageに保持する。
3. Callableがtokenと現在AuthのUID、email、email確認、有効状態、company claim、`isSuperUser`の型・一致を検証する。既存の別User、別company、欠損Company、不正な初期管理者状態は拒否する。
4. 未所属AuthではCompany、`Users/{uid}`、email予約を同一Firestore transactionで作る。Userは`isAdmin=true`、`isTemporary=false`。
5. transaction後に既存claimsを保持して`companyId`とbooleanの`isSuperUser`を設定し、token refresh後にauth storeを再初期化する。

claims設定だけが失敗して同じUIDの有効な初期管理者UserとCompanyが残った場合、再実行はその既存状態を検証して再利用し、新しいCompanyを重複作成しない。Authだけが作成されCompany/Userがない状態も、同じbrowserにpending情報が残る間はメール確認後に再開できる。

## claims・User更新

- User UIはrolesを直接更新する。roles変更時にAuth claimsを更新するtriggerはない。
- 本登録Userの`displayName`または`disabled`変更をFirestore triggerが検出し、`syncUserAuthAccount`へ委譲してAuth `updateUser`へ反映する。それ以外のfieldだけが変わった場合はAuthへアクセスしない。
- `isTemporary=true`ならupdate triggerはAuthへアクセスせず終了する。Auth同期対象の変更で`isTemporary`が`false`以外なら、登録状態を安全側で拒否する。
- Auth更新前に、Userの`companyId`とpathの会社ID、User doc IDとAuth UID、Auth custom claimの`companyId`とpathの会社IDが一致することを検証する。claim欠損または不一致ではAuthを更新しない。
- trigger失敗時はFirestore更新済み/Auth未反映の部分状態になり得る。再同期用callableまたは状態照合処理は確認できない。
- 管理者移譲はactor/target Authを検証した後、同一Firestore transactionでfrom/to Userと`isAdmin=true`一覧を読み、actor本人が唯一の会社管理者であることを再確認して旧Userの`isAdmin=false`、新Userの`isAdmin=true`と`roles=[]`を更新する。claimsは変更しない。

この同期境界は`userAuthCompanyPolicy.js`と`syncUserAuthAccount.js`へ分離した。管理者移譲は`companyAdminTransferPolicy.js`、`transferCompanyAdmin.js`、`mapCompanyAdminTransferError.js`へ分離した。全domain単体テスト212件と専用local Emulator suite 67件で、認証処理の正常系・陰性経路・安全なerror mappingを確認した。

## 無効化・削除

- `disableUser`/`enableUser`は認証済みactorのUIDとcompany claimを使用し、同じ会社pathのactor/target UserをFirestore transaction内で読む。actorが有効な本登録管理者であること、targetが別UIDの本登録非管理者であること、両Userのcompany整合性を検証する。
- 書込み前にtarget Auth accountのUIDとcompany claimも検証し、transaction内でFirestore `disabled`だけを更新する。Auth disabled反映は検証済み`onUserUpdated` triggerに委ねる。
- 自己操作、非管理者・無効actor、別会社、仮登録、管理者target、Auth claim欠損・不一致は更新前に拒否する。内部UID・会社ID・元例外messageをCallable応答へ含めず、安全な`HttpsError`へ変換する。
- User doc削除後、onUserDeleted triggerがdoc IDをUIDとしてAuth accountを削除する。Auth user不存在は成功扱い。
- Auth account削除後、別のAuth delete triggerが当該UIDのFCM tokenを削除する。cleanup失敗はログ後に吸収する。
- User.deleteは`isAdmin=true`を拒否するが、Rulesの直接deleteはこのschema guardを強制しない。
- 退職連携はUser.employeeIdによる境界のみ確認した。Employee側の詳細は本セグメント対象外。

## failure・再試行・冪等性

- AuthとFirestoreはatomicではないが、Firestore内の全User canonical emailとEmployee連携は予約transactionで排他する。同時createのうち1件だけがcommitし、他は`already-exists`となる。
- 初期管理者の事前確認はUX用であり、同時実行競合とAuth-only状態は残り得る。`createAdminAccount`は別の既存所属を拒否し、同じUIDの有効な初期管理者User/Companyだけをclaims失敗後の再実行として再利用する。
- `setupUserAccount`はFirestore移行後のclaims失敗をrollbackしないが、予約pointerがAuth UIDへ更新済みの整合したregistered stateを再実行で検証し、Firestore write 0でclaimsだけを再試行できる。
- `createAdminAccount`はCompany/User transaction後のclaims失敗をrollbackしないが、同じ整合状態からの再実行では既存Company/Userを再利用してclaims設定を再試行する。Company/Userの一部欠損や不整合を自動修復する契約はない。
- disable/enableはUser doc更新成功をcallable成功として返し、Auth反映完了を待たない。
- deleteはFirestore先行、Authはtrigger後続で、失敗時にUser docを復元しない。

## Rules・tenant・security

- User Rulesはpath companyとrequest claim companyの一致だけを確認する。作成時`request.resource.data.companyId`、doc ID/UID、email、roles、isAdmin、isTemporary、employeeId、disabledの整合を検証しない。
- 旧`checkEmailAvailabilityGlobal`は製品caller 0を確認して公開API indexから除外した。初期管理者用`checkEmailAvailability`は未認証でemailだけを受け取り、Authとemail予約を照合する。一般User用`checkUserPreRegistration`も未認証で呼べるが、予約lifecycleが整合する場合のbooleanだけを返す。
- disable/enable callableのactor・tenant・target境界は、2026-08-14の最小segmentでserver検証へ変更した。2026-08-16に会社管理者で認証済みのChromeからlocal Emulatorへ接続し、非管理者の合成test Userを無効化して操作表示が「有効化」へ変わり、再有効化して「無効化」へ戻ることを確認した。
- 管理者移譲callableはcaller UIDとfromの一致、同社の唯一の有効な本登録会社管理者、移譲先User/Authのcompany・UID・登録・管理者・disabled状態をserverで確認する。実Callable/Emulator検証は未実施である。
- UIが隠す操作は認可境界ではない。正式なrole/permission分割は未決定。

## ユーザー確認済みUser不変条件

- 2026-08-11: registered User document ID = Auth UIDを必須とする。
- temporary Userは別state・identifierで明確化し、registered Userへのconversionはserver-onlyとする。
- companyId・role・admin・Auth linkはgeneral client変更不可とする。company adminによるrole変更もtenant・actor・fieldを検証するCallableに限定する。
- 既存のUser document ID/Auth UID mismatchはmigration前にdetect・listする。
- 2026-08-14: 会社管理者は各会社に`User.isAdmin === true`の1人だけとする。会社管理者だけが同社別の本登録非管理者Userを有効化・無効化でき、自分自身には実行できない。自身を無効化する必要がある場合は先に管理者権限を移譲する。

## 矛盾・未使用候補

- 「招待」と呼べるメール送信入口は確認できず、現行は仮User作成と本人による事前登録検索である。
- User schemaのコメントはemail変更をCloud Functions経由とするが、確認範囲にemail変更callableはなく、Rulesは直接更新を許す。
- UsersManagerは`useDocuments`のdocsを受けつつ、別User instanceでも`subscribeDocs()`するがtemplateでは後者のdocsを使用しない。重複購読候補。
- `checkUserPreRegistration`のmetadata公開と複数一致時の先頭採用は解消した。存在有無の応答差、App Check、rate limit、招待tokenは未解決である。

## 将来要対応

- FUT-0080〜FUT-0084を`future-actions.md`へ登録した。

## 要確認事項

- CONF-0066〜CONF-0069を`pending-confirmations.md`へ登録した。

## 未確認範囲

- Dev・remoteのFirebase Auth/Firestore実data、実メール到達、実action link、deploy後のtoken refresh。
- 実Cloud Functions triggerからのAuth同期、既存Auth accountのcompany claim充足状況、同期失敗後の再試行・手動reconcile。
- `disableUser`/`enableUser`の後続Auth同期trigger完了とAuth disabled値、既存Userの`isAdmin`・`disabled`・`isTemporary`・company claim充足状況。ChromeからのCallable起動とUser画面への状態反映はlocal Emulatorで確認済みである。
- Employee退職処理本文、login/middleware全体、super-user運用、admin SDK保守CLI。
- Functions retry設定、監視・手動reconcile運用、既存重複/orphanデータ。

## Users UI境界の追加確認（SPEC-DEEP-035）

Managerは親から受けた`docs`を表示する一方、別のUser instanceで`subscribeDocs()`を開始して得た配列を使わないため、冗長なlive listenerとなっている。検索欄はlocal値を変えるだけでfilterも`update:search` emitも行わず、`showCreate=false`でもtoolbar plusを表示する。empty時のcreate handlerは未定義の`toCreate`を参照し、標準create入口として成立しない。

有効化・無効化は確認・理由・監査・single-flightなしで既存callableを呼ぶ。employeeId付きUserの削除はUI callbackでdisable指定されるが、Air managerはdisable error後もdelete callbackを続行し、User modelはadminだけを拒否するため、公開/exposed submit経路ではUser削除と後続Auth削除triggerへ到達し得る。User Cardの`loading` propとrole optionsは未使用で、selectionはaccessible name/keyboard contractのないicon操作である。通知設定はpermission requestとtoken登録にlocal loading・retry・error表示がなく、denied時の回復案内もない。

## Auth application flow追加確認（SPEC-DEEP-040）

- `initializeSession`はclaimをstoreへ設定後、process-global FireModel prefixを切替え、User/Companyをfetchしてからsubscribeする。User/Company/FCMのいずれかで失敗しても`setUser`がerrorを吸収し、finallyで`isReady=true`とするため、「初期化処理終了」と「利用可能状態」は一致しない。
- companyId欠損時は認証自体を維持し、User/Companyをinitializeしてprefixを`Companies/unknown`へ設定する。repair・再取得・専用状態表示はこのactionにない。
- signOutはFirebase sign-out後にstoreの`uid===null && isReady`待機へ委譲する。clearSession後段のmodel cleanup失敗も`setUser`が吸収する既知境界で、FCM token削除は行わない。
