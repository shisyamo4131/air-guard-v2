# ページアクセス設定の実装記録

- 状態: Local実装済み・最終検証中
- 対象セグメント: SPEC-SEG-002 — ページアクセス設定
- 最終確認日: 2026-09-08
- 根拠ファイル: `utils/auth/pageAccessContext.js`、`utils/auth/policies/pageAccessPolicy.js`、`utils/pageSettings.js`、`middleware/auth.global.js`、`components/AppNavigationDrawer.vue`、`composables/application/auth/useCurrentPageAccessGuard.js`、`composables/application/auth/useAuthActions.js`、`plugins/02.firebase.auth.js`

## 現在の実装

### 一つの判定情報とpolicy

- `buildPageAccessContext`はAuthentication UID、company claim、メール確認、User documentのUID・company一致、有効・本登録状態、会社管理者field、roles、super-user／developer claimを一つの判定情報へ正規化する。
- 業務pageは有効な本登録actorだけを許可する。User documentのrolesは全要素が空でないtrim済み文字列であることを要求し、`admin`、`super-user`、`developer`、`*`を保存roleとして認めない。不正値を含む場合はactor全体をfail closedとする。
- 会社管理者はUser documentの`isAdmin`、super-user／developerは型が正しいboolean claimだけから導出する。通常のpreset roleと`sites:read`等の直接permission、writeからreadへの既存展開は維持する。
- Employee閲覧は共通Employee actor contract、User管理とlifecycleは各strict policyを使用し、一般permission判定へ緩和しない。super-userの会社設定例外も既存policyを維持する。
- `getNavigationItems`、global route middleware、表示中pageのwatcherは同じaccess contextとpolicy evaluatorを使用する。pathなしgroupは、許可された表示対象の子itemがある場合だけ表示する。

### 遷移とfail-closed

1. maintenance中は`/maintenance`を優先する。
2. auth準備完了後、未認証Userは明示的な`PUBLIC` pageだけを利用できる。
3. 認証sessionのtoken、User、Company初期化に失敗した場合は旧購読・model・tenant prefix・claimを破棄し、Firebase Authentication自体はsign-outせずdashboardへ戻す。
4. メール未確認またはcompany claim未確立の場合は`/unconfirmedEmail`を使用する。
5. それ以外は登録済みpage policyを評価し、未登録routeまたは権限外pageはdashboardへ置換遷移する。
6. 表示中にrole、disabled、temporary、tenant、管理者field、special claimが変わった場合も再評価し、権限を失ったpageからdashboardへ戻す。遷移失敗時の再試行は有限回とし、dashboard自身ではloopしない。

`getPageConfig`は完全一致と明示した動的segmentだけを解決し、任意の親pathや公開rootへfallbackしない。`page-route-inventory.test.mjs`は実在pageとpage設定を照合し、設定漏れを検出する。存在しないURLのNuxt 404表示そのものはbrowserで未確認であるが、認可判定では未登録routeを許可しない。

### 明示的な特殊page

- `/auth/reset-password`: `PUBLIC`、navigation非表示
- `/maintenance`: `AUTHENTICATED`として登録し、middlewareのmaintenance専用分岐を優先
- `/unconfirmedEmail`: `AUTHENTICATED`として登録し、onboarding専用分岐を優先
- `/test/user-permission-info`: 2026-09-08に不要と判断しpageを削除

`/settings/user`は設定だけが残り、対応page fileがない。現在の`/settings/users`とは別pathであり、今回の削除対象には含めていない。

## 認証session更新

- Firebase observerは`onIdTokenChanged`を利用し、login／logoutだけでなくtoken claim更新も直列に`setUser`へ渡す。
- session開始時に旧User・Company listenerとmodelを解除・初期化し、Firestore prefixを`Companies/unknown`へ戻してから新しいtokenとdocumentを取得する。
- token、User、Company取得に失敗した場合も同じ初期化を行い、`sessionInitializationFailed`を設定する。正常な次回callbackまたはlogoutで復帰・clearできる。
- client access controlは表示と遷移のUX gateであり、Firestore RulesまたはCallableのactor・tenant・field認可を代替しない。

## Local検証

- policy、access context、middleware source contract、session failure、current-page再認可、route inventory、User管理、Employee strict policyのdomain testを追加・更新した。
- 実Firebase token refresh、実User無効化／role変更中のbrowser挙動、Dev・Prod、remote dataは未確認である。
- 最終の全domain、Emulator、build、文書・governance検証結果はこのcheckpointの完了報告へ記録する。

## 残る注意点

- `onIdTokenChanged`の直列化はsource contractで確認している。rapid A→B→logoutをFirebase observer込みで再現するbehavior testは追加余地がある。
- redirect開始後に権限がdenyからallowへ戻った場合、開始済みのdashboard遷移が完了する可能性がある。これは安全側の一時的なUX差であり、再び許可pageへ移動できる。
- test/development pageのproduction bundle隔離と`/settings/user`の整理は別課題である。
