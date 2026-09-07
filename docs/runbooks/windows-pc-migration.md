# Windows PC migration runbook

- 状態: 運用中
- 最終確認日: 2026-08-27
- 役割: repository、Git外local data、Codex local stateの安全なPC移行

## Windows PC移行

AirGuardV2とCodex local taskを別のWindows PCへ移す場合、Git repositoryを作業状態の正本とし、Codexのlocal thread復元は補助経路として扱います。新旧PCでWindowsユーザー名とprojectの絶対pathを一致させます。AirGuardV2の標準pathは`C:\Users\seven\projects\AirGuard\air-guard-v2`です。

ChatGPT desktop app for WindowsはWindows nativeとWSL2の両方を選択できます。現在のAirGuardV2 coordinatorはWindows native、PowerShell、保存済みrepositoryへ直接接続するlocal taskです。新PCでも最初はこの構成を維持し、WSLを移行作業の途中で追加・有効化しません。WSLへ切り替える場合は、Windows側`C:\Users\<user>\.codex`とWSL側`/home/<user>/.codex`が別の保存先になることを前提に、別の承認済み移行として扱います。

### 1. 旧PCで作業を確定する

1. application、Emulator、server、browser検証を停止し、専用loopback portにLISTENがないことと`.codex-test/runtime`が空であることを確認します。
2. AirGuardV2と内部`air-vuetify-v3`、同時に移す関連repositoryについて、branch、HEAD、`git status --short`を記録します。
3. 未コミット差分を残しません。未統合branchにupstreamがない場合、remote cloneでは復元できないため、`.git`を含むrepository全体のcopyとGit bundleを両方作成します。pushは代替手段ではなく、別の明示承認が必要です。
4. project-owned validator、managed governance validator、`git diff --check`、必要に応じて`git fsck --full`を実行します。application testを省略する場合は理由をhandoffへ記録します。
5. `.env`系file、利用者用`saved-data`、`.codex-test/saved-data`はGit外の重要local dataとして、内容を表示せず存在、件数、容量だけを確認します。秘密情報と実dataを含み得るため、暗号化された外付けdriveまたは同等の保護された媒体だけを使います。

### 2. Repositoryをbackupする

`<BACKUP_ROOT>`は暗号化された外付けdrive上の新規directoryへ置き換えます。`/MIR`は誤削除を伝播するため使用しません。次のcopyは`.git`、nested repository、`.env`系file、`saved-data`、`.codex-test/saved-data`を含み、再生成可能なdependencyとbuild生成物を除外します。

```powershell
$backupRoot = "<BACKUP_ROOT>"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
robocopy "C:\Users\seven\projects\AirGuard" "$backupRoot\AirGuard" /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /XD node_modules .nuxt dist .output
if ($LASTEXITCODE -ge 8) { throw "AirGuard repository backup failed: robocopy exit $LASTEXITCODE" }
```

copy破損と`.git`欠落に備え、各repositoryの全refをbundleへ保存します。内部`air-vuetify-v3`は親repositoryとは別のGit repositoryなので個別bundleが必要です。

```powershell
$bundleRoot = Join-Path $backupRoot "git-bundles"
New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null
$repoRoots = Get-ChildItem "C:\Users\seven\projects\AirGuard" -Directory | Where-Object { Test-Path (Join-Path $_.FullName ".git") }
foreach ($repo in $repoRoots) {
  git -C $repo.FullName bundle create (Join-Path $bundleRoot ($repo.Name + ".bundle")) --all
  if ($LASTEXITCODE -ne 0) { throw "Git bundle failed: $($repo.FullName)" }
}
git -C "C:\Users\seven\projects\AirGuard\air-guard-v2\air-vuetify-v3" bundle create (Join-Path $bundleRoot "air-vuetify-v3.bundle") --all
if ($LASTEXITCODE -ne 0) { throw "Git bundle failed: air-vuetify-v3" }
Get-ChildItem $bundleRoot -File | Get-FileHash -Algorithm SHA256 | Format-Table -AutoSize | Out-File (Join-Path $backupRoot "git-bundle-sha256.txt") -Encoding utf8
```

### 3. Codex local stateをbackupする

CodexのSQLite、WAL、JSONLを実行中にcopyしません。この手順を実行する前に本taskの最終応答を確認し、ChatGPT desktop app、Codex CLI、IDE extensionを完全に終了します。Task Managerでも関連processが終了したことを確認します。SQLiteを開いて編集、`VACUUM`、WAL削除、schema変更は行いません。

OpenAI認証は新PCで再実行します。`auth.json`はaccess tokenを含むためcopy対象にせず、repositoryや通常のbackupへ含めません。OS credential store、plugin、connector、Firebase CLI、Git hostの認証も新PCで再設定します。

local thread復元はOpenAIの正式なPC間import契約ではないためbest-effortです。経験上重要なthread DB、session JSONL、設定、個人skillだけを、app停止中にportable backupへcopyします。machine固有のsandbox、SID、installation ID、browser profile、worktree、log、cache、credentialはcopyしません。

```powershell
$codexSource = Join-Path $env:USERPROFILE ".codex"
$codexTarget = Join-Path $backupRoot "codex-portable"
New-Item -ItemType Directory -Path $codexTarget -Force | Out-Null
foreach ($name in @("sessions", "archived_sessions", "attachments", "skills", "rules", "plugins")) {
  $source = Join-Path $codexSource $name
  if (Test-Path $source) {
    robocopy $source (Join-Path $codexTarget $name) /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ
    if ($LASTEXITCODE -ge 8) { throw "Codex backup failed: $name" }
  }
}
foreach ($name in @("config.toml", ".codex-global-state.json", ".codex-global-state.json.bak", "session_index.jsonl")) {
  $source = Join-Path $codexSource $name
  if (Test-Path $source) { Copy-Item -LiteralPath $source -Destination $codexTarget -Force }
}
Get-ChildItem $codexSource -File | Where-Object { $_.Name -match "^(state_5|memories_1|goals_1)\.sqlite($|-shm$|-wal$)" } | Copy-Item -Destination $codexTarget -Force
Get-ChildItem $codexTarget -Recurse -File | Get-FileHash -Algorithm SHA256 | Sort-Object Path | Format-Table -AutoSize | Out-File (Join-Path $backupRoot "codex-portable-sha256.txt") -Encoding utf8
```

`auth.json`、`.sandbox-secrets`、`.sandbox`、`.sandbox-bin`、`cap_sid`、`installation_id`、`browser`、`computer-use`、`worktrees`、`logs_*.sqlite*`、`queue_*.sqlite*`、cache、tmpはportable backupへ含めません。他projectのCodex worktreeに未統合差分がある場合は、そのproject側で別途clean handoffまたはGit bundleを作成します。

### 4. 新PCの基盤を準備する

1. Windowsユーザー名を旧PCと同じ`seven`にし、projectを同じ絶対pathへ配置できることを確認します。表示名ではなく`C:\Users\seven`になることを確認します。
2. Windows Update、Git、Node.jsを導入します。Cloud FunctionsはNode.js 22を要求するため、rootと`functions`のlockfileを使えるNode.js 22環境を優先します。
3. ChatGPT desktop appをMicrosoft Storeまたは公式OpenAI Docs記載の`winget install --id 9PLM9XGG6VKS -s msstore`で導入します。
4. 最初はWindows nativeとPowerShellを選び、WSLを有効化しません。sandboxとapproval profileを旧PCと同等に設定します。
5. 外付けdriveをmalware scanし、bundleのSHA-256を再計算してmanifestと一致することを確認します。

### 5. Repositoryとlocal dataを復元する

1. ChatGPT desktop appを閉じた状態で`$backupRoot\AirGuard`を`C:\Users\seven\projects\AirGuard`へcopyします。新規PC側に同名directoryがある場合は`/MIR`や無条件上書きを使わず、退避してから復元します。
2. AirGuardV2のbranch、HEAD、clean worktree、内部`air-vuetify-v3`と関連repositoryのHEAD・cleanを確認します。期待したrefが欠ける場合は、copy元を変更せずGit bundleから別directoryへcloneして照合します。
3. `.env`系file、利用者用`saved-data`、`.codex-test/saved-data`の存在・件数・容量を確認します。値、credential、実dataをterminalやCodex応答へ出力しません。
4. `node_modules`はcopyせず、rootと`functions`でlockfileを確認して`npm ci`により再生成します。package更新、`npm audit fix`、lockfile変更は移行作業へ混ぜません。
5. `.output`、`.nuxt`、`dist`は復元しません。Codex用buildは実行ごとの明示承認が必要であり、mandatory build identity gateが完了するまで旧生成物を受入れ証拠に使いません。

### 6. Codexを復元する

1. ChatGPT desktop appを一度起動してOpenAIへ再loginし、Windows nativeであることを確認して完全に終了します。CLIを使う場合は`codex login status`で認証方式を確認します。
2. 新PCが生成した`C:\Users\seven\.codex`を別名で退避します。portable backupから`config.toml`、skill、rule、plugin、session、attachment、thread DB関連fileを、app停止中に復元します。新PCの`auth.json`、sandbox、SID、installation IDは上書きしません。
3. appを起動し、PM（AirGuardV2）-05 taskが表示され、本文を読めるか確認します。表示されてもrepository identityとCWDを確認するまでは続きを実行しません。
4. thread復元に失敗した場合、SQLiteやWALを修復・編集しません。新PC側`.codex`の退避へ戻し、利用者の明示承認後に新しい連番coordinator taskを保存済みrepositoryへ直接接続し、repositoryのhandoff記録から再開します。
5. pluginとconnectorは個別に再loginし、permissionを確認します。credentialやsession copyを接続確認の代替にしません。

### 7. 変更なしrestore checkpoint

新PCで最初に`PC-MIGRATION-RESTORE-001`を実行します。このcheckpointではapplication、test、Rules、Firebase設定、Emulator、server、browser、remote、external serviceを変更・起動しません。

- cwdとGit top-levelが`C:\Users\seven\projects\AirGuard\air-guard-v2`そのもの。
- branch、handoffに記録したHEAD、root clean。
- `air-vuetify-v3`と関連repositoryのHEAD、clean。
- common governance、active instruction sources、公式進捗、承認境界、mandatory restart 4項目。
- `.env`系file、`saved-data`、`.codex-test/saved-data`は内容を表示せず存在・件数・容量だけ照合。
- project-owned validator、managed governance validator、`git diff --check`が成功。
- Windows native、PowerShell、sandbox、approval、callback destinationが期待どおり。

変更なしcheckpointと、その後の最初の実file限定commitを確認するまで旧PCとbackupを消去しません。新PCでの復元後も、remote、Dev、Prod、利用者用local、実data、external service、push、deploy、main mergeは個別承認なしに実行しません。

参考情報は[OpenAI DocsのWindows app](https://learn.chatgpt.com/docs/windows/windows-app)、[Codex authentication](https://learn.chatgpt.com/docs/auth)、[Codex configuration](https://learn.chatgpt.com/docs/config-file/config-basic)を優先します。2026-03-05の[Windows PC移行経験記録](https://note.com/umarketing/n/n1359dbc60fe1)は、同一ユーザー名・pathとWindows/WSL保存先の分離を確認する補助資料として扱い、製品仕様の正本にはしません。
