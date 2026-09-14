# FGA-06 現場稼働予定Manager復元 Dev反映記録

- Checkpoint: `FGA-06-SCHEDULE-MANAGER-RESTORE-09`
- 実施日: 2026-09-14（Asia/Tokyo）
- 製品commit: `c3439f2de115a82ca29fb23da63275342530ac37`
- release commit: `21013672a471e419ab26272cc80a73325db59db2`
- GitHub Actions: [Dev deployment 34824366589](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34824366589)
- 状態: Firestore Rules・HostingのDev反映完了。正規画面の業務操作受入れは未実施

## Release境界

- 対象はDev project `air-guard-v2-dev`のFirestore `(default)`とHosting。GitHub Actionsの変更file判定は`firestore,hosting`を選択した。
- release classはclient／Rules同時変更。schema・migration・既存dataの一括変更・Functions変更はない。
- data更新、maintenance、snapshotは実施していない。rollbackは製品commitをrevertした新しいcommitを、承認済みのGitHub Actions経路で再反映する。
- 停止条件は対象serviceの不一致、Dev設定検査、生成、認証、dry-runまたは実deployの失敗とした。該当する失敗はなかった。

## Release前検証

[Local検証記録](fga-06-schedule-manager-restore-local.md)のdomain 1,434件、Local Emulator 178件、専用UI buildを再利用した。製品source・Rules・testはその後変更されていない。release commitに対して次を個別実行し、すべてexit status 0を確認した。

| gate / command | 結果 | exit status |
|---|---|---:|
| `npm run generate:dev` | Dev向け静的画面、34 route、Service Workerを生成 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 319 Markdown、73 ADR、12 roadmaps、8 TOML pass | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | negative fixtures pass | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks pass | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hashes・生成AGENTS・policy整合 pass | 0 |
| `git diff --check` | errorなし | 0 |

## GitHub Actionsと配信確認

- `main`を`65a10bde`からrelease commit `21013672`へpushし、GitHub Actions run `34824366589`を開始した。
- 固定Dev設定、AirVuetify3固定source、Hosting依存導入、`generate:dev`、鍵なし認証、Firebase CLI `15.29.0`、Firebase dry-runが成功した。Functionsは対象外のため依存導入を省略した。
- Firestore Rulesのcompile・release、Firestore indexesのdeploy、Hosting 189 filesのupload・version releaseが成功し、Actions全体はexit status 0で完了した。
- `https://air-guard-v2-dev.web.app/`へHTTP GETを行い、status 200、`text/html; charset=utf-8`、`no-store, must-revalidate, no-cache`、AirGuard識別子を確認した。commandのexit statusは0だった。
- local HEADと取得済み`origin/main`はrelease commit `21013672`で一致し、worktreeはcleanだった。

## 未実施・残存risk

- 配置管理と上下番確定の正規画面操作、保存・再表示、見た目、remote Trigger logは未確認。今回のdeploy成功を、利用者報告エラーの修正成功とは扱わない。
- Rulesの正常・拒否経路はLocal Emulatorを正とし、Dev実dataを使う書込みprobeは行っていない。
- 同じtenant内の直接書込みがmodelの入力確認を迂回できる、簡素化に伴う既知riskは変わらない。
- Prod、Functions、実data、migration、IAM、credentialは変更していない。

## 利用者の受入れ

Devの正規画面で配置管理と上下番確定を確認し、成功または表示されたerrorと操作手順をこのcheckpointへ追記する。受入れ完了まではcheckpointを完了扱いにしない。
