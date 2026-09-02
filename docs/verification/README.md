# 検証証拠索引

この索引は検証証拠の正本へ移動するための案内です。件数、結果、commit、現在状態は各証拠本文または機械可読証拠を参照し、ここへ複写しません。

## 索引

| 目的 | 証拠 |
|---|---|
| 検証方針変更の比較本文 | [Governance verification benchmark](governance-verification-benchmark.md) |
| 変更前の機械可読実測 | [Pre-migration benchmark JSON](governance-verification-benchmark-pre.json) |
| 変更後の機械可読実測 | [Post-migration benchmark JSON](governance-verification-benchmark-post.json) |
| STRIPE-05 Dev release・migration・受入れ | [STRIPE-05 Dev release verification receipt](stripe-05-dev-release.md) |
| 検証選択の判断 | [ADR 0040](../decisions/0040-impact-based-staged-verification.md) |
| 文書責務と最終状態検証の判断 | [ADR 0041](../decisions/0041-single-source-documentation-and-final-validation.md) |
| 機械可読の検証方針 | [Verification policy](../../governance/verification-policy.json) |

## 証拠の扱い

- 実測値は再実行や推測で補完せず、対応するraw evidenceまたはimmutable receiptを一次証拠とする。
- 人向け本文と機械可読証拠が競合する場合は、本文が指定する一次証拠を確認する。
- 実行証拠は実行時点を固定する履歴であり、後続の現在状態を表すものとして使わない。
