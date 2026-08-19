# 0014 Codex専用localテストデータとloopback隔離

- 日付: 2026-08-12
- 更新日: 2026-08-19
- 状態: Accepted
- 関連仕様: 開発ガバナンスとCodex作業手順
- 関連判断: [0005](0005-multi-agent-and-emulator-testing.md)、[0006](0006-user-prepared-authenticated-browser-testing.md)、[0011](0011-roadmap-and-codex-session-lifecycle.md)

## 背景

利用者が画面確認に使う`./saved-data`をCodexの自動テストと共有すると、テストによる上書き、データ前提の衝突、意図しない破損が利用者のlocal環境へ波及する。毎回すべてのAuthアカウントとFirestoreドキュメントを組み立てる方式は再現性と起動時間にも不利である。一方、Codexのセッション、SQLite、WAL、一時ログを含む保存領域の肥大化は過去に不整合を起こしたため、専用テストデータにも容量境界が必要である。

## 決定

- 利用者用`./saved-data`はCodex自動テストの読込元にも出力先にもせず、実行前後の指紋が変化していないことを検証する。
- Codex専用の合成データを`.codex-test/saved-data`へ保存する。実在の会社、利用者、メールアドレス、資格情報、業務データは複製しない。
- 合成fixture定義と生成・実行スクリプトはGit管理し、Emulator exportと一時runtimeは`.gitignore`で除外する。専用exportを破棄しても同じ定義から再生成できる。
- 初回生成は`npm run test:local:seed`に限定し、既存exportがある場合は上書きせず失敗する。通常の`npm run test:local`は`--import`だけを使用し、`--export-on-exit`を指定しない。
- Firebase CLIはWindowsユーザーのglobal npm領域に1つ導入し、正式運用開始まではlatestを使用する。Codex専用Emulator scriptはglobal `firebase` commandを使用し、`npx --offline` cacheを実行前提にしない。CLI更新で回帰した場合は直前に確認済みのversionへ戻す。
- 専用Firebase設定は`demo-air-guard-v2-codex`、`127.0.0.1`、通常local環境と異なるポートへ固定する。初期段階ではFunctions Emulatorを起動せず、FCM、Stripe、ジオコーディング等の外部作用経路を含めない。
- 2026-08-17以降の拡張目標として、Codexが専用Emulator、Functions、local server、合成Authentication accountと業務fixture、Codex管理ブラウザを一連で起動・操作・停止し、利用者によるChrome起動やsign-inを通常の前提にしない。
- Codex管理ブラウザの挙動・受入れ証拠は、可視・有効なcontrolへ実利用者が行える通常のpointer・keyboard操作だけで取得する。`fill`、DOM・storage・Auth persistenceの直接変更、event・handler・component method・client APIの直接呼出し、force操作、disabled・hidden・overlay回避は禁止する。read-only観測と非UI setup・backend assertionは許可するがUI操作証拠から分離する。
- Functions追加前に外部API、Stripe、mail、FCM、通知、ジオコーディング等をstub、明示拒否、または到達不能設定でfail-closedにする。隔離を証明できないFunctionを専用UI testから呼ばない。
- 専用accountの資格情報は実在の資格情報を流用せず、local demo projectだけで有効な合成値または実行時生成値を使う。秘密情報、session、実在emailをrepository、log、prompt、成果物へ保存しない。
- 数百件のdocumentは段階的に生成し、件数、応答時間、memory、Emulator logを監視する。約1000件で停止した利用者経験をlocal riskとして記録し、同規模の一括生成は停止条件と復旧方法を定めた別承認なしに行わない。公式Firebase上限とは断定しない。
- `.codex-test`は50 MiBで警告、100 MiBで実行停止とする。実行ごとの一時runtimeは終了時に専用領域配下であることを確認して削除する。
- Codex所有のSQLite、WAL、セッション記録はテスト基盤から変更、削除、`VACUUM`しない。タスク容量はADR 0011の手順で別に監視する。
- 専用saved-dataの削除・再生成は自動実行せず、容量異常またはfixture変更時に別の承認済み作業として行う。

## 理由

利用者のlocal環境とCodexの自動テストを物理的・論理的に分離しつつ、小さな合成snapshotを繰り返し利用することで、データ準備時間と結果の揺れを減らせる。初期suiteはdemo project、loopback、Functions非起動、指紋確認によって外部到達を除外する。UI拡張後も同じ分離を維持し、Codexが準備から終了まで所有することで利用者のChrome sessionや手動準備への依存をなくす。

## 代替案

- 利用者用`./saved-data`を共用する案: 利用者のlocal確認環境を壊す可能性があるため採用しない。
- 毎回空のEmulatorへ全fixtureを生成する案: export破損時の再生成手段としては保持するが、通常実行の起動時間と再現性で不利なため標準にしない。
- Emulator exportをGit管理する案: バイナリ差分、Firebase CLI互換性、容量、誤ったデータ混入の監査が難しいため採用しない。
- Codex領域へsnapshotやログを保存する案: セッション・SQLite等との容量干渉を避けるため採用しない。

## 影響

- 利用者: 既存`firebase.json`、`.env.local`、`./saved-data`、通常のlocal起動手順は変更されない。
- 実装: 専用Firebase設定、合成fixture、seed、Node標準テスト、容量・指紋ガードを追加する。browser automationは実利用者相当の入力経路に限定し、実行不能な操作をDOM・event直接操作で補完しない。
- 開発環境: Firebase CLIはprojectごとに複製せずglobal導入する。新規PCではglobal CLIの導入・認証を別々に確認し、npm/npx cacheをCLIの存在証明にしない。
- データ: `.codex-test/saved-data`はローカル生成物であり、Git、Dev環境、実データへ反映しない。
- 外部作用: 現行の初期テストではFunctionsを起動しない。承認済みUI拡張では、FCM、Stripe、mail、通知、ジオコーディング、郵便番号検索等を個別にfail-closedで隔離できたFunctionだけを起動する。
- 容量: 合成exportは100 MiB未満を必須とし、通常は20 MiB以下を目標とする。

## 移行

Rules・Callable等の隔離test用直接生成fixtureは`.codex-test/isolated-saved-data`で管理し、正規UI登録の受入れ証拠には使用しない。UI基準snapshotは正規signup、Authentication Emulator OOB確認、同じbrowser contextでの`createAdminAccount`、token refresh、dashboard到達を完了したbackend状態からcandidate exportし、fresh import後のbackend assertionと実利用者相当sign-in・dashboard再到達に合格してから`.codex-test/saved-data`へ昇格する。OOB確認とbackend assertionはUI操作証拠には数えない。2026-08-17までの旧基準のbrowser証拠は履歴として保持するが、新しいpointer・keyboard操作基準では未検証である。実端末FCMとremote APIは含めない。Nuxt buildを使う再検証はプロジェクト規則に従い実行ごとの明示承認を必要とする。

## 再検討条件

専用領域が50 MiBを超えた場合、100 MiBへ到達した場合、CodexのSQLite/WALまたはタスク容量が異常増加した場合、Firebase Emulator export形式が互換性を失った場合、Functions・ブラウザUI modeの隔離に失敗した場合、または数百件の段階投入で停止・著しい遅延が再現した場合に再検討する。
