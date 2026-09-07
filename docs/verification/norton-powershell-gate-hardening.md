# PowerShell検証runtime hardening記録

- 日付: 2026-09-07
- checkpoint: EMP-08開始前の独立Norton再検知防止
- baseline: branch `codex/employee-master-roadmap`、commit `5def8bc76acf078cafc258d06ff7ea8f6dad63cc`
- 対象: repository-owned PowerShell gateとfixture
- 対象外: Nortonの保護・除外設定、UI、製品logic、Dev/Prod、remote、実data

## 変更前の利用者確認

利用者がNorton Security Historyで次を確認した。

- 脅威名: `IDP.HELU.PSE90 - コマンド ライン検出`
- 検出機能: ふるまい検知
- 最終使用日時: 2026-09-03 08:15
- process: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- 削除済みfile: Temp内の`__PSScriptPolicyTest_*.ps1`

この履歴は旧commandとの因果を単独で証明しない。旧gateに`-ExecutionPolicy Bypass`、Base64復号、子`powershell.exe`、Temp fixtureが併存していたため、各条件を分離して確認した。

## 段階検証

| 条件 | 結果 | Norton差分 |
|---|---|---|
| Base64・子PowerShell・Bypass・Tempなしの`check-project-docs.ps1` | 初回は既存不可視BOMを検出して修正。修正版は256 Markdown、60 ADR、11 roadmaps、8 TOML、exit 0 | 各実行後に利用者が新規検出なしを確認 |
| Base64・子PowerShell・Bypassなし、Tempありの`test-project-docs-check.ps1` | 初回はliteral不一致を検出して修正。修正版は全29 fixture期待一致、exit 0 | 各実行後に利用者が新規検出なしを確認 |
| 子PowerShell・Bypassなし、Tempありの`test-codex-session-size.ps1` | 文字列配列の位置引数化を検出しHashtableへ修正。修正版は7 checks、exit 0 | 診断・修正版実行後に利用者が新規検出なしを確認 |

## 判定

PowerShell 7の現processで、Base64復号とlegacy子PowerShellを除去しても従来の検証内容を維持できた。Temp fixtureを含む検証でも新規検出はなかった。正式policyとrunbookを`pwsh -NoProfile`へ移行し、最終comprehensive gateとNorton差分確認を行う。

## 正式policy反映後のcomprehensive gate

| Gate | Command | 結果 |
|---|---|---|
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 258 Markdown、61 ADR、11 roadmaps、8 TOML、exit 0 |
| project-docs-negative | `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全29 fixture期待一致、exit 0 |
| capacity-regression | `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks、exit 0 |
| managed-governance | `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash・生成物・policy summary・renderer整合、renderer exit 0を含めexit 0 |

この追記後の`project-docs`再実行と最終`diff-check`はcheckpoint completion reportへ独立exit statusを記録する。利用者は正式comprehensive gate実行後にもNorton履歴を確認し、新しい`IDP.HELU.PSE90`がないことを確認した。

## 未確認と停止条件

- Norton内部の検知規則と旧検出の厳密な因果は確認できない。
- 新しい`IDP.HELU.PSE90`が発生した場合は影響するPowerShell gateを停止し、Norton除外や保護無効化では迂回しない。
