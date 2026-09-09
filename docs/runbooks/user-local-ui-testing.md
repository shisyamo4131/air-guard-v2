# 利用者環境local UI検証runbook

- 状態: 運用中
- 役割: 利用者が管理するlocal環境とサインイン済みChromeタブを使う独立手順

担当、承認、環境、受入れ判断は[Environment and approval rules](../project-rules/environment-and-approval.md)を正とする。本runbookは利用者が`.env.local`、`./saved-data`、Chrome profile、起動processを管理するLocal検証だけを対象とし、[Codex専用local UI検証](local-ui-testing.md)の専用demo project、専用port、`.codex-test/saved-data`、generated server、Codex管理browser、cleanup手順を適用しない。Dev環境での試用・検証は[Dev deploy runbook](dev-deployment.md)へ分ける。

本runbookは、利用者Chrome・profile・表示環境、`.env.local`、利用者環境固有の再現、またはDev反映前の利用者によるUX判断を確認すると手戻りを実質的に抑えられる場合だけ選ぶ。自動検証またはCodex専用Localで同じ事項を証明できる場合や、必要な証明がDev固有である場合は実行しない。実行前に、この環境で固有に証明する事項を明示する。

本runbookの成功はDev前の補助証拠であり、製品変更の最終受入れまたは完了ではない。製品変更の最終受入れは固定commitを[Dev環境](dev-deployment.md)へ反映して行う。

## 基本起動

利用者またはCodexがローカル画面を起動する場合は、`.env.local`を使用し、LANへ公開しないようloopbackへ限定します。

```powershell
npx nuxt dev --dotenv .env.local --host 127.0.0.1
```

認証後の画面操作が必要な場合は、Emulator専用アカウントを使用します。必要なアカウント作成は利用者へ依頼します。

## ブラウザ操作の現在の制約

CodexのインアプリブラウザとChrome拡張による操作のどちらからもNuxtローカルサーバーの画面は取得できますが、現在の環境ではCodexがAuth Emulatorの `127.0.0.1:9099` へ直接接続してサインインを自動化する経路が、ブラウザ操作レイヤーで `ERR_BLOCKED_BY_CLIENT` として遮断されます。

利用者環境Localで固有に証明する事項がある場合は、Codex専用UI testと混在させず、次の準備を利用者が行った後にcoordinatorがサインイン済みChromeタブを直接引き継ぐ補助経路を使います。この操作を`ui_tester`その他のsubagentへ委譲しません。

1. `--import=./saved-data` を付けてFirebase Emulatorを起動する。
2. `.env.local` を使ってローカルサーバーを起動する。
3. Chrome拡張が有効なプロファイルでChromeを起動する。
4. Emulator専用アカウントでサインインし、必要に応じてテスト対象画面まで移動する。
5. 画面の準備が完了したことをCodexへ伝える。

coordinatorは既存タブを引き継いだ後、SPAローディングテンプレートの表示を即時エラーとみなさず、画面遷移の完了または明確なタイムアウトまで待機します。データ作成・更新・削除を伴う操作は、利用者がテスト内容として明示的に許可した範囲だけで行います。テスト終了時は利用者が起動したEmulator、ローカルサーバー、ChromeをCodex側から停止しません。

危険なChrome起動オプションや利用者の通常profile変更は採用しません。Codex専用UI modeは利用者用環境の制約を回避するために混在させず、専用project、専用port、合成account、Codex管理ブラウザで独立して検証します。

Chrome拡張を使う場合、拡張機能を有効にしたChromeプロファイルでChromeを先に起動しておく必要があります。現在の環境では、Chrome終了後にcoordinatorからChromeを自動起動・再接続することはできません。Chromeを終了した場合は、利用者が対象プロファイルでChromeを再起動してからcoordinatorが検証を再開します。
