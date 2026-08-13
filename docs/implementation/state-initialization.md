# 状態管理入口と初期化の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-003 — 認証・会社・システム・アプリシェルの状態管理入口
- 最終確認日: 2026-08-10
- 根拠ファイル: `stores/useAuthStore.js`、`stores/useCompanyStore.js`、`stores/useSystemStore.js`、`stores/useAppStore.js`、`composables/application/auth/useAuthActions.js`、照合済みの `plugins/02.firebase.auth.js`、`plugins/07.system.js`

この文書は指定された状態管理入口から観察できる実装事実を記録する。モデル、補助 composable、権限 utility、通知処理の内部は未調査であり、実装事実を承認済みの設計意図と混同しない。

## 責務表

| 対象 | 所有する状態 | ゲッター・導出値 | 公開操作・入口 |
|---|---|---|---|
| `useAuthStore` | `uid`、`isEmailVerified`、`isSuperUser`、`isDeveloper`、`companyId`、`isReady`、リアクティブな `User` インスタンス | email、displayName、isAdmin、employeeId、tagSize、roles、permissions | `waitUntilReady`、`waitUntilSessionCleared`、`hasRole`、`hasPermission` |
| `useCompanyStore` | リアクティブな `Company` インスタンス | subscription から導出する `customerType` | ストア独自の公開 action はない。モデルの操作は `company` 経由 |
| `useSystemStore` | リアクティブな `System` インスタンス、起動モードから設定する `isDev` | System または現在会社のメンテナンス状態から導出する `isMaintenance` | ストア独自の公開 action はない。システム初期化は別の application composable を `plugins/07.system.js` が呼ぶ |
| `useAppStore` | ナビゲーションドロワーの内部 `drawer` | appBar、navBar、navIcon、previousButton | 返却値はアプリシェル部品へ渡す属性群。独立 action はない |
| `useAuthActions` | 独自 state は持たない | なし | `setUser`、`signIn`、`signOut`。内部で `initializeSession` と `clearSession` を調整する |

### `useAuthStore`

- 認証カスタムクレーム由来のスーパーユーザー、開発者、会社IDと、Firebase Authentication由来のUID・メール確認状態を保持する。
- `User` ドキュメント由来のロール、管理者状態、表示情報、従業員ID、タグサイズを保持または導出する。
- `roles` は User のロールと `isSuperUser`、`isDeveloper`、User の `isAdmin` を `buildRoles` へ渡して導出する。`permissions` はその結果を `getPermissions` で展開する。
- tagSize は schemas 定数に存在する値だけを採用し、未設定・不正値では MEDIUM の値を返す。
- `waitUntil` は Vue watcher と timeout を作成し、成功・失敗の両方で watcher と timeout を解除する。
- `waitUntilReady` は `isReady`、`waitUntilSessionCleared` は `uid === null && isReady` を最大5秒待つ。

### `useCompanyStore`

- 現在会社を単一のリアクティブ `Company` インスタンスとして保持する。
- `customerType` は Company の subscription から都度導出する。
- 認証状態、UID、ロールは保持しない。

### `useSystemStore`

- 単一のリアクティブ `System` インスタンスと、`NODE_ENV === "development"` から初期化する `isDev` を保持する。
- `useCompanyStore` に依存し、システム全体または現在会社のいずれかがメンテナンス中なら `isMaintenance` を true にする。
- 認証ストアには依存しない。

### `useAppStore`

- Vuetify の表示ブレークポイント、認証ストア、現在ルート、ルーター、ページ設定に依存する。
- `drawer` は `display.lgAndUp` を watchEffect し、広い画面では開いた状態、狭い画面では閉じた状態へ追従する。
- appBar のタイトルは現在パスのページ設定 label、設定がなければ `AirGuard` とする。
- navIcon は未認証または広い画面で非表示となり、それ以外では drawer を切り替える。
- previousButton は現在パスに親ページがある場合だけ表示し、クリック時に履歴を1件戻る。
- User、Company、System の業務状態は保持しない。

## 認証初期化シーケンス

1. `plugins/02.firebase.auth.js` が Firebase App の初期化済み状態を確認し、Authentication の `onAuthStateChanged` を登録する。
2. 認証状態変更ごとに、初回だけ auth store、system store、`useAuthActions().setUser` を取得する。
3. コールバックは `sessionUpdate` Promise チェーンへ追加され、直前の `setUser` が完了してから次の認証状態を処理する。直列化チェーン自体の catch はエラーをコンソールへ記録する。
4. `setUser` は既存エラーをクリアし、`auth.isReady = false` にする。
5. Firebase User がある場合、`initializeSession` が強制更新付きでIDトークン結果を取得する。
6. UID、メール確認状態、`isSuperUser`、`isDeveloper`、会社IDを auth store へ設定する。
7. UIDまたは会社IDがない場合、User と Company の購読を解除してモデルを初期化し、FireModel のprefixを `Companies/unknown` にして終了する。AuthenticationのUID自体は、Firebase Userがあれば保持される。
8. UIDと会社IDがある場合、FireModel のprefixを `Companies/{companyId}` に設定する。
9. UserをUIDでfetchし、続けてCompanyを会社IDでfetchする。両方の初回取得完了後にUserとCompanyを購読する。
10. 購読開始後、Userを渡してFCMトークン登録処理の完了を待つ。`registFCMToken` は自身の例外をloggerへ記録して吸収するため、通知登録失敗は `initializeSession` へ伝播しない。
11. User・Company取得や購読など、`initializeSession` まで伝播した成功・失敗にかかわらず `setUser` のfinallyで `auth.isReady = true` にする。伝播した失敗はloggerへ記録され、`setUser` の呼出し元へ再throwされない。
12. グローバル認証ミドルウェアは `waitUntilReady` により、このシーケンスのfinallyまで待ってから認証・権限判定を続ける。

### システム初期化との関係

- `plugins/07.system.js` は system storeを取得し、別の `useSystemActions().initializeSystem` をawaitする。この action の内部は今回の所有範囲外である。
- 同プラグインは `systemStore.isMaintenance` をwatchし、trueへの変化で `/maintenance`、falseへの変化で同ページから `/` へ置換遷移する。
- system storeの `isMaintenance` はCompany状態にも反応するため、認証セッションがCompanyをfetch・購読した後の会社メンテナンス変更も導出値へ反映される。
- ファイル名上は認証observerの `02` がシステム初期化の `07` より前に登録される。Nuxt内部の非同期完了順と最初の認証コールバックが発火する正確な時点は未検証である。

### アプリシェル初期化との関係

- `useAppStore` 自体は認証セッション、Company、Systemを初期化しない。
- app shellがストアを利用した時点で、画面幅、現在ルート、認証UID、ページ設定から表示用属性をリアクティブに導出する。
- drawerのwatchEffectには明示的な停止処理がない。Piniaストアの存続期間にわたる監視として実装されている。

## 状態クリアシーケンス

### Authenticationが未認証状態を通知した場合

1. `setUser(null)` がエラーをクリアし、`auth.isReady = false` にする。
2. `clearSession` がUID、メール確認状態、スーパーユーザー、開発者、会社IDを初期値へ戻す。
3. User購読を解除してUserモデルを初期化する。
4. Company購読を解除してCompanyモデルを初期化する。
5. FireModelのprefixを `Companies/unknown` に戻す。
6. finallyで `auth.isReady = true` にする。

### 明示的なサインアウト

1. `useAuthActions.signOut` がFirebase Authenticationの `signOut` をawaitする。
2. Authentication observerが未認証状態を受け取り、上記の `setUser(null)` と `clearSession` を実行する。
3. `signOut` は `auth.waitUntilSessionCleared()` で `uid === null && isReady` になるまで待つ。

### 会社IDのない認証ユーザー

- Authentication由来のUID、メール確認状態、特権クレームは設定したまま、UserとCompanyだけを購読解除・初期化する。
- FireModel prefixは `Companies/unknown` になる。
- `setUser` のfinallyで認証準備完了として扱う。

## 依存関係

| 起点 | 直接依存 | 観察できる目的 |
|---|---|---|
| `useAuthStore` | User schema、authorization utility、logger、errors store、tag-size constants | 認証・User状態、ロール・権限、待機、エラー記録 |
| `useCompanyStore` | Company schema、subscription utility | 現在会社と顧客区分 |
| `useSystemStore` | System schema、`useCompanyStore` | システム・会社を合わせたメンテナンス判定 |
| `useAppStore` | Vuetify display、`useAuthStore`、Vue Router、pageSettings | シェル表示属性 |
| `useAuthActions` | `useAuthStore`、`useCompanyStore`、Firebase Auth、FireModel、notification composable、logger/errors store | AuthenticationとUser・Companyモデルの調整 |
| `plugins/02.firebase.auth.js` | Firebase Auth、`useAuthActions`、auth/system stores | 認証observerと状態更新の直列化 |
| `plugins/07.system.js` | system store、system actions、Vue Router | システム初期化とメンテナンス遷移 |

指定範囲内に `useAuthStore` からCompany/Systemへの依存はなく、CompanyからAuth/Systemへの依存もない。SystemだけがCompanyへ依存し、App shellはAuthへ依存する。`useAuthActions` がAuthとCompanyの協調点である。

## 確認済み整合

- `useAuthStore` が認証状態、カスタムクレーム、ログインUser、ロール・権限を管理し、Company/Systemを直接参照しない点は `AGENTS.md` と `docs/specification.md` の責務分離に一致する。
- `useCompanyStore` がCompanyとsubscription由来のcustomerTypeを管理し、認証状態を持たない点は既存文書に一致する。
- `useSystemStore` がSystem、会社を考慮したメンテナンス状態、開発環境判定を管理し、Companyへ依存する点は既存文書に一致する。
- `useAppStore` がシェル表示だけを管理し、業務データを持たない点は既存文書に一致する。
- `useAuthActions` がAuthentication状態に応じたUser・Companyの取得、購読、初期化を調整する点は既存文書に一致する。
- UserとCompanyはsubscribe前にfetchをawaitしており、初回取得完了前に認証準備完了としない構成である。
- 認証observerの更新をPromiseチェーンで直列化し、連続した認証変更の `setUser` 同時実行を避けている。

## 矛盾・未使用候補

- `useAuthStore` 内部の `permissions` computedは返却オブジェクトに含まれず、同ファイル内では `hasPermission` からだけ参照される。内部実装用であり、未使用ではない。
- 4ストアが返すstate・getter・操作のリポジトリ全体での利用有無は、所有範囲外の横断検索をしていないため判断できない。
- `plugins/02.firebase.auth.js` が取得するsystem storeは、同プラグイン内では開発ログ判定の `isDev` だけに使われる。不要とは断定できない。
- `onAuthStateChanged`、system maintenance watch、app drawer watchEffectには明示的な購読解除がない。いずれもプラグインまたはPiniaストアのアプリ存続期間監視として成立し得るため、直ちにリークとは断定しない。
- `useAuthActions.initializeSession` はUID・クレームを先に設定し、その後のUser fetch、Company fetch、購読のいずれかが失敗しても、catch後のfinallyで `isReady = true` にする。失敗地点により部分的な認証・User・Company状態でナビゲーションが再開し得る。FCM登録の例外は `registFCMToken` 内で吸収されるため、この伝播経路には含まれない。
- 認証済みユーザーAからユーザーBへ、未認証状態を挟まずobserver通知が切り替わる場合、`initializeSession` は開始時に既存User・Company購読を明示解除しない。各モデルの `subscribe` が既存購読を置換するかは未確認であり、購読重複候補である。
- `clearSession` は認証scalarを先に初期化し、その後にモデル購読解除・初期化を行う。後段が例外になっても `setUser` はエラーを吸収して `isReady = true` にし、`waitUntilSessionCleared` の条件は成立し得るため、モデル状態のクリア失敗をsignOut呼出し側が検出できない候補がある。
- `registFCMToken` はUser・Company取得と購読開始後に同じ初期化シーケンスでawaitされるが、通知登録失敗は同関数内でloggerへ記録して吸収される。したがって待機時間には含まれる一方、認証初期化の失敗として呼出し元へは伝播せず、読み込み済みセッションは維持される。

## 仮説

- FCMトークン登録を認証初期化でawaitする理由は未確認である。失敗結果を基本セッションから分離する挙動自体は承認済みである。
- `Companies/unknown` prefixは会社未確定・サインアウト状態でテナント固有パスを誤使用しないための安全な既定値と考えられるが、FireModel内部動作は未確認である。

## ユーザー確認済み方針

- 2026-08-11: `isReady` は「認証初期化処理が終了した」を意味し、初期化成功そのものを意味しない。
- 2026-08-11: FCM登録失敗は現状どおりlogだけを残して吸収し、loginを継続する。
- 2026-08-11: User切替は必ずsign-outを挟む。cleanup失敗時は強制reloadする。
- 2026-08-11: FCM tokenは現在login中Userだけに紐付け、sign-out時にFirestore紐付けを削除し、次回login時に再取得・再登録する。

## 将来修正候補

このセグメントでは実装しない。

- `isReady` と、User・Companyを含むセッション初期化成功状態または初期化エラー状態を分離する必要性を検討する。
- User fetch失敗、Company fetch失敗、subscribe失敗ごとの期待状態とアクセス可否を定義する。FCM登録失敗はlogのみでloginを継続する承認済み境界をテストする。
- sign-outを経ないUser切替を許可しない境界と、sign-out時に既存のUser・Company購読が確実に解除されることをテストする。
- clearSessionのモデル解除・初期化失敗を検出し、承認済みの強制reloadへ到達させる。
- sign-out完了条件へFCM tokenのFirestore紐付け削除を含め、次回login時にtokenを再取得・再登録する。
- 初回認証コールバック、system初期化、middleware開始の順序を結合テストし、メンテナンス状態や認証状態が一時的に誤判定されないことを確認する。

## 質問

- 調査継続を妨げる質問はない。
- `isReady` は失敗を含む「認証初期化処理の終了」を意味し、FCM登録失敗はlogだけを残してloginを継続する方針が確認済みである。User・Company初期化失敗時の利用可能範囲は未確定である。
- User切替はsign-out必須、cleanup失敗時は強制reloadとする方針が確認済みである。現実装がこの境界を強制できるかは未確認である。

## 未確認範囲

- User、Company、System、FireModelの `fetch`、`subscribe`、`unsubscribe`、`initialize`、prefixの実装と例外契約。
- `useSystemActions.initializeSystem` の取得、購読、失敗・解除処理。
- `useNotification.registFCMToken` の再試行契約と利用者への状態表示。例外を内部で捕捉し、呼出し元へ伝播しないことは確認済みである。
- authorization utilityのロール構築・権限展開の詳細。
- errors store、logger、subscription customerType utility、pageSettings helperの内部挙動。
- 対象state・getter・actionのリポジトリ全体での参照有無。
- 実行時の初期化タイミング、Firebase Emulator・DEV環境での成功・失敗経路。
