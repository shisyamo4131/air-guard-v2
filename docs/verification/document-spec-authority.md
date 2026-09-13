# Project固有文書の正本と手順整理

- Checkpoint: DOC-SOT-01
- 日付: 2026-09-12
- Baseline: `b133fd9fabd4927c1cb93a4920d42fc112ac19aa`（primary repository、main、開始時clean）
- 対象: [現行仕様](../specification.md)、[development/data規則](../project-rules/development-and-data.md)、[開発workflow](../runbooks/development-workflow.md)、[local UI手順](../runbooks/local-ui-testing.md)、[coordination手順](../runbooks/project-coordination.md)、[環境・承認規則](../project-rules/environment-and-approval.md)、[確認事項台帳](../implementation/pending-confirmations.md)、[将来対応台帳](../implementation/future-actions.md)、[旧引継ぎ](../implementation/task-handoff-2026-08-14-user-led-governance.md)、[実装調査索引](../implementation/README.md)、[製品再開案内](../implementation/current-coordinator-handoff.md)、[UWB記録](../implementation/user-write-boundary.md)、[Employee実装記録](../implementation/employee-master.md)、[FGA roadmap](../roadmaps/foundational-governance-alignment.md)、[保険実装調査](../implementation/employee-insurance.md)、[ADR 0070](../decisions/0070-employee-insurance-normal-business-boundary.md)、CHANGELOG、本記録と検証索引。
- 状態: 承認済み文書整理の差分作成・独立review済み。必須検証は下表と非失効の再利用根拠を参照。Employee保険の文書上の不一致は下記再照合へ整理し、複数端末での順序・二重適用保護は未検証と区別する。commit・pushは対象外で未実施。live remote未確認。

## 意味保存と参照

既存文書内の重複を整理する。製品の要件・例外・承認・データ互換性は変更せず、仕様versionと製品進捗は据え置く。文書構造の移行・managed syncは行わず、既存pathとanchorを維持する。旧本文はbaselineのGitに保持する。

| baselineの記述 | 整理後の正本・扱い |
|---|---|
| development/data規則 14〜23行、仕様のPageとcomponent | 仕様の同節へ集約。構成・入力、Editor、Activator・保存、選択UI・例外、幅を小見出しで区分 |
| 同規則16行の未移行Manager | 同規則に段階移行条件を保持 |
| 同規則13・24〜26・31〜32行、仕様の同時更新 | 仕様のFirestoreドキュメントの同時更新へ統合。Company/User等の例外、失敗区別、Prod後の未確定案も保持 |
| 仕様から規則への詳細参照、workflowの競合制御参照 | 詳細は仕様、変更・移行の進め方は規則という方向へ更新 |
| ADR 0069のmode別入力条件 | 既存のcustomInput resolver条件を仕様へ明記。ADRは判断理由として保持 |

独立reviewで、default factory・prop validator、非提供operation拒否、ClientAdapter保存責務、commit確定結果の選択、listener・tenant別cache、例外保護、dialog除外条件、同時更新の意味保存を照合した。ADRだけに残ったresolver条件の指摘を仕様へ反映し、独立再reviewで解消を確認した。

## 承認済みの追加整理

同じ未commit文書整理へ、利用者承認のlocal UI → coordination → 環境・承認の順で追加した。追加3文書は開始時baseline HEADと同一。既存6文書の差分を保持し、独立した次checkpointやGit統合を開始しない。

| 対象 | 整理内容と維持条件 |
|---|---|
| local UI | 事前確認→build・合成認証→起動→UI操作→終了へ並べ替え。可視操作、credential fallback、snapshot保護、外部通信隔離、失敗時cleanup、marker・clean HEAD・実行承認を維持 |
| coordination | 通常loopからtransition・Git統合へ参照。担当規則の複写を減らし、callback障害、remote未確認、容量の報告・停止・閾値、task交代を維持 |
| 環境・承認 | 環境選択・再利用と実行境界を区分。UI-READY・debug log詳細をlocal UIへ参照し、Dev最終受入れ、外部作用、見た目変更、合成data大量投入の承認を維持 |

独立reviewで、参照化により曖昧になったcommit前の独立review完了と、subagent継続禁止の利用者による別の明示指示を本文へ復元した。再reviewで2件の解消と新たな実害のある指摘なしを確認。追加3文書の文字数は23,328から21,390へ減少した（改行を含むUTF-16 code unit計測）。

## 承認済みの規則・workflow・台帳整理

利用者が優先度「高」とdevelopment/dataへの推奨整理を採用したため、同じDOC-SOT-01の文書差分へ追加した。製品実装・質問への回答・完了判定は変更しない。

| 対象 | 正本・保存方法 |
|---|---|
| development/data | tenant・例外、document分割、page/fetch・従属参照の詳細を仕様へ集約。段階移行、既存Dev dataの3条件、phase/test合意を規則へ保持 |
| development workflow | error/loadingとclient policyの詳細を仕様へ集約し、runbookは分類→接続→確認へ整理。ADR 0065の例外API直前role再検査禁止とADR 0069のhelper任意契約を既存一般原則より優先する参照を明記 |
| pending confirmations | 本文Status別のIDリンクを追加。再照合Disposition・canonical・保留関係と区別し、過去集計を折りたたんだ履歴へ分類。Answerと全項目本文は保存 |
| future actions | 本文の限定条件付き状態をそのまま使うIDリンクを追加。Local実装・解決・置換を製品完了と扱わない。全項目本文は保存 |
| 旧handoff | 各checkpoint時点のHistorical記録と明示し、現在の手順・製品作業へのrouteを追加。旧task ID等を現行指示へ使わない。元本文全体を保持 |
| implementation index | 古い集計を記録時点の履歴へ限定し、変動するID範囲の複写を台帳へのlinkに置換。台帳更新時に履歴集計を更新する旧指示を解消 |

追加前後の機械比較ではCONF 146件・FUT 190件のID順序、見出し、状態、Answerを含む本文全体が完全一致し、各IDが状態別索引へ一度だけ掲載されることを確認した（exit 0）。別fileへの分割・改名・既存anchor変更は行わない。台帳は証拠・回答を残すため本文量を減らさず、検索導線と履歴の読み分けを整理する。

独立reviewで追加範囲の意味保存・台帳全件の本文一致・索引所属を確認し、残る指摘なし。追加範囲の初回project-docsは新しいerror/loadingリンクの中黒を検出してexit 1となった。生成anchorに合わせて修正し、再実行でexit 0を確認した。development/dataは今回の追加整理前8,291→4,745文字、workflowは6,867→6,031文字（CRLFを含むUTF-16 code unit）。

## 承認済みの現在情報・工程履歴整理

利用者が次のHigh 3文書を採用したため、同じDOC-SOT-01へ追加した。開始時の13文書差分を保持する。中優先度のEmployee roadmap全体とdeep review planは今回の対象にしない。

| 対象 | 整理内容と根拠 |
|---|---|
| current coordinator handoff | 完了済み準備、旧commit、実測、古い停止点を正本への参照へ置換。FGA-06の次提案、FUT-0190・0005、Employee archive／Site自動終了等の別工程・承認、条件付きdata/IAM対応、Spark不再採用を保持。旧本文はbaseline Gitに保持 |
| user write boundary | Dev受入れ進行中・0/1の冒頭重複を、本文Dev受入れ完了記録と正式roadmapへ整合。UWB時点の経路・契約・工程・変更記録を履歴として区別し、工程本文を保持。現行仕様と残る境界へ直接route |
| employee master | Local時点の未反映記述を既存FGA-04 Dev受入れ記録へ参照化。EMP工程、旧通常保存、EMP-05実装前設計の時点を明示。FGA-04で通常保存を置換した範囲とarchive・User/Auth等の維持境界を分ける |
| FGA roadmap内部状態表 | RESULT-EDIT行だけがDev未受入れのまま残っていたため、同roadmapの完了記録・実装記録・Dev receiptへ照合してCompletedと参照を修正。FGA-06全体の加点・phase進捗80%は変更しない |

今回の追加は`documentation-only`と`project-guidance-metadata`。新しい機能要件・承認・release・data操作を定めず、既存記録に基づく現在/履歴整合だけを行う。project-docsとdiff-checkを最終差分へ実行し、先行するcomprehensiveのproject-docs-negative・managed-governance・capacity-regressionはvalidator-required route、policy、規則、容量契約の非失効を確認して再利用する。runtime・live remoteは再確認しない。

独立reviewでは、再開案内からの削減条件がrelease surfaces・acceptance planへ辿れること、UWBの工程本文・例外の保存、Employeeの維持境界、FGA状態行の既存完了証拠との一致を確認し、新規のblocking欠落なし。追加4文書を含むproject-docs・diff-checkは各exit 0。記録と留保だけの最終反映後にも両gateを実行する。

保険再照合前に検出した不一致（整理経緯）: [Employee仕様](../specification.md#employeeの操作権限と保持)の保険世代値増加・raw期待値・同transaction競合拒否と、[FGA-04実装記録](../implementation/employee-master.md#fga-04での情報分類)の通常保険保存・競合拒否撤去は一致していない。[旧技術契約](../implementation/employee-master.md#通常保存の技術契約)にも留保を明記した。この時点では既存の不一致を留保した。その後の利用者指示によるsource再照合と文書訂正は次節を参照する。

## Employee保険の保存・世代値の再照合

利用者が残件の整理を指示したため、既存のFGA-04判断・Local/Dev記録とactual sourceを照合した。sourceは`schemas/Employee.js`、`composables/application/employee/useEmployeeInsurance.js`、`composables/domain/employee/employeeInsuranceContract.js`。世代値自体が撤去されたとする解釈は誤りだった。対象保険のbaseline世代値+1をcandidateへ含め、Employee modelの通常updateで保存する。一方expected map/versionは同じbaselineとの照合であり、server最新値との競合検出ではない。

- 仕様: 世代値の保持・新規0・既存不存在・対象+1・不正値拒否と、通常document保存・server最新値照合撤去を区分。保存時の原子的な競合拒否という古い説明を訂正し、通常Employeeの古い適用待ち表現を実装記録への参照に置換した。
- 保険実装調査: actual sourceの入力・遷移・保存・互換性と保証限界を一つの表へ集約。EMP-04と初期調査の専用Callable契約は履歴として保持する。
- Employee実装記録: 未解決という留保から、世代値とserver競合拒否を区別した仕様・保険実装調査への参照へ更新した。
- ADR 0070: 分類時にFGA-04へ委ねた保存方式の具体化を追記。新規ADR・spec version・data shape・製品code・Rulesの変更は行わない。rollbackは本checkpointの所有文書差分を一体で戻す。

残る検証限界: 別tab・別端末の先行commitに対する順序保護・二重適用防止は今回確認していない。世代値の単調増加や原子的競合拒否を実装済みとせず、ADR 0070の状態保護要件をこの整理で廃止しない。既存UI testはFunctions側の同名contractをharnessへ注入するため、client contract全体・remote競合の証拠として使わない。client contractの冒頭に残るFunctionsを保存正本とする旧commentはsourceの残存説明であり、今回はcode変更しない。現行経路の説明は保険実装調査へ固定した。

検証選択: 今回は既存FGA-04保存方式の文書整合だけであり、`documentation-only`／`project-guidance-metadata`。project-docsとdiff-checkを再実行し、変更していない製品codeのdomain・Emulator・UI検証は追加しない。先行comprehensiveの陰性・managed・capacityの非失効条件は維持する。独立reviewで保存方式・世代値・例外・未検証境界の一致とcode無変更を確認し、blocking指摘なし。「取消」を保存操作の加入取消と混同しないよう「編集dialogの取消」へ明確化した。最終gateは記録反映後に実行する。

## 検証

変更classは`governance-permissions-agents`と`documentation-only`。comprehensive 5 gateを選択。製品code・schema・Rules・runtimeを変更しないため、domain・Emulator・UI build・Dev/Prod受入れは対象外。追加のvalidatorやtestは作成しない。

| Command | 結果 | Exit |
|---|---|---|
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 成功 | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 先行整理の成功結果を再利用（7 checks） | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| `git diff --check` | 成功 | 0 |

先行するlocal UI・coordination・環境整理では全5 gateを実行し、coordination修正後の容量回帰もexit 0（7 checks）を確認した。今回の追加整理ではproject-docs、project-docs-negative、managed-governance、diff-checkを再実行し、各process終了と独立exit 0を確認。容量のalias・runbook・script・fixtureは先行成功後に不変のため、capacity-regressionだけはpolicyのinvalidatedByに基づき成功結果を再利用した。managed-governanceに含まれるrenderer-checkは別実行しない。記録だけの最終反映後はproject-docsとdiff-checkを再実行する。他gateを失効させるvalidator・policy・規則・容量条件の変更はない。未追跡の本記録を含む13文書についてUTF-8/BOMなし・CRLF・行末空白を直接確認しexit 0。stage/commitは今回実行しない。

## 影響範囲と復元

- ADR 0041・0049の既存の正本分離を適用する整理であり、新ADR・roadmapのscope／得点変更は不要。data contract、画面manual、operations、検証policy、managed artifacts、applicationは不変。今回のFGA roadmap状態行補正は既存の完了証拠の反映漏れだけで、scope・完了条件・得点を変えない。
- 文書・索引の到達性、UTF-8/BOMなし・CRLF、対象外差分の不存在を最終検証する。CHANGELOG・環境規則など対象内の混在改行をCRLFへ揃える。
- 問題時は本checkpointの文書差分全体をbaselineに基づいて戻す。他者差分を上書きせず、片側だけ戻して詳細の正本を二重化しない。製品・dataの復元は発生しない。

## 追加整理: EMP・archive・初回Dev・Company・精査計画

利用者が推奨5組の整理を承認。baselineはmain / b133fd9fabd4927c1cb93a4920d42fc112ac19aa、先行DOC-SOT-01の未コミット文書差分を維持する。同checkpointへの追加であり、製品変更・release判断・Git統合は含めない。

対象は docs/roadmaps/employee.md と docs/implementation/ 配下の archive-restore.md、master-dev-release-surfaces.md、master-dev-acceptance-plan.md、company-settings.md、deep-review-plan.md。索引READMEと既存CHANGELOGを同期する。

- EMP: FGA後の正本へ案内し、旧工程・操作表の部分保存/認可を当時の契約として明示。得点・受入れ証拠を維持し、次作業と検証選択の重複は正本への参照へ置換する。
- archive: EMP-05実装記録とEMP-09受入れを根拠に専用archive未実装の旧表を訂正。実装・環境受入れ・tenant開放を区別し、generic調査と未実装purge案を分離する。
- 初回Dev: 反映候補・停止/rollback契約を履歴として保持。受入れ結果を冒頭へ移し、後続作業へ参照する。新たな外部操作や同条件での再実行を承認しない。
- Company: CPU実装記録と現行仕様・後続改修の案内を分け、旧CCB/Stripe/途中rollbackの観測を日付付き履歴へまとめる。
- 精査計画: 当時の531件・manifest・完了記録を保持し、後続の変更への再読免除を意味しないことを明示する。

今回はdocumentation-only / project-guidance-metadata。project-docsとdiff-checkを最終状態で実行する。既存comprehensiveのproject-docs-negative、managed-governance、capacity-regressionは、validator/必須route・policy・project rules・容量条件の変更がなく非失効のため再利用する。製品code・Rules・data契約・runtimeを変更しないためdomain/Emulator/UI/build・release-onlyは省略する。新しい仕様・ADR・進捗加点・manual変更は不要。rollbackはこの追加の所有文書差分のみを戻し、先行整理を維持する。remote状態は再確認していない。独立reviewと最終gateの結果は完了報告へ記録する。

独立reviewではCompany現行案内が旧CCBロードマップへ向かう1件を指摘。coordinatorがCompany部分更新ロードマップのCPU完了・追加権限別要件・親roadmapへの参照を直接照合して修正し、旧課題・未確認欄の時点も明示した。他5文書の条件保持にblocking指摘なし。文書validatorとdiff-checkは修正前にexit 0、最終修正後に再実行する。旧Dev/Company本文、EMP工程行、精査manifestの保持とdetails構造、未追跡receiptを含む25 MarkdownのUTF-8/BOMなし・CRLF・行末空白なしも直接検査でexit 0。

## 追加整理: Site・Outsourcer・確認事項依存・coverage

利用者承認の4組6文書をDOC-SOT-01へ追加した。primary main / b133fd9fabd4927c1cb93a4920d42fc112ac19aaを直接確認し、先行文書差分を維持。対象は docs/implementation/site-master.md、docs/roadmaps/site.md、docs/roadmaps/outsourcer.md、docs/implementation/confirmation-dependency-map.md、docs/implementation/coverage-inventory.md、docs/implementation/coverage-audit.md。implementation索引・既存CHANGELOG・本記録を同期する。

SiteはFGA-03 roadmapとDev受入れ記録に照合し、Dev未受入れ・Local候補の旧表現を訂正。SITE工程の100%・専用操作・公開/補完の別承認は維持する。初回受入れで残した合成Customerは後続受入れ結果へ参照し、現在の削除待ちとして複写しない。OutsourcerはOUT当時の契約・100%を保持し、FGA-05後の通常保存・認可へ案内する。

確認事項依存表は当時138件の分類・group・提示順を履歴として保持し、現在の回答・保留は台帳へ参照する。coverage棚卸しは文書/source対応、監査は方法・訂正経緯、最終depth分類・件数は精査計画へ分担する。過去の未被覆0や精査完了を後続変更の保証へ拡張しない。

変更classはdocumentation-only / project-guidance-metadata。最終project-docsとdiff-checkを実行し、独立reviewを行う。先行comprehensiveの陰性・managed・capacity成功証拠はvalidator/必須route・policy・project rules・容量条件が不変のため再利用。製品code・schema・Rules・data・挙動を変更しないためdomain/Emulator/UI/build/release-onlyを省略。新しい仕様・ADR・manual・進捗加点は不要。rollbackはこの追加文書差分だけを戻し、先行整理を保持する。Git統合・remote状態再確認は含めない。最終結果はcompletion reportへ記録する。

## 追加整理: Functions・Callable・Customer試験・全体進捗履歴

利用者承認の4文書（docs/implementation/cloud-functions-catalog.md、callable-authorization.md、customer-dev-release.md、docs/roadmaps/airguard-v2.md）を同DOC-SOT-01へ追加。primary main / b133fd9fabd4927c1cb93a4920d42fc112ac19aaを直接確認し、先行差分を維持する。

Functionsの旧6件Dev削除未実施はFGA-04 Dev receiptの不在確認に基づき訂正し、旧export一覧は調査履歴に限定。CallableのUWB-08前の広域write説明は旧観測と明示し、UWB・Companyの後続実装・受入れ・残件へ参照する。Customerの反映前契約は保存し、閉鎖結果と請求受入れの後続移管へ案内する。全体roadmapは進捗履歴70行が全て10%で初行基準線・他行変化0と直接検査し、6節目へ短縮。機能の途中結果は既存UWB・Company・精査記録、旧逐次本文はGitへ追跡可能とする。現行マイルストーン表・重み・得点・未完了条件は不変。

索引・CHANGELOG・本記録を同期。既存事実と履歴の整理だけでdocumentation-only / project-guidance-metadataを適用し、project-docsとdiff-checkを最終実行する。独立reviewで根拠・状態・条件保持を確認。先行comprehensiveのproject-docs-negative、managed-governance、capacity-regressionはvalidator/必須route・policy・rules・容量条件が不変で非失効のため再利用する。製品code・schema・Rules・runtime・環境を変更しないためdomain/Emulator/UI/build/release-onlyを省略する。新しい仕様・ADR・manual更新や進捗加点は不要。復元は本追加の所有文書差分だけを戻す。Git統合・network・remote再確認は行わず、最終gate・review結果はcompletion reportへ記録する。

独立reviewでCustomer台帳の継続data保持指示まで履歴扱いになり得る1件を指摘。coordinatorは台帳の追加指示と01E receiptの参照を直接確認し、冒頭へ保持・自動削除対象外・削除済みdata非再作成・次回actual確認の有効性を明記した。他3文書にblocking指摘なし。最終gateはこの修正後に再実行する。

## 最終closeout

2026-09-13にcoordinatorが最終差分へ`project-docs`と`diff-check`を再実行し、`project-docs`は307 Markdown、70 ADR、12 roadmap、8 TOMLの検証に成功してexit 0、`git diff --check`もexit 0を確認した。先行comprehensive gateの再利用条件に変更はなく、製品code・Rules・schema・runtime・remote環境は変更または再検証していない。利用者承認に基づき、このDOC-SOT-01の35文書だけをlocal commit対象とする。pushは別承認とする。
