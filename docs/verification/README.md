# 検証証拠索引

- 状態: 運用中
- 最終確認日: 2026-09-01
- 役割: 検証方針の変更前後を比較するための実測証拠と機械可読データを案内する。

## 現在の証拠

- [Governance verification benchmark](governance-verification-benchmark.md): common governance 1.4.1の反映前実測、比較契約、制約。1.5.0反映後の値は未測定であり、改善をまだ主張しない。
- [Pre-migration benchmark JSON](governance-verification-benchmark-pre.json): `GOV15-AIRGUARD-PREBENCH-EXEC-001`で保存された環境、対象file集合、全gate・全roundの時間とexit、scenario集計、cleanup、制約の機械可読正本。

## 証拠の扱い

- 実測値は再実行や推測で補完せず、JSONのraw roundを一次証拠とする。
- Markdown本文は人向けの要約であり、数値が競合する場合は同じcommit内のpre JSONを優先して照合する。
- post-migration比較では同じgate ID、command、round順、対象file集合の結び付け、集計規則を維持する。coverageやfailure detectionを落として短縮した値を改善とは扱わない。
- round 1はcold-ish参考値であり、true cold cacheとは扱わない。比較値はround 2〜4の中央値を使う。
