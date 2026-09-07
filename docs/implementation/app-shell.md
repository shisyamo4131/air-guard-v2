# アプリケーション入口とシェルの実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-001 — アプリケーション入口とシェル
- 最終確認日: 2026-08-10
- 根拠ファイル: `package.json`、`nuxt.config.js`、`app.vue`、`layouts/auth.vue`、`layouts/default.vue`、`layouts/guest.vue`、`middleware/auth.global.js`、`plugins/01.firebase.init.js`、`plugins/02.firebase.auth.js`、`plugins/03.air-firebase.init.js`、`plugins/04.vuetify.js`、`plugins/05.air-vuetify.js`、`plugins/06.dayjs.js`、`plugins/07.system.js`、`plugins/08.firebase-messaging.client.js`、`plugins/09.chartjs.client.js`、`plugins/10.company-settings.client.js`、`plugins/11.user-settings.client.js`、`pages/arrangements-manager.vue`、`pages/index.vue`、`pages/maintenance.vue`、`pages/unconfirmedEmail.vue`

この文書は、指定された実装範囲から観察できた事実を記録する。確認済み要件の正本である `docs/specification.md` を置き換えず、設計意図や利用者承認済み要件を実装事実から推定しない。

## 確認済み実装事実

### アプリケーション方式

- Nuxt `3.17.2`、Vue `3.5.13`、Vue Router `4.5.0`、Pinia `3.0.1`、Vuetify `3.11.6` を依存関係として宣言している。
- `nuxt.config.js` は `ssr: false` を指定しており、アプリケーションは CSR SPA として構成される。
- SPA 起動完了まで Nuxt のローディングテンプレートを使用する。
- ページとレイアウトのトランジションはいずれも `out-in` で、`app.vue` が対応する全体スタイルを定義する。
- `app.vue` は PWA マニフェストと現在のレイアウトを描画する。`NuxtPage` は `app.vue` ではコメントアウトされ、各レイアウトがページ描画を担当する。
- 全体 CSS として `assets/css/utilities.css` を読み込む。

### PWA

- `@vite-pwa/nuxt` を使用し、`injectManifest` 方式で `service-worker/sw.js` を `sw.js` として構築する。
- Workbox のプリキャッシュ対象は空に設定され、マニフェストはアプリ名、単独表示、開始 URL `/`、192px と 512px のアイコンを宣言する。
- 開発時にも PWA を有効化し、Service Worker を module として扱う。
- `plugins/08.firebase-messaging.client.js` がブラウザ、Notification、Service Worker の各対応を確認して Service Worker を手動登録する。開発時は `/dev-sw.js?dev-sw`、それ以外は `/sw.js` を使用する。
- 通知許可済みの場合だけ Firebase Messaging のフォアグラウンド受信を登録し、受信内容を Service Worker registration の通知として表示する。

### レイアウト

- `guest` レイアウトは、グローバルローディング、AirGuard のアプリバー、ページ本体、年表示付きフッターを持つ。
- `auth` レイアウトは、グローバルローディングとメッセージキューを持つ。広い画面では製品説明領域とフォーム領域を分け、狭い画面ではフォーム領域を表示する。
- `default` レイアウトは、グローバルローディング、メッセージキュー、アプリストアにより制御されるアプリバーとナビゲーションドロワー、ユーザー設定、サインアウト、ページ本体、フッターを持つ。
- `default` レイアウトのサインアウトは認証アクションを実行し、成功時にメッセージを追加して `/` へ遷移する。処理中はローディングを追加し、成功・失敗にかかわらず解除する。
- `default` レイアウトは一部の一覧ページ名を最大10件の keep-alive 対象として指定する。

### 直下ページのルーティング情報

Nuxt のファイルベースルーティングにより、`pages/` 直下には次のページがある。各ページ配下の詳細実装はこの調査の対象外である。

| ファイル | 観察できるパス | 明示レイアウト・名前 |
|---|---|---|
| `pages/index.vue` | `/` | `guest` レイアウト |
| `pages/arrangements-manager.vue` | `/arrangements-manager` | コンポーネント名 `arrangements-manager`。レイアウト指定は調査したルーティング情報内にない |
| `pages/maintenance.vue` | `/maintenance` | `auth` レイアウト |
| `pages/unconfirmedEmail.vue` | `/unconfirmedEmail` | `auth` レイアウト |

`pages/` の子ディレクトリには `articles`、`attendances`、`auth`、`billings`、`customers`、`dashboard`、`employees`、`operation-results`、`operation-schedules`、`outsourcers`、`settings`、`sites`、`super-user`、`test` が存在する。個別ページの内容とメタ情報は未調査である。

### package scripts

以下は宣言されたコマンド名と、コマンド文字列から直接確認できる役割だけを記載する。実行結果は確認していない。

| コマンド | 宣言上の役割 |
|---|---|
| `build` | Nuxt をビルドする |
| `dev` | `.env.development` を指定して Nuxt 開発サーバーを起動する |
| `deploy:dev` | 開発用設定で静的生成し、Firebase の `dev` プロジェクトを選択してデプロイする |
| `generate:prod` | 既定の環境設定で静的生成する |
| `generate:dev` | `.env.development` を指定して静的生成する |
| `local` | `.env.local` を指定し、ホスト公開指定付きで Nuxt 開発サーバーを起動する |
| `install:firemodel` | ルートと Functions の FireModel パッケージを latest で導入する |
| `install:schemas` | ルートと Functions に schemas パッケージを導入する |
| `install:schemas@dev` | ルートと Functions に承認済みのexact dev版 schemasを導入する（現在は`2.4.2-dev.167`） |
| `list:adapter` | ルートの client adapter と Functions の server adapter の導入版を表示する |
| `list:schemas` | ルートと Functions の schemas 導入版を表示する |
| `update:adapter` | ルートと Functions の各 adapter を更新し、導入版を表示する |
| `update:firemodel` | ルートと Functions の FireModel を更新する |
| `update:schemas` | ルートと Functions の schemas を更新し、導入版を表示する |
| `uninstall:schemas` | ルートと Functions から schemas を削除する |

## コンポーネント／処理の責務と実行順

番号付きプラグインのファイル名と依存関係から、少なくとも次の初期化連鎖が実装されている。ここでの順序はファイル名で表現された順序であり、Nuxt 内部の全フック完了順まで検証したものではない。

1. `01.firebase.init.js` が runtime config から Firebase 設定を組み立て、App、Firestore、Authentication、Storage、Realtime Database、Functions を初期化して Nuxt App へ提供する。Emulator フラグが有効なら、現在のブラウザホスト名に各 Emulator の固定ポートを組み合わせて接続する。
2. `02.firebase.auth.js` が Firebase App の存在を確認し、Authentication の状態変更を購読する。状態変更ごとの `setUser` 処理は Promise チェーンで直列化する。
3. `03.air-firebase.init.js` が提供済み Functions を使う client adapter を FireModel へ設定し、Callable Functions の `geocoding` を GeocodableMixin へ注入する。
4. `04.vuetify.js` と `05.air-vuetify.js` が Vuetify、ロケール、ディレクティブ、コンポーネント既定値、AirVuetify を Vue App へ登録する。
5. `06.dayjs.js` が日本語ロケール、比較・UTC・timezone プラグイン、`Asia/Tokyo` の既定 timezone を設定する。
6. `07.system.js` がシステム状態を初期化し、メンテナンス状態を監視して `/maintenance` と `/` の間を制御する。
7. client 限定の `08`～`11` が、Service Worker と FCM、Chart.js 部品、会社別コンポーネント既定値と丸め設定、ユーザー別タグサイズを設定する。
8. 画面遷移時は `auth.global.js` がエラーをクリアし、メンテナンス状態を先に判定した後、認証準備完了を待って認証、メール確認、公開ページ、ロール権限の順でアクセスを判定する。
9. 選択されたレイアウトが `NuxtPage` を描画する。

## 外部依存・設定境界

- Firebase の公開クライアント設定と Emulator 使用フラグは `runtimeConfig.public` へ渡される。値そのものは調査・記録していない。
- Service Worker のビルド時には `NUXT_` と `VITE_` 接頭辞を Vite の環境変数対象とし、Firebase の一部設定をプレースホルダー置換で注入する。
- Firebase 初期化プラグインは Functions のリージョン未指定時に `us-central1` を使用する。
- Emulator 接続先は実行中ページの hostname と、Firestore 8080、Auth 9099、Storage 9199、Realtime Database 9000、Functions 5001 の各固定ポートから構成される。
- client adapter、schemas、AirVuetify、Firebase、Vuetify、Day.js、Chart.js、PWA モジュールがアプリケーション入口で利用される外部・隣接境界である。関連リポジトリの実装は未調査である。
- `deploy:dev` は Firebase プロジェクト選択とデプロイを伴う外部作用のあるスクリプトである。この調査では実行していない。
- `local` は `--host` を指定している。ユーザー確認によれば、これは実機・PCを問わず Emulator 環境で動作確認するための承認済み LAN 公開用途であり、Codex が通常の検証でローカルサーバーを loopback に限定する規則とは用途が異なる。この調査では起動していない。
- ユーザー確認によれば、試用には既存の DEV Firebase プロジェクトを使用し、PROD Firebase 環境はまだ用意されていない。これは環境値を調査して得た実装事実ではない。

## 仕様書や既存文書との一致

- CSR SPA、Nuxt 3、Vue 3、Vuetify、Pinia、Firebase Hosting 向け構成、PWA Service Worker は `docs/specification.md` のシステム境界と一致する。
- Firebase Authentication、Firestore、Realtime Database、Storage、Cloud Functions のクライアント初期化は、仕様書に記載されたバックエンド境界と一致する。
- `useAuthStore`、`useCompanyStore`、`useSystemStore`、`useAppStore` の入口側で観察できる用途は、仕様書のアプリケーション状態の責務と整合する。各ストア内部の責務分離は未調査である。
- メンテナンス状態による画面制御、PWA と FCM による通知、会社設定から導出される丸め設定の注入は、仕様書に記載された対象機能と整合する。
- `package.json` の `deploy:dev` は、`CHANGELOG.md` にある修正済み開発環境デプロイ手順の記載と名称上は整合する。実行可能性と運用手順本文は未検証である。

## 矛盾・未使用候補

- `middleware/auth.global.js` の引数 `from` は本体で参照されていない。将来用途または慣例的シグネチャの可能性があり、削除可否は未判断である。
- 同ミドルウェアは未認証の場合に既知の`PUBLIC` access policyだけを許可する。一方、認証済み経路にはページ設定が存在しない場合を許可する分岐が残る。さらに`getPageConfig`の親探索は未登録パスから登録済み`/`まで遡り、ホームの`PUBLIC`設定を返し得るため、設定なし分岐へ到達しない場合がある。この未登録route境界は別gateのfail-closed課題である。
- `app.vue` の `NuxtPage` はコメントアウトされているが、全3レイアウトが `NuxtPage` を持つため、この範囲だけでは未使用コードではなく、ページ描画場所をレイアウトへ集約した構成と観察できる。

## 仮説

- 番号付きプラグイン名は、Firebase、認証、モデル adapter、UI 基盤、日時、システム、client 限定設定という依存順を安定させる意図と考えられる。明示的な `dependsOn` は確認範囲にない。
- ページ設定がないパスを認証ミドルウェアが許可する処理は、コードコメント上は 404 表示を通す意図とされる。ただし、404 と設定漏れの実在ページを識別する仕組みは実装範囲にない。
- `runtimeConfig.public.firebaseUseEmulator` は環境変数から直接設定され、Firebase 初期化側では真偽値への明示変換がない。文字列として供給される場合の真偽判定が意図どおりかは、設定値を見ずには確定できない。

## 未決事項・ユーザーへの質問

- ユーザー回答により、ページ設定がない実在ページを許可する現在の fail-open 挙動は望ましくなく、将来 fail-closed へ修正すべき事項と確定した。現行挙動は実装事実として維持して記録する。将来はroute一覧と照合し、実在する未設定pageを設定漏れ専用error、存在しないURLを404とする。具体的な照合実装は未設計である。
- `local --host` の用途、DEV Firebase プロジェクトの存在、PROD Firebase 環境が未準備であることについて、このセグメントに残る質問はない。

## 次に読むべき小セグメント候補

1. `utils/pageSettings` と各ページのルーティングメタ情報だけを照合し、公開・権限・設定漏れの境界を確認する。
2. 認証・会社・システム初期化を調整する store と application composable の入口だけを調査する。
3. `service-worker/` と PWA 登録処理だけを照合し、キャッシュ、FCM、更新制御の実装事実を確認する。
