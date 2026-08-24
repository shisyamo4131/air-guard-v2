# 変更履歴

このファイルは、利用者、仕様、セキュリティ、運用に見える変更を記録します。詳細な判断理由は `docs/decisions/` に記録します。

## Unreleased

### Added

- Windows PC移行について、repository・Git外local data・Codex portable stateの停止時backup、Windows native/WSL境界、再認証、変更なしrestore checkpoint、旧PC保持条件を含む手順を追加した。
- 利用者用`./saved-data`と通常local環境を変更せず、loopback限定demo project、合成Auth/Firestore seed、読込専用export、容量・指紋ガードを使うCodex専用localテスト基盤を追加した。
- 共通managed governance 1.0.0とAirGuardV2所有の`governance/project-rules.md`を分離し、lock、renderer、managed validator、生成`AGENTS.md`を再構築する方針を追加した。
- 作業目的別の文書案内、正式運用準備ロードマップ、証拠に基づく加重進捗管理を追加した。
- Codexのイベント駆動チェックポイント、300 MiBでのセッション引継ぎ、再起動後のコールバック検証手順を追加した。
- 文書リンク、索引、ADR状態、ロードマップ計算、TOMLを確認するローカルガバナンス検証を追加した。
- ガバナンス設定を再現可能に検証するため、TOMLパーサーを開発依存関係として明示した。
- 配置管理の作業員タグへ、配置人数に含まれない OJT 配置を識別できる表示を追加した。
- 配置管理の日付ヘッダーへ日別の稼働数・配置人数・過不足を、固定フッターへ仮配置・配置済・確認済・上番済・下番済・要確認の件数を表示する機能を追加した。
- 配置管理で従業員の同日の日勤・夜勤、および夜勤から翌日の日勤への連勤を判定し、関係する双方の配置タグへ理由付きの警告アイコンを表示する機能を追加した。
- プロジェクト管理文書一式を追加した。
- 現行仕様の正本、ADR、運用手順、将来タスク用プロンプト、一般技術知識の記録先を追加した。
- 主エージェント、リサーチャー、コーダー、テスターによるマルチエージェント体制を追加した。
- 外部作用を排除したFirebase Emulator環境で、Codexが単体・結合テストを行う手順と制約を追加した。
- `.codex/agents/` に実装、テスト、コード調査、外部文書調査、独立レビュー、UI検証、セキュリティレビューのプロジェクト専用エージェントを追加した。

### Changed

- UWB-07をEmployee退職、会社管理者専用の単独本登録User削除、会社管理者専用の誤退職訂正へ再構成した。`employees:terminate`、User archive不採用、操作単位の統合`LifecycleOperations`、本登録Auth削除intent・冪等reconcile、旧User/Auth非復元、current Auth再照合、UWB-08との同一Rules release gateを確定した。仮User連携は既存仮登録削除後のEmployee-only退職へ限定し、作成元を証明できないsignup途中Authをemailから推定削除しない。disabled UserへのFCM通知、token Rules・log、同email signup競合をrelease blockerまたはrepair対象へ加えた。将来日退職と実際の再雇用、legacy退職者repairを分離し、ledger reader・保持期間・legal hold・terminal後識別子縮小の確定までは自動purgeとProd公開を行わない。
- UWB-06として、共通managerの`submit()`へ`isLoading`再入guardを追加し、共通managerを通らないUser有効化・無効化、管理者移譲、本人プロフィール保存をapplication共通operation stateへ接続した。全documentへの汎用single-flightは採用せず、多重実行riskとserver側追加対策の要否をUWB全工程の後段へ移した。全35 routeを共有`accessPolicy` catalogへ移行し、12のpathなしgroupをアクセス可能な子から導出する。routeとnavigationは同じevaluatorを使い、legacy field併記、未知・複製policy、不正なUser管理contextをfail closedとする。User管理は会社管理者または既知preset由来`users:write`へ限定し、super-userには従来の直接route許可と揃えて会社設定menuだけを表示する。全domain単体test 521件、専用Emulator suite 79件、利用者UI受入れが成功し、UWB-06を完了した。
- UWB-05として、本人の`displayName`・`tagSize`、管理対象Userの通知3フラグ、他の非管理者Userのroleを3つの専用Callableへ分離した。各操作はexact field allowlist、型・既知preset、同一tenantの有効な実行者、会社管理者またはstrict preset由来`users:write`をserverで検証し、自己role変更と会社管理者targetを拒否する。User一覧と本人設定からFireModel full document updateを除去し、全domain単体test 490件、専用Emulator suite 79件、利用者によるapplication file・動作受入れを完了した。
- `functions/modules/auth`のpolicy・permission定義を`policies/`、Callable error mapperを`mappers/`へ移し、公開export名と挙動を変えずに責務別の配置へ整理した。利用者のUWB-04確認通過後、全domain単体test 468件と専用Emulator suite 74件で回帰がないことを確認し、UWB-04を完了した。
- managed common governanceを1.3.0へ同期し、必須検証ごとの結果・exit statusを独立して扱い、後続commandの成功で先行失敗を隠さない完了証拠契約を適用した。
- managed governance validatorを必須の明示`-ProjectPath`付き正規commandで実行し、Windows user configstoreを参照するFirebase CLIベースのCodex専用Emulator suiteを既存のdemo隔離・承認境界内で最初からworkspace sandbox外で実行するプロジェクト運用へ変更した。

- User管理permissionを、仮登録Userの作成・削除を行う`users:provision`と、role・通知等を管理する`users:write`へ分離した。managerへ両方、human-resourceへ`users:provision`だけを明示付与し、provision-only actorの作成時rolesは空配列に限定した。非空rolesはclient transport前とCallableのpreflight・transaction内で拒否する。
- AirGuardV2の全Codex taskを利用者repositoryへの直接接続に限定し、Codex専用worktreeの作成・使用を禁止した。task交代時の旧task archiveは利用者だけが行い、Codexは交代検証結果の報告後に待機する運用へ変更した。
- Codex専用demo環境の`.codex-test`配下と通常の専用test sessionにある合成dataについて、作成・変更・削除、予約migration、candidate acceptance・promotionを操作ごとの利用者承認なしに行える境界へ更新した。利用者用`./saved-data`、Dev、Prod、remote service、実data、および上位のCodex・Browser安全確認は対象外のまま維持する。
- UWB-04として、全Userのcanonical email予約とEmployee予約をserver-onlyの一意性正本にし、単独／Employee連携の仮登録作成、仮登録削除、本登録変換、初期会社管理者作成、未認証事前確認を同じtransaction lifecycleへ統一した。User一覧とEmployee詳細の直接Firestore作成を専用Callableへ置換し、会社管理者またはstrict preset由来`users:write`をclient送信直前とserverで検証する。旧`checkEmailAvailabilityGlobal`は製品caller 0を確認してpublic APIから除外した。全domain単体test 462件が成功した。Codex専用Emulator以外を拒否するdry-run既定migration toolを追加したが、saved-data・Dev・Prodへのapplyは未実施である。
- UWB-04のCodex専用受入れとして、予約migration dry-runのclean、専用Emulator suite 74件、単独／Employee連携仮登録Userの正規UI作成・削除を確認した。Employee連携では既知role、User・email予約・Employee予約、Authentication不存在を作成後に確認し、削除後はUser・両予約・Authentication不存在とEmployee残存を確認した。
- 本登録Userの単なる操作権限剥奪は無効化、Employee退職時は旧accountが別tenantでの同じメールアドレスの再利用を妨げないようAuthentication accountとUser documentを物理削除し、EmployeeとのUser紐付けだけを解除する契約をUWB-07として追加した。`Users_archive`、UID参照、削除条件、監査・復旧、部分失敗reconcileは具体例による実装前の確認事項とした。
- UWB-03の仮登録User削除を、製品UIで正規作成した単独UserとEmployee連携Userで再検証し、取消、処理中、成功、競合時の安全な失敗、Authentication不変を確認した。正規管理者signupで作成した合成管理者1件をCodex専用saved-dataへ昇格し、通常再起動とdashboard復帰も確認した。
- CodexのUI受入れでは、架空のテスト値であっても対象業務dataをbackendへ直接注入せず、製品の可視UIと正規application処理経路で作成してから同じUI経路で操作し、backendは結果確認だけに使う契約を追加した。
- Codex専用local UI testについて、保存済み合成Auth accountを起動ごとに再作成せずimportして使う契約、Emulator→Nuxt→インアプリブラウザの起動順序、一回限定reload、dashboard到達、終了時port確認を運用手順へ記録した。Nuxt dev serverは専用dotenvのexact allowlistと外部作用拒否を検証するwrapper経由へ変更した。Browser visibilityは再試験時に有効化できず、background UI成功と利用者目視未達を分離して記録した。
- Firebase CLIをWindowsユーザーのglobal npm領域でlatest運用し、Codex専用Emulator・seed・export scriptから`npx --offline` cache依存を除去した。CLI更新で回帰した場合は直前の確認済みversionへ戻す運用を追加した。
- Codex専用generated UI serverを、専用build commandが記録したdemo project、外部作用拒否、専用dotenv SHA-256、clean source HEADのidentityと現在状態が一致する場合だけ起動するfail-closed方式へ変更した。実buildは引き続き実行ごとの明示承認を必要とする。
- Codex専用UI candidateを、backend verifier合格時のdirectory SHA-256とclean source HEADへ結び付け、専用Emulator・server portがすべて停止し、acceptance receiptが現在状態と一致する場合だけsaved-dataへ昇格できるようにした。
- Codex専用UI backend verifierへ会社名カナの形式・長さ・保存値一致と、claim company ID・Auth UIDの単一Firestore path segment検査およびURL encodeを追加した。
- Codex専用UI backend verifierのtransport契約を、Auth EmulatorへのPOST 1回とFirestore EmulatorへのbodyなしGET 2回へ分離し、それぞれが相手のportへ到達しない単体testを追加した。
- Codexのbrowser UI検証を、可視・有効なcontrolへの実利用者相当のpointer・keyboard操作だけに限定した。`fill`、DOM・event・handler・client APIの直接操作、force・disabled回避を禁止し、read-only観測、非UI setup、backend assertionをUI操作証拠から分離した。旧基準のUI証拠は履歴として保持するが、新基準で再検証する。
- Codex専用local UIの最小経路を実装し、専用Functionsとloopback server、PWA・通知のfail-closed、メール確認済み・company claim付き合成account、Codex管理ブラウザでのdashboard到達、process・runtime cleanupを検証した。Nortonが`IDP.Generic`として検出したPowerShell child helperはrevertし、独立した前景processへ置き換えた。
- Codex専用local testを、専用Emulator、隔離済みFunctions、local server、合成Authentication account・data、Codex管理ブラウザまでCodexが起動・操作・終了し、利用者のChrome起動やsign-inを通常の前提にしない方針へ拡張した。約1000件でEmulatorが停止した利用者経験をlocal riskとして記録し、多数documentは段階投入する。
- ドメイン上の操作可否をclientで事前検証する機能は、UI非依存の純粋policy、これを適用して操作可否・拒否理由・実行処理を提供するapplication composable、結果を表示するcomponentへ責務を分離する共通原則を採用した。client判定はUX補助とし、server最終認可を維持する。
- Userを単独UserとEmployee連携Userへ分類し、会社管理者に依存しない仮登録管理permissionとして`users:write`を採用した。`manager`と`human-resource`へ付与し、単独・Employee連携の作成入口を分離して、本人Employee情報のread境界は別ゲートで扱う方針を確定した。
- 初期会社管理者signup用`checkEmailAvailability`をemailだけのAuth・全User重複事前確認へ変更し、client指定`isAdmin`によるpolicy選択を廃止した。一般User signupは当該Callableを使用せず、事前登録確認とAuth作成時のemail一意性へ責務を分離した。
- 一般Userの未認証事前登録確認をboolean応答だけに縮小し、会社ID・表示名・role・仮User IDの公開を廃止した。複数仮登録は先頭を採用せず拒否し、signup画面も汎用表示へ変更した。
- `auth-v2.js`に残っていた全Callableを`functions/apis`へ分離し、有効化・無効化は共通request処理と2つの公開Callableを1ファイルへ集約した。Authentication削除triggerは`functions/triggers/auth.js`へ移し、公開Function名と既存挙動を維持した。
- signup用`checkEmailAvailability`を`functions/apis`の単体ファイルへ分離し、Cloud Functionsの公開名と既存挙動を維持したままAPI index経由のexportへ整理した。
- 公開Callableの`checkEmailAvailabilityGlobal`、`rebuildAllHistories`、`rebuildSecurityReportIndexes`を`functions/apis`の単体ファイルへ分離し、API indexを公開export一覧へ限定した。再構築で共有する認可処理は内部moduleとして維持し、Cloud Functionsの公開名は変更していない。
- スーパーユーザーの恒久的な全会社Firestore client accessを廃止する方針と、将来は明示的な手続きを経た一時的な他社support accessを提供する未実装構想を記録した。
- application codeの標準実装者を利用者へ変更し、Codexを設計、仕様整理、security・差分review、test計画・許可済み検証、document、local Git管理へ集中させた。Codex developerは明示された補助実装、testerのtest code編集は明示されたtest scopeに限定した。
- 認証・認可・tenant分離の改善を最優先とし、一括置換ではなく、現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを説明できる最小segmentごとに進める運用へ変更した。
- local Emulatorはtest用1社、Devは利用者の会社と協力会社の2社が試用するremote環境として、一般公開の有無にかかわらずtenant境界を必須とする環境条件を記録した。
- `OperationResult.isLocked`を請求確定や全体凍結ではなく管制側編集保護と定義し、`operation-results:write`と`operation-billings:write`の権限境界、理由入力・追加承認・新規履歴collectionを要求しない方針を仕様、ADR、実装調査、マニュアル、ロードマップへ反映した。
- 2026-08-12までの静的source reviewをFUT/CONF、coverage、正式運用準備roadmapへ再照合し、主repoのdeep-reviewed件数を310/531から519/531へ更新してB/Cを0とした。公式進捗は無部分加点規則により10%へ据え置いた。
- 認証・認可、請求・派生同期、共通UI、Admin backup/restoreの問題と要判断事項を、既存canonical groupと新規FUT-0177〜FUT-0183へ整理した。
- AirGuardV2固有の文書・ADR・roadmap・TOML検査を`check-project-docs.ps1`へ改名し、managed validatorと所有・ファイル名を分離した。
- Codexの起動経路を生成`AGENTS.md`、`governance/project-rules.md`、task-routedな`docs/README.md`の順へ変更した。
- 実装・修正・改修を機能単位ブランチで行い、利用者の動作確認と明示承認後にだけマージコミットで `main` へ統合する運用を採用した。
- 関連5リポジトリは事前承認なく読み取り可能とし、各役割と、変更時の影響確認・個別承認境界を明確化した。
- Codex専門タスクは差分と検証を報告し、コーディネーターが受入れたファイルだけをコミット・統合する運用へ明確化した。
- 新しい作業では `docs/README.md` から必要最小限の正本文書を選ぶ読取順序へ更新した。
- 配置管理の作業員タグで OJT 表示を資格者アイコンと作業員名の間へ配置し、表示幅が不足する場合は状態表示を維持したまま作業員名だけを省略表示するよう変更した。
- 配置管理では、配置予定と配置通知が共有する OJT などの業務プロパティについて配置通知を優先し、日別配置人数と現場稼働予定カードの過不足を同じ実効 OJT 状態で判定するよう変更した。
- 配置管理の現行画面責務と作業員タグの表示仕様、および連勤の定義と未決事項を現行仕様へ追記した。
- 配置管理の連勤判定を従業員だけに限定し、表示期間の前後1日を判定用に取得して、連勤関係を構成する双方の配置タグへ警告アイコンと理由ツールチップを表示する仕様を確定した。
- 管制業務マニュアル索引の配置管理リンクを、既存の配置管理説明へ修正した。
- 既存の Codex 作業指示を、承認制の仕様変更フローと文書同期ルールを含む `AGENTS.md` へ統合した。
- `README.md` を Nuxt 初期テンプレートから AirGuardV2 の案内へ更新した。
- 作業指示ごとに文書と実装を照合し、相違は変更前に確認し、実装から判明した未記載仕様を文書へ反映する運用を追加した。
- 影響範囲の大きい隣接リポジトリを、明示的な対象指定と影響確認なしに変更しない規則を追加した。
- 修正済みの `deploy:dev` を開発環境向けデプロイ手順へ反映した。
- CodexのインアプリブラウザからAuth Emulatorへ接続できない現在の制約と、認証済み画面の検証に必要な条件を運用文書へ追加した。
- Chrome拡張による検証では、拡張機能を有効にしたプロファイルでChromeを事前起動する必要があることを明記した。
- Chrome拡張による操作でもAuth Emulatorへの接続が遮断され、サインイン操作を自動化できない現在の制約を運用文書へ反映した。
- Codexの認証後UIテストについて、ユーザーがEmulator、ローカルサーバー、Chrome、サインイン済み画面を準備し、Codexが既存タブを引き継ぐ運用を採用した。
- 既存のリサーチャー・コーダー・テスター体制を、役割と書込み権限を分離した基本5エージェントと任意2エージェントへ具体化した。

### Fixed

- 一般User signupの確定buttonが通常のform submitでpage reloadを起こし、account作成を中断する問題を修正した。Employee連携仮登録User作成では、`users:provision`だけを持つactorにgeneric role fieldが残る問題も修正し、human-resource正規UIでemailだけの作成・削除を再受入れした。
- 初期会社管理者のCompany/User作成をメール確認後へ移し、同じbrowserでは確認待ちから再開できるようにした。管理者表示名は値を切り捨てず、6文字超過をfield errorとして表示して作成を抑止する。
- 一般Userのメール確認後画面で認証Callable composableの明示importがなく、クリーンなclientで本登録を開始できない問題を修正した。
- メール確認済みでも会社claim未設定の一般Userをglobal middlewareがdashboardへ早期転送し、本登録Callableを実行できない問題を修正した。
- 管制業務マニュアルの上下番確定処理リンクが存在しない文書を参照していた問題を修正した。
- 上下番確認画面で確定処理中のダイアログが表示されず、処理対象の現場稼働予定を再選択できる問題を修正した。

### Removed

### Security

- 会社所属済みの認証必須Callable向けに、ID tokenと現在のAuthentication UserのUID・email・email確認・company claim・`isSuperUser`・有効状態をAPI固有処理より先に照合する共通identity gateと安全なerror mappingを追加した。`disableUser`、`enableUser`、`changeAdminUser`、`checkEmailAvailabilityGlobal`、再構築2 APIへ適用し、重複した実行者Auth検査を除去した。匿名事前確認と所属確立前bootstrapは専用境界を維持する。
- Authentication Userと会社Userの整合性検査で`isSuperUser`を必須boolean claimとして扱い、欠損・型不正を拒否するようにした。管理SDKの権限解除はclaimを削除せず`false`を保存し、Emulator・Devの全所属アカウントをdry-run、apply、再dry-runの順で検証した。
- 初期会社管理者作成を、メール確認済みで有効な未所属Authに限定した。ID tokenと現在AuthのUID・email・claimを照合し、別の既存User/Company所属を拒否する。claims設定失敗後は同じUIDの整合した初期管理者状態だけを再利用し、Company重複作成を防ぐ。
- 管理者signupの匿名email事前確認で、callerが`isAdmin`を偽装して弱い一般User分岐を選べないようにした。事前確認は認可ではなく、作成との競合、Auth-only部分状態、email列挙、App Check・rate limitは残存riskとして継続する。
- 全会社Userのメールアドレス重複確認Callableを、確認済みメール、正常な会社claim、現在の有効なAuthentication User、同社の有効な本登録会社管理者がすべて整合する場合だけ許可した。`isSuperUser`だけでは許可せず、拒否経路と全会社重複検出を専用loopback Emulatorで検証した。
- スーパーユーザー向けの履歴・警備日報インデックス再構築Callableを、ID token、現在のAuthentication User、同社の有効な本登録User、要求会社がすべて整合する場合だけ許可した。Auth無効・User無効・他社指定を含む拒否経路と両再構築の正常経路を専用loopback Emulatorで検証した。
- StorageのSecurityReportsを、確認済みメール、正常な会社claim、同一tenant path、対応する有効な本登録Userがすべて整合する場合だけ許可するよう変更した。専用loopback Emulatorでupload、list、metadata、download URL、byte download、deleteと不正identity・他tenant拒否を検証した。
- FirestoreのCompanies配下を、確認済みメール、正常な会社claim、同一tenant path、対応する有効な本登録Userがすべて整合する場合だけ許可するよう変更した。恒久的なsuper-user全会社bypassを廃止し、SecurityReportIndexesとStripeDataの個別操作制約を汎用ルールで迂回できないようにした。専用loopback Emulator 32件で検証した。
- 一般User本登録について、確認済みAuthenticationメールに完全一致する一意の仮登録だけを選択し、会社ID・仮User IDをクライアント入力として信頼しないpolicy、use-case、安全なCallable error mappingを既存Callableへ接続した。clientはAuthentication account作成と確認メール送信で一度停止し、メール確認後に更新したID tokenで本登録してからsessionを初期化する。
- Auth accountが有効でも、確認済みメール、正常な会社claim、tenant path、対応する有効な本登録Userの整合が確認できなければFirestore、Storage、Callableを拒否する方針を確定した。この認可整合性は次の最優先改修であり、実装・Rules test完了まで一般User本登録client接続はdeploy不可とする。
- 仮登録UserのFirestore削除では、対応するglobal Authentication Userを削除しないようUser削除triggerを変更した。本登録済み状態を明示的に確認できる場合だけAuth削除へ進む。
- 会社管理者移譲Callableを、認証済みactor自身が同社の唯一の有効な本登録管理者である場合だけ実行できるtransactionへ変更した。移譲元・移譲先のUser/Auth UID・company・登録・管理者・disabled状態を検証し、管理者0人・複数人、別人による移譲、内部識別子を含むerror応答を拒否する。
- User有効化・無効化Callableを、認証済みactorの会社内transactionへ変更した。有効な本登録会社管理者だけが同社別の本登録非管理者Userを操作でき、自己操作、会社・UID・Auth claim不一致、仮登録、管理者targetを更新前に拒否する。
- User更新triggerのAuth同期を独立モジュールへ分離し、Auth更新前にFirestore path・User document・Auth UID・Auth company claimの整合性を検証するよう変更した。会社不一致、claim欠損、UID不一致、登録状態不正ではAuthを更新しない。
- invitation本人確認前のaccount setup、global Auth target、管理Callable、同一tenant Rules、SecurityReport Storage、`admin_users`、FcmToken、Admin operator境界の静的調査結果をsecurity backlogへ反映した。
- 秘密情報、個人情報、本番データ、外部操作に関する文書化・承認境界を明文化した。
