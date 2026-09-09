# Company legacy Stripe scaffold removal

- 状態: Historical cleanup / script available
- 役割: Company rootからlegacy Stripe scaffoldを除去する個別migration手順
- 判断: [ADR 0038](../../decisions/0038-legacy-stripe-scaffold-removal.md)
- 実行証拠: [Company Stripe removal roadmap](../../roadmaps/company-stripe-removal.md)、[STRIPE-05 Dev release verification receipt](../../verification/stripe-05-dev-release.md)

> この文書は再実行可能な手順と停止条件だけを扱う。過去の件数、digest、commit、受入れ結果は上記の証拠を参照する。


[ADR 0038](../../decisions/0038-legacy-stripe-scaffold-removal.md)に従い、`scripts/migrate-company-legacy-stripe.mjs`は既存Company rootの`stripeCustomerId`・`subscription`だけを全target共通の削除対象にする。`codex-local` rehearsalでは既知形状の直下`StripeData`も削除できるが、`user-local`とDevは`StripeData` 0件を必須とする。STRIPE-03の経路は`demo-air-guard-v2-codex`、`(default)` database、`127.0.0.1:18080`の組合せだけを許可する。STRIPE-04は利用者用Emulatorの`air-guard-v2-dev`、`(default)` database、`127.0.0.1:8080`だけを許可する。Devはremote `air-guard-v2-dev`、`(default)` database、明示credential、Emulator無効の組合せだけを許可し、内部`StripeData`が1件でもあれば変更せず停止する。Prodは提供しない。手作業、Firebase Console、汎用scriptで代替してはならない。

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
- この手順を使用した実行結果は[STRIPE-05 Dev release verification receipt](../../verification/stripe-05-dev-release.md)を参照する。本runbookへ実測件数、digest、commit、受入れ結果を複写しない。
