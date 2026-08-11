# Implementation coverage mechanical / review-depth audit

> Current review-depth (2026-08-11): SPEC-DEEP-033 completed — A 310, B 43, C 166, D 11, E 1, Unknown 0; remaining B/C 209 files in 23 execution checkpoints. This line supersedes earlier progress counters in this historical audit text.

- 状態: 機械監査
- 対象チェックポイント: SPEC-AUDIT-001
- 最終確認日: 2026-08-11
- 対象: app `pages/`、`components/`、`composables/`、`stores/`、`plugins/`、`middleware/`、`utils/`、`services/`、`functions/`、schemas `src/`
- 根拠: `rg --files`、import/export/route symbol、既存`docs/implementation/*.md`のfile/symbol mentionとcoverage scope
- 制約: code本文の新規深読、runtime、外部環境、実dataは行っていない。

## 重要なcoverage訂正（SPEC-DEEP-AUDIT-001）

従来のCoveredはfile/domain対応を示すmechanical coverageであり、全公開API・主要分岐・error・side effect・callerを本文レベルで精査した意味ではない。利用者の「すべて確認」はreview-depthを要求するため、531 filesを次へ再分類した。割当根拠と排他的segmentは[deep review plan](deep-review-plan.md)を参照する。

| depth | 件数 | 意味 |
| --- | ---: | --- |
| A Deep-reviewed | 310 | 本文、responsibility/public API、主要分岐、error/side effect、callerまで精査した証拠が明確。 |
| B Flow-reviewed | 43 | 業務flowに必要な範囲は読んだが、file全公開契約は未確認。 |
| C Mapped-only | 166 | 親domainへ機械対応しただけで本文精査証拠がないか曖昧。 |
| D Generated/config/test/asset | 11 | test route、font asset、migration、Functions package metadata。 |
| E External boundary | 1 | package re-export境界。 |
| Unknown | 0 | なし。 |
| **合計** | **531** | 重複0、欠落0。 |

Aは初期6 filesにSPEC-DEEP-001〜003のFunctions 36 files、SPEC-DEEP-004のpage 12 files、SPEC-DEEP-005のstore/middleware 8 files、SPEC-DEEP-006のplugin 11 files、SPEC-DEEP-007のnotification Functions 5 files、SPEC-DEEP-008のSecurityReport Functions 6 files、SPEC-DEEP-009のgeocoding/Stripe/error Functions 4 files、SPEC-DEEP-010のArticle/Customer/Site pages 6 files、SPEC-DEEP-011のEmployee/Outsourcer/Attendance pages 6 files、SPEC-DEEP-012のOperation/Schedule/Billing pages 9 files、SPEC-DEEP-013のAgreement components 10 files、SPEC-DEEP-014のArrangementNotification components 10 files、SPEC-DEEP-015のArrangements components 10 files、SPEC-DEEP-016のArticle components 7 files、SPEC-DEEP-017のatoms buttons/chips 7 files、SPEC-DEEP-018のatoms core controls 9 files、SPEC-DEEP-019のenum/chart/Tag components 13 files、SPEC-DEEP-020のCompany/root components 8 files、SPEC-DEEP-021のCustomer components 10 files、SPEC-DEEP-022のBilling/OperationResult components 8 filesを加えた201 filesである。既存domain文書に記載があること、Flowで一部を読んだこと、mechanical CoveredであることだけではAへ昇格しない。

SPEC-DEEP-023〜032でDailyAttendance 7、Worker/drag 14、Employee 10、certification/custom-input 7、Employees/Insurance 11、molecules 12、OperationBilling 10、OperationResult 14、OperationSchedules 11、organisms 6の計102 filesを追加でAへ昇格し、A 303 filesとなった。

SPEC-DEEP-033でOutsourcer/Outsourcers components 7 filesを追加でAへ昇格し、A 310 filesとなった。

## 方法と分類基準

全pathを正規化して一度だけinventoryへ取り込み、directory/domain cluster、basename/symbol mention、既存文書scopeを順に照合した。basenameが本文にないだけではUncoveredにせず、親page・domain component tree・trigger helperとして文書scopeに含まれる場合はCoveredとした。

- **Covered**: domain文書のroute/source scopeに含まれ、主要入口・data flow・境界が既に記録される。
- **Partially covered**: 利用側で一部値だけ触れたが、横断API/選択肢/validation契約を専用には整理していない。
- **Uncovered**: 実利用または独立責務があるが専用scopeがなく、既存文書にも責務契約がない。
- **generated-config-test-asset**: package metadata、font生成物/asset、test/dev/migration候補。業務仕様coverageから分離する。
- **external package boundary**: app内re-exportだけで、実体は隣接package側にある境界。

分類は機械inventoryの漏れ検査用であり、Coveredを実装品質・正式仕様・本番準備完了とは扱わない。

## inventory集計

| source | 母数 |
| --- | ---: |
| pages | 38 |
| components | 247 |
| composables | 82 |
| stores | 7 |
| plugins | 11 |
| middleware | 1 |
| utils | 14 |
| services | 1 |
| functions | 55 |
| schemas `src/` | 75 |
| **合計** | **531** |

| 分類 | 件数 | 主な範囲 |
| --- | ---: | --- |
| Covered | 518 | legacy mechanical分類。review-depthは上表を使用する。 |
| Partially covered | 1 | `utils/formats/util.js` 1 |
| Uncovered | 0 | なし |
| generated-config-test-asset | 11 | `/test` 5、font 3、migration 1、Functions package metadata 2 |
| external package boundary | 1 | `functions/schemas/index.js` package re-export |
| classification unknown | 0 | なし |
| **合計** | **531** | 重複0、分類漏れ0 |

`components`配下の個別childや同居`use*.js`は、親domain文書が直接component treeをscopeに含める場合にCoveredとした。したがって「全props/emitsを個別列挙済み」という意味ではない。

## route・app surface

38 pageは、auth/onboarding、dashboard、各master、schedule/arrangement、OperationResult、Attendance、Billing、settings、super-user、test/devの各文書へ対応した。route分類の未割当は0である。`/test` 5 routeは`test-development-routes.md`により調査済みだが、業務coverageではなくgenerated-config-test-assetにも分類した。

7 stores、11 plugins、1 middlewareはstate initialization、app shell、PWA、Company/RoundSetting、error/feedback、authorization文書のscopeへ対応した。

## 未被覆・部分被覆cluster

未被覆clusterは0である。`utils/generateCollectingReport.js`は`collecting-report-utility.md`で、実体がcaller 0件の運転日報PDF utilityであること、input/output、browser作用、privacy/error境界まで調査した。Partially covered 1件は`utils/formats/util.js`である。`formatNumber`/`formatCurrency`の直接callerはBilling PDF・Billing table・Worker tableにあり、各domainの値源と表示は既存文書scopeに含まれる。専用format API catalogがないという分類で、CONF再照合を妨げる未調査業務clusterではない。

## Functions・schema export

Functions 55 filesは、entry/export catalogと各domain文書により52をCoveredとした。`modules/migration.js`はunexported test候補、`package.json`/lockはconfig、`schemas/index.js`はschemas packageのexternal boundaryである。

schemas `src/` 75 filesの主要model/mixinは各domain文書へ対応した。package exportsはroot、`./constants`、`./apis`、`./utils`の4入口である。model class群はCovered、constants/field definitions/error definitionsは一部利用だけのためPartially coveredとした。

## dynamic import / export

確認した実行時dynamic importは次で、specifierはいずれも静的文字列literalだった。

- messaging plugin / notification composable: `firebase/messaging`
- billing / arrangement PDF: `pdfmake/build/pdfmake`とlocal `vfs_fonts`
- Functions dependent sync: schemas package

computed pathによる解決不能dynamic importは0。Functions `index.js`のstar exportと`functions/schemas/index.js`のpackage re-exportはcatalog済みである。Nuxt component/composable auto-importはbuild-time discoveryであり、明示import欠如を未使用判定の根拠にしていない。

## 次segment推奨順

audit backlogは0件。追加segmentは新しい実装・route・exportの追加、または既存Covered領域のsemantic再検証が指示された場合に再棚卸しする。

## 未確認範囲

- file本文、全props/emits、全call graph、runtime auto-import resolution、tree shaking/build artifact。
- npm package内部、Firebase/外部環境、実data、Emulator、browser。
- docsの主張を全sourceへ再検証するsemantic audit。
- symlink、generated build output、Git ignored file。`rg --files`から見えるsourceだけを母集団とした。
