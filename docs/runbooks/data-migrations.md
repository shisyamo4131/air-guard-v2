# data migration runbook

- 状態: 運用中
- 最終確認日: 2026-08-28
- 役割: 確認済みmigrationのtarget、dry-run、apply、post-check、rollback

maintenanceを伴うmigrationでは、個別手順に加えて[maintenance・data change runbook](maintenance-and-data-change.md)を必読とする。maintenanceを排他lockとみなさず、対象Functionのbounded quiet period、log、連続dry-run digest、整合snapshot、post-checkを組み合わせる。

## Company legacy Stripe scaffold removal（codex-local / user-local Emulator rehearsal）

[ADR 0038](../decisions/0038-legacy-stripe-scaffold-removal.md)に従い、`scripts/migrate-company-legacy-stripe.mjs`は既存Company rootの`stripeCustomerId`・`subscription`と直下`StripeData`だけを対象にする。STRIPE-03の経路は`demo-air-guard-v2-codex`、`(default)` database、`127.0.0.1:18080`の組合せだけを許可する。STRIPE-04は利用者用Emulatorの`air-guard-v2-dev`、`(default)` database、`127.0.0.1:8080`だけを許可する。Dev、Prod、remote targetは提供しない。手作業、Firebase Console、汎用scriptで代替してはならない。

既定は値非出力のdry-runで、短い対象名、件数、分類、匿名化subject hash、64文字のplan digestだけを表示する。project、database、接続先、Company ID、path、field値、Stripe形式の値、秘密情報は標準出力・errorへ出さない。対象の完全なidentityは内部のplan digestに含め、`codex-local`と`user-local`の計画を取り違えられないようにする。dry-runで変更予定がある場合は終了code 2、blockerは3、target拒否は78である。

```powershell
# 専用Emulator process内の環境を使用する。まず値を出さない計画を確認する。
node scripts/migrate-company-legacy-stripe.mjs --target codex-local

# dry-runと同じ状態から、無視対象の.codex-test配下へ新規backupを作る。
node scripts/migrate-company-legacy-stripe.mjs --target codex-local --create-backup --plan-digest <64文字のdigest> --backup-path .codex-test/runtime/stripe03-backup.json

# backup作成結果のreceiptと同じfileだけを使い、同じ計画へ一括適用する。
node scripts/migrate-company-legacy-stripe.mjs --target codex-local --apply --plan-digest <64文字のdigest> --backup-path .codex-test/runtime/stripe03-backup.json --backup-receipt <64文字のreceipt>

# apply後にcleanを確認する。
node scripts/migrate-company-legacy-stripe.mjs --target codex-local

# STRIPE-03の合成data復旧演習。運用中dataのrestore承認には使用しない。
node scripts/migrate-company-legacy-stripe.mjs --target codex-local --restore --backup-path .codex-test/runtime/stripe03-backup.json --backup-receipt <64文字のreceipt>
```

利用者用Emulatorでは、3つの環境変数が不足または不一致ならAdmin SDK初期化前に拒否する。`./saved-data`は起動時のimportに限り、migration後の自動export、上書き、昇格を行わない。次の変更commandは、会社管理者を含むwriterを止めたquiet window中にだけ使う。

```powershell
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIRESTORE_DATABASE_ID = "(default)"
node scripts/migrate-company-legacy-stripe.mjs --target user-local

# coordinatorはここで停止する。利用者から同じ停止状態に対するbackup完了の明示連絡を受けた後だけ実行する。
node scripts/migrate-company-legacy-stripe.mjs --target user-local --apply --plan-digest <直前dry-runの64文字digest> --confirm-project air-guard-v2-dev --confirm-quiet-window --confirm-user-backup --confirm-user-local-apply --expected-company-total 1 --expected-company-field-documents 1 --expected-stripe-data-documents 0
```

- `--confirm-user-backup`は人為確認であり、backupまたは復元可能性の証明ではない。coordinatorはapply直前に停止し、同じquiet / stopped stateでexact preimageを取得済みであること、対象Companyの対象fieldだけをcurrent-state conflict check後に復元できる手順・担当・保存先・保持期限が確認・記録済みであることを利用者と確認する。どれか一つでも満たせなければapplyせず、復元実行は別の明示承認を必須とする。このtoolはbackupを作成、読取、検証、削除、復元できず、backup方法、path、値を推測しない。
- user-localはdry-runとapplyだけを提供し、`--create-backup`、`--restore`、backup ID、receiptを受け付けない。`codex-local`の合成data用schema v1 backup/create/apply/restoreには変更を加えない。
- user-local apply前にcleanな40文字HEADとmigration script identityをAdmin初期化前に確認する。1秒間隔の2回inventory一致はwriter停止を補う保守的heuristicであり排他lockではない。nested、unknown shape、件数1/1/0またはdigestの変化はwrite 0で停止する。transaction内でも再確認し、post-check失敗時に自動restoreしない。

- migrationはCompany rootを作成・削除・全体置換しない。更新は旧2 fieldの削除だけ、document削除は既知形状の直下`StripeData`だけである。Companyの他fieldと他subcollectionは変更しない。
- 旧`subscription`は`null`または既知4 fieldの完全形だけ、`StripeData`は撤去前実装が生成し得たrequest・success・failureの3完全形だけを許可する。未知・部分形、親Company不在、親documentが存在しない入れ子を含む全nested dataは変更前にblockする。
- apply前にexact target、Rules sourceの補助検査、root/FunctionsのSchemas version・取得元・integrity一致、直前digest一致、状態再検査、400 writeのtool上限を確認する。codex-localはtoolのschema v1 backupも確認する。user-localはtool外の利用者backup完了確認flagを必須にする。全変更は一つのtransactionへ登録し、1件でも失敗すれば全件を変更しない。
- backupは`.codex-test`配下の新規fileだけを許可し、既存fileを上書きしない。receiptはfile変更の検出値であり、作成者や真正性の証明ではない。読込時にpath、親子関係、重複、値形状、件数、対象内容digestを再検証する。合成dataだけを扱い、実data用の保管・暗号化・保持契約には使用しない。
- post-checkはlegacy field 0、`StripeData` 0、Company件数不変、Company非対象field不変、再dry-run cleanを必須とする。codex-localの復旧はschema v1のexact preimageだけを一括で戻し、現在状態と衝突する場合はwrite 0で停止する。user-localの復元機能は提供しない。
- Rules source検査は補助であり、実際の拒否保証は専用Emulatorの全actor・全階層deny testを正本とする。missing-parent列挙はtransaction readではない。user-local applyでは会社管理者を含むwriterを止め、bounded quiet period、連続inventory、transaction再確認、post-checkを組み合わせる。Dev、Prod、remote dataへは拡張しない。
- STRIPE-03では合成dataでdry-run、backup、missing-parent時write 0、一括apply、post-check、再実行clean、復旧を確認した。利用者用saved-data、Dev・Prod、外部Stripe、実dataは変更していない。STRIPE-04のlocal migration・画面受入れは別checkpointとする。

## 旧CCB Company設定migration（Historical / unavailable）

ADR 0031で旧8-target設計を廃止し、2026-08-30に`scripts/migrate-company-settings.mjs`、SettingAudits restore planner、専用domain/Emulator testとpackage scriptsをcorrective rollbackした。これらのcommandは現在存在せず、8 target、`PrivateSettings`、`SettingAudits`のlocalまたはremote migration/restore経路を提供しない。旧設計の詳細と当時の検証証拠は[ADR 0028](../decisions/0028-ccb-parity-backup-audit-restore.md)と[historical roadmap](../roadmaps/company-settings.md)に履歴として残す。

新CCBのdata migrationは、まずCompany whole-document replacementをoperation別exact field updateへ置換した後に設計する。Devで確認済みのCompany root 4件へ作用する場合も、対象commit、匿名化target manifest、backup、dry-run、write allowlist、停止条件、post-check、rollback、利用者受入れを固定した別のbounded承認を必要とする。旧plannerや公開Schemas `.167`のmappingが存在することを実行承認・互換保証の代わりにしてはならない。

## UWB-04 User予約migration

`scripts/migrate-user-reservations.mjs`はFirestoreのUserを監査し、全Userのemail予約とEmployee予約を再構築する。既定はdry-runで、対象ごとにproject、Emulator routing、資格情報をAdmin SDK初期化前に検査する。`codex-local`は専用demo projectと`127.0.0.1:18080`だけを許可する。`user-local`は利用者用`air-guard-v2-dev` Emulatorと`127.0.0.1:8080`だけを許可し、Devと同じcreate-only制約で動作する。`dev`はEmulator routingを拒否し、明示されたDev service account資格情報のproject・identityを検査する。Prod targetは提供しない。

```powershell
# 専用Emulatorをcandidate importで起動した別process内の環境を使用する
node scripts/migrate-user-reservations.mjs --target codex-local

# dry-runが出力したplanDigestと同じ状態にだけ適用する
node scripts/migrate-user-reservations.mjs --target codex-local --apply --plan-digest <64文字のdigest>

# apply後に再度dry-runし、cleanを確認する
node scripts/migrate-user-reservations.mjs --target codex-local
```

利用者用EmulatorでDev適用前のcreate-only経路を確認する。

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
node scripts/migrate-user-reservations.mjs --target user-local
node scripts/migrate-user-reservations.mjs --target user-local --apply --plan-digest <64文字のdigest>
node scripts/migrate-user-reservations.mjs --target user-local
```

Dev実環境はmaintenance開始と必要なbackup確認後に、次の3 commandを個別processとして実行する。`<DEV_SERVICE_ACCOUNT_JSON>`の値と秘密鍵本文をlog・応答・repositoryへ出さない。

```powershell
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
$env:GOOGLE_APPLICATION_CREDENTIALS = "<DEV_SERVICE_ACCOUNT_JSON>"
node --use-system-ca scripts/migrate-user-reservations.mjs --target dev

node --use-system-ca scripts/migrate-user-reservations.mjs --target dev --apply --plan-digest <64文字のdigest> --confirm-project air-guard-v2-dev --confirm-backup

node --use-system-ca scripts/migrate-user-reservations.mjs --target dev
```

- dry-runで変更予定がある場合の終了codeは2、data blockerは3である。applyはblocking findingが1件でもあればwrite 0で停止する。
- canonical email重複、同社Employee重複、不正User状態、dangling Employee、予約のmissing・malformed・mismatch・orphanを監査する。
- `codex-local` applyが変更できるのは、missing予約のcreateと、旧pointer先Userが不存在で競合再検査に合格したstale pointerのupdateだけである。`user-local`と`dev`はmissing予約のcreateだけを許可し、updateを含むplanはwrite 0でblockする。すべてのtargetで予約delete、User、Employee、Authenticationのwriteは行わない。
- reportは分類別件数、計画digest、opaque subject hashだけを出力し、email、氏名、company ID、User ID、path、document bodyを出力しない。
- `.codex-test/saved-data`を直接上書きしない。candidate importへdry-run・apply・再dry-runを行い、backend verifierと既存candidate acceptance/promotion gateを通した後だけsnapshotを置換する。Codex専用candidateでの操作は個別承認を要しない。利用者用`saved-data`は事前backupとexport candidate検証なしに上書きしない。
- Dev applyはmaintenance、必要なbackup、直前dry-run、利用者の実data migration承認、project名とbackup確認flagを必須とする。dry-run後にUser・Employee・予約が変化するとdigestまたはtransaction再検査で停止する。途中失敗で一部create済みの場合は予約を推測削除せず、再dry-runして残りのcreateだけを再計画する。
- Dev rollbackは自動deleteやUser/Auth変更を行わない。公開前の追加予約は既存runtimeに参照されないが、削除が必要な場合は事前・事後証拠から本migrationが新規作成したexact reservationだけを特定し、別のrepair・実data操作承認で扱う。Prod migrationは未提供である。

UWB-03までに確認したsuiteは、専用seed、Authサインイン、Firestore・Storage Rules、旧公開Callableを含む72件である。UWB-04では`functions/apis/index.js`の公開Callableを12件へ更新し、旧global availability testを退役させた。2026-08-21にemail/Employee予約fixture、予約Rules、仮登録作成・削除、本登録変換、初期管理者作成、cross-tenant emailとEmployeeのconcurrencyを含む専用Emulator suite 74件を確認した。2026-08-25には会社管理者専用`listLifecycleOperations`、20/21件cursor paging、同時刻document ID tie-break、exact projection、actor拒否、cursor failure統一、LifecycleOperations client read denyを含む専用Emulator suite 92件を確認し、追加composite indexが不要であることを実queryで確認した。2026-08-26にはcurrent Auth disabledの全UWB-07 mutation Callable拒否、仮User削除前後の退職境界、完了済み旧退職の再送が同emailの別tenant新User・予約・新Auth UIDまたはAuth-only accountへ作用しないことを追加し、suite 96件を確認した。Realtime Database Rules、画像圧縮、実端末FCM、外部API、Authentication削除triggerのevent transportは未対象である。

## `isSuperUser` claimの正規化

関連repository `air-guard-v2-admin-sdk`の`migration is-super-user-claim`は、所属済みAuthentication User、Company、同一UIDの本登録Userが整合する場合だけ、未設定の`isSuperUser`を`false`へ正規化します。既定はdry-runで、不正claim、identity不整合、読取errorがある場合はapply前に停止します。Emulatorまたは明示的なDev環境だけを許可し、Prod環境では拒否します。

```powershell
# Emulator: dry-run -> apply -> dry-run
npm run cli:emulator -- migration is-super-user-claim
npm run cli:emulator -- migration is-super-user-claim apply
npm run cli:emulator -- migration is-super-user-claim

# Dev: 個別のremote data操作承認後だけ、同じ順序で実行
npm run cli:dev -- migration is-super-user-claim
npm run cli:dev -- migration is-super-user-claim apply
npm run cli:dev -- migration is-super-user-claim
```

実行前に対象環境、復旧可能性、件数だけを出力することを確認します。dry-runの`invalidIdentity`、`invalidClaim`、`errors`がすべて0の場合だけapplyへ進み、apply後のdry-runで`eligibleMissing`が0であることを確認します。
