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

以前の直接対象testも成功済みである。`operation-datetime` 1/1、`operation-write` 30/30、`operation-submission` 18/18、`role-presets-parity` 4/4、最終`operation-editor` 38/38を確認した。

## 省略したgateと未検証範囲

- Local Emulator full suiteはT19で成功済みであり、今回の省略gateではない。Dev候補での再実行要否は、後続の製品差分とrelease判断に従う。
- `local-ui-build`は未実行。利用者環境でLocal UIを確認済みであり、verification policyのomittable gateとして省略した。
- Dev/Prodへの反映・受入れ、FCM delivery、Notificationsの実配信、backendでの日付算術、別actorによる本人遷移、Dev受入れは未検証である。Dev dataはread-onlyで確認したが、write・migration・repairは実施していない。
- dashboard本人向け表示は会社管理者accountでは表示されず、TESTERによる独立確認はない。上記の本人確認と混同しない。
- build、generate、deploy、data migration、data repairは実施していない。

## 外部作用、rollback、次の承認境界

今回のLocal検証はlocalhost上の画面・自動testに限定し、Dev/Prod、remote data、FCM、既存dataへの外部作用はない。失敗時はSCR-02のcode/test差分をレビュー済みの変更前状態へ戻す。既存dataのrollbackやmigration rollbackは不要である。

Local検証は完了したが、SCR-02はDev受入れ前のため得点0を維持し、状態は`In Progress（Local完了・Dev待ち）`とする。次の承認境界は、利用者review後の選定completion gate確認とDev反映・会社管理者受入れであり、別承認なしに実行しない。
