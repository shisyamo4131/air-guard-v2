# Codex専用local UI検証runbook

- 状態: 運用中
- 最終確認日: 2026-09-04（郵便番号隔離の追加修正・再検証は実行証拠を参照）
- 役割: Codex専用UI環境の共通手順と個別手順の索引

## UI検証と最終受入れの責任分離

- 担当、承認、環境、受入れ判断は[Environment and approval rules](../project-rules/environment-and-approval.md)と[Coordination and Git rules](../project-rules/coordination-and-git.md)を正とする。本runbookはCodex専用Localだけを対象とし、利用者環境Local、Dev、Prod、remote/data、外部操作の権限を追加しない。
- application fileごとの利用者確認はcheckpointが明示した場合だけ行い、通常はsegment単位の変更挙動、UI smoke、未検証、残存risk、rollback、利用者確認項目をまとめる。

## 適用範囲

- 対象: Codexが専用demo project、専用port、`.codex-test/saved-data`、generated server、Codex管理browserを使用して起動からcleanupまで所有する局所的・限定的なLocal UI検証。
- 対象外: 利用者が`.env.local`、`./saved-data`、Chrome profile、起動processを管理するLocal検証。この経路は[利用者環境local UI検証runbook](user-local-ui-testing.md)を使用する。
- Dev環境での試用・検証はLocal検証へ含めず、[Dev deploy runbook](dev-deployment.md)のremote検証として扱う。
- 本runbookは、自動検証後にも専用build、合成data、Emulator、UI操作、保存・再表示、外部作用denyの結合に不確実性が残る場合に選ぶ。自動検証が必要事項を直接覆う場合、または必要な証明がDev固有である場合は実行しない。
- 本runbookの成功はDev前の手戻り抑制用証拠であり、製品変更の最終受入れまたは完了ではない。製品変更の最終受入れは固定commitを[Dev環境](dev-deployment.md)へ反映して行う。

## Codexだけで完結するlocal UI test

Codex専用local UI検証は、承認済み専用buildから生成した画面をgenerated serverで配信する経路を標準とする。HTTP 200または起動templateだけは成功証拠ではなく、製品画面へ到達して対象操作を確認する。実行結果は[検証証拠索引](../verification/README.md)から対象receiptを参照する。外部作用は専用Functionsでdenyし、専用UIではPWA module、Service Worker登録、通知permission、FCM token登録を無効化する。Functionsのdenyだけではブラウザの直接通信を制御できないため、下記の専用郵便番号隔離も確認する。これらを未調査の全ブラウザ通信を遮断する汎用firewallとは扱わない。

### UI-READY preflight

最初に[Documentation and verification rules](../project-rules/documentation-and-verification.md#verification)の4点を照合し、既存の自動test、Emulator、build、browser受入れ等で今回の証明事項が同一または厳しい条件のままカバーされている場合は、手段が異なることだけを理由にUI検証を追加しない。UI固有の不足がある場合だけ、buildまたはprocess起動前に次を一度確認する。どれかを満たせない場合はbuildせず、担当・環境・隔離方法を見直す。

1. 実際にUI操作するtaskが正規in-app browserのtab取得と通常pointer・keyboard操作を利用できる。
2. 保存済み合成sessionまたは秘密値を残さない一時合成credentialにより、対象actorを準備できる。
3. 完了条件に必要なCallable・背景trigger・保存先・初期dataを実行構成と照合し、必要な処理の登録とloopback接続を確認する。Functions側denyに加えclient-side endpoint・file参照packageの外部作用も隔離する。不足は環境整備または確認方法の合意を先行し、未取得のnetwork trace等は未確認として残す。
4. 既存runtime・port・processを確認し、ownerと生成物を含むcleanup対象をexact pathで固定する。Firebase Emulatorがrootへ出力するdebug logは一時診断情報として上書きを許容し、退避・復元しない。削除・停止の承認範囲と保護対象を開始時に確認し、既存承認が対象を含む場合は再承認を求めない。
5. 対象HEAD、専用build、Emulator、generated server、browser、backend assertion、cleanupの担当と停止条件が一つのcheckpoint内で決まっている。終了時はcleanupの実行結果まで確認し、承認取得だけを完了としない。

新規準備が必要な構成の標準起動・確認・終了順序は次のとおりとする。対象HEAD、identity、設定、actor、tenant、Functions・Rules・Firestore、隔離、data、owner・cleanup境界を確認できる起動済みEmulator、generated server、ChromeまたはCodex管理browserは対応する起動手順を省略して再利用し、同一条件を作り直さない。今回所有していない既存processは停止せず、条件不一致または確認不能な構成だけを分離して準備する。

Windows上でCodexがこの経路を実行する場合、Firebase CLIとlocal serverは、最初からworkspace sandbox外の承認済み前景processとして起動する。sandbox内ではNuxtのdependency解決がfilesystem read制限で停止することが既知であるため、成功しない予備起動を試してから再起動する手順にしない。これは既存のCodex専用demo project、loopback、合成data、外部作用denyの承認境界に限ったprocess実行方法であり、network、利用者用local環境、Dev、Prod、remote service、実dataへの許可拡張ではない。

1. 上記`UI-READY`を完了し、新規起動する専用portが未使用で、`.codex-test/saved-data`にexport metadataとAuth fixtureがあることを確認する。再利用する既存processはownerと条件一致を確認し、既存runtime・他者processは変更しない。
2. clean worktreeの同一HEADで`npm run test:local:ui:build`を実行し、identity marker付き`.output`を生成する。このbuildは実行ごとの承認境界を維持する。
3. `npm run test:local:ui:emulators`を独立した前景processで起動し、`All emulators ready`まで待つ。
4. `npm run test:local:ui:server:generated`を別の前景processで起動し、identity確認、server ready、loopback rootのHTTP応答を確認する。marker欠損・不一致、dirty worktree、非200ならbrowserを開かず停止する。
5. Codexインアプリブラウザで`http://127.0.0.1:14600/`を初めて開く。visibility機能が利用可能な場合は操作開始前に表示を要求し、その状態を報告する。利用者が監視する場合もChrome profileではなく同じCodex Desktop内のtabを使う。
6. 製品landmarkが現れるまでbounded waitし、起動templateを成功証拠にしない。残る場合はreloadを通常手順にせず失敗として停止し、server identity、HTTP、console、FUT-0005・FUT-0008・FUT-0096・FUT-0178の既知再発要因を診断する。
7. 可視UIからsign-inへ移動し、保存済み合成accountを通常のkeyboard入力で使用して対象画面へ到達する。保存済みbrowser sessionが有効なら、その合成account sessionを再利用する。
8. Codexが作成したtabを閉じ、generated server、Emulatorの順に停止し、専用portと今回の派生portがLISTENしていないことを確認する。Windowsでは実LISTENと取得結果を照合し、APIで結果が欠ける場合は`netstat`でも確認する。saved-data不変を検証し、`.output`と今回所有runtimeだけを安全な絶対path・reparse不在確認後に削除する。Firebase Emulatorのroot debug logは復元しない。反省会など別目的の一時メモは削除対象へ混ぜない。

インアプリブラウザはCodex Desktop内の専用browserであり、利用者のChrome profileを使用しない。利用者が目視を希望する検証ではvisibilityを要求し、同じtabを監視対象にする。visibility状態を機械的に取得できない場合は、利用者が実際に監視できた事実とtool上の未確認を分けて報告する。Chrome拡張経路は、利用者が既存sessionを使う受入れまたはインアプリブラウザ障害の補助経路であり、標準のCodex専用UI testの前提ではない。

`.codex-test/saved-data/auth_export/accounts.json`には実在情報を含まない検証済み合成Auth accountを保存する。利用するfixtureの現在値と受入れ証拠は[検証証拠索引](../verification/README.md)から確認する。通常起動は`--import .codex-test/saved-data`だけを使い、確認済みのCodex管理ブラウザ認証sessionを再利用する。sign-in credentialはtracked repository、応答、検証logへ保存・出力しない。browser sessionを喪失した場合は、対象が専用loopback Auth Emulatorの保存済み合成accountであることを確認し、running Emulator内だけへrandom alphanumeric passwordを一時設定してよい。saved-dataを更新せず、停止後に同じcredentialを再利用可能と扱わない。永続管理が必要になった場合はrepository外の保護済みlocal credential storeと復旧手順を別途確定するまで平文保存しない。Rules・Callable test用の`CODEX_LOCAL_USERS`とは分離し、いずれもlocal demo project以外へ使用しない。起動ごとにaccountを作成せず、既存snapshotを読取り利用する。snapshot破損時だけ、candidate生成・backend assertion・promotion手順で置換し、通常のUI testから`--export-on-exit`で上書きしない。

Codex専用demo Emulator、loopback限定、外部作用deny、実在情報を含まない合成accountという承認済み境界内では、保存sessionの再利用または合成credentialの通常keyboard入力によるsign-inのたびに利用者へ再承認を求めない。credentialは画面へ入力する直前まで表示せず、repository、応答、command出力、検証logへ残さない。接続先が利用者用local環境、Dev、Prod、remote serviceまたは実dataへ変わる場合はこの継続承認を適用しない。

`npm run test:local:seed`が生成する`.codex-test/isolated-saved-data`はRules・Callable test用であり、UI用`.codex-test/saved-data`を生成・更新しない。UI snapshotの更新はcandidate受入れ・promotion手順だけで行う。

インアプリブラウザで`type=password`への通常typingが利用できない場合は、専用loopback demo accountの一時credentialに限って、製品の可視なpassword表示切替controlを通常pointerで操作し、可視fieldへ一文字ずつkeyboard入力した直後に再maskする。平文表示中はscreenshot、DOM snapshot、console、networkその他のread-only観測も行わない。入力値をtool outputへ含めず、終了時にEmulatorを停止してcredentialを失効させ、実行前後のsaved-data file数・SHA-256指紋が一致することを確認する。実account、利用者用local、Dev、Prod、remote serviceではこのfallbackを禁止し、通常のsecure credential入力を利用できなければ未検証として停止する。

### UI操作と受入れ証拠

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

### Emulatorとgenerated serverの起動

Emulatorとgenerated serverは、build完了後に次の2つの独立した前景processとして起動する。`Start-Process`、detach、background helperは使用しない。

```powershell
npm run test:local:ui:emulators
npm run test:local:ui:server:generated
```

### 専用buildとgenerated serverの制約

`npm run test:local:ui:server`を使うCodex専用Nuxt開発サーバーは、郵便番号隔離の追加対応により起動を停止する。遮断を確認していない診断経路へ迂回せず、上記generated serverを使う。通常のDev環境・利用者用localの起動方法は変更しない。従来は途中確認・診断に利用できたが、専用診断経路の復旧には同等の通信隔離と陰性testの確認が必要である。古いmarkerや生成物は流用しない。

承認済みの専用buildは`npm run test:local:ui:build`だけを使用する。このcommandはbuild前後にroot worktreeがcleanで同じHEADであること、専用dotenvがallowlist済みのdemo project・loopback・Emulator設定だけであることを確認し、成功した`.output`へ設定SHA-256とsource HEADを含むidentity markerを作成する。`npm run test:local:ui:server:generated`はmarkerの欠損・破損、現在のdotenvまたはHEADとの差、dirty worktreeのいずれでもgenerated serverをimportせず停止する。markerを手動作成・更新してはならない。実buildとgenerated serverの受入れ確認は引き続き実行ごとの明示承認を必要とする。

### Codex専用local UI testの完成条件

完成条件は次のとおりとする。

1. `demo-air-guard-v2-codex`と通常local環境とは異なるloopback portだけを使用する。
2. CodexがAuth、Firestore、Realtime Database、Storage、必要なFunctions、local serverを起動し、Codexが起動したprocessだけを終了する。
3. sign-in actorと環境baselineは再生成可能な専用fixtureから準備できる。UI受入れ対象の仮登録Userや必要な業務documentは、架空のテスト値を使って製品の可視UIと正規application処理経路から作成する。
4. Functionsから外部API、Stripe、mail、FCM、通知、ジオコーディング等へ到達しないことを陰性testまたは明示拒否設定で確認する。
5. Codex管理ブラウザが実利用者相当のpointer・keyboard操作だけでlocal appを開き、合成accountでsign-inし、対象画面を操作できる。非UI setup・backend assertionは別証拠として記録する。
6. 利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataが実行前後で変更されない。
7. 終了時にserverとEmulatorを停止し、一時runtimeをproject配下の明示pathだけから削除する。失敗時も同じcleanupと状態報告を行う。

## 実行証拠の保存先

日付固有の実行結果と機能固有の受入れ条件は本runbookへ蓄積しない。Customerの実行結果は[検証証拠索引](../verification/README.md)、User・Employee lifecycleの履歴と現在の残作業は[実装記録](../implementation/user-write-boundary.md)を参照する。過去の操作方式は現在のUI受入れ基準へ自動再利用しない。

## 個別手順索引

共通の`UI-READY`、専用build、Emulator、generated server、ブラウザ操作、cleanup、完成条件は本runbookを正とする。対象機能に応じて、次の個別手順を追加で適用する。

| 個別手順 | 適用する場合 |
| --- | --- |
| [実績の背景生成](local-ui-testing/operation-result-background-generation.md) | 実績から4保存先への背景生成をUI経由で検証する場合 |
| [Employee archive](local-ui-testing/employee-archive.md) | Employee archiveを専用demo環境で検証する場合 |
| [専用UIの郵便番号隔離](local-ui-testing/postal-code-isolation.md) | 郵便番号検索の外部通信遮断と手入力保存を検証する場合 |
| [UI snapshot candidateの受入れとpromotion](local-ui-testing/snapshot-candidate-promotion.md) | signup後のcandidateを検証し、専用saved-dataへ昇格する場合 |

### 専用UIの郵便番号隔離

詳細は[専用UIの郵便番号隔離](local-ui-testing/postal-code-isolation.md)を参照する。この見出しは既存の文書リンクを維持するために残す。
