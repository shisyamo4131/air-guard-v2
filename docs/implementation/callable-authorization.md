# Callable認可境界（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-049
- 最終確認日: 2026-08-11
- 根拠ファイル: `functions/index.js`、`functions/modules/auth-v2.js`、`composables/auth/useAuthFunctions.js`、`composables/useCreateAdminUser.js`、`composables/useCreateNormalUser.js`、`pages/auth/sign-up*.vue`、`pages/settings/users.vue`、`components/Users/Manager/index.vue`、`components/organisms/ChangeAdminUserDialog/index.vue`、`utils/pageSettings.js`、`firestore.rules`
- 調査境界: entryからexportされるauth-v2 callable 8件の入口guard、対象解決、直接UI入口、Users/Companies Rulesだけを確認した。runtime、Firebase CLI、実data、他callable本文は未確認。

## Callable別認証・対象解決

| Callable | authentication / actor | tenant・target解決 | input / field境界 | 主な直接UI |
| --- | --- | --- | --- | --- |
| `checkEmailAvailabilityGlobal` | 未認証可。App Check、role、rate limitなし | `collectionGroup("Users")`を全tenant検索 | email必須。存在時`already-exists`、不在時availableだけを返す | User/Employeeの仮User作成前 |
| `checkEmailAvailability` | 未認証可。caller指定`isAdmin`を信頼して分岐 | Auth全体とUsers collection group。一般登録時は全tenantのtemporary Userを検索 | emailとboolean `isAdmin`だけを検証 | `/auth/sign-up-admin`、`/auth/sign-up` |
| `createAdminAccount` | 認証必須のみ。admin/super-user判定、既存company claim、App Checkなし | caller UID/emailで新Companyと`Users/{uid}`を作成 | companyName/companyNameKana/displayName必須。caller自身を`isAdmin=true`、claimを新companyIdへ設定 | 公開signup-adminでAuth作成直後 |
| `checkUserPreRegistration` | 未認証可。App Check、rate limitなし | emailで全tenantのtemporary Userを検索し先頭1件を採用 | email必須。存在時companyId/displayName/roles/tempUserIdを返す | `/auth/sign-up` |
| `setupUserAccount` | 認証必須。caller UID/token emailを利用 | caller入力companyId/tempUserIdのpathを読み、temporary User emailとtoken emailを照合 | companyId/tempUserId必須。temporary document全体を本Userへ複製し、doc IDをcaller UIDへ変更 | 一般signupでAuth作成直後 |
| `disableUser` | 認証必須のみ。caller admin/super-user/company検証なし | 入力UIDからAuth Userを取得し、targetのcustom claim companyIdでUser pathを決定 | uid必須。User documentの`disabled=true`だけを更新 | admin route `/settings/users`のmanager |
| `enableUser` | 認証必須のみ。同上 | disableと同じ | uid必須。`disabled=false`だけを更新 | 同上 |
| `changeAdminUser` | 認証とcaller token companyId必須。caller自身のadmin/super-user判定なし | from/toはcaller token company配下だけをfetch | from/to必須・相違。from.isAdmin=true、to.isAdmin=falseを確認し、2 UserのisAdminとto.rolesをtransaction更新 | admin route内の変更dialog |

`functions/index.js`は`auth-v2.js`をstar exportするため、8件はいずれもdeployment candidateである。列挙したv2 callableに`enforceAppCheck`や共通guardは指定されない。

## caller・target・tenant境界

- `disableUser`/`enableUser`はcallerのcompanyIdを使用しない。対象Auth Userのclaimからpathを決めるため、認証済み一般Userが知っている任意UIDを渡せば、同社・他社を問わず対象User documentのdisabledを変更し得る。targetがdisabledかtemporaryか、caller自身かも制限しない。
- `changeAdminUser`は対象をcaller claimのcompany pathへ限定するためcross-tenant targetはnot-foundになる。ただしcaller adminを検証しないため、同社一般Userでも既存adminから任意のactive Userへadmin fieldを移せる入口である。UIはdisabled/temporaryを候補から外すがserverはtoのdisabled/temporaryを検証しない。
- `setupUserAccount`は入力companyIdをcaller claimと比較しないが、temporary Userのemailとcaller token emailを照合する。これは招待先本人のtenant onboardingを成立させる直接guardであり、一般的な「caller company一致」とは異なる。
- `createAdminAccount`は新規signup用途だが、任意の認証済みcallerが再度呼べる。既存User/company/claimの有無、email verification、disabled、1 UID 1 companyを検証しない。Firestore transaction後のcustom claim設定はtransaction外である。
- server入口はcaller Auth Userのdisabled状態を独自検査しない。Firebaseが既発行tokenをどの時点で拒否するかはruntime未確認であり、無効化直後の既存sessionをcodeだけで拒否する契約は確認できない。

## 匿名signup callableと情報境界

- email availability 2件は成功/存在errorによりemail登録有無を判別可能である。
- `checkUserPreRegistration`は一致時にcompanyId、displayName、roles、temporary document IDを未認証callerへ返す。signup UIが次処理へ使うのはcompanyId/tempUserId/displayNameであり、rolesは直接画面表示に使用しない。
- 同一emailのtemporary Userが複数tenantに存在する場合、query orderを指定せず先頭documentだけを採用する。`checkEmailAvailability`一般分岐も「1件以上」を確認するだけで、後続が選ぶtemporary Userとの一意対応を保証しない。
- App Check、IP/UID/email単位rate limit、challenge、招待token、応答の一定化は入口にない。

## UI guardとserver enforcementの差

- `/settings/users`と管理者変更dialogはpageSettingsの`admin` route内にあり、UI上はadmin向けである。しかしroute/navigation判定はclient制御であり、callableは`isAdmin`を検証しない。
- Users managerのcreate/update/deleteはCallableではなくFirestore client writeも使用する。Users Rulesは同社認証Userまたはsuper-userへ全field read/writeを許し、client admin UIを迂回できる。
- signup pagesはauth layoutから匿名checkを呼び、Auth account作成後にcreate/setup callableを呼ぶ。この順序に対応するserver guardはあるが、失敗時のAuth/Firestore/claims間rollbackはない。

## Firestore Rulesとの境界

- `Companies/{companyId}`と`Companies/{companyId}/Users/{userId}`は、claim companyIdがpathと一致する全認証Userまたはsuper-userへread/writeを許す。role、caller UID、allowed fields、temporary conversion、admin transfer、disabled transitionを検証しない。
- CallableはAdmin SDK経由でRulesを迂回するため、上記RulesがCallableの不足を補うことはない。逆にCallableを修正してもdirect Firestore writeを同時に制限しなければUser/companyId/role/admin fieldの強制境界にならない。

## 失敗・部分状態

- `createAdminAccount`: Company/User transaction成功後にclaim設定が失敗するとCompanyとadmin Userは残る。
- `setupUserAccount`: temporary削除と本User作成のtransaction成功後にclaim設定が失敗すると本Userは残るがclaimがない。
- `disableUser`/`enableUser`: Firestore disabledだけを更新し、Auth disabled反映は別`onUserUpdated` triggerに依存する。
- `changeAdminUser`: 2 User documentはtransaction更新するが、Auth claim更新処理はなく、isAdminがUser document由来という現行client契約に依存する。

## 確認済み整合・矛盾

- registered User doc IDをAuth UIDとする承認済み方針にはcreate/setupの作成先が一致する。
- temporary Userからregistered Userへのconversionをserver-onlyにする承認済み方針とは、Rulesが一般同社Userへ直接writeを許すため一致しない。
- User role/admin/company/Auth linkの変更をtenant・actor・field検証Callableへ限定する承認済み方針とは、disable/enable/changeAdminのactor guardおよびUsers Rulesが一致しない。
- 既存`cloud-functions-catalog.md`の入口一覧と矛盾せず、今回target解決・UI・Rulesまで根拠を追加した。

## 将来要対応

- FUT-0151: auth-v2各入口へactor/tenant/target/App Check/abuse guardを実装し、Users Rulesと一体で強制する。
- FUT-0098、FUT-0099、FUT-0100: User/Authの作成・更新・削除におけるserver-only field、部分失敗、retry/idempotencyを整備する。
- FUT-0133: client admin表示とserver権限の意味を統一する。

## 要確認事項

- CONF-0129へ、今回確認した8 callableのactor/tenant/匿名応答境界を集約した。新規CONFは追加していない。
- role/permission全体の正式設計はCONF-0111、反映・失効はCONF-0113を参照する。

## code evidenceで質問不要となった事項

- `setupUserAccount`のcross-tenant onboardingが単純なcompany claim一致では成立しない理由は、招待先temporary User emailと新規Auth token emailの一致を直接検証する実装で説明できる。これは実装事実であり、正式な招待security policyの承認を意味しない。
- `changeAdminUser`のcross-tenant対象はcaller claim company path内に限定されるため、別tenant documentを直接選ぶ経路はcode上not-foundとなる。ただしcaller admin不足は別の未解決riskである。
- disable/enable対象companyはrequest dataではなく対象Auth Userのclaimから決まる。したがって「入力companyId改ざん」の質問は不要だが、任意UIDによるcross-tenant操作riskは解消しない。

## 未確認範囲

- Emulator/runtimeでの拒否code、App Check/IAM platform override、token失効、disabled Userの既存session、email enumeration耐性、concurrent signup、重複temporary User実data。
- User/Auth trigger本文、Employee連携、削除cleanup、全signup error recovery、関連schema/adaptersの内部validation。
- 正式actor matrix、rate limit値、audit retentionはユーザー判断待ちである。
