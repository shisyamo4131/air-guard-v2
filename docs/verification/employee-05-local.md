# EMP-05 local実施記録

- checkpoint: EMP-05。内部順序は05-A reader→05-B参照入口→05-C背景保存/整合確認→05-D archive→05-E統合。
- 開始日: 2026-09-06
- 開始baseline: primary `C:\Users\seven\projects\AirGuard\air-guard-v2`、branch `codex/employee-master-roadmap`、HEAD `0f884183d3663ce4e13941f8a4aed7811e193d7d`。設計4文書のlocal commitとcleanをrootが確認した。
- 承認: 利用者が「コミットし、EMP-05を開始してください」と明示。05-A〜Eの実装・必要なlocal検証・review・文書更新・local統合を行い、EMP-05完了報告で停止する。EMP-06以降、push/main/Dev/Prod/remote/実data/package変更は含めない。
- 正本: [仕様](../specification.md#employeeの操作権限と保持)、[実装前契約](../implementation/employee-master.md#emp-05実装前契約)、[設計レビュー](employee-05-design-review.md)、[ロードマップ](../roadmaps/employee.md)。進捗の部分加点はしない。

## 担当・検証の境界

developer一名がapplication/Functions/Rulesと直接testを所有し、rootは文書・必須gate/専用UI・cleanup・review統合・Gitを所有する。reviewer/securityはread-only。各内部単位の未達を後続へ送らず、callbackと独立reviewを統合して次のbaselineを渡す。実装初期に操作・期待結果をsourceとtestへ対応づける。

対象は実装前契約R1〜R3/W1〜W5/A1〜A6/G1/U1。raw保持、現在認可/tenant、参照追加差分、埋込み索引、競合両順序、旧trigger無作用、結果不明、現query/Class/期間条件と直接UIを検証する。全機能業務の受入れ、物理削除、実data補完、外部通知/providerは含めない。共通cache/packageを一括変更しない。

変更classはUI/application/data・Rules/permissions/専用buildの該当union。内部単位では直接testと影響回帰を優先し、その単位に必要なcompletion gateとUIを確認する。最終05-Eはdomain-full、local-emulator-suite、local-ui-build、comprehensive 5 gateを最終影響状態へ対応させる。非影響・後続失効の扱いはverification policyに従う。Dev/Prod generateは別承認まで実行しない。

## 05-A 開始契約

Employee専用reader/cache、期間reader、詳細のraw/User購読破棄を対象とする。既存7actor・query/limit/Class型・初期選択ID・期間内退職者を維持し、更新/不存在/権限喪失/tenant変更/遅延応答を確認する。参照writer/Rules新契約・archive入口・User shell全面整理はこの内部単位では変更しない。変更前の安全境界へ戻せない場合は影響する操作を停止し、旧広域writerを再開しない。

開始時点では製品test/build/UIは未実施だった。以下に環境、初回失敗・修正、最終検証、cleanupを記録する。

## 専用local環境の開始確認

rootが`firebase.codex-test.json`、`config/codex-test-ui.env`、package scripts、専用Functions entry、Nuxt設定を照合した。対象は`demo-air-guard-v2-codex`、loopback専用port 14600/19099/18080/19000/19199/15001/14400/14500。開始時にこれらと9150のLISTENはなく、`.output`も存在しない。in-app browserに所有tabを作成し、通常keyboard操作を確認した。保存済み合成Auth fixtureが存在し、必要時はrunbookに従いrunning Emulator内だけで一時credentialを設定する。

`.env.local`、利用者用`saved-data`、専用`saved-data`/`isolated-saved-data`の22 fileの開始hashと、既存root debug log 3 fileのbackupを、root所有`C:\Users\seven\projects\AirGuard\air-guard-v2\.codex-test\runtime\emp05-ui`へ保存した。既存runtime一覧も固定し、他者runtimeはcleanup対象に含めない。終了時に保護fileの不変、既存log復元、所有tab/process/派生portの停止、今回所有の生成物とruntimeの安全な削除を確認する。

専用Functionsは外部作用denyのAPI harnessであり、背景triggerの自動実行をUI証拠に含めない。背景保存は05-Cの直接testで検証する。05-Aでは既存API構成を用いる。専用UIはPWA/通知と郵便番号外部検索の隔離設定を用い、fresh buildのreceiptを確認してから製品画面を開く。05-B以降の新規Callable・archive登録は、その実装後に実行構成を再照合する。

## 05-A 受入れシナリオ

read-only経路調査`EMP-05-A-TEST-PLAN`の結果を次の実施計画へ反映した。これは開始時の計画であり、実測は後掲の受入れ結果を参照する。

- 正規Employee作成UIで合成Employeeを登録し、詳細の再読込み、基本editorでの表示名更新、詳細/在職一覧の反映を確認する。再読込みはapplication memory再初期化であり、Firestore local cacheの完全消去とは扱わない。
- 配置画面の「作業員選択」に期間内の作成済Employeeが表示され、別tabからの名前変更が反映されることを確認する。05-Aでは配置保存を必要としない。
- 詳細表示中の通常logout後、戻る操作でも旧Employee/User情報が表示されないことを確認する。これはrole剥奪testの代用ではない。
- cold cache、初期選択ID、query membership、入退社日の境界、query除外と原本不存在、権限/tenant切替と遅延応答は直接testへ対応づけ、7actor/拒否actor/他tenantはRules Emulatorで確認する。
- Siteの入場者表示には履歴が必要だが、専用API harnessは履歴生成triggerを登録していない。直接注入でUI証拠を代用せず、SiteのEmployee接続と権限喪失は直接testを必須にする。準備済みの正規履歴がない場合、Site入場者の実画面検証は未実施として区別する。

## 基盤検証

開始baseline `0f884183`とroot文書編集状態で、次を実行し独立exit 0を確認した。対応するgovernance/validator/runtime policyが変わらない場合のみ、最終判定で証拠を再利用する。製品のdomain/Emulator/build/UIの代用にはしない。

| Command | 結果 | Exit |
|---|---|---:|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash/renderer/policy整合 | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 全fixtureの期待成功/拒否一致 | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 7 checks成功 | 0 |

文書validatorは開始文書追加時点で254 Markdown/60 ADR/11 roadmap/8 TOML、exit 0。その後の本記録追記により、最終文書状態では再実行が必要。

05-A実装中に`npm run test:local`を実行し、174/174成功、exit 0を確認した。Functions/Rules/local harness/Emulator構成のdiffがないことをrootが照合しており、この境界に対する回帰証拠である。readerの新規挙動の証拠とはしない。CLIは既存login期限の警告を出したが、再認証せず専用demoで正常終了した。22保護fileのhash不変、専用portと観測した派生8396/9150の停止、harness所有runtimeの自動除去を独立commandのexit 0で確認した。05-B以降でFunctions/Rulesを変更した場合はこのsuiteを再実行する。

## 05-A 初回実装とレビュー

developerはEmployee専用reader/session、現在Auth/raw User認可、詳細の関連User破棄、期間reader、Autocompleteと表示consumer、SiteのEmployee接続を変更した。直接reader/editor testは38/38・exit 0とcallbackされた。rootが`node --test test/domain/*.test.mjs`を実行すると1242/1243・exit 1で、Site詳細の旧provide文字列を要求する既存testが1件失敗した。失敗抽出の再実行も同じ結果であり、合格扱いにはしない。

root先行確認の初回認可待機順序は、raw User許可scopeの設定をloading解除より先に行い、実Vue接続testを追加した。securityの`EMP-05-A-SEC`では、同世代で遅延した期間queryが個別ID購読で得た最新raw/不存在を上書きできるP2を検出した。旧tenant応答の拒否だけではこの競合を覆わない。`EMP-05-A-R1`で期間応答の鮮度保護と更新/不存在の直接test、Site既存testの契約更新を実装担当へ戻した。独立最終review・修正後domain・fresh build・直接UIは未完了。

reviewerはEmployee Tag/Workers Table/Worker Chipのcache missが、原本不存在・閲覧拒否・取得失敗でもloadingまたは一律N/AとなるP2を検出した。非PIIの終端状態表示と実consumer testも同R1へ追加し、共通Tagや別masterの表示基盤は変更しない。

R1では期間queryのmembershipと原本観測の鮮度を分離し、個別ID購読で確定したraw/不存在を優先した。Employee専用状態ラベルとconsumerの実binding test、Siteの実page/session/provide/cleanup testを追加した。2026-09-07、rootが修正後に`node --test test/domain/*.test.mjs`を再実行し1245/1245・exit 0、`git diff --check`もexit 0を確認した。独立再reviewは進行中で、UI前のsource統合を準備している。

REVIEW-R1は先の指摘解消・追加指摘なし。SEC-R1は個別ID購読の優先を確認した一方、個別購読のないIDでACTIVE/RESIGNED query同士が異なるrawを返すと、新rawまで捨てて旧値を固定する追加P2を指摘した。05-A-R2で競合IDだけの原本確認と両応答順序のtestを修正対象にした。R1の1245件成功だけでは受入れ完了としない。R2初回割当はモデル容量エラーで失敗し、同じ境界で再開を依頼した。

R2は再開後、query-onlyの内容が食い違うIDだけ原本購読で確認するよう修正した。同値の応答では追加購読せず、原本確認済みのraw/不存在を優先する。live/snapshot各2順序の回帰を追加し、rootが`node --test test/domain/*.test.mjs`を再実行して1246/1246・exit 0を確認した。変更はreader coreと直接testの2fileで、Functions/Rules/harnessは不変。独立再review・fresh build・実UIはこの時点では未完了。

05-Aは既存確定契約の実装であり、仕様・ADR・保存data形状・migration・共通運用・利用者の業務操作手順を変更しない。実装記録、roadmap、検証索引/receipt、changelogだけを更新する。governance/agent設定・package変更はない。

REVIEW-R2とSEC-R2はともに指摘解消・追加blockingなし。rootもR2 core/testのhash一致と最終domain1246/1246を照合した。`powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`は254 Markdown/60 ADR/11 roadmap/8 TOML・exit 0、`git diff --check`はexit 0。以下の受入前sourceをlocal統合し、clean HEADでfresh build/UIへ進める。source commitだけで05-A/EMP-05を完了扱いにしない。

05-Aの製品所有fileは次の15件。

- `composables/domain/employee/employeeReadSession.js`、`employeeReadLabel.js`
- `composables/application/employee/useEmployeeReadAccess.js`、`useEmployeeDetailRead.js`
- `composables/fetch/useFetchEmployee.js`、`composables/dataLayers/employee/useEmployeesInRange.js`
- `components/Employee/Autocomplete.vue`、`components/Employee/Select.vue`、`components/Employee/Tag/useIndex.js`
- `components/Worker/Chip.vue`、`components/Workers/Table/Tr.vue`
- `pages/employees/[id].vue`、`pages/sites/[id].vue`
- `test/domain/employee-reader.test.mjs`、`test/domain/site-read-authorization.test.mjs`

root文書は`CHANGELOG.md`、`docs/implementation/employee-master.md`、`docs/roadmaps/employee.md`、`docs/verification/README.md`、本記録の5件。

## 05-A local受入れ結果（2026-09-07）

source commitは`d68b9587a69167909bfac73df6825cabe8e32b43`。rootがcleanを確認して`npm run test:local:ui:build`を実行しexit 0。専用identityのsource HEAD一致、`externalEffects: deny`、郵便番号隔離receiptを確認した。`npm run test:local:ui:emulators`は専用importから必要な既存Employee/退職Callableを登録してready、`npm run test:local:ui:server:generated`はidentity検査後に14600でready。loopback rootのHTTP 200と製品dashboard到達を確認した。新たなpackage更新・再認証は行っていない。

### UI user-equivalent action

- 保存済み合成会社管理者sessionを再利用し、可視メニュー→在職一覧→正規登録でEmployeeを1件作成した。code `EMP05A`、氏名「検証 閲覧」、入社日2026-09-07。生年月日は正規calendarから選択し、住所は合成値を手入力した。codeの記号入力は既存validationで拒否され、英数字へ訂正して保存した。非UIでEmployeeを注入していない。
- 詳細への遷移とreload後に、code・氏名・カナ・住所・保険初期状態・User未登録を確認。基本editorで名と表示名を「更新」/「検証更新」に変更し、詳細の氏名と在職一覧の表示名が反映された。
- 可視メニューから配置管理→作業員選択を開き、候補「検証更新」を確認。別の専用tabの基本editorで「連動」/「検証連動」へ保存すると、配置画面をreloadせず候補名が「検証連動」へ更新された。配置の保存はしていない。
- User未連携のこのEmployeeを正規退職dialogで2026-09-07に退職させた。詳細の退職表示・通常編集action終了、退職日を含む09-06〜09-19の配置候補に氏名が残ることを確認した。
- 詳細から通常Sign Outを実行し、詳細と別tabの配置候補からEmployee情報が消えた。browserの戻る操作はsign-inへ移り、旧Employee/User表示を復活させなかった。これはrole剥奪のUI試験ではない。

### Backend assertion・未検証

専用Emulatorのread-only verifierと同じ`Bearer owner`経路を使用した。最初の認証なしGETは403となり、検証用header付きGETへ修正した。UI作成原本のcode/表示名/ACTIVEを照合し、2回の名称保存前後の全field（存在有無を含む）の差が`firstName`/`displayName`/`fullName`/`tokenMap`/`updatedAt`だけであることを確認した。退職後は同じEmployee原本がRESIGNEDで残り、保存済みの単一合成Auth actorと会社管理者Userも残っていることを確認した。各assertion commandはexit 0。通常のUI操作をbackend呼出しで代用していない。

7actor/拒否actor/他tenantのRulesは174件のEmulator suite、cold cache/初期ID/権限とtenant切替/遅延応答/期間境界/検索membership/表示状態/Site接続は1246件のdomain suite中の直接testへ対応づける。実画面は合成会社管理者1actor。Firestore disk cacheの完全消去、Site入場者履歴の実UI、全別機能業務、背景triggerの自動実行、実data/Dev/外部providerは未検証。履歴生成triggerのない専用環境でSite表示の成功を装わず、Site接続は実Vue/session testで確認した。

### 終了・判定・次工程

所有tab 2件を閉じ、generated server→Emulatorの順にCtrl-Cで停止した（前景sessionのexit 1は依頼した停止による）。専用portと観測した派生8197/9150のLISTEN不在をTCP APIとnetstatで確認。保護22 fileの件数/hash不変、既存root log 3 fileの復元/hash一致を確認し、絶対path・reparse不在を検査した所有`.output`と`.codex-test/runtime/emp05-ui`を削除した。cleanup assertionはexit 0、source worktreeはcleanだった。他者runtime・利用者Chromeは操作していない。

05-Aのlocal受入れ条件を満たした。source/仕様/既存7actor/保存境界を維持して05-Bへ進める。05-Bでは表示cache/Classを保存時の原本期待値・認可に使わず、保存先の現在rawと現在actorを保存境界で再確認する。05-Aの仕様変更判断待ちはない。最終文書反映のgateとlocal統合を終えてから05-Bを割り当てる。EMP-05全体は未完了、確認済み進捗は55%のまま。
