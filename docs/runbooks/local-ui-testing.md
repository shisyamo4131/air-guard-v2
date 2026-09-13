# Codex専用local UI検証runbook

- 状態: 運用中
- 最終確認日: 2026-09-12（文書整理。runtimeの実行証拠は検証索引を参照）
- 役割: Codex専用UI環境の共通手順と個別手順の索引

## UI検証と最終受入れの責任分離

担当は[Coordination and Git rules](../project-rules/coordination-and-git.md)、環境選択・承認・最終受入れは[Environment and approval rules](../project-rules/environment-and-approval.md#local-emulatorとlocal-ui)を正とする。本runbookは実行手順を定め、利用者環境Local、Dev、Prod、remote/data、外部操作の権限を追加しない。application fileごとの利用者確認はcheckpointが明示した場合だけ行い、通常はsegment単位に結果をまとめる。

## 適用範囲

- Codexが専用demo project、専用port、`.codex-test/saved-data`、generated server、Codex管理browserの起動からcleanupまで所有するLocal UI検証を扱う。
- 自動検証後に専用build・合成data・Emulator・UI操作・保存再表示・外部作用denyの結合に不確実性が残る場合だけ選ぶ。自動検証で必要事項を覆う場合は実行しない。
- 利用者が`.env.local`、`./saved-data`、Chrome profile、起動processを管理する検証は[利用者環境Local](user-local-ui-testing.md)、Dev固有の証明と製品変更の最終受入れは[Dev deploy](dev-deployment.md)へ進む。本手順の成功はDev前の手戻り抑制用証拠とする。

## Codexだけで完結するlocal UI test

[事前確認](#ui-ready-preflight) → [build制約](#専用buildとgenerated-serverの制約)・[認証準備](#合成認証とsnapshot) → [起動](#emulatorとgenerated-serverの起動) → [UI操作](#ui操作と受入れ証拠) → [終了確認](#codex専用local-ui-testの完成条件)の順に進める。

### UI-READY preflight

[検証規則](../project-rules/documentation-and-verification.md#verification)の4点を照合し、有効な既存証拠を再利用する。UI固有の不足がある場合だけ、buildまたはprocess起動前に次を確認する。一つでも満たせなければ起動せず、担当・環境・隔離方法を見直す。

1. 実担当taskが正規in-app browserのtab取得と通常pointer・keyboard操作を利用できる。
2. [合成認証](#合成認証とsnapshot)により対象actorを準備でき、`.codex-test/saved-data`にexport metadataとAuth fixtureがある。
3. 完了条件に必要なCallable・背景trigger・保存先・初期dataの登録とloopback接続を実行構成で確認する。Functionsから外部API、Stripe、mail、FCM、通知、ジオコーディング等へ到達しないことを陰性testまたは明示拒否設定で確認する。client-side endpointとfile参照packageも隔離し、専用UIではPWA module、Service Worker登録、通知permission、FCM token登録を無効化する。[郵便番号隔離](#専用uiの郵便番号隔離)も確認する。これは全ブラウザ通信を遮断する汎用firewallではなく、未取得のnetwork trace等は未確認として残す。不足時は環境整備または確認方法の合意を先行する。
4. 既存runtime・port・processとownerを照合し、新規起動portの未使用、生成物を含むcleanup対象のexact path、削除・停止の承認と保護対象を固定する。既存承認が対象を含む場合は再承認を求めない。rootのEmulator debug logは一時診断情報として上書きを許容し、退避・復元しない。
5. 対象HEAD、build、Emulator、server、browser、backend assertion、cleanupの担当と停止条件を同じcheckpointに固定する。対象は`demo-air-guard-v2-codex`と通常localとは異なるloopback portだけとする。

起動済み構成は[環境規則の再利用条件](../project-rules/environment-and-approval.md#local-emulatorとlocal-ui)に加え、identityと必要なFunctions・Rules・Firestoreの一致を確認できれば対応する準備・起動を省略する。条件不一致または確認不能な構成だけを分離して準備し、今回所有していないprocessは変更・停止しない。

### 専用buildとgenerated serverの制約

`npm run test:local:ui:server`を使うCodex専用Nuxt開発サーバーは、郵便番号隔離の追加対応により起動を停止する。遮断を確認していない診断経路へ迂回せず、上記generated serverを使う。通常のDev環境・利用者用localの起動方法は変更しない。従来は途中確認・診断に利用できたが、専用診断経路の復旧には同等の通信隔離と陰性testの確認が必要である。古いmarkerや生成物は流用しない。

承認済みの専用buildは`npm run test:local:ui:build`だけを使用する。このcommandはbuild前後にroot worktreeがcleanで同じHEADであること、専用dotenvがallowlist済みのdemo project・loopback・Emulator設定だけであることを確認し、成功した`.output`へ設定SHA-256とsource HEADを含むidentity markerを作成する。`npm run test:local:ui:server:generated`はmarkerの欠損・破損、現在のdotenvまたはHEADとの差、dirty worktreeのいずれでもgenerated serverをimportせず停止する。markerを手動作成・更新してはならない。実buildとgenerated serverの受入れ確認は引き続き実行ごとの明示承認を必要とする。

### 合成認証とsnapshot

`.codex-test/saved-data/auth_export/accounts.json`には実在情報を含まない検証済み合成Auth accountを保存する。利用するfixtureの現在値と受入れ証拠は[検証証拠索引](../verification/README.md)から確認する。通常起動は`--import .codex-test/saved-data`だけを使う。browser sessionを喪失した場合は、対象が専用loopback Auth Emulatorの保存済み合成accountであることを確認し、running Emulator内だけへrandom alphanumeric passwordを一時設定してよい。saved-dataを更新せず、停止後に同じcredentialを再利用可能と扱わない。永続管理が必要になった場合はrepository外の保護済みlocal credential storeと復旧手順を別途確定するまで平文保存しない。Rules・Callable test用の`CODEX_LOCAL_USERS`とは分離し、いずれもlocal demo project以外へ使用しない。起動ごとにaccountを作成せず、既存snapshotを読取り利用する。snapshot破損時だけ、candidate生成・backend assertion・promotion手順で置換し、通常のUI testから`--export-on-exit`で上書きしない。

Codex専用demo Emulator、loopback限定、外部作用deny、実在情報を含まない合成accountという承認済み境界内では、保存sessionの再利用または合成credentialの通常keyboard入力によるsign-inのたびに利用者へ再承認を求めない。credentialは画面へ入力する直前まで表示せず、repository、応答、command出力、検証logへ残さない。接続先が利用者用local環境、Dev、Prod、remote serviceまたは実dataへ変わる場合はこの継続承認を適用しない。

`npm run test:local:seed`が生成する`.codex-test/isolated-saved-data`はRules・Callable test用であり、UI用`.codex-test/saved-data`を生成・更新しない。UI snapshotの更新はcandidate受入れ・promotion手順だけで行う。

インアプリブラウザで`type=password`への通常typingが利用できない場合は、専用loopback demo accountの一時credentialに限って、製品の可視なpassword表示切替controlを通常pointerで操作し、可視fieldへ一文字ずつkeyboard入力した直後に再maskする。平文表示中はscreenshot、DOM snapshot、console、networkその他のread-only観測も行わない。入力値をtool outputへ含めず、終了時にEmulatorを停止してcredentialを失効させ、実行前後のsaved-data file数・SHA-256指紋が一致することを確認する。実account、利用者用local、Dev、Prod、remote serviceではこのfallbackを禁止し、通常のsecure credential入力を利用できなければ未検証として停止する。

### Emulatorとgenerated serverの起動

WindowsのFirebase CLIとlocal serverは、最初からsandbox外の承認済み前景processとして起動する。sandbox内ではNuxtのdependency解決がfilesystem read制限で停止するため、失敗する予備起動を試さない。`Start-Process`、detach、background helperは禁止する。これは専用demo・loopback・合成data・外部作用deny内の実行方法であり、network等への許可を拡張しない。

1. `UI-READY`とbuild制約を満たし、clean worktreeの同一HEADで`npm run test:local:ui:build`を実行してidentity marker付き`.output`を生成する。
2. `npm run test:local:ui:emulators`を独立した前景processで起動し、`All emulators ready`まで待つ。Auth、Firestore、Realtime Database、Storage、必要なFunctionsを対象とする。
3. `npm run test:local:ui:server:generated`を別の前景processで起動し、identity、server ready、loopback rootのHTTP応答を確認する。marker欠損・不一致、dirty worktree、非200ならbrowserを開かず停止する。
4. Codexインアプリブラウザで`http://127.0.0.1:14600/`を開き、製品landmarkまでbounded waitする。HTTP 200や起動templateだけでは成功とせず、templateが残れば停止する。reloadを通常手順にせず、server identity、HTTP、consoleとFUT-0005・FUT-0008・FUT-0096・FUT-0178を診断する。
5. 有効な保存済み合成sessionを再利用するか、可視UIからsign-inへ進んで合成credentialを通常keyboard入力し、対象画面を操作する。操作契約と証拠区分は[UI操作と受入れ証拠](#ui操作と受入れ証拠)に従う。

インアプリブラウザは利用者のChrome profileを使用しない。visibility機能が利用可能なら操作開始前に表示を要求して状態を報告し、利用者の監視も同じCodex Desktopのtabで行う。visibilityを機械取得できない場合は、利用者が監視できた事実とtool上の未確認を分ける。Chrome拡張は利用者が既存sessionを使う受入れ、またはインアプリブラウザ障害の補助経路であり、標準手順の前提ではない。

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

### Codex専用local UI testの完成条件

対象画面で[UI操作契約](#ui操作と受入れ証拠)を満たし、非UI setup・backend assertionを区別して証拠を残す。sign-in actorと環境baselineは再生成可能な専用fixtureから準備できること、受入れ対象の仮登録User・業務documentは架空値を可視UIから正規作成したことを確認する。成功・失敗とも次を行い、承認取得だけで終了扱いにしない。

1. Codexが作成したtabを閉じ、今回起動したgenerated server、Emulatorの順に停止する。専用portと今回の派生portに実LISTENがないことを確認し、WindowsのAPI取得結果が欠ける場合は`netstat`でも照合する。
2. 専用saved-dataの実行前後の指紋を比較し、不変を確認する。利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataも変更されていないことを確認する。
3. `.output`と今回所有する一時runtimeだけを、project配下の明示された安全な絶対path・reparse不在確認後に削除する。debug logの扱いはUI-READYに従い、反省会など別目的の一時メモを削除対象へ混ぜない。
4. segment単位の変更挙動、UI smoke、未検証、残存risk、rollback、利用者確認項目、cleanup結果と停止後の状態を報告する。

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
