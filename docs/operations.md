# AirGuardV2 運用・開発手順

- 状態: 運用中
- 役割: AirGuardV2固有の共通運用入口、検証policyの人向け経路、Prod・復旧・backup・秘密情報の共通境界
- 規則の正本: [Project rules index](../governance/project-rules.md)

## 現在利用できる運用

実行可能な作業と状態は[Runbook索引](runbooks/README.md)を正本とし、この文書へ個別の起動・検証・deploy手順を複写しない。通常開発、Local、Dev deploy、data migration、maintenance、package、Git・task管理は、同索引から今回必要なrunbookだけを選ぶ。

Prodの共通deploy手順、正式な監視、SLA、RPO/RTO、全systemを復旧できるbackup範囲は未確定である。Prod操作は対象環境、artifact、認証、service、data影響、backup、rollback、停止条件、受入れを個別に確定し、別の明示承認を得る。

## Verification Matrix

`governance/verification-policy.json`を機械可読の正本とする。変更class、stage、gate、exact command、includes、失効条件、省略理由は次の生成summaryから確認し、手書きの対応表を重ねない。Codex専用Local、利用者環境Local、Devの選択は[Environment and approval rules](project-rules/environment-and-approval.md#local-emulatorとlocal-ui)を正本とする。

<!-- BEGIN GENERATED VERIFICATION POLICY SUMMARY -->
- Root: schemaVersion=1.0; comprehensiveGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]; unknownImpactGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]
- RuntimeProfile: id=powershell-7; platform=windows; edition=Core; executable=pwsh; versionRule=minimum-major=7; required=True; supportStatus=supported
- Class: id=project-guidance-metadata; triggers=[Descriptive project guidance\, phase/progress\, metadata\, links/history\, or document-only structure with no common-contract\, policy\, permission\, approval\, safety\, or executable behavior change]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-docs]; completionGateIds=[project-docs,diff-check]; releaseOnlyGateIds=[]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,domain-full,local-emulator-suite,local-ui-build,generate-dev,generate-prod]; omissionRecord=Completion report or migration evidence
- Class: id=documentation-only; triggers=[Project-owned prose\, index\, link\, or post-completion historical record that does not alter a release baseline\, target\, artifact\, readiness decision\, procedure\, approval\, rollback\, product behavior\, or remote state]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-docs]; completionGateIds=[project-docs,diff-check]; releaseOnlyGateIds=[]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,domain-full,local-emulator-suite,local-ui-build,generate-dev,generate-prod]; omissionRecord=Completion report
- Class: id=ui-css-layout; triggers=[Vue component presentation\, CSS\, layout\, accessibility\, browser interaction\, or user-visible UI behavior]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[domain-full]; completionGateIds=[project-docs,domain-full,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,local-emulator-suite,local-ui-build]; omissionRecord=Completion report or acceptance receipt
- Class: id=application-logic; triggers=[Client\, server\, Functions\, shared module\, or executable script behavior without a data-contract or release-boundary change\; governance-only checkers and fixtures that do not change product logic belong to governance-permissions-agents instead]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[domain-full]; completionGateIds=[project-docs,domain-full,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,local-emulator-suite,local-ui-build]; omissionRecord=Completion report
- Class: id=data-contract-schema-migration; triggers=[Firestore\, Realtime Database\, Storage\, schema\, package contract\, migration\, Rules\, or persisted-data compatibility]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[domain-full,local-emulator-suite]; completionGateIds=[project-docs,domain-full,local-emulator-suite,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[project-docs-negative,capacity-regression,managed-governance,local-ui-build]; omissionRecord=Completion report or migration receipt
- Class: id=governance-permissions-agents; triggers=[Common or project governance\, verification policy\, permissions\, approval policy\, coordinator duties\, agents\, managed sync\, or generated AGENTS]; iterationGateIds=[managed-governance,project-docs]; targetedRegressionGateIds=[project-docs-negative,capacity-regression]; completionGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]; releaseOnlyGateIds=[]; omittableGateIds=[]; omissionRecord=Completion report or migration evidence
- Class: id=build-release-deploy; triggers=[Actual build\, static generation\, package installation or publication\, Dev or Prod deploy\, or remote acceptance execution\; release readiness decision\; or release contract\, baseline\, target\, artifact\, or procedure change]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-docs,domain-full]; completionGateIds=[project-docs,project-docs-negative,capacity-regression,managed-governance,diff-check]; releaseOnlyGateIds=[generate-dev,generate-prod]; omittableGateIds=[local-emulator-suite,local-ui-build]; omissionRecord=Approved release checkpoint evidence or completion report
- Gate: id=diff-check; command=git diff --check; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Any later worktree edit]; evidenceDestination=Command report
- Gate: id=renderer-check; command=pwsh -NoProfile -File scripts/render-governance.ps1 -ProjectPath C:\\Users\\seven\\projects\\AirGuard\\air-guard-v2 -Check; stages=[iteration,targeted]; includes=[]; invalidatedBy=[Managed common\, governance lock\, renderer\, project rules\, verification policy\, or generated AGENTS change]; evidenceDestination=Command report or included managed-governance result
- Gate: id=managed-governance; command=pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\\Users\\seven\\projects\\AirGuard\\air-guard-v2; stages=[iteration,targeted,completion]; includes=[renderer-check]; invalidatedBy=[Managed common\, governance lock\, renderer\, validator\, project rules\, verification policy\, generated AGENTS\, or verification summary change]; evidenceDestination=Command report
- Gate: id=project-docs; command=pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\\Users\\seven\\projects\\AirGuard\\air-guard-v2; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Project Markdown\, TOML\, document routing\, verification policy\, or project document validator change]; evidenceDestination=Command report
- Gate: id=project-docs-negative; command=pwsh -NoProfile -File scripts/test-project-docs-check.ps1; stages=[targeted,completion]; includes=[]; invalidatedBy=[Project document validator\, its negative fixtures\, validator-required documentation route\, or verification-policy contract change]; evidenceDestination=Command report
- Gate: id=capacity-regression; command=pwsh -NoProfile -File scripts/test-codex-session-size.ps1; stages=[targeted,completion]; includes=[]; invalidatedBy=[Capacity aliases\, capacity runbook\, capacity measurement command or script\, or capacity regression fixture change]; evidenceDestination=Command report
- Gate: id=domain-full; command=node --test test/domain/*.test.mjs; stages=[targeted,completion]; includes=[]; invalidatedBy=[Application\, Functions\, Rules contract\, schema\, shared module\, or domain test change]; evidenceDestination=Command report
- Gate: id=local-emulator-suite; command=npm run test:local; stages=[targeted,completion,release]; includes=[]; invalidatedBy=[Functions\, Rules\, schema\, Emulator configuration\, test harness\, or affected application behavior change]; evidenceDestination=Checkpoint callback\, completion report\, or release evidence
- Gate: id=local-ui-build; command=npm run test:local:ui:build; stages=[targeted,completion,release]; includes=[]; invalidatedBy=[UI source\, client configuration\, dependencies\, build wrapper\, or affected application behavior change]; evidenceDestination=Checkpoint callback\, acceptance receipt\, or release evidence
- Gate: id=generate-dev; command=npm run generate:dev; stages=[release]; includes=[]; invalidatedBy=[Source\, dependency\, Dev environment mapping\, or release baseline change]; evidenceDestination=Approved Dev release evidence
- Gate: id=generate-prod; command=npm run generate:prod; stages=[release]; includes=[]; invalidatedBy=[Source\, dependency\, production environment mapping\, or release baseline change]; evidenceDestination=Approved Prod release evidence
<!-- END GENERATED VERIFICATION POLICY SUMMARY -->
### Gate Catalog and Inclusion

- gateの選択とexact commandは、上の生成summaryと[verification policy](../governance/verification-policy.json)を使用する。
- `managed-governance`は`renderer-check`を内包する。内包関係を満たす同じgateを重複実行しない。
- application固有の対象testは、選択したrunbookと変更範囲から追加する。

### Evidence Validity

結果の再利用、後続変更による失効、実行結果と独立exit status、省略理由の記録は[Documentation and verification rules](project-rules/documentation-and-verification.md#verification)に従う。LocalとDevの役割を読み替えず、実行回数ではなく今回必要な証明事項で環境を選ぶ。

## 共通準備

1. [文書案内](README.md)で作業種別を選び、[Runbook索引](runbooks/README.md)から必要な手順だけを読む。
2. 対象repository、branch、commit、環境、service、data影響、承認範囲を、選択したrunbookの開始条件に従って固定する。
3. runtime、依存関係、設定、認証は、package manifest、verification policy、対象runbook、actual targetから確認する。すべての作業にFirebase CLI認証や特定の`.env`を一律要求しない。
4. dependency installが必要な場合はlock fileと差分を確認し、対象runbookが指定する固定installを使う。証明書対応、Firebase CLI、Windows固有設定は[該当runbook](runbooks/README.md)へ従い、共通設定として複写しない。

## 作業別runbook

作業ごとの正本、状態、追加確認対象は[Runbook索引](runbooks/README.md)に集約する。Codex専用Local、利用者環境Local、Devを混在させず、環境の定義と承認は[Environment and approval rules](project-rules/environment-and-approval.md)を使用する。

Devの標準経路は[Dev deploy runbook](runbooks/dev-deployment.md)、maintenanceを伴うdata変更は[maintenance・data change runbook](runbooks/maintenance-and-data-change.md)を使用する。Prodは上記の未確定境界を先に解消する。

## 出力と完了判定

生成物、log、画面、data、cleanup、rollbackの確認方法は、選択したrunbookの完了条件を使う。特定実行のcommit、件数、結果は[検証証拠索引](verification/README.md)から対応するreceiptへ記録し、この共通入口へ蓄積しない。

commandの完了だけで成功とせず、選択したgateのexit statusと、今回の変更が必要とする環境・機能の受入れを確認する。利用者による画面確認を全変更へ一律に要求せず、[検証規則](project-rules/documentation-and-verification.md#verification)に従って必要な証明だけを選ぶ。

## ガバナンス文書の確認

Project-owned文書とmanaged governanceの検証は、上の生成summaryにあるgate IDとexact commandを使用する。変更classごとのcompletion gateは[verification policy](../governance/verification-policy.json)を正本とし、短縮command、既定pathへの依存、後続編集で失効した結果を完了証拠にしない。

managed common、lock、renderer、生成`AGENTS.md`は直接編集しない。AirGuardV2固有の規則は[Project rules index](../governance/project-rules.md)、文書の責務と索引更新は[Documentation and verification rules](project-rules/documentation-and-verification.md)へ従う。

## エラーと復旧

失敗時は対象環境と成功済み作用を再取得し、選択したrunbookの停止・復旧手順を使う。deploy、migration、repairの部分成功後に対象を推測して再実行・削除せず、同じcommit・scopeで限定再試行できるかを確認する。data変更を伴う場合は[maintenance・data change runbook](runbooks/maintenance-and-data-change.md)へ戻る。

PWA更新問題ではService Worker、cache header、登録状態を確認し、利用者dataを失う一律削除を安易に案内しない。

## バックアップと保持

- backupの要否と復旧方法はreleaseまたはdata changeごとに決める。data migrationは[data migration runbook](runbooks/data-migrations.md)、整合snapshotを要する作業は[maintenance・data change runbook](runbooks/maintenance-and-data-change.md)を使用する。
- Firestore PITRは、release固有の整合snapshot、Storage・Authentication・外部serviceのbackup、復旧演習を代替しない。確認済み時点のDev Firestore状態は[履歴記録](verification/dev-firestore-baseline-2026-08-27.md)を参照し、現在のcritical identifierとして使う前にactual targetを再確認する。
- 正式な監視、SLA、RPO/RTO、backup scopeの残作業は[project roadmap](roadmaps/airguard-v2.md)を正本とする。
- 文書と仕様の履歴はGitで保持する。

## 秘密情報

秘密値、credential、実account、個人・顧客・勤怠・請求dataの保護と転記禁止は[Environment and approval rules](project-rules/environment-and-approval.md#承認と保護対象)と[common governance](../governance/common-governance.md#safety-and-sensitive-information)に従う。個別serviceのSecret管理をこの共通入口へ重複記載しない。
