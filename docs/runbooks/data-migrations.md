# data migration runbook

- 状態: 運用中
- 最終確認日: 2026-09-02
- 役割: 確認済みmigrationのtarget、dry-run、apply、post-check、rollback

maintenanceを伴うmigrationでは、個別手順に加えて[maintenance・data change runbook](maintenance-and-data-change.md)を必読とする。maintenanceを排他lockとみなさず、対象Functionのbounded quiet period、log、連続dry-run digest、整合snapshot、post-checkを組み合わせる。

## 小規模Dev migrationの共通手順

小規模であることだけを根拠に確認や復旧手段を省略しない。一方、すべてのmigrationへmaintenance、全体snapshot、専用backup、外部service確認を一律に追加しない。対象writer、旧新runtimeの互換性、追加・更新・削除の別、冪等性、件数、外部作用、失敗時の復旧難度を個別ADR・script・release checkpointで確認し、必要なものだけを選ぶ。

1. 対象project、database、release commit、許可するwrite、期待件数、停止条件、復旧方法、UI影響を固定する。migration固有のADRまたは節と専用scriptがない場合は開始しない。
2. maintenanceは実際のwriterと互換性から、復旧手段は別backupなし、PITR、Firestore全体snapshot、migration専用backupから理由付きで選ぶ。別backupなしは、追加だけ、再構築可能、PITR等で復旧可能など、data loss時の回復経路と理由を固定できる場合だけ許可する。削除・上書きで回復経路がない場合は許可しない。前のmigrationの例外を流用しない。
3. credential、project、database、database edition、Emulator不使用、cleanな固定commitをremote接続またはwrite前に確認する。値、document ID、credential、実dataを証拠へ出さない。
4. 旧新runtimeの併存順を決め、必要なRules・Functions・clientを[Dev deploy runbook](dev-deployment.md)に従って互換な順序で反映する。
5. fresh dry-runを実行し、計画digest、期待件数、停止条件を固定する。変更予定を専用終了codeで示すtoolでは、期待された計画状態と実際の失敗を区別して記録する。
6. 最初のapplyは独立した1回として記録し、tool内post-checkの成功を確認する。その後、独立processのdry-runでcleanを確認する。失敗時に盲目的な再試行をせず、現在状態を再取得・再計画して固有契約に従う。同一目的の確認を回数だけで反復せず、quiet periodや一貫性確認など別の証拠目的を持つ固有checkは省略しない。
7. UI影響がある場合だけ主要画面を確認し、remote状態とerror logはreleaseで影響したserviceに限定して確認する。件数、digest、operation状態、各commandの結果とexit statusを記録する。
8. 計画差分、未知状態、部分失敗、証拠不一致があれば、推測deleteや自動rollbackを行わない。現在状態を再読込して計画を作り直し、承認範囲が変わる場合は停止する。

STRIPE-05のmaintenance不要、外部Stripe確認不要、migration専用backup不要という判断は、Stripe未使用、外部更新なし、writer 0、旧2 fieldだけの冪等な削除、全体snapshotという固有証拠に基づく。この例外を将来の小規模migrationへ継承しない。

## Company legacy Stripe scaffold removal（codex-local / user-local / Dev）

[ADR 0038](../decisions/0038-legacy-stripe-scaffold-removal.md)に従い、`scripts/migrate-company-legacy-stripe.mjs`は既存Company rootの`stripeCustomerId`・`subscription`だけを全target共通の削除対象にする。`codex-local` rehearsalでは既知形状の直下`StripeData`も削除できるが、`user-local`とDevは`StripeData` 0件を必須とする。STRIPE-03の経路は`demo-air-guard-v2-codex`、`(default)` database、`127.0.0.1:18080`の組合せだけを許可する。STRIPE-04は利用者用Emulatorの`air-guard-v2-dev`、`(default)` database、`127.0.0.1:8080`だけを許可する。Devはremote `air-guard-v2-dev`、`(default)` database、明示credential、Emulator無効の組合せだけを許可し、内部`StripeData`が1件でもあれば変更せず停止する。Prodは提供しない。手作業、Firebase Console、汎用scriptで代替してはならない。

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

利用者用Emulatorでは、3つの環境変数が不足または不一致ならAdmin SDK初期化前に拒否する。既存`./saved-data`をpre-migrationの永続baselineかつADR 0038のexact preimageとし、import-only起動中は上書きしない。次の変更commandは、会社管理者を含むwriterを止め、同じquiet window中に他writeがない場合だけ使う。別backupは要求しない。

```powershell
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIRESTORE_DATABASE_ID = "(default)"
node scripts/migrate-company-legacy-stripe.mjs --target user-local

node scripts/migrate-company-legacy-stripe.mjs --target user-local --apply --plan-digest <直前dry-runの64文字digest> --confirm-project air-guard-v2-dev --confirm-quiet-window --confirm-user-local-apply --expected-company-total 1 --expected-company-field-documents 1 --expected-stripe-data-documents 0
```

- 確認は次の順で行う。既存`./saved-data`からimport-onlyで起動し、migrationと画面・data確認を行う。問題があればexportせず終了し、改修後に元の`./saved-data`から再開する。問題がなければ一度exportせず終了する。次に元の`./saved-data`をimportし、今度はexport-on-exitも付けて起動し、同じmigrationと画面・data確認を再実行する。2回目も問題がなければ終了して`./saved-data`へ確定する。
- exact preimageは、quiet window開始前から変更されていない既存`./saved-data`が確定まで担う。import-only確認中とmigration実行中に他writeがないことを前提とし、別backup、別path、別の保存方法を追加・推測しない。このuser-local toolはbackupまたはrestoreを提供せず、利用者承認により確定後のpre-migration data rollbackも提供しない。この限定例外はCompany 1件の`stripeCustomerId`・`subscription`削除かつ`StripeData` 0件のSTRIPE-04だけに適用し、件数または対象が変わればwrite 0で停止して再判断する。
- user-localはdry-runとapplyだけを提供し、`--create-backup`、`--restore`、backup ID、receiptを受け付けない。`codex-local`の合成data用schema v1 backup/create/apply/restoreには変更を加えない。
- user-local apply前にcleanな40文字HEADとmigration script identityをAdmin初期化前に確認する。1秒間隔の2回inventory一致はwriter停止を補う保守的heuristicであり排他lockではない。nested、unknown shape、件数1/1/0またはdigestの変化はwrite 0で停止する。transaction内でも再確認し、post-check失敗時に自動restoreしない。

- migrationはCompany rootを作成・削除・全体置換しない。更新は旧2 fieldの削除だけ、document削除は既知形状の直下`StripeData`だけである。Companyの他fieldと他subcollectionは変更しない。
- 旧`subscription`は`null`または既知4 fieldの完全形だけ、`StripeData`は撤去前実装が生成し得たrequest・success・failureの3完全形だけを許可する。未知・部分形、親Company不在、親documentが存在しない入れ子を含む全nested dataは変更前にblockする。
- apply前にexact target、Rules sourceの補助検査、root/FunctionsのSchemas version・取得元・integrity一致、直前digest一致、状態再検査、400 writeのtool上限を確認する。codex-localはtoolのschema v1 backupも確認する。user-localは変更されていない既存`./saved-data`を永続baselineとし、追加backup flagを要求しない。全変更は一つのtransactionへ登録し、1件でも失敗すれば全件を変更しない。
- backupは`.codex-test`配下の新規fileだけを許可し、既存fileを上書きしない。receiptはfile変更の検出値であり、作成者や真正性の証明ではない。読込時にpath、親子関係、重複、値形状、件数、対象内容digestを再検証する。合成dataだけを扱い、実data用の保管・暗号化・保持契約には使用しない。
- post-checkはlegacy field 0、`StripeData` 0、Company件数不変、Company非対象field不変、再dry-run cleanを必須とする。codex-localの復旧はschema v1のexact preimageだけを一括で戻し、現在状態と衝突する場合はwrite 0で停止する。user-localの復元機能は提供しない。
- Rules source検査は補助であり、実際の拒否保証は専用Emulatorの全actor・全階層deny testを正本とする。missing-parent列挙はtransaction readではない。user-local applyでは会社管理者を含むwriterを止め、bounded quiet period、連続inventory、transaction再確認、post-checkを組み合わせる。Dev、Prod、remote dataへは拡張しない。
- STRIPE-03では合成dataでdry-run、backup、missing-parent時write 0、一括apply、post-check、再実行clean、復旧を確認した。STRIPE-04では利用者承認の2段階手順により、利用者用`./saved-data`をimport-onlyで予行し、同一baselineのimport＋export-on-exitでCompany 1件のlegacy 2 field削除を確定した。`StripeData` 0件、post-check、主要3画面、確定snapshotの再import cleanを確認済みである。Dev・Prod、remote data、外部Stripeは変更していない。

### STRIPE-05 Dev remote

DevはStripe未使用・外部更新なし、現行runtimeの旧field writer 0、`StripeData`全階層denyを前提にmaintenanceを使用しない。Rules・Functions・Hostingを先行反映し、UWBと同じ手順でFirestore全体snapshotを取得してから、次の3 commandを独立processで実行する。実行時点のcredential、database edition、project、release commit、snapshot operationとreceiptは承認済みrelease checkpointで確認し、値や識別子をrepository・応答・logへ出さない。

```powershell
$env:GCLOUD_PROJECT = "air-guard-v2-dev"
$env:FIRESTORE_DATABASE_ID = "(default)"
$env:GOOGLE_APPLICATION_CREDENTIALS = "<DEV_SERVICE_ACCOUNT_JSON>"
node --use-system-ca scripts/migrate-company-legacy-stripe.mjs --target dev

node --use-system-ca scripts/migrate-company-legacy-stripe.mjs --target dev --apply --plan-digest <64文字のdigest> --confirm-project air-guard-v2-dev --confirm-database "(default)" --confirm-full-snapshot --expected-company-total 4 --expected-company-field-documents <dry-run件数> --expected-stripe-data-documents 0

node --use-system-ca scripts/migrate-company-legacy-stripe.mjs --target dev
```

- dry-runでCompany rootが4件でない、内部`StripeData`が直接・入れ子・orphanを含め1件以上、旧fieldが未知形状、対象identityまたは旧2 field digestが変化した場合はwrite 0で停止する。外部Stripeは確認しない。
- applyは元の4 Companyをtransaction内で再読込し、`stripeCustomerId`・`subscription`だけを削除する。通常のCompany更新は非対象fieldを保持し、停止理由にしない。`StripeData`、Companyの他field・他subcollectionを変更しない。
- post-checkは元の4 Companyの存在、旧2 field 0、内部`StripeData` 0、再dry-run cleanを確認する。部分完了は現在状態を再確認して同じ冪等処理を再実行し、自動rollbackしない。
- Devでは`--create-backup`と`--restore`を提供しない。旧2 fieldは未使用scaffoldの恒久削除であり、migration固有backup・data rollbackを行わない。全体snapshotは対象外dataを変更した重大事故に限る別承認repair候補で、通常の全体restoreは行わない。
- 2026-09-02にrelease commit `c3b29c59903928159f0d1c6f2ee3852b6ad7b46c`をDevへ反映した。Firestore RulesとFunctions 40件、Hosting 180 filesの反映後、全Firestore snapshotを取得し、Company 4件の旧2 fieldだけを1 transactionで削除した。`StripeData`は前後とも0件で、独立post dry-runはCompany 4件、旧field 0件、`StripeData` 0件、finding 0件のcleanだった。外部Stripe、maintenance、migration専用backup、自動restore、Prod、pushは実施していない。

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
- `.codex-test/saved-data`を直接上書きしない。candidate importへdry-run・apply・再dry-runを行い、backend verifierと既存candidate acceptance/promotion gateを通した後だけsnapshotを置換する。Codex専用candidateでの操作は個別承認を要しない。`migrate-user-reservations.mjs`で利用者用`saved-data`を更新する場合は、事前backupとexport candidate検証なしに上書きしない。この予約migration規則は、上記STRIPE-04限定例外を変更しない。
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
