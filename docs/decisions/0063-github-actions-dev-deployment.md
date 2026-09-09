# ADR 0063: GitHub ActionsによるDev自動deploy

- 日付: 2026-09-09
- 状態: Accepted
- 関連: [Environment and approval rules](../project-rules/environment-and-approval.md)、[Dev deploy runbook](../runbooks/dev-deployment.md)

## 背景

利用者PCからのFirebase CLI deployは、利用者loginの期限切れ、local credentialの権限差、PC固有のtrust設定に左右される。Git pushは元から利用者がcommit単位で承認しており、その直後に同じcommitのDev deployを再度手作業で開始する重複があった。

## 決定

`main`へのpushでGitHub Actionsが変更fileから対象Firebase serviceを選び、`air-guard-v2-dev`へdeployする経路を標準とする。`main` pushの明示承認は、自動選択された対象serviceのDev deploy承認を含む。

GitHub Actions専用service accountを作成し、Workload Identity連携で`shisyamo4131/air-guard-v2`の`refs/heads/main`だけに一時的な権限借用を許可する。長期秘密鍵は作らない。GitHub `dev` Environmentも`main`だけに制限し、Firebase Web設定は暗号化したEnvironment Secretsに保存する。

手動dispatch、再実行、対象serviceの上書き、IAM・credential変更、data migration、repair、Prodはpush承認へ含めず、別承認とする。Actions失敗時にlocal credentialへ自動切替しない。

## 理由

push済みcommitとdeploy artifactを同じSHAへ結び付け、利用者PCのlogin状態と秘密鍵へ依存しない。repository・branch、GitHub Environment、provider条件の三層でDev以外や未承認refからの利用を防ぎ、変更のないserviceを再deployしない。

## 代替案

- 利用者loginを都度更新してlocal deployする: 単純だが期限切れと手作業が残る。
- localサービスアカウント鍵をGitHub Secretへ保存する: 実装は容易だが長期秘密鍵の発行・保管・更新が必要になるため採用しない。
- 全serviceを毎回deployする: 対象判断は簡単だが時間と変更範囲が増えるため採用しない。

## 影響と互換性

Firebase上の製品契約やdata形式は変えない。標準releaseの実行場所と承認境界が変わる。既存local経路は障害時の明示承認fallbackとして保持する。classifierで一括順序が安全でないclient/server変更は個別releaseへ戻す。

## 移行・rollback・検証

初回移行では全serviceを手動dispatchし、鍵なし認証、dry-run、実deploy、Actionsの完了、Dev remote経路を確認する。その後の`main` pushは自動選択を使う。

rollbackはworkflowのpush triggerを無効化し、GitHub `dev` EnvironmentまたはWorkload Identity接続を停止する。必要なreleaseは別承認したlocal fallbackで行う。再検討条件は、対象選択の誤り、必要権限の過大化、OIDCまたはFirebase CLIの継続的な互換性問題、複数Dev環境への拡張である。
