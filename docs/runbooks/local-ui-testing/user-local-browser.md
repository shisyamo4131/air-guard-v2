# 利用者用local browser受入れ

- 状態: 運用中
- 役割: 利用者用local環境とサインイン済みChromeタブを使う補助手順

担当、承認、環境、受入れ判断は[local UI検証runbook](../local-ui-testing.md)の共通境界を適用する。

## 基本起動

Codexまたはテスターがローカル画面を起動する場合は、`.env.local` を使用し、LANへ公開しないようloopbackへ限定します。

```powershell
npx nuxt dev --dotenv .env.local --host 127.0.0.1
```

認証後の画面操作が必要な場合は、Emulator専用アカウントを使用します。利用者用local環境では必要なアカウント作成を利用者へ依頼します。Codex専用環境では、Codexが実在情報を含まない合成accountをfixtureまたは実行時生成で作成します。

## ブラウザ操作の現在の制約

CodexのインアプリブラウザとChrome拡張による操作のどちらからもNuxtローカルサーバーの画面は取得できますが、現在の環境ではCodexがAuth Emulatorの `127.0.0.1:9099` へ直接接続してサインインを自動化する経路が、ブラウザ操作レイヤーで `ERR_BLOCKED_BY_CLIENT` として遮断されます。

利用者用local環境そのものの受入れが必要な場合は、Codex専用UI testと混在させず、次の準備をユーザーが行った後にcoordinatorがサインイン済みChromeタブを直接引き継ぐ補助経路を使います。この操作を`ui_tester`その他のsubagentへ委譲しません。

1. `--import=./saved-data` を付けてFirebase Emulatorを起動する。
2. `.env.local` を使ってローカルサーバーを起動する。
3. Chrome拡張が有効なプロファイルでChromeを起動する。
4. Emulator専用アカウントでサインインし、必要に応じてテスト対象画面まで移動する。
5. 画面の準備が完了したことをCodexへ伝える。

coordinatorは既存タブを引き継いだ後、SPAローディングテンプレートの表示を即時エラーとみなさず、画面遷移の完了または明確なタイムアウトまで待機します。データ作成・更新・削除を伴う操作は、ユーザーがテスト内容として明示的に許可した範囲だけで行います。テスト終了時はユーザーが起動したEmulator、ローカルサーバー、ChromeをCodex側から停止しません。

危険なChrome起動オプションや利用者の通常profile変更は採用しません。Codex専用UI modeは利用者用環境の制約を回避するために混在させず、専用project、専用port、合成account、Codex管理ブラウザで独立して検証します。

Chrome拡張を使う場合、拡張機能を有効にしたChromeプロファイルでChromeを先に起動しておく必要があります。現在の環境では、Chrome終了後にcoordinatorからChromeを自動起動・再接続することはできません。Chromeを終了した場合は、ユーザーが対象プロファイルでChromeを再起動してからcoordinatorが検証を再開します。
