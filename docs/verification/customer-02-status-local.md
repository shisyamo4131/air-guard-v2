# CUSTOMER-02 状態表示・編集 local検証記録

- 状態: In progress / 実行済み結果と未実施を分離して記録中
- 日付: 2026-09-03
- checkpoint: `CUSTOMER-02-STATUS`
- branch: `codex/customer-status`
- 開始HEAD: `cfa23595b37f2709131caab6f2a4be03713a8f95`
- 対象: [状態編集ロードマップ](../roadmaps/customer-status.md)のlocal工程。Dev反映・受入れ、実data、請求・PDF、archive・restoreは対象外。

## 設計・差分review

- `CUSTOMER-02-DESIGN`（High）: 基本operation再利用、CREATE状態非入力、状態単独patch、一覧購読引数補正、非同期準備後の再確認、基本editor rollback解除を採用。
- `CUSTOMER-02-SECURITY-DESIGN`（High）: actor・tenant・26field・監査metadata・enum・支払混合拒否・delete/archive拒否を維持する条件で採用。
- `CUSTOMER-02-DOC-DESIGN-CHECK`（High、68秒）: 旧一覧ACTIVE限定断定と状態変更を後続専用操作とする記述を指摘。coordinatorが修正した。
- `CUSTOMER-02-CODE-REVIEW`（High、93秒）と`CUSTOMER-02-SECURITY-FINAL`（High）: application/Rules 7file差分に新規blocking指摘なし。静的reviewであり実行検証やrelease GOではない。
- security監査の既存残存risk: 郵便番号の独自長上限なし、派生情報の意味上の再計算不可。今回の状態変更による新規問題ではなく、独断でSchema制約を追加しない。

## 自動test・command結果

各実行は開始HEAD上の該当差分へ束縛する。最終commandの適用stateとbuild sourceは確定後に追記する。後続のapplication/Rules/test変更が該当gateを失効させた場合は再実行する。

| 段階 | Command | 結果 | Exit |
|---|---|---|---:|
| iteration | `node --test test/domain/customer-operations.test.mjs test/domain/customer-ui-source-contract.test.mjs test/domain/customer-status-sync.test.mjs test/domain/customer-list.test.mjs` | 44/44成功、228.8024 ms。初回はSchema getterの参照比較というtest不具合で39/40、構造比較へ修正後に再実行 | 0 |
| iteration | `node --check test/local/codex-local-harness.test.mjs` | 構文確認成功 | 0 |
| completion | `node --test test/domain/*.test.mjs` | 839/839成功。Node計測1.931秒 | 0 |
| completion | `npm run test:local` | 118/118成功。Node試験部分48.717秒。wrapperも0 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 21 fixture成功 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 7 checks成功、tool計測3.333秒 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功、内包rendererも0。tool計測0.839秒 | 0 |
| completion | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 未実施 | — |
| completion | `git diff --check` | 最終状態は未実施 | — |
| completion | `npm run test:local:ui:build` | 未実施。clean commit後に実行 | — |

## Emulator後処理

`CUSTOMER-02-VALIDATE`で、実設定・wrapperを照合し、専用demo project・loopback・外部作用deny・`isolated-saved-data`読込みで実行した。利用者saved-dataと専用exportの指紋はwrapperで前後一致。専用容量16,091 bytesで前後不変、専用7 portsとFunctions検出用8353のLISTENなし。自身のruntime `test-harness-44828`を削除し、既存runtime directoryは変更しなかった。CLIのMOTD取得不可・認証期限警告は再認証せず扱い、suiteは正常終了した。これはremote認証の確認・更新ではない。

## 証拠の分担

- domain: CREATE固定、状態patch/no-op、基本/支払分離、draft/競合/rollback、準備中の権限・UID・会社・instance変更、状態別一覧購読、終了済みの検索・ID取得・cache保持。
- Emulator: Rulesの許可4actor両方向、陰性actorの既存document update、値/型/削除/metadata/派生値/混合更新拒否、role剥奪、関連Site・予定存在、両状態のdelete/archive/nested拒否。fixtureは合成で、UI操作証拠にはしない。
- production同期handler: 実`onUpdateCustomer`をmock隔離して同社Siteの`customer`だけを更新することを検査。予定とSite自身の状態を変更しない。専用local Functionsはこのtriggerをexportしないため、triggerの配備・実発火成功や非同期配送を検証したとはしない。
- visible UI: 未実施。専用generated serverでCustomer正規作成、状態の取消・保存・戻し・再表示、一覧filter、基本/支払編集を確認する。業務対象の非UI注入は行わない。

## 未検証・残存制約

- Dev・Prod・remote状態と実trigger配送、既存不適合documentへの保存、正式運用可否は未確認。
- 新しい状態filterの見た目・使い勝手は利用者判断を残す。Dev延期をその受入れの自動成功にはしない。
- 一覧adapterの非同期listener error通知不足、送信後の同時更新競合、Payment editorの既存独自rollback経路、CREATE準備後の再認可は今回の限定補正外。
- `generate-dev`/`generate-prod`は別環境release未承認なので省略。standalone rendererはmanaged-governance内包のため重複しない。package・governance/権限設定・data形状変更やmigrationはない。
- 環境cleanup、saved-data不変、最終worktree・commitは実行後に確定する。
