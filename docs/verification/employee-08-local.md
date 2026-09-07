# EMP-08 Local統合確認記録

- 日付: 2026-09-07
- 開始baseline: primary `C:\Users\seven\projects\AirGuard\air-guard-v2`、branch `codex/employee-master-roadmap`、HEAD `eb62202da44b2565180587b7e54696b015c66f8c`。rootがactual Gitから照合し、開始時差分なし。
- 正本: [Employee仕様](../specification.md#employeeの操作権限と保持)、[設計](../implementation/employee-master.md)、[工程・現在進捗](../roadmaps/employee.md)。本書は今回の実行証拠。
- 状態: Local統合確認完了。初回reviewの必須未達を修正・再検証して受入れた。Dev反映の完了ではない。

## 範囲と承認

EMP-01〜07の目的と最終実装、既存代表操作、直接回帰、Local Emulator、独立review、利用者Chrome、cleanupを対応づける。Chromeは会社管理者でサインイン済みの利用者Local環境、業務画面の対象月は2026年6月とする。既存表示・検索・開閉・取消を通常pointer/keyboardで確認し、保存・削除・退職・User操作の確定は行わない。専用Emulatorの合成dataによる保存・認可・競合試験はUI証拠から分離する。

見た目の追加変更は利用者の事前判断が必要。Dev/Prod、remote、実data、migration、通常archive API公開、provider、package、purge/restoreは対象外。利用者のChrome・Emulator・serverを終了せず、今回所有process/runtime/生成物だけをcleanupする。

## 初回独立reviewと是正対象

EMP-08-REVIEWとEMP-08-SECは同baseline・clean worktreeを独立照合し、read-onlyで実sourceと仕様/receiptを確認した。reviewerは全差分一覧と主要Employee経路を対象とし、全fileの全行reviewとはしない。

1. EMP-05/06: `useEmployeeReadAccess.js`のUser購読errorがscope喪失へ変換され、`useEmployeeList.js`は正常な空一覧として扱う。既存error/reloadへ接続し、初回失敗・成功後失敗・再試行・権限喪失・旧応答を直接検証する。
2. EMP-02: `useEmployeeEditor.js`はbusy中のsnapshotを破棄し、確定拒否後に受信済み外部変更の通知が失われる。独立draftを保持し、同sectionの受信済み変更があれば再保存を止め明示再読込を要求する。
3. roadmap内の現在形のEMP-06開始/75%が最新工程表と矛盾する。時点付き履歴へ分離する。

1・2は今回の必須条件であり、独立FUTやEMP-09へ先送りしない。既存の見た目・認可・保存契約を維持するcomposableと直接testだけをEMP-08-R1 developerへ委譲した。rootは文書・Chrome・検証・Gitを所有する。

security reviewはstrict actor/current Auth/tenant、原本/archive/汎用/nested Rules、PII cache失効、12従属と追加参照のtransaction、User/Auth排他、旧削除trigger無作用、専用demo限定公開について具体的なP1/P2迂回を確認しなかった。これはruntime成功ではない。同社会社管理者資格とsuper-user属性を併せ持つactorの通常Employee許可を、super-user属性だけの許可や全拒否と混同しない。

## 検証選択と初回実測

EMP全体のUI/application/data/permissionと今回のbuild、文書のunionに対応し、project-docs、domain-full、local-emulator-suite、local-ui-build、diff-check、managed-governance、project-docs-negative、capacity-regressionを選択する。Dev/Prod generateは未承認のrelease-onlyで省略。renderer-checkはmanaged-governance内の名前付き結果・exitで包含される。

修正前baselineで以下をrootが個別実行した。製品の2指摘を覆す証拠ではなく、修正で失効するgateは最終状態で再実行する。

| command | 結果 | exit |
|---|---|---:|
| `node --test test/domain/*.test.mjs` | 1501/1501、失敗0 | 0 |
| `npm run test:local` | 181/181、失敗0。demo・loopback・外部作用deny。user/専用export指紋不変 | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash/生成整合、renderer exit 0、policy整合 | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全負例fixtureの期待結果一致 | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks成功。task容量測定ではない | 0 |

初回Emulatorは自動終了し、所有runtime `test-harness-44316`不存在、専用portおよび派生9300/9500/8460のLISTENなしをnetstatで確認した。利用者3000/4000は開始時と同PIDで稼働。Get-NetTCPConnectionは権限拒否だったためnetstatの実LISTENを使用した。CLIの認証警告はdemo試験を妨げず、再認証やremote操作は行っていない。

## Chromeの直接回帰（修正前）

既存tabを引継ぎ、退職検索の空検索0件・作成入口なし、メニュー経由の在職一覧、登録dialog本文末尾scroll後の固定タイトル/action、取消を確認した。合成検索文字列で該当なし、clearで一覧復帰を確認した。

2026年6月の実績へ可視menuと月変更buttonで移動し、既存作業員6行の表示・既存1行の編集入力復元・取消、稼働外売上1行の全列/合計・編集入力復元・取消を確認した。個人名、顧客名、ID、原本値は本書へ転記しない。これらは保存成功証拠ではない。

## Source統合前時点の残作業（履歴）

clean source専用build、文書整合/gate、cleanup、review済みlocal統合と目的別最終判定が残る。rollbackは対象composableのcorrective changeとし、旧広域writer・Rulesや削除triggerを再開しない。

## EMP-08-R1の修正と再review

対象は`composables/application/employee/useEmployeeReadAccess.js`、`useEmployeeList.js`、`useEmployeeEditor.js`と`test/domain/employee-reader.test.mjs`、`employee-editor.test.mjs`の5file。rootが差分を直接確認した。最初の再現testでは5件中4件が失敗（exit 1）し、修正後は同5件が成功（exit 0）。共有readerの待機解消・PII cache破棄testを追加した最終差分で、developerの`node --test test/domain/employee-editor.test.mjs test/domain/employee-reader.test.mjs test/domain/employee-list-session.test.mjs test/domain/employee-ui-source-contract.test.mjs`は65件成功（exit 0）。再現用commandは`node --test --test-name-pattern=EMP08 test/domain/employee-editor.test.mjs test/domain/employee-reader.test.mjs`である。

reviewerとsecurity reviewerが同5fileを再照合し、初回2指摘解消、追加blocking指摘なしを確認した。実Vue reactivity、実composable/session、制御Promiseでの5種の確定拒否、別section/自己保存、初回/成功後の取得失敗、再認可、旧callback、権限喪失、dispose、PII破棄を確認した。SDK/Callableを差し替える単体試験であり、実transportや実UIの代用とはしない。

rootの最終製品差分に対する`node --test test/domain/*.test.mjs`は1507/1507（exit 0）、`npm run test:local`は181/181（exit 0）。Emulatorはuser/専用export指紋不変を確認して自動終了した。初回の1501件のdomain証拠は最終成功へ置換する。comprehensiveの先行3gateはgovernance/policy/validator/必須route/capacityを変更しておらず非失効とする。

## 修正後のChrome

既存会社管理者Chromeで在職一覧・詳細を再表示し、基本編集の肩書を合成文字列へ変更した後、保存せず「最新値を読み直す」で原本へ戻ること、成功案内と取消を確認した。資格dialog、3保険それぞれの加入入力、User登録dialogのemailと6 roleの表示・取消を確認し、Employee保存、User確定、保険保存は実施していない。利用者環境の故意の切断、認可変更、同時保存による障害注入は行わず、今回の2障害経路は上記の制御testで直接再現・是正確認した。

## 目的と証拠の対応

| 工程 | 最終目的と確認境界 | 対応する証拠 |
|---|---|---|
| EMP-01 | 3actor通常編集、7actor read、退職後拒否、独立draft/所有field、archive/参照、工程境界 | 現仕様/設計と初回2review。既存採用条件を追加変更しない |
| EMP-02 | 作成・基本・国籍、same-ID、住所、保存失敗/競合/他field保持 | EMP-02〜04 receiptの代表UI/backend + 最終domain/Emulator + R1拒否後通知 + Chrome基本入力/再読込/取消 |
| EMP-03 | 警備員/資格の専用保存、原位置・raw期待配列 | EMP-02〜04 receipt + 最終domain/Emulator + Chrome資格dialog |
| EMP-04 | 3保険6操作・不存在初回・世代・ABA拒否 | EMP-02〜04/EMP-05互換修正receipt + 最終domain/Emulator + Chrome3保険入力/取消 |
| EMP-05 | reader/cache/期間互換、参照writer・背景索引、12従属archive | EMP-05 R1〜U1 matrix + 最終domain/Emulator + R1共有reader試験 + Chrome6月実績明細。archive実UIは既存専用demoの正規作成→archive→backend/cleanup証拠を維持 |
| EMP-06 | 一覧・検索・User shell、統括退職、認可取得失敗/再試行 | EMP-06 receipt + 最終domain/Emulator + R1実access/list試験 + Chrome在職/退職・User dialog |
| EMP-07 | 独立FUT分類と必要部分の解消 | EMP-07 receiptを維持し、今回発見した2件は上記工程へ戻して是正。未発見不具合なしの保証とはしない |

## 文書・変更対象の境界

source文書reviewでは親製品roadmapにEmployeeの旧90%が複製されているP2を検出し、その説明をEmployee正本へのリンクに置換した。親製品の得点は変更しない。Employee内の旧EMP-06開始/75%と旧実行単位は時点付きHistory、冒頭・工程表・現在作業節はCurrentとして整合した。

今回の製品修正は上記3composable、testは2file。文書は本receipt/索引、Employeeロードマップ、実装記録、manual、再開案内、CHANGELOGを影響範囲とする。仕様/acceptance・data shape・API/Rules・package・governance・operation手順・ADRの変更はないため、それらと親製品roadmapの得点は維持する。過去receiptは当時の実測履歴として保持し、現在の結論は本receiptとEmployee roadmapへ集約する。進捗は2未達により90→40と訂正し、最終gate/cleanupが揃うまで復帰・加点しない。

## 最終build・cleanup・判定

review済み製品/testと未完了記録をlocal source commit `d2ee28ab5b89be44acceb471779124463e0e3d13`へ統合し、cleanな同HEADから`npm run test:local:ui:build`を実行、exit 0を確認した。client 1424 modules、server/Nitro生成、sourceHead一致のidentity marker、demo project・externalEffects deny・専用郵便番号隔離receiptをrootが確認した。Browserslistデータ期限、chunk size、sourcemap、package export deprecationの既存warningは残る。package更新は行わない。

UI-READYは今回の明示指定により既存Chrome接続と会社管理者session、利用者Localの表示/取消範囲、専用buildのdemo/loopback設定・client隔離、root所有の`.output`、利用者process/log保護を確認した。専用generated server・専用browser/一時credentialは起動/作成しない。今回のUI受入れは利用者Chromeであり、generated buildをbrowserで受入れたという主張ではない。既存の専用UI保存証拠は上記matrixの範囲で再利用した。

cleanupはrootの停止条件付きPowerShell commandを個別実行してexit 0を確認した。`.output`の実絶対path、reparse point不存在、identityとHEAD一致を検証後、今回生成した`.output`だけを削除した。再検証commandもexit 0で、user saved-data、専用UI saved-data、isolated-saved-dataは各7file・SHA-256指紋一致、`.env.local`指紋一致、所有runtime `test-harness-50372`不存在、専用8portと派生9300/9500/8281のLISTENなしを確認した。利用者3000/4000は同じPIDで継続し、Chromeは在職一覧・検索空・40行・dialogなしへ戻した。既存root logは利用者processが使用中でhash取得不能だったため、同一性を主張せず、退避/削除せず保持した。Emulator logは専用runtime内でrunnerが処理し、buildは標準出力だけを使用した。

| 最終gate | exact command | 結果/独立exit |
|---|---|---|
| domain-full | `node --test test/domain/*.test.mjs` | 最終製品差分1507/1507、exit 0 |
| local-emulator-suite | `npm run test:local` | 最終製品差分181/181、exit 0 |
| local-ui-build | `npm run test:local:ui:build` | clean source d2ee28ab、exit 0 |
| managed-governance | `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | renderer含む成功、exit 0。後続の製品/説明文書変更では非失効 |
| project-docs-negative | `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 期待結果一致、exit 0。validator/必須route不変 |
| capacity-regression | `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks、exit 0。capacity境界不変 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終完了文書259 Markdown/61 ADR/11 roadmap/8 TOML、exit 0 |
| diff-check | `git diff --check` | 最終完了文書の空白検査exit 0 |
| staged diff | `git diff --cached --check` | source13fileと最終文書3fileのstage後を個別実行し、各exit 0 |

初回stageはsandboxの`.git/index.lock`書込み拒否でexit 1。承認済みlocal統合として権限を得た同じ対象のstageはexit 0であり、その後のstaged検査を証拠にする。stage前の空index検査は採用しない。以後の差分は完了記録/案内だけで、最終製品test・buildの失効条件に該当しない。最終文書検証とstaged検査の独立exitを確認して完了記録をlocal統合する。

EMP-02・05・06の未達2件を是正して再受入れし、40→90へ復帰。EMP-08の5点を加え95%とする。必須未達の独立FUT/Dev送りや部分加点はない。今回の所有差分はsource commitの13fileと同じ文書群内で完結し、追加設定/仕様/migrationはない。最終commit/worktreeは利用者報告で確認する。

EMP-09へ渡す入力は、通常archive API未公開・既定tenant許可空、既存raw/索引・予約/Auth・旧client/旧Function revisionの限定確認、必要補完の判断、service/復旧/停止条件である。これらのDev/remote確認・実data変更・migrationは別承認。実provider、全actorのChrome操作、将来workflow、restore/purgeは今回未検証/対象外のままとし、新たな可用性保証や実data安全性の認定をしない。次工程へ渡せるが、開始承認にはしない。


## 最終closeout reviewと再検証

EMP-08-FINALは上記最終文書3file、95点の計算、User Chrome/専用build/過去UIの区別、cleanup、EMP-09別承認を独立照合し、blocking指摘なしとした。製品/test5fileのSHA-256はR1受入れと全件一致した。rootも製品/testのsource commit以後の差分0を直接確認した。直接回帰4fileの上記65件commandをrootが再確認し65/65、exit 0だった。最終文書のproject-docs、通常diff、stage後diffはいずれも個別exit 0を確認した。この実測追記で失効する文書/差分gateも再実行してからlocal commitする。
