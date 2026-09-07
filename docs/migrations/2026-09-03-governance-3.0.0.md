# Governance 3.0.0と文書整理の移行記録

- 日付: 2026-09-03
- 状態: Local検証・独立review済み、中央によるGit統合準備中。下流taskでのstage拒否は、中央による元の利用者承認の確認と通常auto-reviewを経た28ファイルのstage成功（exit 0）により解消した。local commitの成功は未確定であり、統合結果と最終project-docs・diff-checkの結果は本記録を含むGit commit本文を参照する。中央受入れと後継taskのstartupは別工程。
- 判断: [ADR 0045](../decisions/0045-governance-3-normal-startup.md)
- 変更前: `codex/customer-status` / `54880c32bf0f0473d846c5dbd80cb866d40246ed`。primaryは `C:\Users\seven\projects\AirGuard\air-guard-v2`。
- 承認根拠: 中央ScaffoldProjectGovernanceの `docs/evidence/adoptions/2026-09-03-airguard-v2-governance-3.0.0-preflight.md`。承認済みplanの範囲だけを対象とする。
- Source: installed `C:\Users\seven\.agents\skills\scaffold-project-governance`。中央immutable manifest `docs/evidence/installations/2026-09-03-common-governance-3.0.0.sha256`、revision `4ba483f63e7ce086975b7bce8ae39c7864122aa08094fa82210179e7c94eb87d`、41 filesの一致を確認。

## 範囲と保存

共通governance 1.5.0から3.0.0、文書移行契約1.0.1、Task Replacement 2.0.0へ移行する。既存standard splitを維持し、文書数や容量だけを理由に分割しない。[document-plan.json](document-plan.json)は変更前の3正本57 heading単位と、その他11文書259段落のcontent-free hash mappingを持つ。

製品仕様の更新は開発governance節だけ。製品・data version、application、Functions、Rules、package、agent設定、Customer・Devの未完了作業、CONF-0145/0146、local memo、ignored/local data、nested repositoryは変更しない。roadmapの目標・進捗、data contract、画面manual、immutable receipt、既存Accepted ADR本文は変更対象外。ADR 0030と0041は後継判断の注記を加え、元の本文を保存する。

## Source互換と手順

installed ownership referenceの旧turnover CLI記載と、document contractのCLI配置例は既知のsource差異である。承認済みpreflightに従いfixed-nine syncと現行common/turnover契約を正とし、廃止されたCLIを作らない。文書CLIは中央 `scripts/manage-document-migration.ps1` と `scripts/document-migration-functions.ps1` をcommit `a7f022754faade0ac5ee31471f2f1219bfc8a7a2`との一致確認後に使用した。installed・中央source自体は変更していない。

変更前にDiagnose、NewPlan、ValidatePlan、SyncIndexを順に実施し、各exit 0。ValidatePlanは57単位・unmapped 0、SyncIndexは3対象の既存routeを保持した。後続の結果確認には変更前hashを保持したValidateResultを使う。補助paragraph mappingの意味保存は独立reviewで確認し、CLIのheading件数だけをlosslessの根拠にしない。

## 検証結果と残作業

影響classはgovernance-permissions-agentsと文書変更。governance checker/fixtureの変更はoperations matrixのgovernance分類を使用する。Windows PowerShell 5.1.26100.9168 / Desktop（C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe）で次のcompletion 5 gateを実行した。結果・exitを独立確認した後に記録する。

- `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`
- `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`
- `git diff --check`

renderer-checkはmanaged-governanceに内包する。domain-full、local-emulator-suite、local-ui-build、generate-dev/prodは製品/runtime/releaseへの影響がなく今回の承認外のため選択しない。PowerShell 7、remote freshness、Dev/Prod/data操作、最終後継taskのstartupは未検証。local確認をremote状態と扱わない。

### 実測結果

| Gate | 実測結果 | Exit |
|---|---|---:|
| project-docs | 220 Markdown、45 ADR、6 roadmap、8 TOML。link・anchor・索引・policy確認成功 | 0 |
| project-docs-negative | 28 fixture成功。runtime/class、通常startup、製品未決route、reference存在、既存安全条件を確認 | 0 |
| capacity-regression | 7 checks成功 | 0 |
| managed-governance | common 3.0.0、managed hash/生成物/7 class/11 gate/1 runtime整合。renderer-check内包exit 0 | 0 |
| diff-check | whitespace errorなし | 0 |
| managed Plan | fixed 9 destinations、write 0 | 0 |
| managed Apply | 初回7 writes。review修正後はoperations生成summaryだけを各1 writeで同期 | 0 |
| managed Check | changes_required=False、write 0 | 0 |
| ValidateResult | standard_split、3 targets、result_valid=True | 0 |

managed commandは `powershell -ExecutionPolicy Bypass -File C:/Users/seven/.agents/skills/scaffold-project-governance/scripts/sync-project-governance.ps1 -ProjectPath C:/Users/seven/projects/AirGuard/air-guard-v2` に各 `-Plan`、`-Apply`、`-Check` を付け、独立実行した。結果検証commandは `powershell -ExecutionPolicy Bypass -File C:/Users/seven/projects/ScaffoldProjectGovernance/scripts/manage-document-migration.ps1 -Action ValidateResult -ProjectPath C:/Users/seven/projects/AirGuard/air-guard-v2 -PlanPath C:/Users/seven/projects/AirGuard/air-guard-v2/docs/migrations/document-plan.json`。

独立semantic reviewで259段落のbaseline位置・hash不一致0と、製品・承認・通常delegation・容量・履歴の保存を確認した。旧ADR0011/0032の交代条件との競合とJSON/operations分類の差を修正し、再reviewで追加指摘なし。独立checker reviewでは表、omissionRecord、陰性fixtureの別原因失敗を修正し、再reviewで追加指摘なし。

この表は記録追記直前の結果である。本記録追記で失効するproject-docsとdiff-checkをcommit前に再実行し、その独立exitと統合状態をcommit本文に記録する。checker/fixture/policy/必須route・容量手順・managed入力は本記録追記で変わらないため、他3 gateを再実行しない。今後それらを変更した場合は対応証拠を失効させる。

referencesの2文書は既存の `*.md` ignore対象なので、承認済みexact pathを明示して追跡対象へ含める。root READMEは既存docs routeで到達でき、追加変更不要。agent構成・権限・製品進捗・data/画面仕様の更新はない。最終後継taskは中央が作成し、当該taskの通常startupと明示skill読取りを受け入れる。

## Rollback

上記baselineとGit履歴を保持する。managed syncはinvocation内の変更をrollbackできる。追加復旧はowned scopeを整合した単位でreviewし、commit後はcorrective commitを用いる。広いreset/clean、nested repository、local dataの削除は行わない。
