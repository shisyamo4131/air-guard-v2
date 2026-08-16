# Callable認可境界（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-049
- 最終確認日: 2026-08-16
- 根拠ファイル: `functions/index.js`、`functions/apis/*.js`、`functions/triggers/auth.js`、`functions/modules/auth/*.js`、`test/domain/*user*.test.mjs`、`test/domain/*company-admin*.test.mjs`、`test/domain/transfer-company-admin.test.mjs`、`test/local/codex-local-harness.test.mjs`、`composables/auth/useAuthFunctions.js`、`composables/useCreateAdminUser.js`、`composables/useCreateNormalUser.js`、`pages/auth/sign-up*.vue`、`pages/settings/users.vue`、`components/Users/Manager/index.vue`、`components/organisms/ChangeAdminUserDialog/index.vue`、`utils/pageSettings.js`、`firestore.rules`
- 調査境界: entryから`functions/apis/index.js`経由でexportされるCallable 10件の入口guard、対象解決、直接UI入口、Users/Companies Rulesを確認した。全domain単体test 228件と、Auth・Firestore・Storage EmulatorおよびCallable handlerの専用local suite 69件を実行した。ChromeからFunctions Emulatorへのtransportは再構築2件、User有効化・無効化、初期管理者signupの5系統を確認した。残るCallable transport、Dev・remote、実dataは未確認。

## Callable別認証・対象解決

| Callable | authentication / actor | tenant・target解決 | input / field境界 | 主な直接UI |
| --- | --- | --- | --- | --- |
| `checkEmailAvailabilityGlobal` | 認証、verified email、正常な会社claim、現在の有効なAuth User、同社の有効な本登録会社管理者を必須化。App Check、rate limitなし | actorのtoken/Auth/User companyを照合後、`collectionGroup("Users")`を全tenant検索 | email string必須。存在時`already-exists`、不在時availableだけを返す。`isSuperUser`だけでは許可しない | User/Employeeの仮User作成前 |
| `checkEmailAvailability` | 未認証可。App Check、rate limitなし | Auth全体と全tenantのUsers collection group | email string必須。AuthまたはUserが存在すれば`already-exists`、不在時availableだけを返す。追加の`isAdmin`入力は無視する | `/auth/sign-up-admin` |
| `createAdminAccount` | 認証、token/current AuthのUID・email・verified・disabled・company claim・`isSuperUser`整合を必須化。App Checkなし | 未所属callerは新Companyと`Users/{uid}`を作成。同じUIDの有効な既存初期管理者状態だけ再利用 | companyName/companyNameKana/displayName必須。別User・別company・不整合状態を拒否し、既存claimsを保持してcompanyIdを設定 | 公開signup-adminのメール確認後 |
| `checkUserPreRegistration` | 未認証可。App Check、rate limitなし | emailで全tenantのtemporary Userを最大2件検索 | email string必須。0件はfalse、1件はtrueだけを返し、複数一致は`failed-precondition`で拒否 | `/auth/sign-up` |
| `setupUserAccount` | 認証必須。caller UID/token emailを利用 | 確認済みtoken emailから全tenantのtemporary Userをserver側で一意解決 | client dataを受け取らず、temporary documentを本Userへ変換してdoc IDをcaller UIDへ変更 | メール確認後の一般signup |
| `disableUser` | 共通gateでtoken/current AuthのUID・email・verified・company・`isSuperUser`・有効状態を照合し、有効な本登録会社管理者を必須化 | 確認済みcaller company配下のactor/target Userとtarget Authをtransaction内で検証 | uid必須。自己操作、管理者・仮登録target、会社・Auth UID/claim不一致を拒否し、`disabled=true`へ更新 | admin route `/settings/users`のmanager |
| `enableUser` | disableと同じ | disableと同じ | 同じ境界で`disabled=false`へ更新 | 同上 |
| `changeAdminUser` | 認証、caller UID/company claim、caller自身が唯一の有効な本登録会社管理者であることを必須化 | caller company配下のfrom/to User、`isAdmin=true`一覧、actor/target Auth UID・company claim・disabledを検証 | from/to必須・相違、from=actor、管理者1人、active registered targetを要求し、2 UserのisAdminとto.rolesをtransaction更新 | admin route内の変更dialog |

`functions/index.js`は`apis/index.js`をstar exportし、10件の公開Callableをそこへ集約する。`disableUser`と`enableUser`は同じAPI fileで非公開request handlerを共有し、共有`authorizeCompanyRebuild`もAPI indexからexportしない。Authentication削除triggerは`functions/triggers/auth.js`から別にexportする。列挙したCallableに`enforceAppCheck`や共通rate limitは指定されない。

## caller・target・tenant境界

- 会社所属済みの保護対象Callableは、共通`resolveCallableAuthIdentity`でtoken/current AuthのUID、email、verified、company claim、`isSuperUser`のboolean型と値、disabled状態をAPI固有検査より先に照合する。匿名事前確認は対象外で、`createAdminAccount`と`setupUserAccount`は所属確立前のbootstrap専用検査を使用する。現時点でこの共通gateへ移行済みなのは`disableUser`と`enableUser`である。
- `disableUser`/`enableUser`は共通gateで確認したcaller UIDとcompanyを起点に、同社actor/target Userをtransaction内で読み、有効な本登録会社管理者、別UIDの本登録非管理者target、target Auth UID/company claimを更新前に検証する。Auth disabledの反映はUser update triggerへ委ねる。
- `checkEmailAvailabilityGlobal`はtokenのverified email・company claim、現在Auth UserのemailVerified・disabled・company claim、同社Userの本登録・disabled・`isAdmin`を照合する。会社管理者だけが全tenantの重複有無を確認でき、super-user claim単独では許可しない。
- `checkEmailAvailability`は初期会社管理者signupのUX事前確認に限定し、clientからemailだけを受け取る。Authと全tenantの全User状態を確認し、caller指定の管理者・一般User区分ではpolicyを選択しない。一般User signupは`checkUserPreRegistration`とAuth作成時のemail一意性を使用する。
- `changeAdminUser`はcaller UIDと`from`の一致、同社の`isAdmin=true` Userがcaller 1人だけであること、from/toの本登録・有効・company・admin状態、actor/target Auth UID・company claim・disabledを更新前に検証する。旧adminのrolesは空のまま、新adminのrolesは空配列へ初期化する。
- `setupUserAccount`はclient指定companyId/tempUserIdを受け取らず、確認済みcaller token emailから一意のtemporary Userと会社pathをserver側で解決する。これは招待先本人のtenant onboardingを成立させるbootstrap guardであり、通常の「caller company一致」とは異なる。
- `createAdminAccount`はメール確認済みで有効な未所属Authだけに新規Company作成を許可する。別の既存User/company/claim、不正な`isSuperUser`型、token/current Auth不一致を拒否する。Firestore transaction後のcustom claim設定はtransaction外だが、同じUIDの有効な初期管理者状態は再実行時に検証して再利用する。
- `changeAdminUser`はactor AuthとUser双方のdisabledを個別に検証する。有効化・無効化Callableは共通gateでactor Auth、固有policyでactor Userのdisabledを検証する。Firebaseが既発行tokenをどの時点で拒否するかはruntime未確認であるが、共通gate適用済みAPIは現在Auth不整合を拒否する。

## 匿名signup callableと情報境界

- 未認証の`checkEmailAvailability`は成功/存在errorによりemail登録有無を判別可能である。`checkEmailAvailabilityGlobal`も全tenantの存在有無を返すが、実行者を有効な会社管理者へ限定した。
- `checkUserPreRegistration`は一致時にも`isPreRegistered: true`だけを返し、companyId、displayName、roles、temporary document IDを未認証callerへ公開しない。signup UIも確認済みbooleanだけを保持し、汎用表示を使用する。
- 同一emailのtemporary Userが複数tenantに存在する場合は`failed-precondition`で拒否し、先頭documentを採用しない。本登録は`setupUserAccount`が一意性を再検証する。
- App Check、IP/UID/email単位rate limit、challenge、招待token、応答の一定化は入口にない。

## UI guardとserver enforcementの差

- `/settings/users`と管理者変更dialogはpageSettingsの`admin` route内にあり、UI上もadmin向けである。有効化・無効化と管理者移譲Callableはserverでもactorの`isAdmin`を検証するが、他のUser直接writeは引き続きRules境界に依存する。
- Users managerのcreate/update/deleteはCallableではなくFirestore client writeも使用する。Users Rulesは同社認証Userまたはsuper-userへ全field read/writeを許し、client admin UIを迂回できる。
- signup pagesはauth layoutから匿名checkを呼び、一般UserはAuth account作成・メール確認後にsetup callableを呼ぶ。この順序に対応するserver guardはあるが、失敗時のAuth/Firestore/claims間rollbackはない。

## Firestore Rulesとの境界

- `Companies/{companyId}`と`Companies/{companyId}/Users/{userId}`は、claim companyIdがpathと一致する全認証Userまたはsuper-userへread/writeを許す。role、caller UID、allowed fields、temporary conversion、admin transfer、disabled transitionを検証しない。
- CallableはAdmin SDK経由でRulesを迂回するため、上記RulesがCallableの不足を補うことはない。逆にCallableを修正してもdirect Firestore writeを同時に制限しなければUser/companyId/role/admin fieldの強制境界にならない。

## 失敗・部分状態

- `createAdminAccount`: Company/User transaction成功後にclaim設定が失敗するとCompanyとadmin Userは残るが、同じ整合状態から再実行してclaim設定を再試行できる。不整合な部分状態の自動修復は行わない。
- `checkEmailAvailability`の事前確認とAuth/User作成はatomicではなく、同時signupでは確認後に競合し得る。Auth email一意性はAuth作成時に最終検出するが、後段失敗ではAuth-only状態が残り得る。
- `setupUserAccount`: temporary削除と本User作成のtransaction成功後にclaim設定が失敗すると本Userは残るがclaimがない。
- `disableUser`/`enableUser`: Firestore disabledだけを更新し、Auth disabled反映は別`onUserUpdated` triggerに依存する。
- `changeAdminUser`: 2 User documentはtransaction更新するが、Auth claim更新処理はなく、isAdminがUser document由来という現行client契約に依存する。

## 確認済み整合・矛盾

- registered User doc IDをAuth UIDとする承認済み方針にはcreate/setupの作成先が一致する。
- temporary Userからregistered Userへのconversionをserver-onlyにする承認済み方針とは、Rulesが一般同社Userへ直接writeを許すため一致しない。
- User role/admin/company/Auth linkの変更をtenant・actor・field検証Callableへ限定する承認済み方針に対し、disable/enable/changeAdminのCallable actor guardは整合したが、Users Rulesの同社一般User直接write境界は一致しない。
- 既存`cloud-functions-catalog.md`の入口一覧と矛盾せず、今回target解決・UI・Rulesまで根拠を追加した。

## 将来要対応

- FUT-0151: disable/enable/changeAdmin、再構築、global email確認のactor・tenant・target guardは実装済み。残るauth-v2/API入口、App Check、abuse guard、Users Rulesを一体で強制する。
- FUT-0098、FUT-0099、FUT-0100: User/Authの作成・更新・削除におけるserver-only field、部分失敗、retry/idempotencyを整備する。
- FUT-0133: client admin表示とserver権限の意味を統一する。

## 要確認事項

- CONF-0129へ、今回確認した8 callableのactor/tenant/匿名応答境界を集約した。新規CONFは追加していない。
- role/permission全体の正式設計はCONF-0111、反映・失効はCONF-0113を参照する。

## code evidenceで質問不要となった事項

- `setupUserAccount`のcross-tenant onboardingが単純なcompany claim一致では成立しない理由は、招待先temporary User emailと新規Auth token emailの一致を直接検証する実装で説明できる。これは実装事実であり、正式な招待security policyの承認を意味しない。
- `changeAdminUser`のcross-tenant対象はcaller claim company path内に限定され、caller本人が唯一の会社管理者であることもserverで検証する。別tenant、一般User、別人をfromにした移譲は更新前に拒否される。
- disable/enable対象companyはrequest dataやtarget claimではなくcaller company claimから決まり、同社User/Auth整合性を更新前に検証する。任意UIDによるcross-tenant状態変更経路はこのCallableでは解消した。

## 未確認範囲

- `changeAdminUser`、一般User signup Callable、Auth削除event transport、App Check/IAM platform override、token失効、disabled Userの既存session、email enumeration耐性、concurrent signup、重複temporary User実data、Dev・remote・実data。初期管理者signupはChromeとlocal Emulatorで確認済みである。
- User/Auth trigger本文、Employee連携、削除cleanup、全signup error recovery、関連schema/adaptersの内部validation。
- 正式actor matrix、rate limit値、audit retentionはユーザー判断待ちである。

## Chrome Callable transport確認（2026-08-16）

- 会社管理者かつスーパーユーザーで認証済みのChromeとlocal Emulatorを使用し、`rebuildAllHistories`と`rebuildSecurityReportIndexes`の成功応答を画面で確認した。後者の処理件数・index件数は0件だった。
- 非管理者の合成test Userを対象に`disableUser`を実行し、画面上の操作が「無効化」から「有効化」へ変わることを確認した。続けて`enableUser`を実行し、「無効化」へ戻ることを確認した。
- dashboardへ戻った後も認証状態を維持し、Chrome console errorは0件だった。既存の子menu role警告と、通常画面遷移に伴うFCM token登録logは残った。
- 利用者のEmulatorはexport-on-exitなしで起動されており、この確認では停止・exportを行っていない。4 Callable以外のtransport、Auth削除event、Dev・remote・deploy・実dataは確認していない。
