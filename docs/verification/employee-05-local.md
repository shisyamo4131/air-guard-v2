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

05-Aの受入れ文書は上記project-docs・diff-check・cached diff-checkがそれぞれexit 0で、`6c6e09f71ca3eef2e3d975290c76dc31bd968fce`へlocal commitした。rootがcleanを確認し、次の05-Bを割り当てた。最後の文書差分だけでは製品source/domain/Emulator/UIの証拠は失効しない。release-onlyのDev/Prod generateは未承認のため省略、governanceの3 gateは対象設定・validator不変のため再利用した。

## 05-B 開始契約（2026-09-07）

baselineは上記`6c6e09f7`、同じprimary/branch。実装担当の所有は予定・実績・実績の請求編集・配置通知の専用保存、raw参照抽出/各保存先差分の共通helper、正本に列挙したclient入口の接続と迂回Rules、直接domain/HTTP/Rules test。新規APIは通常entryにも接続して専用demoで検証するがremote反映はしない。独立通知状態は既存同社認証境界の部分transactionを維持する。

W1〜W3のraw不正/索引一致/追加Employeeだけの0・1・10種類read、操作別actor/lock、Site/Customer保護、通知actual値とraw期待値、通知だけの競合、予定pointerと実績作成のatomic性を確認する。表示Classと保存rawは分け、正規UIの保存await・拒否draft保持・結果不明の非自動再送を維持する。全別機能業務の受入れへは広げない。05-Cの背景writer/旧trigger/限定整合tool、05-Dのarchive、purge/restore、package/data/governance/他repositoryはこの内部単位の対象外。

rootは最終gate/専用UI/cleanupと文書/Gitを担当し、read-only経路調査が最小のUI準備順を確認する。Firestore Rules変更のreviewには既存のRules監査skillを適用する。変更classはapplication/UI/data・Rules/permissions/buildのunion、直接検証の後に全domain・専用Emulator・fresh build/UIを行う。新たな実測成功は実行後に記録する。

### 05-B の実装接続と受入れ準備

期間配置の`useSiteOperationSchedulesInRange.js`は現行の`subscribeDocs`で表示Classだけを保持している。承認済みの編集開始時raw期待値を確保するため、対象期間・表示Classを維持したoperation専用raw contextへの限定接続をdeveloper所有へ含めた。保存時の新規取得を古い表示の期待値に置き換えず、期間/tenant変更と破棄、rawと表示の同時点性を直接testする。共通cache/packageの変更は含めない。

配置から保存までの同時点性を保つため、`components/SiteOperationSchedule/Card/useIndex.js`、`components/Draggable/Workers/useIndex.js`、`components/Draggable/OperationSchedules/useIndex.js`の表示clone/initializeにもraw contextと原本行位置の継承を限定接続する。rootが現sourceと既定の即時表示/保存拒否rollback契約を照合し、developer所有へ追加した。表示順やClass keyで原本行を探し直さず、失敗時の表示復元・再取得、tenant/期間切替時の破棄を直接testへ含める。共通drag基盤の刷新や配置条件の変更は含まない。

`EMP-05-B-UI-PLAN`/`EMP-05-B-UI-PLAN-ARTICLE`のread-only調査に基づく予定であり、以下はまだ実測成功ではない。

1. 合成会社管理者でCustomer、関連Site、日勤の取極め、Employeeを各1件、すべて可視の正規UIから作成する。同月内の予定2日を使い、入社/適用日は予定日以前、資格必須はfalse、単価は正数とする。
2. 配置管理で予定を作成しEmployeeを追加、作業時間を編集・保存・再表示する。翌日へ複製し、一方だけ配置通知を作成する。
3. 実績作成で通知済み予定の実時刻・休憩0を保存して実績化する。未通知の複製予定では自動`notify(false)`準備を経た実績化を確認する。実績詳細の作業員編集、請求編集と再表示、lock後の通常編集拒否と請求編集許可、unlockを確認する。
4. 商品管理は`utils/pageSettings.js`と`pageAccessPolicy.js`でDEVELOPER限定であり、会社管理者fixtureではArticleを正規作成できない。商品明細はArticle選択が必要なため、UIでは空候補と取消後の明細不変を確認する。非空articlesの追加/更新/削除、所有field外保持、競合、lock、拒否時write 0は直接API/domain testへ対応づけ、非空保存のUI成功とは記録しない。権限変更や直接注入で代替しない。

User未連携Employeeでも配置通知と管理者による実時刻入力は可能だが、User向け一般通知生成はUser不存在で終了する。専用FunctionsはAPI harnessのため、個人の出退勤・外部通知配送、日次2種/請求集計/履歴の自動生成を今回のUI成功へ含めない。raw不正・参照種別・索引・旧writer拒否、0/1/10 read、別tenant、通知だけの競合、0/falseの全組合せ、二重実績化、lock race、結果不明は制御可能な直接testで検証する。実操作時に見つかった不足は未検証として残し、必須条件との対応をreviewで判断する。

### 05-B server先行検証（2026-09-07、途中）

`saveOperation`専用Callable、server transaction、operation field/期待値契約、参照抽出helperを先行実装した時点で、rootがdeveloperの固定4fileのhashを照合し、`node --test test/domain/operation-write.test.mjs test/domain/operation-references.test.mjs test/domain/codex-functions-entrypoint.test.mjs`を実行した。16/16成功、exit 0。raw未知field/nanoseconds、行位置、参照差分、actor/lock、Site/Customer/revision、通知単独競合・0/false・実績化を含む直接testであり、HTTP/Rules/画面の成功ではない。

固定serverへの`EMP-05-B-SERVER-REVIEW`/`EMP-05-B-SERVER-SEC`を並列依頼し、developerはclient接続を継続した。review結果・client/Rules・全domain・Emulator・build/UIはこの時点で未完了。helperのread計数を保存API全体の計数と混同せず、最終証拠で実経路との対応を確認する。UI準備は専用IABの通常keyboard接続、保存済み単一合成Auth fixture、専用port空きを確認し、保護22fileの指紋と既存3logを所有runtime `.codex-test/runtime/emp05-b`へ退避した。準備用の空tabは閉じており、製品画面/build/processはまだ起動していない。

先行reviewでP2を3件検出した。REVIEWは同一配列のremove→update等を開始時raw期待値で照合して変更後位置へ適用する行ずれと、`hasNotification=false`なのに同ID通知が存在するとnotifyがactual/statusを初期化できる点を指摘。SECはworker更新による通知取消を計画した後、同じpayloadのconvertがread cacheの旧通知を採用できる点を指摘した。rootも該当sourceを照合してdeveloperへ一括修正依頼した。仕様変更ではなく、原本位置・通知保持・準備後期待値契約の実装不足として扱う。同一対象の依存commandを制限しても、正規の複数対象保存・必要なcreateとworker追加・複製を失わないことを修正条件にした。修正後の再現test・再reviewまで未解消であり、先の16件成功を受入れ完了の根拠にはしない。

R1は原本位置の一時map、notify/convertの依存command混在拒否、false flag＋既存通知の拒否を追加した。rootが上記と同じ直接test commandを実行し25/25・exit 0を確認。実`saveOperation`の新規2保存先×10人と削除後再作成も計数している。REVIEW-R1/SEC-R1で最初の3件の解消を確認した。一方rootの合成helper診断で外注行`out-a:1`を`out-b`へ変更すると兄弟の`out-b:1`と重複でき、REVIEW-R1も通知ID衝突をP2と判定した。既存raw/candidateのworkerId一意性、正常な同外注先・異なるindex配置の維持、schedule/resultの拒否時write 0をR2へ依頼した。R2未完のためserver受入れは保留。途中clientのraw contextが旧表示modelを強参照し続ける点もrootから指摘し、購読破棄時の無効化と不要modelの解放を両立する修正を依頼した。

R2はworkerIdの配列全体での一意性を保存前raw/candidate双方へ適用した。rootが`operationReferences.js`（`54FB42CC05FDCDE1DA0B66631AD862DDA898800C9346A36335B2CE0C85D9F23D`）と`operation-write.test.mjs`（`42B23F3A4CB0682F2204CA67E4FF298F3E392978B2181311B85D4E452F58A84F`）のhashを照合し、同じ直接test commandで27/27・exit 0を確認。REVIEW-R2/SEC-R2とも指摘解消・追加blockingなし。先行serverの既知指摘は解消したが、client/Rules/HTTP/Emulator/UIの確認とB全体の統合は未完了である。これ以後のserver変更は影響review/testを再実施する。

### 05-B editor先行検証と残る入口（2026-09-07、途中）

rootは固定したeditor/raw contextと管理画面・行編集の接続について`node --test test/domain/operation-editor.test.mjs`を実行し、8/8・exit 0（12 SFCのcompileを含む）を確認した。`EMP-05-B-EDITOR-REVIEW`は商品IDを先に変更して単価取得を待つ間に旧単価で保存できるP2、`EMP-05-B-EDITOR-SEC`はRowsManagerの取得error/不存在/claim無効化で一覧rawとeditorの破棄が一貫しないP2を指摘した。rootも該当sourceを照合し、入力の非同期解決中の保存、手入力と逆順応答、取得拒否/閉じる/別行、read不能時のraw/draft/期待値破棄と旧応答拒否をEDITOR-R1へ依頼した。通常の保存競合では入力を保持する条件を維持する。8件成功だけで当該接続を受入れ済みにしない。

実績複製のfacade/application/domain、請求lock button、予定複製dialogもrootが旧Class writerへの到達を確認し、05-Bの限定接続対象へ含めた。実績複製dialog本体は失敗理由の表示を追加する。exact入口は実装文書の既存source表へ反映した。実績複製は調整値・商品・workerの引継ぎがあり、概要作成とworker追加だけでは既存値を落とすため、source ID/日付/期待値からserverの現在rawを複製する限定operationを追加する。controllerへ経理権限を要求せず、source lock/不存在/競合、全read先行、新保存先の参照確認を維持する。これは既存複製仕様の移行であり、新業務条件ではない。この追加で先行serverの影響箇所は再review/test対象となる。client R1・複製・残る配置/通知/Rules/HTTPはこの時点で実装・検証中である。

EDITOR-R1は商品取得中の保存禁止・ID/初期単価の同時確定・手入力優先・旧応答拒否と、Rowsのscope/read不能時の購読/raw/editor一括破棄を実装した。rootが7fileの固定hashを照合して同じeditor test commandを実行し、12/12・exit 0を確認。EDITOR-REVIEW-R1/SEC-R1で2件解消・追加blockingなし。商品入力の追加証拠はhelper実行とtemplate接続検査であり、実UIの成功に置き換えない。配置rollback用raw context復元関数の追加、および複製・同一配列move→add補正等の後続変更はB最終review/testへ含める。先行chunkの指摘解消とB全体の受入れを区別する。

### 05-B 既存テストの責務移行（途中）

read-only `EMP-05-B-TEST-RESPONSIBILITY-MAP`で旧`site-schedule-guard.test.mjs`の11件を新server/client責務へ対応づけた。SDK transactionの呼出し形状は移行するが、Site revision欠損の初期化・不正値拒否、旧新Site双方の更新と競合、unique Site 8/9件境界、全read先行と途中拒否時のwrite 0、確認の操作/tenant束縛・取消・再試行、rawと無関係field保持は維持する。`site-lifecycle-ui-source-contract.test.mjs`はSite固有の表示/取消/専用操作とCustomInputの破棄を残し、旧handler接続のassertだけ新Manager/submission/duplicatorへ移す。旧guardとhandlerの保存拒否も直接確認する。実行結果は移行後のcommand完了時に記録する。

同調査とrootのsource照合で、同batchの最初に終了済みSiteを移動元としてread cacheへ入れると、後のcommandで同Siteを移動先にする明示確認が省略される問題を確認した。読取cacheと移動先の確認状態を分離し、取消でCallableを送らないtestをdeveloperへ依頼した。また[Site実装記録](../implementation/site-master.md#矛盾未使用候補)の既存条件に合わせ、確認は成功/取消/破棄で消し、確定失敗後の同じ操作の明示再試行だけで維持する。毎submitの再確認へ仕様を変更せず、editor/submissionの双方を回帰対象とする。この時点は静的確認と修正指示までで、修正後の成功・受入れを意味しない。

### 05-B 通知の先行レビュー（途中）

固定した通知state contract/editor/ManagerとRulesの4fileへ`EMP-05-B-NOTIFICATION-REVIEW`/`SEC`を実施した。一般reviewは既存4状態の計算・時刻・0/false・所有field保持に追加指摘なし。securityは、通知A保存中のreset後に同scopeでBを開くと旧transactionがAを書き込めるP2と、commit後の再取得拒否を未保存と誤分類するP2を検出した。rootもsourceを照合し、transactionのawait前後とwrite前のgeneration照合、commit確定と再取得結果の分離、旧応答破棄を修正依頼した。状態helperだけではcontrollerの非同期経路を証明できないため、再試行・scope変更・commit後read拒否を直接testへ追加する。

Rulesの限定静的reviewでは参照/非所有field変更、create/delete、generic/nested迂回の拒否を確認した。監査評価は通知4fileの範囲でscore 2、上記2件が未解消の途中評価である。rootは固定したFunctions/Rules/HTTP harnessに対して`npm run test:local`を開始した。新規HTTP統合caseの通過を観測したが、全suiteのexitはまだ得ておらず、完了証拠にはしない。developerは実行中のserver/Rules/harnessを固定し、client/domainの修正を継続する。

通知R1はgeneration照合とcommit確定後の表示分離を追加した。rootがeditor（`F3C1E2CF47C5C93145867BA05AD9BAEF37901EDF628375AEBB6D64DC23DC6D53`）と直接test（`E3C93060E945BB939A414B8BCC7BE1B37A054E72AD8B6A47056ECBAAFEB62B7D`）を照合し、`node --test test/domain/operation-submission.test.mjs`で12/12・exit 0を確認。再reviewはこの時点で未完了。

### 05-B 全体Emulator初回と修正対象（2026-09-07）

rootの`npm run test:local`は175件中172成功・3失敗、exit 1。大量の陰性logで初回の失敗本文がtool出力から切れたため、同じcommandを所有runtimeへ出力保存して診断再実行し、同じ件数・3失敗・exit 1を確認した。新規EMP05-B HTTP統合caseは成功したが、全体gateは失敗である。

- Site archive競合testのarchive先行側は、追加したfixtureの`customer: {}`が既存の正規projection条件を満たさず拒否された。実Customer projectionを使い、archive成功と後続参照拒否の条件を維持する修正を依頼した。
- Customer競合testのOperationResults参照先行側に旧client `setDoc`が残り、Rulesで拒否された。両順序・同時競合を専用writerへ移し、旧writerが常に拒否されるだけの陰性testで参照整合性を証明しない。
- 履歴再構築の許可actor testで`dayjs.tz is not a function`。新HTTP caseが残した実績の参照により、従来の空集合testが履歴生成へ到達した可能性がある。新caseの所有fixtureをfinallyで片付ける隔離と原因切分けを依頼した。履歴再構築の実data経路と日付処理は05-Cの直接回帰へ引き渡し、隔離後のtest成功だけでこの経路の成功を主張しない。

各実行後にEmulator停止と専用port・観測した派生8294/8939・9150のLISTEN不在、保護22fileのhash不変をrootの独立command・exit 0で確認した。所有runtimeは後続検証用に保持している。

固定server後続差分への`SERVER-FINAL-REVIEW`は追加指摘なし、`SERVER-FINAL-SEC`はresult/billingが同じOperationResultsへ解決されるのにkind名で複製元との依存commandを判定するP2を検出した。rootもsourceを照合し、解決後collection/pathで判定して同じ原本のbilling変更と複製を両順序write 0にする修正を依頼した。別対象の独立操作は維持する。修正後のreview・testまで先行serverの受入れは未完了とする。

### 05-B 追加の到達確認と再検証（途中）

`NOTIFICATION-SEC-R1`は2件解消・追加blockingなし、限定静的監査score 5へ更新した。`RAW-CONTEXT-SEC`は配置のraw context・期間reader・Card・Draggable2種・command導出の6fileに追加blockingなし。一方、外側の予定actionが旧scopeのsubmit終了を新画面の失敗通知へ変えるP2を検出した。開始scope/世代/disposeをactionにも適用し、同scope拒否のrollbackだけを維持する修正を依頼した。

`WRITER-CLOSURE`は対象の旧全文writer迂回を検出しなかったが、Site詳細の引数なしCREATEで`beforeEdit`へundefinedを渡すP2を検出した。独立preset生成の補正後、`ARRAY-CREATE-REVIEW`で解消を確認。未使用`useOperationBillingsManager.js`には旧createが残り、caller未検出とRules拒否を確認したため、旧writer文字列の全消滅とは扱わない。

同じRulesへ到達する本人向け通知を追補調査すると、旧adapterの`updatedAt = new Date()`・全文setが新Rulesの`request.time`とcreatedAt保持に合わないことを確認した。これは本人操作を刷新する要求ではなく、05-Bで変更するRulesによる回帰である。既存next状態・下番入力・認可を維持し、開始rawを持つ共有通知controllerの状態部分transactionへ保存だけを接続する補正をsource表へ追加した。本人handlerの直接回帰を追加し、全本人業務のUI受入れへは拡張しない。実装・reviewは未完了。

server alias補正（`DAC9CFF716B54285DEF70D7D97BB2C10E046BDE0F009DBAE4740E730DAA40781`）は`SERVER-SEC-R1`で解消。rootが`node --test test/domain/operation-write.test.mjs test/domain/operation-editor.test.mjs`を実行し46/46・exit 0を確認した。aliasの8陰性組合せと別対象成功、ArrayManagerの独立preset・取消を含む。harnessのfixture隔離・参照競合移行後、`powershell -ExecutionPolicy Bypass -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern 'EMP05-B HTTP|Site archive and OperationResult writer|CAS-03 OperationResults|rebuild history Callable allows'`を実行し、6件中2成功・4失敗、exit 1。新HTTPと履歴の許可caseは成功したが、Site fixtureでAdmin Timestampをclient setDocへ渡す型不一致、Customer競合3件でactor fixtureの保存API認可不一致が残り、fixtureの修正を依頼した。

通常`functions/index.js`にはdayjsのUTC/timezone・Asia/Tokyo初期化があり、専用entry/harnessには同じ初期化がないことをrootが確認した。履歴の先行エラーを通常entryの製品不具合と断定しない。05-Cの非空履歴回帰では、この実行前提を明示して確認する。targeted実行後は専用port・派生8887/9150停止、保護hash不変を確認し、Windows handleで自動cleanupが遅延した所有`test-harness-6684`だけを絶対path・reparse検査後に削除した。cleanup commandはexit 0。

### 05-B terminal後の最終レビューと検証（途中）

fixtureのSDK日時型とEMP05専用actor原本を補正した後、上記targeted commandは6/6・exit 0。専用/派生8135/9150の停止、保護22hash不変、所有`test-harness-5556`の遅延cleanupを確認した。

本人通知の3fileは`PERSONAL-REVIEW`/`PERSONAL-ACTIONS-SEC`で追加blockingなし。actionsの同scope権限喪失が世代へ反映されない残りP2を、allowed同期監視と喪失/再許可×旧成功/拒否の4testで補正し、`CLIENT-FINAL-SEC`で解消を確認した。rootの直接`operation-submission`/`operation-editor`合計45件成功は途中の証拠であり、後続追加分は全domainへ対応づける。

developer terminal後、rootが`node --test test/domain/*.test.mjs`を実行し1326/1326・exit 0、`npm run test:local`は175/175・exit 0を確認した。Emulatorには同社rolesなしの本登録actorによる通知4状態の部分transaction、createdAtのsubmillisecond精度・未知map保持を追加した（harness hash `F5A899D4AC778B6ACF5E2AB3F1F32E5E33858345FA7474EA9A226C9F55C38A7D`）。本人controllerから同じpatch契約までのdomain証拠とRules実行証拠を対応づけ、本人UI全体の成功とはしない。Emulator終了後に保護22fileの件数/hash不変、専用/派生8581/9150の停止を独立command・exit 0で確認した。

ただし最終client reviewで3件が残り、受入れは保留した。一般reviewは、複製の保存確定後read失敗をuncertain扱いし、新しい複製も開けなくするP2を検出。securityは、editorの旧Site取得/確認応答がreset後の新draft確認状態へ混入するP2と、複製のpost-read中にbusyが解除されて再送/日付変更等が可能なP2を検出した。rootもsource照合し、`CLIENT-R1`でeditor/duplicatorと直接testだけを修正対象にした。保存全体のbusy、開始ticket/対象値、既知成功と応答不明の区別を一緒に確認する。修正後のdomain・影響review・fresh build/UIは未完了で、1326件成功を最終修正版の証拠に流用しない。Functions/Rules/harnessは固定し、変更がない保存境界のEmulator証拠とclient固有の追加回帰を区別する。

### 05-B source統合前の修正確定（2026-09-07）

`CLIENT-R1`は上記4fileだけを修正した。rootがsourceとhashを照合し、`node --test test/domain/*.test.mjs`を再実行して1334/1334・exit 0を確認した。`CLIENT-REVIEW-R1`と`CLIENT-SEC-R1`は3件の解消・限定差分に追加blockingなしと判定した。両reviewは独立test実行をせず、rootの実行証拠と区別する。

保存確定後の読取失敗は保存済み案内と旧attempt破棄へ分け、新しい複製を可能にする。実際の結果不明は再送禁止を維持する。複製の再取得終了までbusyを維持し、Site取得/確認は開始ticket・会社・対象に固定する。両複製種別と読取拒否/通信失敗、処理中の再送/別対象/取消、旧応答、Site取得/確認待機中のdraft切替を直接回帰へ含めた。

最終4fileはclient controllerとdomain testであり、175件成功後のFunctions/Rules/harnessには変更がない。verification policyの失効条件に従い、保存境界のEmulator175/175・exit 0は再利用し、後続client差分は1334件のdomainとこれから行うfresh build/実UIへ対応づける。managed-governance、project-docs-negative、capacity-regressionも対象validator・policy・governance・fixtureに後続変更がなく、同turnのexit 0証拠を再利用する。文書検証とdiff検査は最終文書に対して再実行する。Dev/Prod生成・releaseは対象外で未実施。

この時点はreview済みsourceのlocal統合準備で、05-Bの実UI・cleanup・受入れは未完了。05-C以降へ進まず、EMPの得点は55%のままとする。新仕様・data形状・ADR・共通governance・packageの変更はなく、実装記録・roadmap・本receipt・CHANGELOGの4文書だけを同期する。

### 05-B 初回実UIと補正（2026-09-07、途中）

文書検証（254 Markdown / 60 ADR / 11 roadmap / 8 TOML）、`git diff --check`、`git diff --cached --check`はそれぞれexit 0。review済み62製品/test fileと4文書を`df00e543`へlocal統合し、clean HEADから`npm run test:local:ui:build`を実行してexit 0を確認した。専用Emulatorとgenerated serverを独立前景processで起動し、HTTP 200・saveOperation登録・外部作用denyを確認した。

非UI setupでは保存済み単一合成Authを再利用し、一時credentialはrunning専用Auth内と入力memoryだけで扱った。Customerの正規UI作成後、Site作成はSystem/system不存在によりRulesで拒否された。GET 404とRulesを照合し、自動testと同じ`isMaintenance=false`だけを不存在条件付きでrunning専用Emulatorへ環境baselineとして作成した。保存済みexportは変更せず、業務fixtureの直接注入とは分離する。保持した画面入力からのSite再試行は成功した。

通常UIでCustomer・Site・日勤取極め・Employeeを各1件作成した。取極めは09/07適用、08:00〜17:00・実働8時間/休憩1時間、平日通常12000/残業1500・資格14000/1750、未使用曜日0円の明示確認を経て保存した。Employeeは09/07入社、User未連携・警備員登録未完了で、座標取得不可でも住所保存と案内を確認した。初回の数値だけの日付入力と表示名長さは入力条件に合わせて訂正し、製品保存不具合へ数えない。

配置管理の既存SpeedDialから予定を開くと、draftと「編集を開始できません」が同時表示された。入力を補い取極めを適用した後の09/07・必要人数1の予定保存は成功したが、正常な作成開始とは受け入れない。`EMP-05-B-UI-DIAG`の純粋診断とrootのinstalled source照合で、Class presetの未入力startTime/endTime=nullをcontrollerがsetterへ再代入して例外になると確認した。また新OperationManagerのfallback作成ボタンが、既存配置画面の固定高Table後へ意図せず増えていた。

`UI-R1`は同値preset再代入の回避と当該配置画面の空activator接続、実Classの作成/取消回帰へ限定する。UIタブとgenerated serverを停止し、Functions/Rulesを固定したまま所有Emulatorに合成状態を保持する。修正後のreview・domain・source統合・fresh build/画面再確認が終わるまでBは未完了。背景処理・archiveへは進まない。

rootが3fileの差分・hashを照合し、`node --test test/domain/*.test.mjs`で1336/1336・exit 0を確認した。`UI-REVIEW-R1`は追加blockingなし。actor/tenant・transaction・保存fieldに変更はなく、同値入力の初期化とslotだけの限定修正として影響reviewを選び、Functions/Rules/harnessの175件証拠を再利用する。実UIを再開する前に、14600のLISTEN不在・所有Emulatorだけの稼働・保護22hash不変をsandbox外の読取りcommandで確認した（exit 0）。read-only backend assertionでは初回予定のworker配列0件、必要人数1、08:00〜17:00を確認した。まだ配置・複製・実績化の成功を主張しない。

### 05-B 再UIでの確認と日付処理の再点検（2026-09-07、途中）

`51585c04`へ上記限定修正とreceiptをlocal統合し、clean HEADの`npm run test:local:ui:build`でexit 0を確認した。再開した実UIで予定CREATE開始時の例外は解消した。一方、空activator slotでも配置画面のfallbackボタンは残った。compile/source検査と先行reviewだけでは実描画を証明できなかったため、この指摘を再開する。

通常のpointer操作で合成Employeeを予定へ配置し、worker詳細の休憩を0.5時間へ変更して保存・再読込した。backendの読取りではemployeeIds/従業員配列が各1件、breakMinutes=30、hasNotification=falseを確認した。最初のdrag位置推定は外れたが、表示要素の境界を読取り確認して通常dragを行うと成功したため、drop領域自体の変更を追加しない。

複製dialogで09/08を選択して保存すると、コピーが09/07の列へ現れた。backendでもコピーの日付文字列09/07を確認した。rootのsource照合ではserverのduplicateが計算用ClassのdateAt setterへ再代入し、installed WorkTimeBaseがnative Date.setHours(0,0,0,0)でhost時差に依存している。既存domainはWindowsのJST環境で成功しており、UTCでの選択日保持の証拠ではない。create/overview/worker連動・通知/実績化・請求日付の同原因を05-B内で点検し、packageやprocess全体の時差を変更せずapplication内で修正する。通常entryのdayjs timezone初期化だけではnative Dateの問題は解消しない。

rootは所有tab、generated server、Emulatorの順で停止した（前景sessionのCtrl-C終了はexit 1）。sandbox外の独立port照合で専用portと観測済み派生8917/9150のLISTEN不在、exit 0を確認した。running専用Emulatorの合成UI状態はexportしていない。backend修正により影響するEmulator証拠は再実行対象とし、再review・domain・Emulator・fresh build/UIが完了するまで05-B未完了を維持する。

### 05-B 日時・slot補正の固定検証（2026-09-07、途中）

`UI-R2`は計算/draft instanceと子配列へ限定したJST adapterをBの保存・通知状態・editor・予定移動へ接続した。package/prototype/global Date/process設定は変更せず、通知actualの既存flag規則、callback・dayType・親子同期、raw差分保持を維持する。Managerはslotが存在するときに既定ボタンを描画しない。実templateとwrapperのrender testでなし/空/customを確認する。

`UI-R2-PLAN`で親子再生成と固定数値の条件を補足し、実装文書へ反映した。`UI-R2-REVIEW`/`UI-R2-SEC`は固定した7sourceに追加P1/P2なし。review途中の同一親instance.initialize後のWeakSet残留は、現適用先の再表示/rollbackが新instanceへ置換することと、Card/Workersの別cloneを照合して現経路のP2にはしなかった。adapterの寿命制約は実装文書に残し、共通基盤としての保証へ拡張しない。

rootが最終source/test hashを照合し、`node --test test/domain/*.test.mjs`で1338/1338・exit 0、`npm run test:local`で175/175・exit 0を確認した。新日時test（SHA-256 `B0C3BCB7E12FE5CA0B9483B1DDCE808F1F83D89B318F80F1973AE2582AF13BFF`）はUTC/JST各24 chainを実saveOperation経由で検証し、日勤480分・09時境界2分・夜勤/24時間・翌日加算・閏日/年越し・通知/実績化を固定値と比較する。非0の曜日別料金と改定取極めを使い、締日11/20の21800円、翌11/21の51000円、適用agreement.keyと翌月請求日を個別assertした。日付不変時のTimestamp nanos123456789・未知field保持も確認した。料金追補中のtest自身のgetter誤認2件は訂正して最終成功を得ており、製品sourceの追加変更はない。

全Emulator終了後、rootの独立commandで専用port・派生8028/9150のLISTEN不在、保護22fileの件数/hash不変、所有harness runtimeのcleanupを確認した（各exit 0）。Functionsを変更したため旧175件を流用せず再実行した。変更のないmanaged-governance/project-docs-negative/capacity-regressionの同turn証拠はpolicyの失効条件に基づき再利用する。文書/diffは最終文書に対して再実行し、修正版のfresh build/実UI完了まではBを受け入れない。

### 05-B 再入場時の購読補正（2026-09-07、途中）

文書検証と差分検査のexit 0後、日時・slot補正を`b04bd3cc`へlocal統合した。同じclean HEADの専用buildはexit 0。実UIでは作成開始の例外と余分なbuttonが解消し、正規作成した合成Employeeの配置・休憩30分への変更、09/08への複製・再読込を確認した。backend読取りでも親子の09/08、同日17:00終了、休憩30分、参照索引を確認した。

上下番確定の既存queryは前日までを対象にするため、今日・翌日だけでは実績化試験に進まない。正規UIで合成Employeeの入社日とSite取極め開始日を09/01へ変更した。その後配置管理へ戻ると、保存済み予定が一覧に現れなくなった。backendには09/07・09/08の予定が残っており、保存失敗とは分離する。

rootはBの範囲readerがcache/pendingを拒否しながら`includeMetadataChanges`を指定していないことを照合した。installed SDKの型契約では既定がfalseであり、内容が同じままserver確認済みへ移る通知を受け取れない。同じ欠陥を持つBのGenerator通知購読・実績明細購読も限定修正へ含める。既存のcache/pending拒否・actor/tenant・世代条件は維持し、初回cache→server確認、再入場/再選択、旧scope応答を直接回帰へ追加する。他reader全体へ一般化しない。

所有tabとgenerated serverを停止し、14600のLISTEN不在を独立command・exit 0で確認した。Functions/Rulesを変更しないclient補正のため、専用Emulator内の合成状態を保持している。`UI-R3`のreview・domain・fresh build・再入場と実績化の実UI・cleanupは未完了であり、B受入れやC開始の証拠にはしない。

その後、rootは固定した3source/2testの差分・hashを照合し、`node --test test/domain/*.test.mjs`で1340/1340・exit 0を確認した。`UI-REVIEW-R3`は一般/限定security影響を確認し追加P1/P2なし。sourceは各listenerのoptions1行だけであり、actor/tenant・cache/pending拒否・世代条件は不変である。Functions/Rules/harnessに変更がないため保存境界の175/175・exit 0と非失効の包括gate証拠を再利用し、client配送の証拠は直接testと後続のfresh build/実UIへ分ける。文書検証とdiffはこの最終receiptに対して再実行する。まだBの実UI・cleanupは未完了。
