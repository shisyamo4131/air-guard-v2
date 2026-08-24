# ページアクセス設定の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-002 — ページアクセス設定
- 最終確認日: 2026-08-24
- 根拠ファイル: `utils/auth/policies/pageAccessPolicy.js`、`utils/pageSettings.js`、`middleware/auth.global.js`、`pages/` 配下の `.vue` ファイル名、および`test/domain/page-access-policy.test.mjs`

この文書は実装から観察できたアクセス設定と、ユーザーが明示的に回答した運用・将来方針を分離して記録する。各ページの本文、業務ロジック、ストア、composable は調査していない。

## 確認済み実装事実

### 設定モデル

- `pageStructure` は47 nodeで構成される。35のpath付きpageは`id`、`path`、既知の`accessPolicy`、表示情報を持ち、12のpathなしnavigation groupはpolicyを持たない。
- `PAGE_ACCESS_POLICIES`は13件のdeep-frozen descriptorを公開する。catalog objectとdescriptorのidentityを既知policyの境界とし、clone、未知object、`null`、文字列値を許可しない。
- `public`、`roles`、`strictPresetPermissions`、`allowAdmin`はlegacy fieldであり、page設定に保持しない。既知policyと旧fieldを併記したconfigもruntimeとvalidatorの双方で拒否する。
- `PUBLIC`、`AUTHENTICATED`、`SUPER_USER`、`DEVELOPER`、`ADMIN`と7種類のread permission policyは一般pageの既存実効条件を維持する。`super-user`／`developer`専用pageは排他的に扱い、通常pageではadmin override、super-user wildcard、直接permission、preset展開、writeからreadへの展開を許可する。
- `USER_MANAGEMENT`だけはrawのpreset rolesと`isAdmin`を追加検査し、会社管理者または既知preset由来の`users:write`だけを許可する。直接`users:write`、未知・非文字列role、`super-user`だけのactorは拒否する。
- `getNavigationItems` はrouteと同じpolicy evaluatorを使用する。pathなしgroupは、アクセス可能かつ`navigation: true`の子itemが1件以上ある場合だけ表示する。
- `getPageConfig` は末尾スラッシュを除去して完全一致を試し、次に `[id]` または `:id` の動的セグメントを一致させ、その後は URL の末尾セグメントを順に除いて登録済みの親パスを探す。
- `/` 自体が公開ページとして登録されているため、上記の親探索は任意の未登録絶対パスに対して最終的に `/` の設定を返し得る。
- `isPageAllowed` 自体は設定が見つからない場合に `false` を返す。しかし現在の親探索では `/` がフォールバックになり得るため、通常の絶対パスで「設定なし」へ到達しない場合がある。
- 開発環境では `validatePageSettings` を呼び出す。重複ID・path、path付きpageのpolicy欠損・未知policy・legacy field、pathなしgroupのpolicy保持、pathもchildrenもないnodeを検出する。ファイルルートと設定パスの存在照合は行わない。

### グローバルミドルウェアの判定順

1. 画面遷移時にエラーストアをクリアする。
2. メンテナンス中は `/maintenance` だけを許可し、それ以外を同ページへ置換遷移する。メンテナンス中でなければ `/maintenance` から `/` へ戻す。
3. 認証ストアの準備完了を待つ。
4. 未認証の場合は、取得した設定がlegacy fieldを含まない既知の`PUBLIC` policyなら許可し、それ以外は `/auth/sign-in` へ置換遷移する。
5. 認証済みかつメール未確認の場合は `/unconfirmedEmail` だけを許可する。
6. メール確認済みで `/unconfirmedEmail` にいる場合は `/dashboard` へ遷移する。
7. 認証済みで`PUBLIC` policyのページへ遷移した場合は `/dashboard` へ遷移する。
8. ページ設定が存在しない場合は許可する。
9. それ以外は `isPageAllowed` で共有policyを判定し、不許可なら `/dashboard` へ遷移する。

### 登録済みページ設定

`PUBLIC` policyを参照する公開ページは次の4件である。

| パス | 用途 | ナビゲーション |
|---|---|---|
| `/` | ホーム | 非表示 |
| `/auth/sign-in` | サインイン | 非表示 |
| `/auth/sign-up` | 利用者アカウントサインアップ | 非表示 |
| `/auth/sign-up-admin` | 管理者アカウントサインアップ | 非表示 |

認証後の登録済みページと共有policyは次のとおりである。

| パス | accessPolicy | ナビゲーション |
|---|---|---|
| `/dashboard` | `AUTHENTICATED` | 表示 |
| `/super-user` | `SUPER_USER` | 表示 |
| `/operation-schedules` | `SITE_OPERATION_SCHEDULES_READ` | 表示 |
| `/arrangements-manager` | `SITE_OPERATION_SCHEDULES_READ` | 表示 |
| `/operation-results/generator` | `SITE_OPERATION_SCHEDULES_READ` | 表示 |
| `/operation-results` | `OPERATION_RESULTS_READ` | 表示 |
| `/operation-results/[id]` | `OPERATION_RESULTS_READ` | 非表示 |
| `/attendances` | `DEVELOPER` | 表示 |
| `/attendances/export` | `DEVELOPER` | 表示 |
| `/billings/operations` | `BILLINGS_READ` | 表示 |
| `/billings/operations/[id]` | `BILLINGS_READ` | 非表示 |
| `/billings/customers` | `BILLINGS_READ` | 表示 |
| `/billings/customers/[id]` | `BILLINGS_READ` | 非表示 |
| `/customers` | `CUSTOMERS_READ` | 表示 |
| `/customers/[id]` | `CUSTOMERS_READ` | 非表示 |
| `/sites` | `SITES_READ` | 表示 |
| `/sites/[id]` | `SITES_READ` | 非表示 |
| `/sites/terminated` | `SITES_READ` | 表示 |
| `/employees` | `EMPLOYEES_READ` | 表示 |
| `/employees/[id]` | `EMPLOYEES_READ` | 非表示 |
| `/employees/resigned` | `EMPLOYEES_READ` | 表示 |
| `/outsourcers` | `OUTSOURCERS_READ` | 表示 |
| `/articles` | `DEVELOPER` | 表示 |
| `/settings/company` | `ADMIN` | 表示 |
| `/settings/users` | `USER_MANAGEMENT` | 表示 |
| `/settings/checkout` | `SUPER_USER` | 非表示 |
| `/test/component-test` | `DEVELOPER` | 表示 |
| `/test/permissions-test` | `DEVELOPER` | 表示 |
| `/test/rollback-operation-result` | `DEVELOPER` | 表示 |
| `/test/round-setting-test` | `DEVELOPER` | 表示 |
| `/settings/user` | `ADMIN` | 非表示 |

pathなしgroupはpolicyを持たず、表示できる子itemから導出する。このため親子の権限fieldは重複しない。承認済みのroute/menu parityとして、super-userは`admin-settings`内の`company-setting`を表示する一方、`users-setting`は表示されず、`checkout`も`navigation: false`のため表示されない。

### ページ側メタ情報

- 調査対象の全 `.vue` ファイルについて、`usePageSetting` の呼び出しやページ固有のロール・権限メタ情報は検索で見つからなかった。アクセス制御情報は `utils/pageSettings.js` に集中している。
- `definePageMeta` はレイアウト指定にだけ使われている。`/` は `guest`、`/auth/sign-in`、`/auth/sign-up`、`/auth/sign-up-admin`、`/auth/reset-password`、`/maintenance`、`/unconfirmedEmail` は `auth`、`/settings/checkout` と `/test/permissions-test` と `/test/user-permission-info` は `default` を明示する。
- その他のページでは、検索対象に `definePageMeta` によるアクセス設定は見つからなかった。

## 設定漏れ・未参照候補

実在するページファイルに対する完全一致設定がないものは次の4件である。

| 実在パス | ページファイル | 現在の実効的な取得結果 |
|---|---|---|
| `/auth/reset-password` | `pages/auth/reset-password.vue` | 親探索により `/` の公開設定を取得し得る |
| `/maintenance` | `pages/maintenance.vue` | 親探索により `/` の公開設定を取得し得る。ただしミドルウェアのメンテナンス専用分岐が先行する |
| `/test/user-permission-info` | `pages/test/user-permission-info.vue` | 親探索により `/` の公開設定を取得し得る |
| `/unconfirmedEmail` | `pages/unconfirmedEmail.vue` | 親探索により `/` の公開設定を取得し得る。ただしメール確認状態の専用分岐がある |

- `/settings/user` は設定に存在するが、対応する `.vue` ファイルはない。実在する `/settings/users` も別途登録されているため、旧設定または将来設定の候補である。利用箇所の意図は未確認である。
- `validatePageSettings` は設定内の重複pathを検出するが、ページファイルとの存在照合は行わないため、上記の未登録実在pageと不存在設定の差異は検出しない。

## コメント・実装・確定方針の差

- ミドルウェアは未認証なら既知の`PUBLIC` policyだけを許可する。一方、認証済み経路には「設定がないページを許可する」分岐があり、`getPageConfig` はさらに未登録パスへ `/` の公開設定を返し得る。
- `isPageAllowed` のコメントと直接実装は設定なしを不許可とするが、呼出し前のミドルウェアが設定なしを許可し、かつ `getPageConfig` の `/` フォールバックが設定なしを覆い隠す。このため関数単体の fail-closed と経路全体の挙動が一致しない。
- ユーザー回答により、ページ設定がない実在ページを許可する現在の fail-open 挙動は望ましくなく、将来 fail-closed へ修正すべき事項と確定した。これは将来方針であり、現在の実装事実ではない。

## 将来の fail-closed 修正課題

このセグメントでは実装しない。

- 承認済み方針としてroute一覧と照合し、実在する未設定pageは設定漏れ専用error、存在しないURLは404とする。route一覧の取得・照合方法とerror遷移の実装は未設計である。
- `getPageConfig` の親継承が必要な経路を明示し、任意パスが `/` の公開設定を継承しないようにする。詳細ページが親設定を継承する既存用途との互換性を確認する。
- ミドルウェアの `if (!pageConfig) return` を安全側の拒否へ変更する場合、承認済みの専用error/404分離を維持し、動的ルートと深い子ルートの照合方法を定義する。
- 全ページファイルと設定パスを機械的に照合するテストを追加し、設定漏れ、実在しない設定、重複パス、動的ルートを検出する。
- 未認証、メール未確認、一般認証済み、各ロール・権限、`admin`、`developer`、`super-user` について、許可、サインイン遷移、ダッシュボード遷移、メンテナンス優先をテストする。
- `/auth/reset-password`、`/maintenance`、`/unconfirmedEmail`、`/test/user-permission-info` の明示設定と期待アクセス条件を確定する。

## DEV・PROD・Emulator の状態

### ユーザー確認済み

- 試用には既に存在する DEV Firebase プロジェクトを使用する。
- PROD Firebase 環境はまだ用意されていない。
- `npm run local` は、実機・PCを問わず Emulator 環境で動作確認するための承認済み LAN 公開用途である。通常の Codex 検証を loopback 限定とする規則とは用途が異なる。

### 実装から確認済み

- `npm run local` は `.env.local` と `--host` を指定する。
- Firebase 初期化は公開 runtime config の Emulator フラグが有効な場合、実行ページの hostname を使って各 Emulator へ接続する。
- `npm run deploy:dev` は開発用設定で静的生成し、Firebase の `dev` プロジェクトを選択してデプロイするコマンドを宣言する。

### 未確認

- DEV Firebase プロジェクトの実設定、接続状態、デプロイ状態、保持データは確認していない。
- `.env.local` と `.env.development` の値は確認していない。
- PROD 環境の不存在はユーザー回答であり、リポジトリやFirebase管理画面から検証していない。

## 仮説

- `/settings/user` は、現在の `/settings/users` またはユーザー設定UIへ移行する前の設定が残った可能性がある。履歴と利用側を調べていないため確定できない。
- 設定のないページを許可する分岐と親探索は、404表示や未登録の深い子ページへ親権限を継承する目的が混在した可能性がある。設計記録はこのセグメントでは確認していない。

## 未決事項・ユーザーへの質問

- 404と設定漏れ実在ページはroute一覧との照合で識別し、前者を404、後者を設定漏れ専用errorとする方針が承認済みである。具体的な実装方法は未設計である。
- 4件の未登録実在ページに必要な公開状態・ロールは、fail-closed修正前に個別確定が必要である。

## 次に読むべき小セグメント候補

1. 認証状態とロール・権限を生成する authorization utility、auth store、auth application action の入口だけを調査する。
2. NavigationDrawer が `getNavigationItems`、親ページ設定、設定IDをどう利用するかだけを調査する。
3. ルーター解決情報を用いた404識別方法について、現在のNuxtバージョンの公式仕様と最小テスト境界を調査する。
