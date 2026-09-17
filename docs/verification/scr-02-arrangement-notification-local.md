# SCR-02 配置通知 Local検証記録

- 実施日: 2026-09-15
- 対象: `codex/standard-crud-alignment`、HEAD `d4ae71d2f2ae5f4fcc7b35328266d7fca3d3a373`時点のSCR-02差分
- 対象環境: 利用者LocalのChrome、`http://localhost:3000/arrangements-manager`
- package: `@shisyamo4131/air-guard-v2-schemas@3.0.0-dev.3`をroot/Functionsへ導入。source tag、release evidence、registry、manifest/lockのversion・resolved・integrityを照合し、PostAdoptionは成功。Functionsのnotify生成には`actualIsStartNextDay`の実勤務値引継ぎ補正を反映した。

## 検証結果

### TESTERによる会社管理者Local UI確認

- LEAVED通知の取消操作が成功した。
- 必須field validationが機能した。
- 一時値として開始23:00、終了08:00、翌日開始ON、休憩2.0を保存し、listener反映とreload後の保持を確認した。
- baselineの開始08:00、終了17:00、翌日開始OFF、休憩1.0へ復元し、reload後も保持されることを確認した。statusはLEAVEDのまま変化しなかった。

### ユーザー本人によるLocal確認

- 本人向け通知のARRANGED→CONFIRMED→ARRIVED→LEAVEDは一方向で、仕様どおりに遷移した。
- D11後のLEAVED再表示では汎用の「確定」は表示されず、「閉じる」のみが表示され、errorは発生しなかった。
- 「閉じる」は`closeEditor`から`manager.value?.quitEditing()`を呼ぶだけで、state transitionやwriteを行わない。

### 自動検証

| 対象 | command | 結果 | exit |
|---|---|---:|---:|
| SCR-02対象manager | `node --test --test-name-pattern="arrangement notification managers" test/domain/operation-editor.test.mjs` | 1/1 | 0 |
| operation-editor | `node --test test/domain/operation-editor.test.mjs` | 38/38 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1433/1433 | 0 |
| 差分検査 | `git diff --check` | 成功（改行warningのみ） | 0 |

### T19 Local Emulator全件

- command: `npm run test:local`
- filterなしのLocal Emulator full suiteで180/180 pass、fail/cancelled/skipped/todoは各0、suite durationは72378.3216ms、exitは0だった。
- Firebase CLI 15.30.1、project `demo-air-guard-v2-codex`、127.0.0.1 loopback、合成data、`AIR_GUARD_EXTERNAL_EFFECTS=deny`で実行した。
- runnerは`functions_started=true`、`loopback_only=true`、`user_saved_data_unchanged=true`、`dedicated_saved_data_read_only=true`を報告した。cleanupは成功し、専用portのLISTEN残存はなく、利用者用saved-dataと専用isolated saved-dataのfingerprintは前後一致した。T19によるworktree変更はなく、post diff-checkもexit 0だった。
- expected negative Rulesの`PERMISSION_DENIED`／error classification logは出力されたが、test failureはなかった。

### T21 最終Local確認

- TESTERの`operation-editor`は38/38、domain全件は1433/1433、`npm run test:local`は180/180で成功した。fail/cancelled/skipped/todoは各0、Local suite durationは73450.7618ms、各exitは0だった。
- Codex専用demo、127.0.0.1 loopback、合成data、`AIR_GUARD_EXTERNAL_EFFECTS=deny`で実行し、cleanupは完了した。8 port listenersは0件で、利用者用saved-dataと専用saved-dataのfingerprintは前後一致した。
- project docsと`git diff --check`もexit 0だった。D14Bのコードはユーザーが承認済みである。

### DEV read-only確認

- コーディネータが`air-guard-v2-dev`の`(default)`、`STANDARD/FIRESTORE_NATIVE`をread-onlyで確認した。配置通知2579件を必要最小fieldだけで取得し、document ID、会社、氏名、時刻、生data、credentialは記録していない。remote writeは0件だった。
- 予定が翌日開始の配置通知は1件で、その通知はstatus LEAVED、実績側は当日開始だった。関連予定は翌日開始、勤務実績は通知の実績日（予定より1日前）と一致し、既存勤務実績も存在した。
- この1件は配置通知と実績が整合しており、今回の導入で新たにずれた未処理dataではないため、SCR-02のmigration/repairは不要と判断した。これはread-only確認であり、Dev反映・Dev受入れ・FCM配信の証拠ではない。

### 2026-09-16 最終Dev候補と反映

- 最終候補はcommit `f3b1e01891f6a14605d17b2e7fb5c67daabec15a`。domain-fullは1434/1434、Local Emulatorは180/180、Local UI build、`generate:dev`、project docs、diff-checkがそれぞれexit 0だった。
- Codex専用Local UIではVueの`Extraneous non-props attributes (class)`警告がなく、左右paneが利用可能高まで表示され、再取得・旧再読込buttonがないことを確認した。未確定dataが0件だったため、実data状態の左右独立scroll、固定された確定操作、既存通知行の鉛筆は未確認とした。
- GitHub Actions run `35066835154`はHosting・Functions・Firestore Rulesを選択し、Dev生成、鍵なし認証、dry-run、実deployをすべて成功した。Dev HostingはHTTP 200、`Cache-Control: no-cache, no-store, must-revalidate`を返し、local/remote `main`は上記commitで一致した。data migration・repair・削除は行っていない。
- （2026-09-16時点の記録）上下番確定を実行できる対象dataが2026-09-17まで発生しないため、会社管理者によるDev受入れは`Pending`とした。翌日の利用者受入れ報告により、このPendingは解消した。

### 2026-09-17 利用者Dev受入れ（完了）

- 利用者から「Local受入れ検証、コード検証: 完了」と「上下番確定処理画面の確認事項: 確認OK（Dev受入れOK）」の確定報告を受領した。
- これにより、上下番確定処理画面の左右独立scroll、固定された確定操作、既存通知行の鉛筆、上下番確定と再表示に関するSCR-02のDev受入れを完了とする。
- SCR-02はLocal検証・コード検証・Dev反映・利用者Dev受入れを満たした。Prod、FCM実配信、Notificationsの実配信、backend日付算術、dashboard本人表示は未検証のまま維持する。

以前の直接対象testも成功済みである。`operation-datetime` 1/1、`operation-write` 30/30、`operation-submission` 18/18、`role-presets-parity` 4/4、最終`operation-editor` 38/38を確認した。

## 省略したgateと未検証範囲

- Local Emulator full suiteはT19・T21に加え、最終Dev候補でも180/180、exit 0を確認した。
- `local-ui-build`は初回Local工程では省略したが、最終Dev候補では実行してexit 0を確認した。
- DevへのHosting・Functions・Firestore Rules反映と、対象data発生後の会社管理者による上下番確定受入れは完了した。Prod、FCM delivery、Notificationsの実配信、backendでの日付算術、別actorによる本人遷移は未検証である。Dev dataのmigration・repairは実施していない。
- dashboard本人向け表示は会社管理者accountでは表示されず、TESTERによる独立確認はない。上記の本人確認と混同しない。
- 最終候補のbuild、`generate:dev`、Dev deployは実施済み。data migrationとdata repairは実施していない。

## 外部作用、rollback、次の承認境界

Local検証はlocalhost上の画面・自動testに限定した。後続のDev releaseはHosting・Functions・Firestore Rulesを反映したが、remote dataのmigration・repair・削除、FCM実配信、Prod操作は行っていない。rollbackは反映前commit `65529ef1dc6e51550c2dd4184be783be5c5b71cb`を基準とするrevert releaseであり、data rollbackは不要である。

Local検証、Dev反映、利用者によるDev受入れが完了したため、SCR-02をCompletedとして扱う。migration・repairは不要であり、Prod、FCM実配信、backend日付算術、dashboard本人表示は後続の未検証範囲として残す。
