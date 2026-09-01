# Governance verification benchmark

- 状態: Pre/Post実測・比較完了
- checkpoints: `GOV15-AIRGUARD-PREBENCH-EXEC-001` / `GOV15-AIRGUARD-POSTBENCH-EXEC-001`
- 実測日: 2026-09-01
- pre baseline: `2591372d1550abc9665e864db2e52ab6a7297d5b`
- post baseline: `18c2a5b724351bc2c54591b1b6c18f30d3fa72e3`
- branch: `codex/dev-user-reservation-migration`
- common governance: pre `1.4.1` / post `1.5.0`
- machine-readable evidence: [pre JSON](governance-verification-benchmark-pre.json) / [post JSON](governance-verification-benchmark-post.json)

## 目的と比較契約

common governance 1.5.0とproject-owned verification selectionの反映前後で、実行時間、root gate数、既知の内包実行、重複renderer、test/fixture結果を比較する。移行後も同じscenarioのcoverageとfailure-detection目的を維持し、不要な重複を除けたかを確認する。

pre/postとも9 gateを下表の順序でround 1〜4に各1回実行した。各commandはPowerShell Stopwatchで囲み、command自身のexit statusを保存した。round 1はfirst-run/cold-ish参考値だけに使い、round 2〜4の中央値をwarm比較値とする。post値はPM-14 taskに保存された36件のexact `CommandExecution` resultから記録し、この文書化checkpointではベンチマークを再実行せず、欠損値を推測していない。

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

## Pre-migration raw elapsed time and exit status

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

## Post-migration raw elapsed time and exit status

単位はms。`warm median`はround 2〜4の中央値である。

| Gate | Round 1 | Round 2 | Round 3 | Round 4 | Warm median | Exit |
|---|---:|---:|---:|---:|---:|---|
| `G-DOC` | 1485.875 | 1429.704 | 1450.262 | 1457.480 | 1450.262 | 0 / 0 / 0 / 0 |
| `G-GOV` | 541.239 | 568.557 | 541.139 | 540.293 | 541.139 | 0 / 0 / 0 / 0 |
| `G-RENDER` | 384.458 | 388.652 | 374.188 | 382.271 | 382.271 | 0 / 0 / 0 / 0 |
| `G-DOC-NEG` | 8622.382 | 8661.568 | 8474.199 | 8584.247 | 8584.247 | 0 / 0 / 0 / 0 |
| `G-CAP` | 2589.233 | 2562.793 | 2547.425 | 2534.186 | 2547.425 | 0 / 0 / 0 / 0 |
| `G-DIFF` | 62.005 | 62.053 | 59.640 | 64.848 | 62.053 | 0 / 0 / 0 / 0 |
| `G-SYNTAX` | 95.148 | 50.024 | 47.967 | 53.655 | 50.024 | 0 / 0 / 0 / 0 |
| `G-TARGET` | 569.253 | 522.009 | 511.906 | 525.590 | 522.009 | 0 / 0 / 0 / 0 |
| `G-FULL` | 1803.745 | 1780.692 | 1754.447 | 1828.105 | 1780.692 | 0 / 0 / 0 / 0 |

## Result counts

- `G-DOC`: preのMarkdown 196 / ADR 39 / roadmap 5 / TOML 8から、postは199 / 40 / 5 / 8となった。post各roundで同じcountを成功した。
- `G-GOV`: post各roundでcommon 1.5.0、managed hash・generated `AGENTS.md` current、project rules・verification policy present、11 gate / 6 class、inclusion graph valid、documentation aligned、embedded renderer exit 0を確認した。
- `G-RENDER`: post各roundでgenerated content current、common SHA-256 `0a13fc03273030594e4355dc3ec29b62ee1abb350311761de77154817fcaf6ac`を確認した。
- `G-DOC-NEG`: pre 8 fixtureからpost 12 fixtureへ増え、verification-policy route、invalid JSON、Verification Matrix heading、`INITIAL_PROMPT.md` routeのfailure detectionを追加した。post各roundで12/12 expected polarityを成功し、一時fixtureはbefore/after 0だった。
- `G-CAP`: pre/postとも各roundで7 regression checkを成功し、一時fixtureはbefore/after 0だった。
- `G-TARGET`: pre/postとも各roundで16 test中16 pass、fail/cancelled/skipped/todoは0だった。
- `G-FULL`: pre/postとも各roundで727 test中727 pass、fail/cancelled/skipped/todoは0だった。
- `G-FULL`の対象はpre/postの開始前・終了後ともsorted relative path 92件で、UTF-8・LF join・末尾改行なしのpath list SHA-256 `d448a879abc6f5c54ecdcbcdb0f905907216f30ee5412341a1d233c9bc7a0709`とexact path listが一致した。exact listはpre JSON、postの照合結果はpost JSONへ保存する。

## Operational scenario comparison

各warm値はgateごとのwarm medianを合計した値であり、scenario round totalの中央値ではない。

| Scenario | Post gates | Root pre→post | Physical pre→post | Round 1 pre→post | Warm pre→post | Warm change |
|---|---|---:|---:|---:|---:|---:|
| `S-DOC` | `G-DOC + G-DIFF` | 4→2 (-50.0000%) | 5→2 | 2364.307→1547.880ms (-34.5313%) | 2373.491→1512.315ms | -36.2831% |
| `S-APP` | `G-SYNTAX + G-TARGET + G-FULL + G-DOC + G-DIFF` | 7→5 (-28.5714%) | 8→5 | 4811.833→4016.026ms (-16.5385%) | 4633.282→3865.040ms | -16.5809% |
| `S-GOV` | `G-DOC + G-DOC-NEG + G-CAP + G-GOV + G-DIFF` | 6→5 (-16.6667%) | 21→24 | 11188.394→13300.734ms (+18.8797%) | 11072.895→13185.126ms | +19.0757% |

post policyでは`G-GOV`がrendererのnamed resultとexit statusを保持するため、standalone `G-RENDER`をoperational `S-GOV`から除外する。post benchmarkでのstandalone実行はpreとのcommand-level parityだけを目的とし、推奨する重複実行ではない。standalone comparable costはround 1で445.236→384.458ms (-13.6507%)、warm medianで440.847→382.271ms (-13.2871%)だった。`G-GOV`内部のrendererだけの時間は分離できないため推測しない。

`S-GOV`のknown physical executionはstandalone renderer 1回を除いた一方、negative checker invocationが8→12へ4回増えたため21→24となった。root選択は6→5へ効率化したが、追加failure detectionによりraw wall-clockは約19%増加したため、時間増加をfailureとは扱わない。

## Coverage and failure-detection assessment

- `S-DOC`: policyが定めるdocumentation-only境界内ではcoverage・failure detectionともequal以上である。managed-governance driftはこのscenarioの対象外であり、`S-GOV`またはcomprehensiveへrouteする。
- `S-APP`: target 16/16、full 727/727、syntaxとtargetedを維持したためapplication behaviorはequalである。文書・verification-policy routeの検出はstrongerであり、managed-governance検査はgovernance classへrouteする。
- `S-GOV`: 12 negative fixture、policy JSON/routing/Matrix/`INITIAL_PROMPT.md`、11-gate/6-class inclusion graph、documentation alignment、embedded renderer exitを検査するためstrongerである。capacity 7とdiff-checkも維持する。
- build、Dev、Emulator、UI、network、remote/data、Realtime Database Rules、外部serviceはpre/postともmodeled-only/unverifiedであり、equivalenceを主張しない。

## Environment and final state

- Node.js: `v22.23.2`
- Stopwatch shell: PowerShell Core `7.6.4`
- `powershell` gate shell: Windows PowerShell Desktop `5.1.26100.9168`
- timezone: `Tokyo Standard Time` / `+09:00`
- pre実測開始/最終: `2026-09-01T18:37:09.4532843+09:00` / `2026-09-01T18:39:40.9106128+09:00`
- post実測開始/終了: `2026-09-01T19:26:21.1010805+09:00` / `2026-09-01T19:27:25.1233237+09:00`
- post最終状態観測: `2026-09-01T19:30:42.0108529+09:00`
- post終了時はbaseline HEAD `18c2a5b724351bc2c54591b1b6c18f30d3fa72e3`・branch不変、upstream none、index・tracked・untrackedがclean、primary worktree 1件、一時fixture 0件だった。

## Limitations

- round 1はtrue cold-cache measurementではない。
- Stopwatchはprocess起動、output capture、同一Windows hostの負荷を含む。
- Node TAPは実行source manifestを直接出力しないため、`G-FULL`の結び付けは凍結command、前後で不変の92-path list/hash、各roundの727 test結果を組み合わせる。
- build、Dev、Emulator、UI、network、remote/data、Realtime Database Rules、外部service回帰はこのbenchmarkの対象外である。
- warm scenario totalはgate別medianの合計であり、scenario round totalのmedianではない。
- `G-GOV`内のrenderer-only時間は分離できず、standalone `G-RENDER`を比較proxyとする。
- postの保存済み実測はこの文書化checkpointで再実行していない。PM-14 taskのexact保存結果36件、前後source-set証拠、最終状態証拠を機械照合して記録した。
- application、Functions、Rules、package、Schemas consumer、build、Dev/Prod、network、remote/data、STRIPE-02はこのbenchmarkと文書化checkpointで変更・実行していない。
