# local UI検証runbook

- 状態: 運用中
- 最終確認日: 2026-08-27
- 役割: Codex専用UI環境と利用者用local browser受入れの準備・操作・終了

## Codexだけで完結するlocal UI test

2026-08-25にNuxt開発サーバーを使う自己完結経路を再確認した。Codexが専用Emulator、Functions、Nuxt、インアプリブラウザを順に管理し、Nuxt/Viteを十分に予熱してから初回navigationすることで、reloadなしに製品topへ到達するcold restartを3回連続で確認した。続けて保存済み合成Auth accountでsign-inし、`/dashboard`へ到達した。HTTP 200または起動templateだけは成功証拠ではない。正規signupからのbaseline再生成はこの最小経路とは別の受入れである。外部作用は専用Functionsでdenyし、専用UIではPWA module、Service Worker登録、通知permission、FCM token登録を無効化する。

標準の起動・確認・終了順序は次のとおりとする。

Windows上でCodexがこの経路を実行する場合、Firebase CLIだけでなくNuxt開発サーバーも、最初からworkspace sandbox外の承認済み前景processとして起動する。sandbox内ではNuxtのdependency解決がfilesystem read制限で停止することが既知であるため、成功しない予備起動を試してから再起動する手順にしない。これは既存のCodex専用demo project、loopback、合成data、外部作用denyの承認境界に限ったprocess実行方法であり、network、利用者用local環境、Dev、Prod、remote service、実dataへの許可拡張ではない。

1. 専用portが未使用で、`.codex-test/saved-data`にexport metadataとAuth fixtureがあることを確認する。
2. `npm run test:local:ui:emulators`を独立した前景processで起動し、`All emulators ready`まで待つ。
3. `npm run test:local:ui:server`を別の前景processで起動する。このwrapperは専用dotenvのexact allowlist、demo project、loopback emulator設定を値を出力せず検証し、`AIR_GUARD_EXTERNAL_EFFECTS=deny`を固定してからNuxtを同じ前景processで起動する。`Vite client warmed up`とNitro readyを待ち、loopback rootと初回読込みで発見したVite/Nuxt entry・plugin moduleをbounded probeする。同じmodule集合を2巡し、全requestがHTTP 200で完了してからbrowserを開く。requestがpending、timeout、非200ならnavigationへ進まず停止する。
4. Codexインアプリブラウザで`http://127.0.0.1:14600/`を初めて開く。visibility機能が利用可能な場合は操作開始前に表示を要求し、その状態を報告する。利用者が監視する場合もChrome profileではなく同じCodex Desktop内のtabを使う。
5. 製品landmarkが現れるまでbounded waitし、起動templateを成功証拠にしない。予熱後も起動templateが残る場合はreloadを通常手順にせず失敗として停止し、Nuxt/Vite readiness、module request、console、FUT-0005・FUT-0008・FUT-0096・FUT-0178の既知再発要因を診断する。
6. 可視UIからsign-inへ移動し、保存済み合成accountを通常のkeyboard入力で使用して対象画面へ到達する。
7. Codexが作成したtabを閉じ、Nuxt、Emulatorの順に停止し、専用portがLISTENしていないことを確認する。

インアプリブラウザはCodex Desktop内の専用browserであり、利用者のChrome profileを使用しない。利用者が目視を希望する検証ではvisibilityを要求し、同じtabを監視対象にする。visibility状態を機械的に取得できない場合は、利用者が実際に監視できた事実とtool上の未確認を分けて報告する。Chrome拡張経路は、利用者が既存sessionを使う受入れまたはインアプリブラウザ障害の補助経路であり、標準のCodex専用UI testの前提ではない。

`.codex-test/saved-data/auth_export/accounts.json`には実在情報を含まない検証済み合成Auth accountを保存する。2026-08-20時点のUI snapshotは、正規管理者signup UIから作成した管理者1件だけを含む。通常起動は`--import .codex-test/saved-data`だけを使い、確認済みのCodex管理ブラウザ認証sessionを再利用する。sign-in credentialはtracked repository、応答、検証logへ保存・出力しない。browser sessionを喪失した場合は、対象が専用loopback Auth Emulatorの保存済み合成accountであることを確認し、running Emulator内だけへrandom alphanumeric passwordを一時設定してよい。saved-dataを更新せず、停止後に同じcredentialを再利用可能と扱わない。永続管理が必要になった場合はrepository外の保護済みlocal credential storeと復旧手順を別途確定するまで平文保存しない。Rules・Callable test用の`CODEX_LOCAL_USERS`とは分離し、いずれもlocal demo project以外へ使用しない。起動ごとにaccountを作成せず、既存snapshotを読取り利用する。snapshot破損時だけ、candidate生成・backend assertion・promotion手順で置換し、通常のUI testから`--export-on-exit`で上書きしない。

Codex専用demo Emulator、loopback限定、外部作用deny、実在情報を含まない合成accountという承認済み境界内では、保存sessionの再利用または合成credentialの通常keyboard入力によるsign-inのたびに利用者へ再承認を求めない。credentialは画面へ入力する直前まで表示せず、repository、応答、command出力、検証logへ残さない。接続先が利用者用local環境、Dev、Prod、remote serviceまたは実dataへ変わる場合はこの継続承認を適用しない。

`npm run test:local:seed`が生成する`.codex-test/isolated-saved-data`はRules・Callable test用であり、UI用`.codex-test/saved-data`を生成・更新しない。UI snapshotの更新はcandidate受入れ・promotion手順だけで行う。

インアプリブラウザで`type=password`への通常typingが利用できない場合は、専用loopback demo accountの一時credentialに限って、製品の可視なpassword表示切替controlを通常pointerで操作し、可視fieldへ一文字ずつkeyboard入力した直後に再maskする。平文表示中はscreenshot、DOM snapshot、console、networkその他のread-only観測も行わない。入力値をtool outputへ含めず、終了時にEmulatorを停止してcredentialを失効させ、実行前後のsaved-data file数・SHA-256指紋が一致することを確認する。実account、利用者用local、Dev、Prod、remote serviceではこのfallbackを禁止し、通常のsecure credential入力を利用できなければ未検証として停止する。

ブラウザUIの挙動・受入れ証拠は次の操作契約に従う。

- UI受入れで作成・編集・削除する業務dataは、実在情報を含まないテスト値を使いつつ、製品の可視UIと正規application処理経路から作成する。Firestore、Authentication、client SDK、Emulator API、Admin SDK、seed scriptによる直接注入で対象状態を作らない。
- 非UI fixture、import、backend APIは、sign-in actorや環境baselineの準備、またはUI操作後のread-only assertionに限定する。UIで正規作成できる対象を非UIで作成してUI受入れの代用にしない。
- 作成と削除を検証する場合は、同じtest sessionで可視UIから正規作成したdataを対象に可視UIから削除し、backend assertionで作成結果、削除結果、非対象serviceの不変を確認する。
- 可視・有効で通常のactionability条件を満たすcontrolを、通常のpointer clickまたはkeyboardで操作する。文字入力はfocusした可視controlへ一文字ずつ行い、削除・選択・確定も利用者が行うkeyまたは可視UIで実行する。
- `locator.click()`相当は通常のpointer入力経路とactionabilityを満たす場合だけ許可し、`pressSequentially()`相当はfocusした可視controlへ通常のkey eventを順に送る場合だけ許可する。mechanismを確認できない場合はmouse・keyboard操作へ切り替える。
- Chrome拡張への接続・再接続または利用者tabの再取得直後は、上部のデバッグ開始表示によるviewport変化が完了するまで3秒待つ。座標操作は待機後の最新screenshotまたは可視DOMから対象を取り直して1回だけ行い、接続前・中断前の座標を再利用しない。操作が中断または無反応だった場合は、対象状態とserver到達有無を確認してから再試行し、同じ変更を重複実行しない。
- `fill`、`clear`、DOMの`value`・`checked`・`selected`等の変更、scriptによるwrite、`dispatchEvent`、`element.click`、event handler・component method・`requestSubmit`・client API/SDKの直接呼出し、force-click、disabled・hidden・overlay回避を禁止する。shortcut型の選択・check・file設定を利用者操作の代用にしない。
- 初期URLのopenとreloadは環境準備として許可するが、route発見性や画面内navigationの証拠には数えない。以後の遷移は可視UIから行う。
- tool-nativeのread-only DOM・ARIA、text、属性、disabled状態、URL、screenshot、console、networkは観測に使用できる。read-only script評価は状態を変更しない診断に限定し、credential、password、token、OOB code、入力値を出力しない。
- clean browser contextの準備、Authentication EmulatorのOOB確認、backend verifier、candidate export/importは非UI処理である。結果は`UI user-equivalent action`、`non-UI setup`、`backend assertion`へ分け、UI成功の代用にしない。
- 許可された実利用者相当操作をtoolが実行できない場合は、DOMやeventを直接操作して回避せず未検証と報告する。

Emulatorと開発サーバーは、次の2つの独立した前景processとして起動する。`Start-Process`、detach、background helperは使用しない。

```powershell
npm run test:local:ui:emulators
npm run test:local:ui:server
```

Windows上のCodex管理ブラウザでは、Nuxt開発サーバーがHTTP 200を返しても、Viteの初回module変換中にSPA hydrationが完了しない事象を確認した。2026-08-25にEmulator ready、`Vite client warmed up`、2巡のmodule probeを初回navigationより前へ置くことで、reloadなしの製品top到達を3回連続、sign-inからdashboard到達を1回確認した。初回module集合はsource変更で変わり得るため件数を固定せず、各実行でrootから発見した集合を記録する。専用build serverはdev経路がこのready契約を満たしても失敗する場合の診断用fallbackとする。プロジェクト規則のbuild禁止は維持されるため、Codexがbuild経路を再実行する場合は、その都度明示承認を得る。生成した`.output`は検証後に削除する。

承認済みの専用buildは`npm run test:local:ui:build`だけを使用する。このcommandはbuild前後にroot worktreeがcleanで同じHEADであること、専用dotenvがallowlist済みのdemo project・loopback・Emulator設定だけであることを確認し、成功した`.output`へ設定SHA-256とsource HEADを含むidentity markerを作成する。`npm run test:local:ui:server:generated`はmarkerの欠損・破損、現在のdotenvまたはHEADとの差、dirty worktreeのいずれでもgenerated serverをimportせず停止する。markerを手動作成・更新してはならない。実buildとgenerated serverの受入れ確認は引き続き実行ごとの明示承認を必要とする。

正規signup後のexportは直ちに専用saved-dataへ昇格せず、`.codex-test/ui-candidate`へ置く。candidate importを起動し、backend verifierへ正規signupで使用した合成email、会社名、会社名カナ、表示名を`CODEX_UI_SYNTHETIC_EMAIL`、`CODEX_UI_SYNTHETIC_COMPANY_NAME`、`CODEX_UI_SYNTHETIC_COMPANY_NAME_KANA`、`CODEX_UI_SYNTHETIC_DISPLAY_NAME`として渡して`npm run test:local:ui:candidate:accept`を実行する。この処理はUI証拠ではなくbackend assertionであり、合格時だけcandidate directory SHA-256とclean source HEADを`.codex-test/ui-candidate-acceptance.json`へ記録する。実在情報やpasswordを渡さない。verifierは会社名カナを正規signup入力と完全一致で確認し、会社名カナ形式・40文字境界と、claim company ID・Auth UIDが単一の安全なFirestore path segmentであることを検証してからURL encodeしてGETする。

backend verifierのtransport契約は分離する。Authentication account列挙はAuth Emulator `127.0.0.1:19099`の`accounts:query`へJSON bodyを伴うPOSTを1回だけ行う。CompanyとUserはFirestore Emulator `127.0.0.1:18080`へbodyなしGETを各1回行う。Auth helperからFirestoreへ、Firestore helperからAuthへ到達せず、いずれも外部hostを使用しない。このbackend assertionをbrowser UI操作の証拠として数えない。

promotion前にCodex管理browser、generated server、Emulatorを停止する。`npm run test:local:ui:promote`は専用port `14400`、`14500`、`14600`、`15001`、`18080`、`19000`、`19099`、`19199`のLISTENがなく、acceptance receiptとcandidateの再計算SHA-256・現在のclean source HEADが一致する場合だけ`.codex-test/saved-data`を置換する。candidate変更、source変更、receipt欠損、process残存時は変更前に停止する。receiptと既存saved-dataは置換前にruntimeへ退避し、置換失敗時は復旧する。置換後のbackup削除だけが失敗した場合はpromotionを維持して`cleanup_required`を返し、対象runtime backupを明示する。

`scripts/run-codex-local-ui-child.ps1`を使うprocess管理案はNortonに`IDP.Generic`として検出されたため破棄・revertした。隔離解除、allowlist登録、同方式の復元を行わない。現在の前景commandはこのhelperに依存しない。

完成条件は次のとおりとする。

1. `demo-air-guard-v2-codex`と通常local環境とは異なるloopback portだけを使用する。
2. CodexがAuth、Firestore、Realtime Database、Storage、必要なFunctions、local serverを起動し、Codexが起動したprocessだけを終了する。
3. sign-in actorと環境baselineは再生成可能な専用fixtureから準備できる。UI受入れ対象の仮登録Userや必要な業務documentは、架空のテスト値を使って製品の可視UIと正規application処理経路から作成する。
4. Functionsから外部API、Stripe、mail、FCM、通知、ジオコーディング等へ到達しないことを陰性testまたは明示拒否設定で確認する。
5. Codex管理ブラウザが実利用者相当のpointer・keyboard操作だけでlocal appを開き、合成accountでsign-inし、対象画面を操作できる。非UI setup・backend assertionは別証拠として記録する。
6. 利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataが実行前後で変更されない。
7. 終了時にserverとEmulatorを停止し、一時runtimeをproject配下の明示pathだけから削除する。失敗時も同じcleanupと状態報告を行う。

2026-08-17の旧基準による受入れでは、専用suite 72件、UI設定契約9件、専用build、dashboard表示、dashboard滞在中のconsole error 0件、全専用port閉鎖、`.codex-test/runtime`空、`.output`削除を確認した。ただし`fill`等を含む旧操作証拠は新基準の受入れには再利用しない。サインアウト直後に購読解除前のFirestore snapshot listenerが2件の`permission-denied`を出す既存挙動は残っており、製品側のlogout cleanup課題として扱う。

2026-08-19のレビュー後再試験では、専用dotenv exact allowlistと外部作用拒否のpreflight、保存Auth fixture 2件、saved-data fingerprint、全専用port未使用、Emulator importと全service ready、Nuxt/Vite/Nitro ready、loopback HTTP 200を確認してからインアプリブラウザを開いた。起動template後の一回限定reloadで製品topを確認し、可視button clickと一文字ずつのkeyboard入力だけでsign-inして`/dashboard`へ到達し、dashboard滞在中のconsole errorは0件だった。終了後は全専用port閉鎖とsaved-data fingerprint不変を確認した。visibilityは`false`のままで利用者目視だけは未達である。network host一覧のbrowser証拠は取得しておらず、exact configとdemo projectのEmulator fail-closed出力を非UI証拠とする。

2026-08-20のUWB-03受入れでは、fresh専用Emulator上で初期会社管理者を正規signup UIから作成し、Authentication EmulatorのOOB確認だけを非UI setupとして行った。User一覧から単独仮登録Userを、Employee詳細からEmployee連携仮登録Userをそれぞれ可視UIで作成し、取消、削除中、成功を確認した。別tabで先に削除した対象へ古い確認dialogから再実行する競合では`Item to delete not found.`を表示し、画面を壊さず失敗した。削除後のbackend assertionはAuth 1件と管理者User 1件だけが残り、3件の仮登録Userが不存在であることを確認した。Employee作成時は外部geocoding拒否による既知のconsole errorが1件出たが作成・User連携・User削除は完了した。正規signup後の管理者だけをcandidate受入れ・promotion経路で`.codex-test/saved-data`へ昇格し、通常import、HTTP 200、Auth/User各1件、`/dashboard`復帰、console error 0件、終了時全専用port閉鎖、saved-data fingerprint不変を再確認した。Firebase CLIがWindows上でexport一時directoryのrenameを`EPERM`にしたため、Emulatorが残した最新の完全exportについてworkspace内、metadata、容量上限、candidate未存在を検証してcandidateへ移し、通常のacceptance verifierとpromotion gateを通した。

2026-08-21のUWB-04受入れでは、既存の専用snapshotを読込専用で起動し、Employeeを正規UIで作成した後、Employee詳細から合成emailと既知role `human-resource`を指定してEmployee連携仮登録Userを作成した。作成後のbackend assertionで仮登録User、Employee link、role、email予約、Employee予約が一致し、Authentication accountが存在しないことを確認した。同じEmployee詳細UIから仮登録Userを削除し、User・両予約・Authenticationが不存在でEmployeeだけが残ることを確認した。UI操作は通常のpointer clickと一文字ずつのkeyboard入力だけを使った。Employee作成時のconsole errorは外部geocodingをfail-closedで拒否した既知の`FirebaseError: internal` 1件だけだった。終了後は全専用port閉鎖、runtime空、saved-dataのfile数・容量不変、root worktree cleanを確認した。

同日のpermission分離後再受入れでは、保存済み合成管理者から正規UIで`human-resource`仮登録Userを作成し、一般User signupとAuth EmulatorのOOB確認を経てhuman-resourceとしてdashboardへ到達した。通常submitのpage reload中断と、Employee User dialogでcustom role slotが空でもgeneric `roles` fieldが残る問題を修正した。human-resourceのactor Userが`roles=["human-resource"]`であること、作成dialogの入力がemail 1 fieldだけでrole controlが存在しないことを確認した。正規UIでEmployeeとEmployee連携仮登録Userを作成し、作成後は`roles=[]`、Employee link、email・Employee予約pointer、Authentication不存在をbackend assertionした。同じUIから仮登録Userを削除し、User・両予約・Authentication不存在とEmployee残存を確認した。終了後は全専用port閉鎖、saved-data 7 files・3492 bytes不変を確認した。

### UWB-04 利用者向け最小UI確認一覧

機能branchを利用者が確認するときは、次を最小確認とする。Dev・Prod・実dataではなく、承認済みlocal環境の合成dataを使用する。

- User設定で、会社管理者または`users:write`を持つ既知roleから単独仮登録Userを作成でき、email・表示名が一覧へ表示される。2026-08-21時点のUser一覧には明示的な「仮登録」表示はなく、Employee詳細だけが「仮登録」を表示する。
- Employee詳細で、未紐付けの在職Employeeへemailを指定して仮登録Userを作成でき、email・仮登録状態が表示される。会社管理者と`users:write`を持つmanagerは任意の既知roleを指定できる。`users:provision`だけを持つhuman-resourceにはrole選択を表示せず、serverも非空rolesを`permission-denied`で拒否する。
- 作成dialogの取消ではUserが作成されず、確定の連打中は二重作成されない。
- 作成した単独／Employee連携仮登録Userを同じ画面から削除でき、削除後は未登録表示または一覧からの不存在へ戻る。
- permissionなし、既登録・管理者・無効・他社・既に紐付いたEmployeeなどの拒否対象では作成・削除actionが提供されないか、安全なerrorで終了する。
- Employee作成時の外部住所・geocoding失敗はUser作成結果と分けて確認し、外部作用denyを解除しない。

2026-08-21に利用者が上記最小UI確認を実施し、単独／Employee連携の作成、取消、削除、表示・操作感を受入れた。User一覧に「仮登録」表示がない点を確認したうえでUWB-04の利用者testをOKとした。

### UWB-07 利用者向けlocal UI確認一覧

UWB-07/08の自動検証完了後、利用者用local環境のテストデータで次を確認する。実データ、remote、Dev、Prod、deployは使用しない。

1. `human-resource` Userでは、他の在職Employee詳細に「退職処理」が表示され、自分自身と会社管理者に紐づくEmployeeでは表示されないこと。退職日・20文字以内の理由、取消、未来日拒否を確認する。
2. Employee-only対象を退職すると「現在在職していません」となり、Employeeが残ること。会社管理者で「誤退職を訂正する」を実行すると同じEmployeeが在職へ戻り、退職日・理由が消えること。
3. 本登録User連携Employeeを退職するとEmployeeは残り、User一覧から対象Userが消え、旧accountでsign-inできないこと。誤退職訂正後も旧User/Authは自動復元されず、必要ならEmployee連携Userを別操作で再登録する案内が表示されること。
4. 会社管理者のUser管理で、Employee未連携・非管理者・本登録Userに「アカウント削除」が表示されること。理由・取消・最終確認を確認し、削除後に一覧から消えて旧accountでsign-inできないこと。仮登録、Employee連携、自己、会社管理者には表示されないこと。
5. 退職・User削除・訂正を連打しても対象単位のloading中に再送されず、成功後にdialogが閉じること。失敗時は画面が壊れず再試行できること。
6. `firestore.rules`でUsersのclient create/update/delete、Employee lifecycle field/delete、lifecycle ledger/event/lock/head、FcmTokens updateが拒否される方針を確認すること。

会社管理者専用の履歴一覧readerと利用者による`firestore.rules`確認は完了した。Firestore Rules全体に残る広いtenant内write、App Check、rate limit、認証済み実accountのDev受入れは正式運用準備の残作業であるが、それだけをDev deploy blockerとはしない。Prodまたは正式運用開始可とは扱わない。

`LifecycleOperations`は現段階で固定保存期限を設けず、自動削除しない。削除を前提とするlegal hold、terminal後UID縮小、purge command・scheduled jobは提供しない。data量、法令・社内規程、privacy、費用、運用上の必要性から見直しが必要と判断した場合は、実dataへ作用する前に参照chain、誤退職訂正、移行、backup・復旧を含む新しい仕様とrollbackを承認する。

履歴一覧readerは`/settings/lifecycle-history`から`listLifecycleOperations`だけを呼び、会社管理者へ新しい順に20件ずつ表示する。clientから会社ID、件数、検索、filter、sortを送らず、cursorは画面・URL・永続store・storage・analytics・consoleへ出さない。page移動失敗時は現在pageを維持し、権限喪失、sign-out、page離脱時にitemsとcursor stackをmemoryから破棄する。Emulator受入れでは会社管理者の3操作・3公開状態・前後page、他roleとsuper-userのroute/Callable拒否、raw UID・内部error非表示、ledger/event/lock/headのclient直読拒否を確認する。実装前後を通じてRulesをreaderのために緩和しない。

2026-08-25と26の利用者Chrome受入れでは、ログイン済み会社管理者が可視navigationの管理者menuから「退職・アカウント削除履歴」へ到達し、loading、空状態、無効な前後buttonを確認した。対象環境に履歴dataがない場合、実page移動のためだけに21件の退職・削除を作らない。data行のexact projection、20/21件境界、cursorによる次page・前page再取得は単体・Emulatorで直接検証し、Chromeは実route、認可された到達、読み込み、empty、button状態を受け持つ。この分離をlocal受入れの完了証拠とする。

数百件のdocumentを必要とする場合は小さいbatchから段階的に投入し、件数、応答時間、memory、Emulator logを記録する。約1000件でEmulatorが停止した利用者経験をlocal riskとして扱い、同規模の一括投入は行わない。正確な安全件数は実測前に固定せず、停止兆候があれば追加投入とUI操作を中止する。

Codexまたはテスターがローカル画面を起動する場合は、`.env.local` を使用し、LANへ公開しないようloopbackへ限定します。

```powershell
npx nuxt dev --dotenv .env.local --host 127.0.0.1
```

認証後の画面操作が必要な場合は、Emulator専用アカウントを使用します。利用者用local環境では必要なアカウント作成を利用者へ依頼します。Codex専用環境では、Codexが実在情報を含まない合成accountをfixtureまたは実行時生成で作成します。

## 利用者用local環境を使うブラウザ操作の現在の制約

CodexのインアプリブラウザとChrome拡張による操作のどちらからもNuxtローカルサーバーの画面は取得できますが、現在の環境ではCodexがAuth Emulatorの `127.0.0.1:9099` へ直接接続してサインインを自動化する経路が、ブラウザ操作レイヤーで `ERR_BLOCKED_BY_CLIENT` として遮断されます。

利用者用local環境そのものの受入れが必要な場合は、Codex専用UI testと混在させず、次の準備をユーザーが行った後にCodexがサインイン済みChromeタブを引き継ぐ補助経路を使います。

1. `--import=./saved-data` を付けてFirebase Emulatorを起動する。
2. `.env.local` を使ってローカルサーバーを起動する。
3. Chrome拡張が有効なプロファイルでChromeを起動する。
4. Emulator専用アカウントでサインインし、必要に応じてテスト対象画面まで移動する。
5. 画面の準備が完了したことをCodexへ伝える。

Codexは既存タブを引き継いだ後、SPAローディングテンプレートの表示を即時エラーとみなさず、画面遷移の完了または明確なタイムアウトまで待機します。データ作成・更新・削除を伴う操作は、ユーザーがテスト内容として明示的に許可した範囲だけで行います。テスト終了時はユーザーが起動したEmulator、ローカルサーバー、ChromeをCodex側から停止しません。

危険なChrome起動オプションや利用者の通常profile変更は採用しません。Codex専用UI modeは利用者用環境の制約を回避するために混在させず、専用project、専用port、合成account、Codex管理ブラウザで独立して検証します。

Chrome拡張を使う場合、拡張機能を有効にしたChromeプロファイルでChromeを先に起動しておく必要があります。現在の環境では、Chrome終了後にCodexからChromeを自動起動・再接続することはできません。Chromeを終了した場合は、ユーザーが対象プロファイルでChromeを再起動してから検証を再開します。
