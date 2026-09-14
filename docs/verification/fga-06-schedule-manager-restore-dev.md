# FGA-06 現場稼働予定Manager復元 Dev反映記録

- Checkpoint: `FGA-06-SCHEDULE-MANAGER-RESTORE-09`
- 実施日: 2026-09-14（Asia/Tokyo）
- 製品commit: `c3439f2de115a82ca29fb23da63275342530ac37`
- release commit: `21013672a471e419ab26272cc80a73325db59db2`
- GitHub Actions: [Dev deployment 34824366589](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34824366589)
- 状態: Firestore Rules・Hostingの初回Dev反映後、上下番確定画面の表示崩れを確認した。補正版commit `12f05e5a`のHosting再反映は完了し、利用者の画面再受入れ待ち

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

## 利用者の受入れとLocal補正

- 2026-09-14のDev受入れで、上下番確定画面に本来の「左側の現場稼働予定一覧」と「右側の選択した予定の詳細・日報写真」が表示されず、外枠のManagerだけが表示される不具合を確認した。
- 過去の同画面と現行Git履歴を照合した結果、`SiteOperationSchedulesManager`が画面本体用の`table`表示口を明示的に定義した後、同じ`table`表示口を汎用転送でも重ねて定義していた。後から定義された空の表示口が本来の左右画面を上書きしたことが原因だった。
- Local補正では、汎用転送の対象から`table`を事前に除外し、画面本体用の表示口を一つだけにした。上下番確定画面の左一覧、右詳細、日報写真の接続を固定する回帰testも追加した。
- 対象test 36/36件、全domain 1,434/1,434件、`npm run build`はそれぞれexit status 0で完了した。最初のsandbox内buildはWindowsの`readlink`権限で停止したため、同じcommandを許可済み環境で再実行して成功を確認した。
- 補正はcommit `12f05e5a29fd3e5097e4d32b87d885686243e20f`へ固定し、GitHub Actions [Dev deployment 34826651693](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34826651693)でHostingへ再反映した。Devの配置管理と上下番確定の再確認が終わるまでcheckpointを完了扱いにしない。

## 表示補正版のDev再反映

- release commit: `12f05e5a29fd3e5097e4d32b87d885686243e20f`
- 対象project: `air-guard-v2-dev`
- release class / service: client / Hostingのみ。変更file判定は`hosting`だけを選択し、Functions、Firestore Rules、Indexes、Storage、Realtime Databaseは対象外だった。
- data影響: なし。maintenance、snapshot、migration、repair、実data操作は行っていない。
- GitHub Actionsでは固定Dev設定、AirVuetify3固定source、依存導入、34 routeの`generate:dev`、鍵なし認証、Firebase CLI `15.29.0`、dry-run、Hosting 189 filesのupload・version releaseが成功し、run全体がexit status 0で完了した。
- `https://air-guard-v2-dev.web.app/`はHTTP 200、`text/html; charset=utf-8`、`no-store, must-revalidate, no-cache`、AirGuard識別子ありを確認し、commandのexit statusは0だった。
- rollbackはcommit `12f05e5a`をrevertした新しいcommitを、同じGitHub Actions経路でHostingへ反映する。現時点でrollbackは不要。
- 未確認は、利用者sessionでの左一覧、右詳細・日報写真、配置管理、上下番確定処理そのものの再操作である。Actions成功やHTTP 200を画面受入れ成功とは扱わない。
