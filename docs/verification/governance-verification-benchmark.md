# Governance verification benchmark

- 状態: Pre-migration実測完了 / Post-migration未実施
- checkpoint: `GOV15-AIRGUARD-PREBENCH-EXEC-001`
- 実測日: 2026-09-01
- baseline: `2591372d1550abc9665e864db2e52ab6a7297d5b`
- branch: `codex/dev-user-reservation-migration`
- common governance: `1.4.1`
- machine-readable evidence: [pre JSON](governance-verification-benchmark-pre.json)

## 目的と比較契約

common governance 1.5.0とproject-owned verification selectionを反映する前に、既存1.4.1手順の実行時間、root gate数、既知の内包実行、重複renderer、test/fixture結果を固定する。移行後も同じscenarioのcoverageとfailure-detection目的を維持し、不要な重複を除けたかを比較する。

9 gateを下表の順序でround 1〜4に各1回実行した。各commandはPowerShell Stopwatchで囲み、command自身のexit statusを保存した。round 1はfirst-run/cold-ish参考値だけに使い、round 2〜4の中央値をwarm比較値とする。ベンチマーク自体はこの文書化checkpointで再実行していない。

## Gate catalog

| Gate | Exact command |
|---|---|
| `G-DOC` | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` |
| `G-GOV` | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` |
| `G-RENDER` | `powershell -ExecutionPolicy Bypass -File scripts/render-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2 -Check` |
| `G-DOC-NEG` | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` |
| `G-CAP` | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` |
| `G-DIFF` | `git diff --check` |
| `G-SYNTAX` | `node --check functions/modules/company/updateCompanyArrangement.js` |
| `G-TARGET` | `node --test test/domain/company-arrangement-update.test.mjs` |
| `G-FULL` | `node --test test/domain/*.test.mjs` |

## Raw elapsed time and exit status

単位はms。`warm median`はround 2〜4の中央値である。

| Gate | Round 1 | Round 2 | Round 3 | Round 4 | Warm median | Exit |
|---|---:|---:|---:|---:|---:|---|
| `G-DOC` | 1379.689 | 1399.208 | 1396.209 | 1432.288 | 1399.208 | 0 / 0 / 0 / 0 |
| `G-GOV` | 487.585 | 496.038 | 473.528 | 482.129 | 482.129 | 0 / 0 / 0 / 0 |
| `G-RENDER` | 445.236 | 440.847 | 432.437 | 451.638 | 440.847 | 0 / 0 / 0 / 0 |
| `G-DOC-NEG` | 5815.200 | 5845.742 | 5772.889 | 5792.338 | 5792.338 | 0 / 0 / 0 / 0 |
| `G-CAP` | 3008.887 | 2873.553 | 2907.066 | 2942.075 | 2907.066 | 0 / 0 / 0 / 0 |
| `G-DIFF` | 51.797 | 51.307 | 50.422 | 52.341 | 51.307 | 0 / 0 / 0 / 0 |
| `G-SYNTAX` | 82.501 | 40.477 | 39.340 | 41.686 | 40.477 | 0 / 0 / 0 / 0 |
| `G-TARGET` | 550.713 | 504.208 | 498.422 | 491.280 | 498.422 | 0 / 0 / 0 / 0 |
| `G-FULL` | 1814.312 | 1720.892 | 1713.655 | 1723.010 | 1720.892 | 0 / 0 / 0 / 0 |

## Result counts

- `G-DOC`: 各roundでMarkdown 196、ADR 39、roadmap 5、TOML 8、TOML parser対象8を成功した。
- `G-GOV`: 各roundでcommon 1.4.1、managed hash current、generated `AGENTS.md` current、project rules presentを確認した。
- `G-RENDER`: 各roundでgenerated content current、common SHA-256 `21e2be90d274a11001f788f78e647d7d537a45124baa731be5ccbadf89cd5eca`を確認した。
- `G-DOC-NEG`: 各roundでexpected polarityを持つ8 fixture caseを成功し、各回の一時fixtureを削除した。
- `G-CAP`: 各roundで7 regression checkを成功し、各回の一時fixtureを削除した。
- `G-TARGET`: 各roundで16 test中16 pass、fail/cancelled/skipped/todoは0だった。
- `G-FULL`: 各roundで727 test中727 pass、fail/cancelled/skipped/todoは0だった。
- `G-FULL`の対象はsorted relative path 92件で、UTF-8・LF join・末尾改行なしのpath list SHA-256は`d448a879abc6f5c54ecdcbcdb0f905907216f30ee5412341a1d233c9bc7a0709`である。exact listはpre JSONへ保存する。

## Frozen scenario totals

各warm値はgateごとのwarm medianを合計した値であり、scenario round totalの中央値ではない。

| Scenario | Gates | Root runs | Known gate/script-level physical executions | Round 1 sum ms | Warm-median sum ms |
|---|---|---:|---:|---:|---:|
| `S-DOC` | `G-DOC + G-GOV + G-RENDER + G-DIFF` | 4 | 5 | 2364.307 | 2373.491 |
| `S-APP` | `G-SYNTAX + G-TARGET + G-FULL + G-DOC + G-GOV + G-RENDER + G-DIFF` | 7 | 8 | 4811.833 | 4633.282 |
| `S-GOV` | `G-DOC + G-DOC-NEG + G-CAP + G-GOV + G-RENDER + G-DIFF` | 6 | 21 | 11188.394 | 11072.895 |

`G-GOV`は内部でrenderer `-Check`を実行し、その後にstandalone `G-RENDER`を実行するため、各scenarioでrenderer検証が1回重複する。直接測定できたstandalone重複costはround 1が445.236ms、warm medianが440.847msである。`G-GOV`内部のrendererだけの時間は分離できないため推測しない。

## Environment and final state

- Node.js: `v22.23.2`
- Stopwatch shell: PowerShell Core `7.6.4`
- `powershell` gate shell: Windows PowerShell Desktop `5.1.26100.9168`
- timezone: `Tokyo Standard Time` / `+09:00`
- 実測開始観測: `2026-09-01T18:37:09.4532843+09:00`
- 最終状態観測: `2026-09-01T18:39:40.9106128+09:00`
- 実測終了時はbaseline HEAD・branch不変、index・tracked・untrackedがclean、primary worktree 1件、一時fixture 0件だった。

## Limitations and pending comparison

- round 1はtrue cold-cache measurementではない。
- Stopwatchはprocess起動、output capture、同一Windows hostの負荷を含む。
- Node TAPは実行source manifestを直接出力しないため、`G-FULL`の結び付けは凍結command、前後で不変の92-path list/hash、各roundの727 test結果を組み合わせる。
- build、Dev、Emulator、UI、network、remote/data、Realtime Database Rules、外部service回帰はこのbenchmarkの対象外である。
- post-migration値、効率改善、coverage equivalence、failure-detection equivalenceは未確認であり、まだ主張しない。
- common governance 1.5.0 migration、verification policy導入、affected task turnover、STRIPE-02、Schemas adoptionはこのpre実測保存では開始しない。
