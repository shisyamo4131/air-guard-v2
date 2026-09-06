# local UI検証runbook

- 状態: 運用中
- 最終確認日: 2026-09-04（郵便番号隔離の追加修正・再検証は実行証拠を参照）
- 役割: Codex専用UI環境と利用者用local browser受入れの準備・操作・終了

## UI検証と最終受入れの責任分離

- 担当、承認、環境、受入れ判断は[Environment and approval rules](../project-rules/environment-and-approval.md)と[Coordination and Git rules](../project-rules/coordination-and-git.md)を正とする。本runbookはCodex専用local UIと利用者用local browserの実行手順だけを定め、Dev・Prod・remote/data・外部操作の権限を追加しない。
- application fileごとの利用者確認はcheckpointが明示した場合だけ行い、通常はsegment単位の変更挙動、UI smoke、未検証、残存risk、rollback、利用者確認項目をまとめる。

## Codexだけで完結するlocal UI test

Codex専用local UI受入れは、承認済み専用buildから生成した画面をgenerated serverで配信する経路を標準とする。HTTP 200または起動templateだけは成功証拠ではなく、製品画面へ到達して対象操作を確認する。実行結果は[検証証拠索引](../verification/README.md)から対象receiptを参照する。外部作用は専用Functionsでdenyし、専用UIではPWA module、Service Worker登録、通知permission、FCM token登録を無効化する。Functionsのdenyだけではブラウザの直接通信を制御できないため、下記の専用郵便番号隔離も確認する。これらを未調査の全ブラウザ通信を遮断する汎用firewallとは扱わない。

### UI-READY preflight

buildまたはprocess起動前に、次を一度確認する。どれかを満たせない場合はbuildせず、担当・環境・隔離方法を見直す。

1. 実際にUI操作するtaskが正規in-app browserのtab取得と通常pointer・keyboard操作を利用できる。
2. 保存済み合成sessionまたは秘密値を残さない一時合成credentialにより、対象actorを準備できる。
3. 完了条件に必要なCallable・背景trigger・保存先・初期dataを実行構成と照合し、必要な処理の登録とloopback接続を確認する。Functions側denyに加えclient-side endpoint・file参照packageの外部作用も隔離する。不足は環境整備または確認方法の合意を先行し、未取得のnetwork trace等は未確認として残す。
4. 既存root log・runtime・port・processを確認し、退避・復元対象、owner、生成物を含むcleanup対象をexact pathで固定する。削除・停止の承認範囲と保護対象を開始時に確認し、既存承認が対象を含む場合は再承認を求めない。
5. 対象HEAD、専用build、Emulator、generated server、browser、backend assertion、cleanupの担当と停止条件が一つのcheckpoint内で決まっている。終了時はcleanupの実行結果まで確認し、承認取得だけを完了としない。

標準の起動・確認・終了順序は次のとおりとする。

Windows上でCodexがこの経路を実行する場合、Firebase CLIとlocal serverは、最初からworkspace sandbox外の承認済み前景processとして起動する。sandbox内ではNuxtのdependency解決がfilesystem read制限で停止することが既知であるため、成功しない予備起動を試してから再起動する手順にしない。これは既存のCodex専用demo project、loopback、合成data、外部作用denyの承認境界に限ったprocess実行方法であり、network、利用者用local環境、Dev、Prod、remote service、実dataへの許可拡張ではない。

1. 上記`UI-READY`を完了し、専用portが未使用で、`.codex-test/saved-data`にexport metadataとAuth fixtureがあることを確認する。既存runtime・他者processは変更しない。
2. clean worktreeの同一HEADで`npm run test:local:ui:build`を実行し、identity marker付き`.output`を生成する。このbuildは実行ごとの承認境界を維持する。
3. `npm run test:local:ui:emulators`を独立した前景processで起動し、`All emulators ready`まで待つ。
4. `npm run test:local:ui:server:generated`を別の前景processで起動し、identity確認、server ready、loopback rootのHTTP応答を確認する。marker欠損・不一致、dirty worktree、非200ならbrowserを開かず停止する。
5. Codexインアプリブラウザで`http://127.0.0.1:14600/`を初めて開く。visibility機能が利用可能な場合は操作開始前に表示を要求し、その状態を報告する。利用者が監視する場合もChrome profileではなく同じCodex Desktop内のtabを使う。
6. 製品landmarkが現れるまでbounded waitし、起動templateを成功証拠にしない。残る場合はreloadを通常手順にせず失敗として停止し、server identity、HTTP、console、FUT-0005・FUT-0008・FUT-0096・FUT-0178の既知再発要因を診断する。
7. 可視UIからsign-inへ移動し、保存済み合成accountを通常のkeyboard入力で使用して対象画面へ到達する。保存済みbrowser sessionが有効なら、その合成account sessionを再利用する。
8. Codexが作成したtabを閉じ、generated server、Emulatorの順に停止し、専用portと今回の派生portがLISTENしていないことを確認する。Windowsでは実LISTENと取得結果を照合し、APIで結果が欠ける場合は`netstat`でも確認する。saved-data不変と既存ログの復元を検証し、`.output`と今回所有runtimeだけを安全な絶対path・reparse不在確認後に削除する。反省会など別目的の一時メモは削除対象へ混ぜない。

インアプリブラウザはCodex Desktop内の専用browserであり、利用者のChrome profileを使用しない。利用者が目視を希望する検証ではvisibilityを要求し、同じtabを監視対象にする。visibility状態を機械的に取得できない場合は、利用者が実際に監視できた事実とtool上の未確認を分けて報告する。Chrome拡張経路は、利用者が既存sessionを使う受入れまたはインアプリブラウザ障害の補助経路であり、標準のCodex専用UI testの前提ではない。

`.codex-test/saved-data/auth_export/accounts.json`には実在情報を含まない検証済み合成Auth accountを保存する。利用するfixtureの現在値と受入れ証拠は[検証証拠索引](../verification/README.md)から確認する。通常起動は`--import .codex-test/saved-data`だけを使い、確認済みのCodex管理ブラウザ認証sessionを再利用する。sign-in credentialはtracked repository、応答、検証logへ保存・出力しない。browser sessionを喪失した場合は、対象が専用loopback Auth Emulatorの保存済み合成accountであることを確認し、running Emulator内だけへrandom alphanumeric passwordを一時設定してよい。saved-dataを更新せず、停止後に同じcredentialを再利用可能と扱わない。永続管理が必要になった場合はrepository外の保護済みlocal credential storeと復旧手順を別途確定するまで平文保存しない。Rules・Callable test用の`CODEX_LOCAL_USERS`とは分離し、いずれもlocal demo project以外へ使用しない。起動ごとにaccountを作成せず、既存snapshotを読取り利用する。snapshot破損時だけ、candidate生成・backend assertion・promotion手順で置換し、通常のUI testから`--export-on-exit`で上書きしない。

Codex専用demo Emulator、loopback限定、外部作用deny、実在情報を含まない合成accountという承認済み境界内では、保存sessionの再利用または合成credentialの通常keyboard入力によるsign-inのたびに利用者へ再承認を求めない。credentialは画面へ入力する直前まで表示せず、repository、応答、command出力、検証logへ残さない。接続先が利用者用local環境、Dev、Prod、remote serviceまたは実dataへ変わる場合はこの継続承認を適用しない。

`npm run test:local:seed`が生成する`.codex-test/isolated-saved-data`はRules・Callable test用であり、UI用`.codex-test/saved-data`を生成・更新しない。UI snapshotの更新はcandidate受入れ・promotion手順だけで行う。

インアプリブラウザで`type=password`への通常typingが利用できない場合は、専用loopback demo accountの一時credentialに限って、製品の可視なpassword表示切替controlを通常pointerで操作し、可視fieldへ一文字ずつkeyboard入力した直後に再maskする。平文表示中はscreenshot、DOM snapshot、console、networkその他のread-only観測も行わない。入力値をtool outputへ含めず、終了時にEmulatorを停止してcredentialを失効させ、実行前後のsaved-data file数・SHA-256指紋が一致することを確認する。実account、利用者用local、Dev、Prod、remote serviceではこのfallbackを禁止し、通常のsecure credential入力を利用できなければ未検証として停止する。

ブラウザUIの挙動・受入れ証拠は次の操作契約に従う。

- UI受入れで作成・編集・削除する業務dataは、実在情報を含まないテスト値を使いつつ、製品の可視UIと正規application処理経路から作成する。Firestore、Authentication、client SDK、Emulator API、Admin SDK、seed scriptによる直接注入で対象状態を作らない。
- 非UI fixture、import、backend APIは、sign-in actorや環境baselineの準備、またはUI操作後のread-only assertionに限定する。UIで正規作成できる対象を非UIで作成してUI受入れの代用にしない。
- 作成と削除を検証する場合は、同じtest sessionで可視UIから正規作成したdataを対象に可視UIから削除し、backend assertionで作成結果、削除結果、非対象serviceの不変を確認する。
- 可視・有効で通常のactionability条件を満たすcontrolを、通常のpointer clickまたはkeyboardで操作する。文字入力はfocusした可視controlへ一文字ずつ行い、削除・選択・確定も利用者が行うkeyまたは可視UIで実行する。
- `locator.click()`相当は通常のpointer入力経路とactionabilityを満たす場合だけ許可し、`pressSequentially()`相当はfocusした可視controlへ通常のkey eventを順に送る場合だけ許可する。mechanismを確認できない場合はmouse・keyboard操作へ切り替える。
- coordinatorがChrome拡張へ接続・再接続または利用者tabを再取得した直後は、上部のデバッグ開始表示によるviewport変化が完了するまで3秒待つ。座標操作は待機後の最新screenshotまたは可視DOMから対象を取り直して1回だけ行い、接続前・中断前の座標を再利用しない。操作が中断または無反応だった場合は、対象状態とserver到達有無を確認してから再試行し、同じ変更を重複実行しない。
- `fill`、`clear`、DOMの`value`・`checked`・`selected`等の変更、scriptによるwrite、`dispatchEvent`、`element.click`、event handler・component method・`requestSubmit`・client API/SDKの直接呼出し、force-click、disabled・hidden・overlay回避を禁止する。shortcut型の選択・check・file設定を利用者操作の代用にしない。
- 初期URLのopenとreloadは環境準備として許可するが、route発見性や画面内navigationの証拠には数えない。以後の遷移は可視UIから行う。
- tool-nativeのread-only DOM・ARIA、text、属性、disabled状態、URL、screenshot、console、networkは観測に使用できる。read-only script評価は状態を変更しない診断に限定し、credential、password、token、OOB code、入力値を出力しない。
- clean browser contextの準備、Authentication EmulatorのOOB確認、backend verifier、candidate export/importは非UI処理である。結果は`UI user-equivalent action`、`non-UI setup`、`backend assertion`へ分け、UI成功の代用にしない。
- 許可された実利用者相当操作をtoolが実行できない場合は、DOMやeventを直接操作して回避せず未検証と報告する。

Emulatorとgenerated serverは、build完了後に次の2つの独立した前景processとして起動する。`Start-Process`、detach、background helperは使用しない。

```powershell
npm run test:local:ui:emulators
npm run test:local:ui:server:generated
```

実績から勤怠・従業員別稼働・取引先請求・現場履歴への背景生成を対象にする場合だけ、Emulatorを起動する専用前景processで`AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER=enabled`を設定する。専用entryに登録された`codexOnOperationResultChange`は、既定ではeventを処理せず、明示設定時もdemo project・Functions Emulator・loopback Firestore・外部作用denyを検査する。他triggerや通常entryを公開しない。終了時には設定を破棄する。通常の`npm run test:local`は親processのこの設定を除去して子を起動し、終了時に元の有無・値を復元する。

この背景生成のUI検証では、正規画面で作成した実績から上記4保存先へ到達したことをbackend assertionで確認する。直接use-caseを呼んだtestと区別し、一つの保存先の出現だけでtrigger全体成功とは扱わない。

`npm run test:local:ui:server`を使うCodex専用Nuxt開発サーバーは、郵便番号隔離の追加対応により起動を停止する。遮断を確認していない診断経路へ迂回せず、上記generated serverを使う。通常のDev環境・利用者用localの起動方法は変更しない。従来は途中確認・診断に利用できたが、専用診断経路の復旧には同等の通信隔離と陰性testの確認が必要である。古いmarkerや生成物は流用しない。

承認済みの専用buildは`npm run test:local:ui:build`だけを使用する。このcommandはbuild前後にroot worktreeがcleanで同じHEADであること、専用dotenvがallowlist済みのdemo project・loopback・Emulator設定だけであることを確認し、成功した`.output`へ設定SHA-256とsource HEADを含むidentity markerを作成する。`npm run test:local:ui:server:generated`はmarkerの欠損・破損、現在のdotenvまたはHEADとの差、dirty worktreeのいずれでもgenerated serverをimportせず停止する。markerを手動作成・更新してはならない。実buildとgenerated serverの受入れ確認は引き続き実行ごとの明示承認を必要とする。

### 専用UIの郵便番号隔離

専用UIで郵便番号検索の外部通信を遮断する現在の一般手順である。実装・再検証の適用状態は[検証証拠索引](../verification/README.md)から対象receiptを参照する。

- Schemasの郵便番号field・共通入力component・保存契約を維持し、専用client buildだけで実解決先の郵便番号検索utilityを無通信・`null`返却moduleへ置換する。7桁入力でも外部検索・住所自動補完はせず、郵便番号と住所の手入力は維持する。通常利用・通常Dev・関連package・data形状は変更しない。
- 対象moduleが見つからない、対象置換が実行されない、隔離成功receiptを確認できない場合はbuild identityを成立させない。生成receiptは固定の非秘密metadataだけとし、古いreceipt/markerを使って成功を装わない。
- 専用dotenvの検査だけでなく、build子processとgenerated serverの有効な公開Firebase設定も固定する。継承環境変数が専用allowlistと衝突する場合は起動前に停止し、診断には変数名だけを使い値を出力しない。設定の不一致を無視して通常環境用buildを専用identityへ偽装しない。
- 再検証は7桁入力の外部fetch 0、住所更新event 0、手入力保存・再表示、通常設定非影響の陰性testと、fresh専用buildの通常UI操作を分ける。未調査の外部hostすべてについて通信0を保証するものではない。
- rollbackは限定実装commitを安全に戻し、生成物・receipt・markerを破棄する。元へ戻すと既存のbrowser直接検索が復帰するため、その状態で専用UIを隔離済みとして再開しない。data migrationは不要。

正規signup後のexportは直ちに専用saved-dataへ昇格せず、`.codex-test/ui-candidate`へ置く。candidate importを起動し、backend verifierへ正規signupで使用した合成email、会社名、会社名カナ、表示名を`CODEX_UI_SYNTHETIC_EMAIL`、`CODEX_UI_SYNTHETIC_COMPANY_NAME`、`CODEX_UI_SYNTHETIC_COMPANY_NAME_KANA`、`CODEX_UI_SYNTHETIC_DISPLAY_NAME`として渡して`npm run test:local:ui:candidate:accept`を実行する。この処理はUI証拠ではなくbackend assertionであり、合格時だけcandidate directory SHA-256とclean source HEADを`.codex-test/ui-candidate-acceptance.json`へ記録する。実在情報やpasswordを渡さない。verifierは会社名カナを正規signup入力と完全一致で確認し、会社名カナ形式・40文字境界と、claim company ID・Auth UIDが単一の安全なFirestore path segmentであることを検証してからURL encodeしてGETする。

backend verifierのtransport契約は分離する。Authentication account列挙はAuth Emulator `127.0.0.1:19099`の`accounts:query`へJSON bodyを伴うPOSTを1回だけ行う。CompanyとUserはFirestore Emulator `127.0.0.1:18080`へbodyなしGETを各1回行う。Auth helperからFirestoreへ、Firestore helperからAuthへ到達せず、いずれも外部hostを使用しない。このbackend assertionをbrowser UI操作の証拠として数えない。

promotion前にCodex管理browser、generated server、Emulatorを停止する。`npm run test:local:ui:promote`は専用port `14400`、`14500`、`14600`、`15001`、`18080`、`19000`、`19099`、`19199`のLISTENがなく、acceptance receiptとcandidateの再計算SHA-256・現在のclean source HEADが一致する場合だけ`.codex-test/saved-data`を置換する。candidate変更、source変更、receipt欠損、process残存時は変更前に停止する。receiptと既存saved-dataは置換前にruntimeへ退避し、置換失敗時は復旧する。置換後のbackup削除だけが失敗した場合はpromotionを維持して`cleanup_required`を返し、対象runtime backupを明示する。

`scripts/run-codex-local-ui-child.ps1`は使用せず、上記の独立した前景commandを使う。

完成条件は次のとおりとする。

1. `demo-air-guard-v2-codex`と通常local環境とは異なるloopback portだけを使用する。
2. CodexがAuth、Firestore、Realtime Database、Storage、必要なFunctions、local serverを起動し、Codexが起動したprocessだけを終了する。
3. sign-in actorと環境baselineは再生成可能な専用fixtureから準備できる。UI受入れ対象の仮登録Userや必要な業務documentは、架空のテスト値を使って製品の可視UIと正規application処理経路から作成する。
4. Functionsから外部API、Stripe、mail、FCM、通知、ジオコーディング等へ到達しないことを陰性testまたは明示拒否設定で確認する。
5. Codex管理ブラウザが実利用者相当のpointer・keyboard操作だけでlocal appを開き、合成accountでsign-inし、対象画面を操作できる。非UI setup・backend assertionは別証拠として記録する。
6. 利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataが実行前後で変更されない。
7. 終了時にserverとEmulatorを停止し、一時runtimeをproject配下の明示pathだけから削除する。失敗時も同じcleanupと状態報告を行う。

## 過去の受入れ証拠

日付固有の実行結果と機能固有の受入れ条件は本runbookへ蓄積しない。Customerの実行結果は[検証証拠索引](../verification/README.md)、User・Employee lifecycleの履歴と現在の残作業は[実装記録](../implementation/user-write-boundary.md)を参照する。過去の操作方式は現在のUI受入れ基準へ自動再利用しない。

Codexまたはテスターがローカル画面を起動する場合は、`.env.local` を使用し、LANへ公開しないようloopbackへ限定します。

```powershell
npx nuxt dev --dotenv .env.local --host 127.0.0.1
```

認証後の画面操作が必要な場合は、Emulator専用アカウントを使用します。利用者用local環境では必要なアカウント作成を利用者へ依頼します。Codex専用環境では、Codexが実在情報を含まない合成accountをfixtureまたは実行時生成で作成します。

## 利用者用local環境を使うブラウザ操作の現在の制約

CodexのインアプリブラウザとChrome拡張による操作のどちらからもNuxtローカルサーバーの画面は取得できますが、現在の環境ではCodexがAuth Emulatorの `127.0.0.1:9099` へ直接接続してサインインを自動化する経路が、ブラウザ操作レイヤーで `ERR_BLOCKED_BY_CLIENT` として遮断されます。

利用者用local環境そのものの受入れが必要な場合は、Codex専用UI testと混在させず、次の準備をユーザーが行った後にcoordinatorがサインイン済みChromeタブを直接引き継ぐ補助経路を使います。この操作を`ui_tester`その他のsubagentへ委譲しません。

1. `--import=./saved-data` を付けてFirebase Emulatorを起動する。
2. `.env.local` を使ってローカルサーバーを起動する。
3. Chrome拡張が有効なプロファイルでChromeを起動する。
4. Emulator専用アカウントでサインインし、必要に応じてテスト対象画面まで移動する。
5. 画面の準備が完了したことをCodexへ伝える。

coordinatorは既存タブを引き継いだ後、SPAローディングテンプレートの表示を即時エラーとみなさず、画面遷移の完了または明確なタイムアウトまで待機します。データ作成・更新・削除を伴う操作は、ユーザーがテスト内容として明示的に許可した範囲だけで行います。テスト終了時はユーザーが起動したEmulator、ローカルサーバー、ChromeをCodex側から停止しません。

危険なChrome起動オプションや利用者の通常profile変更は採用しません。Codex専用UI modeは利用者用環境の制約を回避するために混在させず、専用project、専用port、合成account、Codex管理ブラウザで独立して検証します。

Chrome拡張を使う場合、拡張機能を有効にしたChromeプロファイルでChromeを先に起動しておく必要があります。現在の環境では、Chrome終了後にcoordinatorからChromeを自動起動・再接続することはできません。Chromeを終了した場合は、ユーザーが対象プロファイルでChromeを再起動してからcoordinatorが検証を再開します。
