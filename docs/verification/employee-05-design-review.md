# EMP-05 実装前設計の再レビュー記録

- checkpoint: EMP-05-PREDESIGN
- 実施日: 2026-09-06
- 開始baseline: primary `C:\Users\seven\projects\AirGuard\air-guard-v2`、branch `codex/employee-master-roadmap`、HEAD `61e732c6378a963b0da48a6edef657d3d2a9db97`、cleanをrootが実測。
- 承認: 利用者はEMP-05範囲の実装前設計・レビュー・文書化を指示した。製品実装・実環境・実data変更の開始承認ではない。
- 設計の参照先: [Employee実装前契約](../implementation/employee-master.md#emp-05実装前契約)。工程状態と得点は[ロードマップ](../roadmaps/employee.md)。本書は今回の観測・レビュー・検証証拠を記録する。

## 調査と補正

rootは既存仕様/ADR0060/設計/ロードマップとreader/cache、詳細、Site archiveの既存処理、Functions entrypoint・旧Employee削除trigger・Rules、請求編集sourceを照合した。Firestore skillのedition選択は既存local Emulator runbookの記録済みSTANDARD baselineを参照し、remote freshnessは未確認。今回DB作成・接続・新query実行は行っていない。

| review | 確認した不足 | 文書へ反映する対応 |
|---|---|---|
| EMP-05-PREDESIGN-SEC / P1 | employeeIds欠損documentはarchive queryから見えず、0件では従属なしと断定不能 | 検査済tenantの非公開server許可集合/default deny、限定整合確認、旧writer/旧triggerを含むbounded cutoverの開放前提 |
| 同SEC / P1 | before集合をevent/draft/移動元から取ると遅延再生成や移動先追加を見落とす | 各保存先の現在rawから差分。不存在のみ空集合。全targetのreadを全writeより先へ |
| 同SEC / P1 | export削除だけでは旧remote triggerの作用停止証拠にならない | 旧handler無作用化・旧event直接試験、remote旧revision/実行中処理停止を別承認releaseで確認 |
| EMP-05-PREDESIGN-PATHS | OperationBillingの実績更新、日次2種の汎用Rules、Billing同先/削除、Class再取得時の索引消失 | 保存経路の閉鎖表、個別と汎用/nested拒否、raw取得→計算→read→writeの順序を明記 |
| EMP-05-PREDESIGN-WIRE | 予定worker詳細、実績workers/articles、請求articlesにも直接updateあり | handler外の入口、operation所有field、lock差異、raw期待値を追加 |
| EMP-05-PREDESIGN-ACCEPTANCE / P2 | archive応答不明時の理由/閉じる/再送/原本消失通知が未具体化 | 詳細入口、attemptのmemory保持、同一要求の明示確認、認証世代と遷移後通知を固定 |
| 同ACCEPTANCE / P2、root | cacheのitems/search/inFlight/表示rawが分離し、query除外と原本不存在を混同する危険 | Employee専用scope無効化・必要ID購読・検索membership・期間generationの受入例 |
| SEC追加認可判定 | 広い既存Rulesとstrict業務presetの差、通知のcomponentコメントではactor確定不能 | 共通認可に従い移行する予定/実績と請求operationのactorを限定。独立通知状態は現同社境界と参照不変client部分更新を維持し、未承認の通知全体のactor変更を追加しない |

各専門reviewはread-onlyのsource確認であり、test/runtimeの独立成功証拠ではない。全動的callerの網羅、実data索引、remote trigger/設定は未検証。変更対象となる通常sourceへの接続と競合両順序はEMP-05実装で実証する。

最終文書のEMP-05-PREDESIGN-SEC-FINALは前回のP1・認可の反映と未実装境界を確認し追加blockingなし。EMP-05-PREDESIGN-DOC-FINALは、結果不明dialogを閉じた後に原本が消失していると初回入口の条件で再確認できなくなるP2を検出した。初回入口と同一attemptの再確認入口を分離し、原本消失時の最小attempt保持とA5の時系列caseを追加した。EMP-05-PREDESIGN-DOC-R1でP2解消・限定差分に追加指摘なしを確認した。

EMP-05-PREDESIGN-DEVELOPER-READでは、実装担当者が自ら設計から現sourceを追い、実績化で予定だけから生成すると通知の実勤務情報が失われるP2を検出した。rootもGenerator、installed syncToOperationResult/notificationKey/notifyを照合した。対応通知rawの同tenant/同予定/worker検査、6fieldの既存fallback、局所期待値の同transaction比較、notify(false)後の期待値再取得、W3の通知単独競合を補記した。内部API名・file名等の裁量を設計不足とせず、実装が必要な生成元と失敗条件を対象にした。EMP-05-PREDESIGN-DEVELOPER-R1でP2解消・追加指摘なし、EMP-05-PREDESIGN-SEC-R1でも追加blockingなしを確認した。ともにactual sourceへの静的照合であり、競合やruntime成功の証拠ではない。

## EMP-02〜04の手戻りの切り分け

根拠は既存の[EMP-02〜04 local検証記録](employee-02-04-local.md)。再実行せず記録と関連sourceを照合した。実装中に修正があったことは確認できるが、全てを仕様変更や設計不足と分類しない。

| 事実 | 分類・EMP-05で先に確認すること |
|---|---|
| prop同期を明示表示名入力と誤認、動的component未登録、作成後警告消失 | 実component/event/slot/遷移の照合不足を伴う実装問題。controller単体だけでなく実入口・入力部品・通知の接続を設計表とUIで確認 |
| 警備解除でconstructorの初期値を消去値として使用 | 既存保存挙動の誤認。Class表示・検証candidate・保存rawを分離し、archiveコピーにconstructor/hookを使わない |
| 不存在のenrollmentDate getterを保存時に新設 | raw保持契約に反する実装問題。不存在/null/未知入れ子fieldを含む原本とarchiveの完全比較 |
| Timestampの投入値をそのまま保存前期待値にした | 検証期待値の問題。保存直後rawとの比較と単体の任意nanoseconds保持を両立し、assertを緩めない |

本再確認は手戻りをゼロに保証するものではない。実装前に決められる入口・field・競合・結果不明・受入例を具体化し、実装時の解釈違いを減らす。実runtimeでしか確認できない不具合は各内部単位で修正・再reviewする。

## 検証選択と実測

権限/安全な開放・rollbackを含む設計文書の再確認としてcomprehensive fallback 5 gateを選択する。製品code/Rules/実効schemaは変更しないため、domain・Emulator・UI buildは今回の設計検証には選択しない。Dev/Prod generate・package/network・実data・providerは範囲外。実装工程のテストを今回の成功と記録しない。

| gate / exact command | 実測結果 | exit |
|---|---|---:|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed/generated/policy一致。内包renderer exit 0 | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | negative fixtureを含む全期待結果一致 | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks。現在task容量の測定ではない | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終review補正・判定を含む253 Markdown / 60 ADR / 11 roadmap / 8 TOMLの整合 | 0 |
| `git diff --check` | 所有tracked文書の空白検査 | 0 |

最初の3 gateの実行後、validator/policy/必須routing/capacity手順は変更しないため、文面と今回の任意receipt link追記では失効しない。project-docsとdiff-checkの上表実測は結果追記前の状態に対するもの。本結果追記後にも両gateを再実行し、stage後の`git diff --cached --check`とともに独立exitをcommand reportへ記録してから統合する。初回の説明link追加patchは文脈一致せず適用失敗したがfile変更はなく、正しい文脈で再適用した。製品動作や必須testの失敗を省略したものではない。

## 文書範囲と残る境界

所有文書はEmployee設計、Employeeロードマップ、本receiptとverification索引。業務要件・確定actor・共通archive原則・工程重みを変更しないためspecification/ADR/CHANGELOG/manualは変更しない。新しい反復運用手順ではなく当該工程の契約補完なのでoperations/runbookを増やさない。package/data-contractの実装・実data変更はない。新receiptは索引と設計・roadmapから到達可能にする。managed artifacts/governance/agent設定は変更しない。

所有fileは次の4つであり、製品code/Rules、governance設定の差分はない。

- `docs/implementation/employee-master.md`
- `docs/roadmaps/employee.md`
- `docs/verification/README.md`
- `docs/verification/employee-05-design-review.md`

設計review判定: 今回確認した実装前の不足を文書へ反映し、開発者・受入観点・securityの指摘を解消した。確認範囲に追加の利用者業務判断待ちはない。実装開始指示後は05-Aから順に本契約とactual sourceを照合して作業を渡せる。全動的caller・実際の保存競合・実data整合・remote設定/旧revision停止は未検証であり、実装/別承認releaseの受入条件として残す。製品実装開始や完成の承認とは区別する。

最終文書gateとGit統合はrootが行い、review済み4fileだけをlocal commitする。remote確認・push・main統合は行わない。EMP-05実装は未開始のまま、進捗55%を維持し、利用者の開始指示を待つ。
