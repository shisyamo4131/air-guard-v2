# CUSTOMER-01A local acceptance verification receipt

- 状態: Verified / immutable execution evidence
- Evidence ID: CUSTOMER-01A-LOCAL-ACCEPTANCE-001
- 実施日: 2026-09-02
- 対象環境: Codex専用local demo project `demo-air-guard-v2-codex`
- 対象commit: `97700ddd03b3abfc7f5f189311c35cd9b0dc81f2`
- 関連実装: [Customer master](../implementation/customer-master.md)
- 関連手順: [local UI検証runbook](../runbooks/local-ui-testing.md)

## 境界

- 保存済みの合成会社管理者accountと合成dataだけを使用し、利用者のChrome、利用者用`./saved-data`、Dev、Prod、remote dataへ接続していない。
- UI操作は可視画面の通常のpointer・keyboard操作だけを使用した。Firestore RESTはUI操作後のread-only確認に限った。
- 外部作用はdenyのままとし、geocoding、Stripe、mail、FCM等を有効化していない。push、deploy、export-on-exitは実施していない。

## 自動検証

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| 全domain | `node --test test/domain/*.test.mjs` | 788/788成功 | 0 |
| Codex専用Emulator | `npm run test:local` | 110/110成功 | 0 |
| migration preflight最終再確認 | `node --test test/domain/migrate-company-legacy-stripe.test.mjs` | 36/36成功 | 0 |
| Codex専用UI build | `npm run test:local:ui:build` | 同一HEAD・clean worktree・専用設定identityを確認して生成成功 | 0 |
| project文書 | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | Markdown、ADR、roadmap、TOML検証成功 | 0 |
| 差分形式 | `git diff --check` | 問題なし | 0 |

- migration preflightの最終補強後、隔離Emulator上の該当rehearsal 1/1も成功したが、exact invocationを永続記録していないため、上表の再現可能なcompletion gateには数えない。最終parserは上表の直接影響test 36/36で確認した。影響しない全suiteは検証方針に従い重複実行していない。
- 一般reviewとsecurity reviewは複数回行い、指摘を反映した最終状態に未解決の停止指摘がないことを確認した。

## 画面確認

- 専用buildはexit status 0で、同一HEAD・clean worktree・専用設定identityを確認したgenerated serverを起動した。
- 保存済み合成会社管理者sessionで`/dashboard`へ到達し、画面の取引先管理からCustomer一覧へ移動した。
- 可視UIから合成Customerを作成し、一覧と詳細への反映を確認した。詳細画面で基本情報と支払条件を別々に更新し、画面再表示後も更新値を確認した。
- active Customerの削除入口が表示されないことを確認した。削除、archive、restoreは実施していない。
- UI操作後のread-only backend確認で、作成documentが契約どおり26 fieldを持ち、`ACTIVE`と更新済み基本情報を保持することを確認した。支払条件3項目の更新値は画面の保存後表示で確認した。
- consoleには外部geocoding拒否による既知の`FirebaseError: internal`が1件あった。これは隔離条件が外部接続を拒否した期待どおりの信号で、住所保存は設計どおり`location=null`で継続し、Customer作成・更新は完了したため、Customer処理の未解決errorとは扱わない。外部作用denyは解除していない。

## 起動経路の判定

- Nuxt開発サーバーはreadyとHTTP 200を確認した後も起動templateから進まず、受入れ成功とは扱わなかった。
- 開発サーバー起動後は`.output`のidentityが失われるため、停止後に専用buildを再実行した。generated serverでは製品画面へ到達し、上記操作を完了した。
- この実測に基づき、generated serverをCodex専用local UI受入れの標準、Nuxt開発サーバーを途中確認・診断用とする。再利用手順はrunbookを正本とし、本receiptへ複写しない。

## 終了確認

- Codexが開いたbrowser tab、generated server、Emulatorを終了し、専用portがLISTENしていないことを確認した。
- `.codex-test/saved-data`は実行前後とも7 files、3492 bytesで、集約SHA-256 `9b5fd0fc7e3e87d6f877b1b26696f5878de2fdd35432f5fc5513b47fa6c5abf0`が一致した。
- 画面から作成したCustomerはEmulator memoryだけに存在し、exportしていない。`.output`は削除済みで、必要時は承認済みcommandで再生成する。

## 完了判定

CUSTOMER-01Aのlocal実装、自動検証、独立review、Codex専用local UI受入れは完了した。上記のexact invocation未記録の補足結果は再現可能な証拠に数えない。Dev反映とDev上の確認、終了・再有効化、archive・restoreは本receiptの完了範囲に含めない。

本receiptは実行時点の証拠であり、後続の現在状態を表さない。現在状態はCustomer実装文書、roadmap、current handoffを参照する。
