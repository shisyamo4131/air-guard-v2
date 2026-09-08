# 配置管理の楽観的更新 Dev接続受入れ記録

- Checkpoint: `ARR-OPT-DEV-ACCEPT-01`
- 実施日: 2026-09-08
- 対象commit: `6a69b8952b652b93d0c5c00d5ddf4f23ff4a2a55`
- 対象環境: Dev backendへ接続した開発server、およびHosted Devの読取り画面
- 対象actor: 会社管理者

## 結果

利用者は対象commit相当の開発serverをDev環境へ接続して配置管理を操作し、楽観的更新に問題はないと判断した。Localでは同じ実装について、予定作成と作業員のドラッグ配置後に配置人数、作業員tag、仮配置状態が直ちに変わり、listener反映後も予定cardと操作buttonが維持されることを確認済みである。

コーディネーターは利用者が会社管理者でsign-in済みのHosted DevをChromeで開き、配置管理route、日付列、日別人数・状態集計、操作menuが正常に読み込まれることをread-onlyで確認した。表示期間に予定dataがなかったため、Hosted Devでは追加の更新操作を行っていない。consoleにはdashboard時点のbrowser message channel errorが残っていたが、配置管理routeのapplication errorまたは今回のCallable失敗とは確認できなかった。

## 検証

- `node --test test/domain/*.test.mjs`: 1574件成功、exit 0。
- `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`: 成功、exit 0。
- `pwsh -NoProfile -File scripts/test-project-docs-check.ps1`: 成功、exit 0。
- `pwsh -NoProfile -File scripts/test-codex-session-size.ps1`: 成功、exit 0。
- `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`: 成功、exit 0。
- `git diff --check`: 成功、exit 0。
- `ARR-OPT-FINAL-REVIEW`: 全73fileの差分をread-only reviewし、指摘なし。

## 作用・未実施・rollback

- Functions、Rules、schema、保存形式、Dev dataを変更していない。
- Firebase HostingへのDev deploy、Prod、pushは実施していない。
- 短時間の同一予定への連続操作や複数actor競合の完全な順序保証は、承認済みtrade-offとして実装していない。
- code rollbackは本checkpointを含むmain merge commitのrevertを基本とする。data migrationがないためdata rollbackは不要である。
