# 検証証拠索引

- 状態: 運用中
- 最終確認日: 2026-09-01
- 役割: 検証方針の変更前後を比較するための実測証拠と機械可読データを案内する。

## 現在の証拠

- [Governance verification benchmark](governance-verification-benchmark.md): common governance 1.4.1/1.5.0のpre/post実測、operational scenario比較、coverage・failure-detection評価、制約。
- [Pre-migration benchmark JSON](governance-verification-benchmark-pre.json): `GOV15-AIRGUARD-PREBENCH-EXEC-001`で保存された環境、対象file集合、全gate・全roundの時間とexit、scenario集計、cleanup、制約の機械可読正本。
- [Post-migration benchmark JSON](governance-verification-benchmark-post.json): `GOV15-AIRGUARD-POSTBENCH-EXEC-001`の保存済み36 command result、pre/post scenario差、source-set照合、coverage・failure-detection評価、cleanup、制約の機械可読正本。
- [Verification policy](../../governance/verification-policy.json): change class、iteration・targeted・completion・release stage、gate inclusion、invalidation、comprehensive fallbackの機械可読正本。
- [ADR 0040](../decisions/0040-impact-based-staged-verification.md): common governance 1.5.0採用、既存gateの安全目的を維持した段階的選択、移行・rollback・検証条件。

## 証拠の扱い

- 実測値は再実行や推測で補完せず、JSONのraw roundを一次証拠とする。
- Markdown本文は人向けの要約であり、数値が競合する場合は同じcommit内の該当phase JSONを優先して照合する。pre比較値はpre JSON、post実測値と差分はpost JSONを正本とする。
- post-migration比較では同じgate ID、command、round順、対象file集合の結び付け、集計規則を維持する。coverageやfailure detectionを落として短縮した値を改善とは扱わない。
- round 1はcold-ish参考値であり、true cold cacheとは扱わない。比較値はround 2〜4の中央値を使う。
- post benchmarkはPM-14 taskに保存されたexact実測36件を再実行・推測せずpost JSONへ記録した。保存済みpre値だけから導いた算術値をpost実測とは呼ばない。
