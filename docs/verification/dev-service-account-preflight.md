# Devサービスアカウント Firebase CLI preflight記録

- 状態: Completed diagnostic / Rules権限不足
- 観測時間帯: 2026-09-09 03:48:33〜04:14:22 UTC（2026-09-09 12:48:33〜13:14:22 JST）
- 対象HEAD: `1921b05344f5f122bcf066d12393a678a4e0665d`
- 対象project: `air-guard-v2-dev`
- Firebase CLI: installed `firebase.cmd` 15.28.1
- remote変更: なし

## 目的と境界

既存のDevサービスアカウント鍵をFirebase CLIへprocess内だけで渡し、`firebase login`を使わずにDev projectへ到達できるかを確認した。文書整理中のdirty worktreeで行った認証診断であり、製品release、固定artifact、Dev受入れの証拠ではない。

credentialのpath、内容、account email、token、Firebase app情報、実dataは出力・保存していない。Firebase CLIの保存済み利用者loginと分離するため、一時`XDG_CONFIG_HOME`を使い、終了後に環境変数と一時directoryを削除した。

## 結果

| 確認 | 結果 | exit |
|---|---|---:|
| `AIRGUARD_DEV_CREDENTIAL_PATH`の通常file、JSON、`service_account`、Dev project一致 | 成功 | 0 |
| 一時設定領域と`GOOGLE_APPLICATION_CREDENTIALS`を使った`firebase apps:list --project air-guard-v2-dev --json` | 成功。Firebase CLIからDev projectへのread-only到達を確認 | 0 |
| Hosting dry-run | 成功 | 0 |
| Functions dry-run | 失敗。`iam.serviceAccounts.ActAs`不足 | 1 |
| Firestore Rules dry-run | 失敗。Rules検査APIがHTTP 403 | 1 |
| Firestore Indexes dry-run | 失敗。HTTP 403 | 1 |
| Storage Rules dry-run | 失敗。HTTP 403 | 1 |
| Realtime Database Rules dry-run | 成功 | 0 |
| Firestore RulesとFunctionsの原因分類用再実行 | 同じ権限不足を確認 | 1 |

比較のため、サービスアカウント環境変数と一時設定を使わず、Firebase CLIに保存済みの利用者accountで同じ6対象をdry-runした。保存済みaccountは存在し、Hosting、Functions、Firestore Rules、Firestore Indexes、Storage Rules、Realtime Database Rulesの全対象がexit 0だった。account emailと応答内容は記録していない。

Rules検査APIの応答は`The caller does not have permission`であった。Functionsは対象の実行service accountに対する`iam.serviceAccounts.ActAs`不足を明示した。認証自体とDev projectへのread-only到達は成功しているため、今回確認した失敗層は対象serviceごとのIAM権限である。

## 判断

- 既存サービスアカウントはFirebase CLIの認証経路として使用できる。
- HostingとRealtime Database Rulesはdry-run範囲で成功したが、実deployの書込み権限までは保証しない。
- Functions、Firestore Rules・Indexes、Storage Rulesを含むreleaseは、必要権限が確認・付与されるまでこのcredentialで開始しない。
- 保存済みの利用者accountは、現在の6対象すべてでdry-runが成功した。通常の利用者実行とCodex実行で同じaccount、commit、artifact、project、`--only`指定を使う場合、Firebase側の実行者とdeploy内容に違いはない。
- IAM変更、別credential、`firebase login`、gcloud・RESTの直接deployへの切替は実施していない。
- 対象serviceごとのread-only preflightまたはdry-runをrelease前に行い、失敗時は停止する。
