# Callable認可境界（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-049
- 最終確認日: 2026-08-21
- 根拠ファイル: `functions/index.js`、`functions/apis/*.js`、`functions/triggers/auth.js`、`functions/modules/auth/*.js`、`test/domain/*user*.test.mjs`、`test/domain/*company-admin*.test.mjs`、`test/domain/transfer-company-admin.test.mjs`、`test/local/codex-local-harness.test.mjs`、`composables/auth/useAuthFunctions.js`、`composables/useCreateAdminUser.js`、`composables/useCreateNormalUser.js`、`pages/auth/sign-up*.vue`、`pages/settings/users.vue`、`components/Users/Manager/index.vue`、`components/organisms/ChangeAdminUserDialog/index.vue`、`utils/pageSettings.js`、`firestore.rules`
- 調査境界: entryから`functions/apis/index.js`経由でexportされるCallable 12件の入口guard、対象解決、直接UI入口、Users/Companies Rulesを確認した。UWB-04はdomain単体test、SFC compile、専用Emulator、単独／Employee連携の正規UI作成・削除を確認した。Dev・remote・実dataは未確認である。

## Callable別認証・対象解決

| Callable | authentication / actor | tenant・target解決 | input / field境界 | 主な直接UI |
| --- | --- | --- | --- | --- |
| `checkEmailAvailability` | 未認証可。App Check、rate limitなし | Auth全体とemail予約 | email string必須。Authまたは予約が存在すれば`already-exists`、不在時availableだけを返す。予約を作らないadvisory | `/auth/sign-up-admin` |
| `createAdminAccount` | 認証、token/current AuthのUID・email・verified・disabled・company claim・`isSuperUser`整合を必須化。App Checkなし | 未所属callerは新Company、`Users/{uid}`、email予約を同じtransactionで作成。整合した予約・Company・Userだけ再利用 | companyName/companyNameKana/displayName必須。別User・別company・不整合状態を拒否し、既存claimsを保持してcompanyIdを設定 | 公開signup-adminのメール確認後 |
| `checkUserPreRegistration` | 未認証可。App Check、rate limitなし | canonical email予約からpointer先Userと必要なEmployee予約をdirect解決 | email string必須。予約lifecycleが整合する場合だけbooleanを返す | `/auth/sign-up` |
| `setupUserAccount` | 認証必須。caller UID/token emailを利用 | 確認済みtoken emailの予約からtemporary Userをdirect解決 | client dataを受け取らず、本User変換と予約pointer更新を同じtransactionで行う | メール確認後の一般signup |
| `createStandaloneTemporaryUser` | 共通identity gate後、同社の有効な本登録会社管理者またはstrict preset由来`users:write` | actor company配下へUserを作り、root email予約で全tenant一意性を確定 | standalone exact allowlist。company/admin/temporary/disabledはserver固定 | `/settings/users` |
| `createEmployeeLinkedTemporaryUser` | standaloneと同じ | actor company配下のACTIVE Employee、Employee予約、既存linkをtransaction検証 | `{employeeId,email,roles?}`だけ。displayNameはEmployee由来 | Employee詳細 |
| `deleteTemporaryUser` | standaloneと同じ | actor company配下targetと対応するemail/Employee予約pointerをtransaction検証 | `{targetUserId}`だけ。仮登録Userと予約だけを削除しAuth不変 | User一覧、Employee詳細 |
| `disableUser` | 共通gateでtoken/current AuthのUID・email・verified・company・`isSuperUser`・有効状態を照合し、有効な本登録会社管理者を必須化 | 確認済みcaller company配下のactor/target Userとtarget Authをtransaction内で検証 | uid必須。自己操作、管理者・仮登録target、会社・Auth UID/claim不一致を拒否し、`disabled=true`へ更新 | admin route `/settings/users`のmanager |
| `enableUser` | disableと同じ | disableと同じ | 同じ境界で`disabled=false`へ更新 | 同上 |
| `changeAdminUser` | 共通gateでtoken/current AuthのUID・email・verified・company・`isSuperUser`・有効状態を照合し、caller自身が唯一の有効な本登録会社管理者であることを必須化 | 確認済みcaller company配下のfrom/to User、`isAdmin=true`一覧、target Auth UID・company claim・disabledを検証 | from/to必須・相違、from=actor、管理者1人、active registered targetを要求し、2 UserのisAdminとto.rolesをtransaction更新 | admin route内の変更dialog |

`functions/index.js`は`apis/index.js`をstar exportし、12件の公開Callableをそこへ集約する。旧`checkEmailAvailabilityGlobal` sourceはrollback用に残るがAPI indexから非公開である。`disableUser`と`enableUser`は同じAPI fileで非公開request handlerを共有し、共有`authorizeCompanyRebuild`もAPI indexからexportしない。Authentication削除triggerは`functions/triggers/auth.js`から別にexportする。列挙したCallableに`enforceAppCheck`や共通rate limitは指定されない。

## caller・target・tenant境界

- 会社所属済みの保護対象Callable 8件は、共通`resolveCallableAuthIdentity`でtoken/current AuthのUID、email、verified、company claim、`isSuperUser`のboolean型と値、disabled状態をAPI固有検査より先に照合する。仮登録作成2件、仮登録削除、`disableUser`、`enableUser`、`changeAdminUser`、再構築2件が対象である。匿名事前確認2件は対象外で、`createAdminAccount`と`setupUserAccount`は所属確立前のbootstrap専用検査を使用する。
- `disableUser`/`enableUser`は共通gateで確認したcaller UIDとcompanyを起点に、同社actor/target Userをtransaction内で読み、有効な本登録会社管理者、別UIDの本登録非管理者target、target Auth UID/company claimを更新前に検証する。Auth disabledの反映はUser update triggerへ委ねる。
- 仮登録作成2件は共通gateの確認済みidentityとtransaction内actor Userを照合し、会社管理者またはstrict preset由来`users:write`だけを許可する。emailとEmployee一意性は予約文書で排他する。
- `checkEmailAvailability`は初期会社管理者signupのUX事前確認に限定し、clientからemailだけを受け取る。Authとemail予約を確認し、caller指定の管理者・一般User区分ではpolicyを選択しない。一般User signupは`checkUserPreRegistration`とAuth作成時のemail一意性を使用する。
- `changeAdminUser`は共通gateでactor Authを確認後、caller UIDと`from`の一致、同社の`isAdmin=true` Userがcaller 1人だけであること、from/toの本登録・有効・company・admin状態、target Auth UID・company claim・disabledを更新前に検証する。旧adminのrolesは空のまま、新adminのrolesは空配列へ初期化する。
- `setupUserAccount`はclient指定companyId/tempUserIdを受け取らず、確認済みcaller token emailから一意のtemporary Userと会社pathをserver側で解決する。これは招待先本人のtenant onboardingを成立させるbootstrap guardであり、通常の「caller company一致」とは異なる。
- `createAdminAccount`はメール確認済みで有効な未所属Authだけに新規Company作成を許可する。別の既存User/company/claim、不正な`isSuperUser`型、token/current Auth不一致を拒否する。Firestore transaction後のcustom claim設定はtransaction外だが、同じUIDの有効な初期管理者状態は再実行時に検証して再利用する。
- 会社所属済み8 Callableは共通gateでactor Auth、各固有policyで必要なactor User状態を検証する。Firebaseが既発行tokenをどの時点で拒否するかはruntime未確認であるが、これらのAPIは現在Auth不整合を拒否する。

## 匿名signup callableと情報境界

- 未認証の`checkEmailAvailability`は成功/存在errorによりemail登録有無を判別可能である。旧`checkEmailAvailabilityGlobal`はpublic exportから除外した。
- `checkUserPreRegistration`は一致時にも`isPreRegistered: true`だけを返し、companyId、displayName、roles、temporary document IDを未認証callerへ公開しない。signup UIも確認済みbooleanだけを保持し、汎用表示を使用する。
- 同一emailの複数Userはmigration blockerであり、runtimeはemail予約pointerだけを解決する。本登録は`setupUserAccount`が予約とUserの整合性を再検証する。
- App Check、IP/UID/email単位rate limit、challenge、招待token、応答の一定化は入口にない。

## UI guardとserver enforcementの差

- `/settings/users`は会社管理者または`users:write`で到達し、作成はclient pure policy/controllerで送信直前にもstrict presetを再評価する。有効化・無効化と管理者移譲は引き続き会社管理者だけである。
- Users managerの仮登録create/deleteはCallableへ移行したが、通常update等はFirestore client writeを使用する。Users Rulesは同社認証Userへ全field read/writeを許すため、UWB-08までclient UIを迂回できる。
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

- FUT-0151: disable/enable/changeAdmin、再構築、global email確認の共通Auth identity、actor・tenant・target guardは実装済み。App Check、abuse guard、Users Rulesを一体で強制する。
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
- User/Auth trigger本文、Employee Self Access、本登録User削除cleanup、全signup error recovery、関連schema/adaptersの内部validation。Employee連携仮登録Userの作成・削除cleanupはCodex専用UIとbackend assertionで確認済みである。
- 正式actor matrix、rate limit値、audit retentionはユーザー判断待ちである。

## Chrome Callable transport確認（2026-08-16）

- 会社管理者かつスーパーユーザーで認証済みのChromeとlocal Emulatorを使用し、`rebuildAllHistories`と`rebuildSecurityReportIndexes`の成功応答を画面で確認した。後者の処理件数・index件数は0件だった。
- 非管理者の合成test Userを対象に`disableUser`を実行し、画面上の操作が「無効化」から「有効化」へ変わることを確認した。続けて`enableUser`を実行し、「無効化」へ戻ることを確認した。
- dashboardへ戻った後も認証状態を維持し、Chrome console errorは0件だった。既存の子menu role警告と、通常画面遷移に伴うFCM token登録logは残った。
- 利用者のEmulatorはexport-on-exitなしで起動されており、この確認では停止・exportを行っていない。4 Callable以外のtransport、Auth削除event、Dev・remote・deploy・実dataは確認していない。
