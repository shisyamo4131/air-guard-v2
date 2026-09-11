# 検証証拠索引

この索引は検証証拠の正本へ移動するための案内です。件数、結果、commit、現在状態は各証拠本文または機械可読証拠を参照し、ここへ複写しません。

## 索引

| 目的 | 証拠 |
|---|---|
| 検証方針変更の比較本文 | [Governance verification benchmark](governance-verification-benchmark.md) |
| 変更前の機械可読実測 | [Pre-migration benchmark JSON](governance-verification-benchmark-pre.json) |
| 変更後の機械可読実測 | [Post-migration benchmark JSON](governance-verification-benchmark-post.json) |
| DevサービスアカウントのFirebase CLI認証・Rules dry-run | [Devサービスアカウントpreflight記録](dev-service-account-preflight.md) |
| GitHub Actionsによる初回Dev全service deploy | [GitHub Actions Dev deploy初回検証記録](github-actions-dev-deployment.md) |
| 2026-08-27時点のDev Firestore構成 | [Dev Firestore baseline履歴記録](dev-firestore-baseline-2026-08-27.md) |
| STRIPE-05 Dev release・migration・受入れ | [STRIPE-05 Dev release verification receipt](stripe-05-dev-release.md) |
| CUSTOMER-01A local実装・画面受入れ | [CUSTOMER-01A local acceptance verification receipt](customer-01a-local-acceptance.md) |
| CUSTOMER-01B Dev保存形式の読取り検査 | [CUSTOMER-01B Dev compatibility verification receipt](customer-01b-dev-compatibility.md) |
| CUSTOMER-01C local準備・Dev向け生成 | [CUSTOMER-01C local preparation verification receipt](customer-01c-local-preparation.md) |
| CUSTOMER-01D Dev反映・通常操作試験 | [CUSTOMER-01D Dev test](customer-01d-dev-test.md) |
| CUSTOMER-01E local分担検証 | [CUSTOMER-01E local test](customer-01e-local-test.md) |
| CUSTOMER-01E Dev権限別検証 | [CUSTOMER-01E Dev test](customer-01e-dev-test.md) |
| CUSTOMER-02 状態表示・編集 local検証 | [CUSTOMER-02 local検証記録](customer-02-status-local.md) |
| FGA-02 Customer Rules簡素化のDev反映・受入れ | [FGA-02 Customer Rules Dev反映・受入れ記録](fga-02-customer-rules-dev.md) |
| FGA-02 Customer Manager 利用者Local確認 | [FGA-02 Customer Manager 利用者Local検証記録](fga-02-customer-manager-user-local.md) |
| FGA-02 Customer Manager訂正後の利用者Local確認 | [FGA-02 Customer Manager訂正後の利用者Local検証記録](fga-02-customer-manager-correction-user-local.md) |
| FGA-02 Customer Manager訂正のDev反映・受入れ | [FGA-02 Customer Manager Dev反映・受入れ記録](fga-02-customer-manager-dev.md) |
| FGA-02 Customer Manager簡素化のDev反映・受入れ | [FGA-02 Customer Manager簡素化 Dev反映・受入れ記録](fga-02-customer-manager-simplification-dev.md) |
| FGA-03 Site通常認可のLocal実装・検証 | [FGA-03 Site通常認可 Local検証記録](fga-03-site-normal-auth-local.md) |
| FGA-03 Site通常Rules簡素化のLocal検証 | [FGA-03 Site通常Rules簡素化 Local検証記録](fga-03-site-rules-simplification-local.md) |
| Customer archive safety CAS-04 local実装・画面受入れ | [Customer archive safety local acceptance verification receipt](customer-archive-local-acceptance.md) |
| Site SITE-05/06 archive・取極め local実装 | [SITE-05/06 Codex専用local検証記録](site-05-06-local.md) |
| Site SITE-07 一覧・検索・UI整合 local実装 | [SITE-07 Codex専用local検証記録](site-07-local.md) |
| Site SITE-08 local統合・権限別ブラウザ受入れ | [SITE-08 Codex専用local統合確認記録](site-08-local.md) |
| Master Dev Site作成のRules評価上限補正 | [Master Dev Site作成補正記録](master-dev-site-create-correction.md) |
| Outsourcer OUT-07 local統合確認の進行記録 | [Outsourcer OUT-07 local progress](outsourcer-out07-local-progress.md) |
| Outsourcer OUT-07 local統合確認 | [Outsourcer OUT-07 local integration verification receipt](outsourcer-out07-local-integration.md) |
| Employee EMP-02〜04 local検証 | [Employee local検証記録](employee-02-04-local.md) |
| Employee EMP-05 実装前設計レビュー | [Employee実装前レビュー記録](employee-05-design-review.md) |
| Employee EMP-05 local実装・検証 | [Employee EMP-05 local実施記録](employee-05-local.md) |
| Employee EMP-06 一覧・User画面・統括退職 local実装・検証 | [Employee EMP-06 local実施記録](employee-06-local.md) |
| Employee EMP-07 独立課題の分類・確認 | [Employee EMP-07 独立課題確認記録](employee-07-independent-issues.md) |
| Employee EMP-08 Local統合確認 | [Employee EMP-08 Local統合確認記録](employee-08-local.md) |
| Employee Dev反映前archive API接続・Local検証 | [Employee Dev反映前API接続 Local検証記録](employee-dev-preflight-local.md) |
| 配置管理の単純な楽観的更新・Dev接続受入れ | [配置管理の楽観的更新 Dev接続受入れ記録](arrangement-optimistic-dev-acceptance.md) |
| PowerShell検証gateのNorton再検知防止 | [PowerShell検証runtime hardening記録](norton-powershell-gate-hardening.md) |
| 検証選択の判断 | [ADR 0040](../decisions/0040-impact-based-staged-verification.md) |
| 文書責務と最終状態検証の判断 | [ADR 0041](../decisions/0041-single-source-documentation-and-final-validation.md) |
| 機械可読の検証方針 | [Verification policy](../../governance/verification-policy.json) |

## 証拠の扱い

- 実測値は再実行や推測で補完せず、対応するraw evidenceまたはimmutable receiptを一次証拠とする。
- 人向け本文と機械可読証拠が競合する場合は、本文が指定する一次証拠を確認する。
- 実行証拠は実行時点を固定する履歴であり、後続の現在状態を表すものとして使わない。
