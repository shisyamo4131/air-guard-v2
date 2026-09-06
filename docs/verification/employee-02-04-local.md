# Employee EMP-02〜04 local検証記録

- 対象: EMP-02 作成・基本・国籍、EMP-03 警備員登録・資格、EMP-04 3保険の保存
- 実施承認: 2026-09-06「EMP-04まで一気通貫で作業開始」
- 開始baseline: `9f4ec24d783f0c81fd89a056dc0ff4893f0f83a4`、primary `codex/employee-master-roadmap`
- 現在工程・進捗・次作業の正本: [Employeeロードマップ](../roadmaps/employee.md)

## 実施範囲と証拠の区分

EMP-01で確定した[仕様](../specification.md#employeeの操作権限と保持)と[設計契約](../implementation/employee-master.md#通常保存の技術契約)を対象とする。各工程の実装・独立review・自動検証・正規UI操作・backend assertion・cleanupを個別に確認する。source commitはUI検証用のclean HEADを得る境界であり、その時点だけで工程完了としない。各工程で実際に得た結果だけを下記へ追記し、後続工程で無効になる証拠を区別する。

UIはCodex専用demo `demo-air-guard-v2-codex`、loopback、合成data、外部作用deny。Dev/Prod、利用者用saved-dataへの書込み、実provider接続、package変更は対象外。geocoding成功・0座標・遅延/競合は注入した合成応答で試験し、外部接続をしないUIでは住所保存と座標未取得の通知を確認する。

## 開始時点の環境確認（2026-09-06）

rootが専用in-app browserのタブ取得を確認した。専用port（14600、19099、18080、19000、19199、15001、14400、14500）にLISTENはなく、`.output`は存在しなかった。既存のdatabase/firestore/pglite debug logをroot所有の`.codex-test/runtime/emp02-04-ui`へ退避し、SHA-256を記録した。他のruntimeは保持する。

以下は開始時のファイル数・bytes・集約SHA-256。FullName順のrelative path（先頭区切りあり）・length・file SHA-256を`|`で連結し、LF結合したUTF-8のSHA-256を使用した。終了後も同方式で比較する。data内容とcredentialsは記録しない。

| 対象 | files | bytes | SHA-256 |
|---|---:|---:|---|
| 利用者用 saved-data | 7 | 6012330 | C0E4BF8B382A786B8EBAA4C6729937D6DDEC6804DCFD0C464FA1C1F38F8BA584 |
| Codex UI saved-data | 7 | 3492 | 12D57744070A8F7D699A4B0A631851BEB87E529E59F8CA570BC930BD9838EC47 |
| Codex isolated-saved-data | 7 | 3520 | 9FD810AB2232A7BB10D89786FE84A72BDC4720ADFA7FC6A1E388995D15720BC1 |

## 共通検証の実測

source baseline上で`powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`、`powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1`、`powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1`を個別実行し、それぞれexit 0を確認した。managed/renderer整合、negative fixturesの期待結果一致、capacity合成7 checksが成功した。現在taskの容量測定ではない。該当validator/route/policyが後続編集で変更されなければpolicy上再利用する。製品domain・Rules・UIの成功証拠とはしない。

## EMP-02 実装・review・検証

開始baselineは上記`9f4ec24`。UI・application logic・data contract/schema・permissions・専用buildのclass unionで選択した。共通3gateに加え、project-docs、全domain、local Emulator、専用UI build、diff-checkを完了gateとする。Dev/Prodのgenerate/deployはrelease-onlyかつ未承認のため実施しない。利用者仕様の変更はなく、specificationのversion更新・新ADR・migration・package/governance設定変更はない。既存ADRの工程停止記述は履歴化し、最新承認とroadmapへ接続した。

### 独立review

- EMP-02-SEC-R1: `employeeContract.js`、`saveEmployee.js`、関連clientとtestをread-only確認。住所の同値preflight後の競合保存、国籍解除時の入力patch残存、在留期間制限解除の満了日消去と期待値を修正し、再reviewで3件解消・追加blockingなし。runtime成功の代用にはしない。
- EMP-02-CLIENT-R1: editor/controller/共有契約/testとmessage queue接続をread-only確認。作成後の遷移で警告が消える問題と、表示名を元の値へ明示入力した場合の優先漏れを修正し、再reviewで2件解消・追加blockingなし。次工程で共通editorを使うための追加設計判断はない。

### 実測（UI前）

- `npm run test:local`: 172 tests / pass 172 / fail 0、exit 0。実Functions HTTPの作成・基本patch・不正field・同ID重複、外部作用deny、および7actor原本/archive read・直接CUD/nested/他tenant拒否を含む。runnerが利用者saved-data不変、専用import read-onlyを確認して終了した。
- `node --test test/domain/*.test.mjs`: 初回は1179 tests中1178 pass、exit 1。既存Rules予約collection期待値に`Employees_archive`がない1件で、Rulesの保護を維持して期待値を更新する。最終結果は後記する。
- 同commandを期待値修正後に再実行し、1179 tests / pass 1179 / fail 0、exit 0。local harnessを変更しないtest期待値の修正なので、上記Emulator証拠は有効。
- `git diff --check`: exit 0。project-docsの初回は既存見出しlinkの欠損でexit 1。見出し識別子を保持して履歴の説明を本文へ置く形に修正した。

直接UI・backend assertion・専用build・最終文書gate・統合・cleanupはこの時点では未完了であり、EMP-02の進捗は加点しない。

### 初回UIと修正対象

sourceを`75080329982e7e6d1edc14a1ec66dc260c529801`へlocal commitし、clean HEADで`npm run test:local:ui:build`はexit 0。専用Functionsの3操作登録・All emulators ready・generated server起動・HTTP 200を確認した。保存済み合成会社管理者sessionでダッシュボードへ到達し、可視メニューから在職者一覧、新規登録へ進んだ。空入力の保存拒否を確認後、通常keyboardで合成Employeeを登録した。

実画面・read-only backend assertionで姓名・住所・ACTIVE・座標null・3保険世代0の保存を確認したが、表示名が姓名の先頭1文字で停止する不具合を検出した。入力部品がprop同期も編集eventとして返し、自動表示名を明示入力と誤認することを静的調査で確認した。Employeeの表示名入力だけを変更し、共通packageへ広げず再試験する。初回UIは受入れ失敗であり、作成後の警告は観測できていないため成功と記録しない。

今回所有tabを閉じ、generated serverとEmulatorへCtrl+Cを送信して終了を確認した（終了processのexit 1は停止操作の結果）。専用8portと派生9150/8286にLISTENがないことを確認し、所有`.output`を絶対path・reparse不在確認後に削除した。saved-dataと既存logの最終指紋確認・復元は連続実施の終了時に行う。

### 表示名の修正と再検証

動的component指定の初案はEMP-02-UI-R2で未登録componentの解決不足を指摘され、EmployeeEditorの`input.displayName`スロットに静的`v-text-field`を置く修正へ変更した。共有operation contractは元へ戻し、package・共通入力部品を変更しない。実AirItemInputのslot attrs生成、静的componentのtemplate compile、逐次姓名入力と明示表示名保持を追加testで検証した。

最終slot修正後の`node --test test/domain/*.test.mjs`は1180 tests / pass 1180 / fail 0、exit 0。`npm run test:local`の再実行も172 tests / pass 172 / fail 0、exit 0。後者の後続差分はUI slot・domain test・文書だけで、server保存契約・Rules・harnessは不変のためEmulator証拠を再利用する。`git diff --check`もexit 0。実UI再試験とその受入れは未完了。

### EMP-02 最終受入れ

EMP-02-UI-R3は静的slot接続のP2解消・追加指摘なし。source commit `67e53a9ee435c842ffcf9b0f0408309ba9f9ea3a`をclean状態で`npm run test:local:ui:build`しexit 0。前景Emulatorのready・3専用Callable登録、generated serverのidentity検査・HTTP 200を確認した。修正前buildの証拠を流用していない。

- UI user-equivalent action: 保存済みsessionが失効したため、専用合成accountへ通常keyboard入力でサインインした。ダッシュボード→可視メニュー→在職一覧→正規新規登録の経路で2件を作成した。姓名の連続入力が完全な表示名へ追従すること、基本編集の取消、明示した元表示名の優先、住所変更、国籍の登録・解除、明示再読込みを確認した。保存中の入力/保存button無効化、住所変更後の座標未取得通知、新規登録から詳細への遷移後にも通知が表示されることを直接観測した。
- non-UI setup: 専用Authの保存済み1合成accountと実行中accountの一致を確認し、running Emulator内だけにrandomな一時passwordを設定した。credentialはmemory内で入力し、repository・応答・command出力へ保存しなかった。saved-dataの変更はない。
- backend assertion: UI作成原本の姓名・表示名・住所・ACTIVE・座標2field null・3保険世代0、取消時の原本完全不変、基本/国籍保存後の他section・保険世代・資格・在籍情報保持、外国籍解除の従属消去をread-only照合した。2件目作成でも1件目原本は不変だった。非UIで対象Employeeを注入していない。
- cleanup: 所有tabを閉じ、generated server→EmulatorをCtrl+Cで停止し、終了を確認した（停止時exit 1）。専用8portと派生9150/8780のLISTENなし、`.output`の安全な削除、開始時3datasetすべてのfile数・bytes・SHA-256一致、既存root logの復元・SHA-256一致を個別commandのexit 0で確認した。一時credentialはEmulator停止で失効した。連続工程の検証logと原log backupだけを既存のroot所有runtimeへ保持し、EMP-04終了時に削除する。

変更classに必要な共通3gate、project-docs（exit 0）、全domain（1180/1180・exit 0）、Emulator（172/172・exit 0）、最終専用build（exit 0）、diff/cached diff（exit 0）を確認した。最終文書更新後は文書gateだけを再実行する。実provider・Dev/Prod・別roleの代表UI・実dataは未検証。権限別保存と拒否・競合/応答不明は自動testで検証し、全roleの画面受入れを実施したとは扱わない。

EMP-02の目的・完了条件を満たし、進捗を10%→30%へ加点する。EMP-03は資格行の原配列位置・raw配列期待値・子Classの明示validation・既存date入力を引き継ぐ。次工程のread-only preflightでAirItemInput schema/slot契約と資格Tableの表示順を確認し、追加仕様判断は不要と判断した。保険編集はEMP-04まで停止、archive/参照保護とDev提供は後続工程のままである。

## EMP-03 開始契約

EMP-02の完了記録を`f4ee3bbcd4ffbd7d8289b96f6023f3b34a6cf0f3`へ統合し、primary/branch/clean状態をrootが確認して開始した。警備員登録9fieldと資格行6fieldの専用操作、原配列位置とraw配列全体の期待値、独立draft、保存await、取消・失敗・競合・結果不明を対象とする。新たな資格IDや重複禁止・行政業務要件を追加しない。共通schemaの必須・型・日付・相関を保存境界で検証し、別section/未知field/保険/lifecycleを保持する。

application writerは既存developerへ集中し、Employee共有契約・専用API/use-case/controller/editor・警備/資格component・詳細pageと直接testを所有する。rootは文書・最終検証・専用UI・backend assertion・cleanup・統合を担当する。他package、参照writer、archive、User/lifecycle専用処理、Dev/Prod/外部作用は対象外。保険editorはEMP-04までread-onlyを維持する。前工程と同じclass unionとgateを適用し、変更で無効になったdomain/Emulator/buildを再実行する。共通3gateはvalidator/route/policy不変なら再利用する。

代表UIは警備登録/解除、資格追加/更新/削除と日付、原配列位置による対象行の維持を確認する。同名・古い配列・別行追加との競合write 0はdomain/Emulatorで検証し、2画面で編集中の変更通知と入力保持・再読込みも確認する。未達はこの工程へ戻し、完了・統合後だけEMP-04を開始する。

### EMP-03 UI前の実測

- `node --test test/domain/*.test.mjs`: 1190 tests / pass 1190 / fail 0、exit 0。
- `npm run test:local`: 173 tests / pass 173 / fail 0、exit 0。実HTTPで警備員登録/解除、同名資格2件の追加・1行の名称変更・古い配列の拒否・削除、現在actor権限喪失時の拒否を追加確認した。既存EMP-02/UWB/他masterのharnessも成功した。
- `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`および`git diff --check`: 各exit 0。後続文書変更があれば該当gateを再実行する。
- EMP-03-CLIENT: 指定component/controller/shared contract/testと実入力部品をread-only reviewし、追加blockingなし。原本位置・再選択・raw draft・日時・権限喪失、EMP-02互換と保険read-onlyを静的確認した。次工程の追加設計判断はない。実UI・2画面競合の成功証拠にはしない。

保存境界の独立review、最終build、直接UI、backend assertion、cleanup、統合はこの時点では未完了。

EMP-03-SECも保存module/API/shared contract/client/testをread-only reviewし、修正必須の指摘なし。資格配列のA→B→Aという完全復元は採用済みの配列期待値だけでは識別しない限界を確認し、保険の世代値によるABA検知と同一視しない。新資格IDや全Employee版数を追加しない。source/testsの確認をrootの実測と区別する。独立review2件と自動gateの結果から、review済みsourceのlocal統合・専用UI検証へ進む。

### EMP-03 初回UIと修正対象

source `3faabe528e81a8ac929056127ecf885ed5bdb368`のclean HEADで専用buildはexit 0。Emulator ready・警備/資格Callable登録・generated server起動・HTTP 200を確認した。合成accountの一時credentialはrunning Auth内だけに設定し、通常keyboardでsign-inした。

可視UIからEmployeeを正規作成し、表示名追従・遷移後の座標未取得通知、警備登録の保存を確認した。同名資格2行を追加し、2行目の名称を変えて表示順が逆転してもraw原配列の1行目は完全不変だった。2画面の別行更新に対し、元画面はdraftを保持して保存を無効化した。明示再読込で選択が解除され、再選択した資格だけの削除と他行の保持をread-only backend assertionで確認した。保険・基本情報も保持された。

警備登録解除では緊急連絡先続柄がnullに戻らず、新規Classの初期選択値に戻る不一致を検出した。installed Employeeの既存従属初期化は続柄をnullにするため、既存仕様の復元として修正する。解除後の全非警備field保持と資格不変は確認できたが、解除の受入れは失敗とする。sourceを修正して再検証するまでEMP-03は加点しない。所有tabを閉じ、generated server→EmulatorをCtrl+Cで停止（停止exit 1）、専用portと派生9150/8411のLISTENなし、所有`.output`削除をexit 0で確認した。

### EMP-03 初期化修正の再検証

createと警備員登録解除だけに、既存schema hookと一致する9fieldの消去値を適用した。入力defaultと保存時消去値を区別し、schema実methodとの全field比較・解除値と従属入力の混在・unknown/不存在/保険保持・実HTTP作成/解除比較を追加した。EMP-03-UI-R1-SECは指定shared contractと直接testの静的再reviewで修正充足・追加blockingなしと判断した。前回reviewの入力defaultと保存消去値の同一視は訂正された。

修正後`node --test test/domain/*.test.mjs`は1191 tests / pass 1191 / fail 0、exit 0。project-docsとdiff checkもexit 0。Emulator・修正版build・実UI再確認はこの時点では未完了である。

### EMP-03 最終受入れ

修正後`npm run test:local`は173 tests / pass 173 / fail 0、exit 0。source `1daf5d38622f0fcec6f54e78022a5cb882dca457`のclean HEADで専用buildもexit 0。generated serverのidentity・HTTP 200と専用Emulatorのreadyを確認した。

可視UIから新規Employeeを作成し、警備員登録・解除を再実行した。read-only backend assertionで、新規/解除それぞれの9fieldすべてが既存schema消去値と一致し、全非警備fieldが保存前後で不変だった。画面も登録/未登録表示へ切り替わった。対象Employeeの直接注入はない。資格のUI/controller/保存branchに変更がないため、前記の同名・表示順逆転・2画面競合・再選択/削除の実UI証拠を再利用し、共通contract影響は全domain/Emulatorで再検証した。

所有tabを閉じ、generated server→Emulator停止（停止exit 1）、専用8portと派生9150/8015のLISTENなし、所有`.output`削除、3datasetのfile数/bytes/SHA-256一致、原root log復元/一致を個別commandのexit 0で確認した。外部provider・Dev/Prod・実data・全roleの直接UIは未検証。専用合成account以外のrole境界は自動testで検証した。共通3gateはvalidator/route/policy不変のため前記証拠を再利用し、最終文書変更に対するproject-docs/diffは再実行する。仕様/ADR/運用手順の変更はなく、実装・進捗・検証記録だけを更新する。

EMP-03の完了条件を満たし進捗を30%→40%とする。次工程reviewでは保険の6操作を維持し、特にlossのisProcessing非変更、cancelEnrollのpreviousStatus=null、rollbackの4field復元、raw履歴Timestamp/unknown保持、巻き戻さない保険別世代値を引継ぎ事項とした。保険番号20文字・喪失理由40文字はinstalled schemaの現制約を使い、新しい形式制約は追加しない。EMP-04完了後に停止する承認境界は維持する。
