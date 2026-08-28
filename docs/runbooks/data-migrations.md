# data migration runbook

- 状態: 運用中
- 最終確認日: 2026-08-28
- 役割: 確認済みmigrationのtarget、dry-run、apply、post-check、rollback

maintenanceを伴うmigrationでは、個別手順に加えて[maintenance・data change runbook](maintenance-and-data-change.md)を必読とする。maintenanceを排他lockとみなさず、対象Functionのbounded quiet period、log、連続dry-run digest、整合snapshot、post-checkを組み合わせる。

## CCB Company設定migration（pure planner実装済み・実行経路未実装）

CCBの既存tenant backfillはcreate-only complete-set stagingとして後続実装する。`createdBy/updatedBy`は承認済みDev service accountのstable non-email opaque IDを使用し、個人email・表示名を保存しない。移行前からmaintenance中で、旧dataからPrivateSettingsの内部理由・停止範囲を決定できないtenantは`ambiguousMapping`としてapply前に停止し、既定値や推測で補わない。

2026-08-28時点のDev target universeはCompany root 4件で、利用者会社1件、試用中の別会社1件、承認済み合成test 2件をすべてmigration対象とする。会社ID、名称、emailはrepository・command output・callbackへ保存しない。実装済みmigration command、target manifest digest、pre-containment Rules receipt、backup、dry-run、apply承認はまだ存在しないため、この分類だけでremote stagingまたはapplyを開始してはならない。

candidate universeは外部保管する承認済みtarget manifest、Company root、既存CCB target pathのunionとする。未分類root、manifest不一致、orphan target、target conflict、unknown field、invalid source、ambiguous mappingが1件でもあれば、全tenantのapplyをwrite 0で停止する。partial setへ不足documentを足して修復しない。`alreadyEquivalent`は8 targetのcomplete/exact/parity、`eligibleCreate`はmarker未active・source決定可能・8 targetとauditが全不存在の場合だけとする。

dry-runとapplyはSchemasのpure mappingから同じtype-tagged canonical planを生成し、applyはlive stateで再生成したdigestが承認値と一致した場合だけtenant単位transactionで8 targetをcreateする。root、既存target、auditのupdate/deleteは0とする。途中成功後は作成済みdocumentを削除せず、fresh dry-runで成功tenantを`alreadyEquivalent`として新しいdigestを承認し直す。activationは別checkpointである。詳細は[ADR 0028](../decisions/0028-ccb-parity-backup-audit-restore.md)を正本とする。

2026-08-28に`scripts/migrate-company-settings.mjs`へpure plannerだけを実装した。入力は呼出元が取得・正規化したmanifest、Company root、target、audit、unexpected pathであり、planner自身はFirestore、Emulator、network、credentialへ接続しない。Schemas exact `2.4.2-dev.167`の`mapLegacyCompanyToConfigurationV1`を使い、公開Firestore REST Valueだけからinteger/double、Timestamp、GeoPoint、reference、bytes、array、mapを区別したcanonical digestを作る。標準summaryは分類別件数、計画digest、opaque subject、create予定件数だけで、company ID、名称、path、document bodyを出力しない。

```powershell
# 合成fixtureだけを使うpure planner回帰test
npm run test:company-settings-migration
```

このcheckpointでは実行可能なFirestore reader、dry-run CLI、transaction apply、post-checkを意図的に提供しない。`node scripts/migrate-company-settings.mjs`の直接実行はexit 64で停止する。次の実装は、まずCodex専用合成Emulator向けの公開REST readerとcreate-only transactionを別checkpointで追加し、target guard、Rules receipt、manifest receipt、read-after-write、root/audit write 0を検証する。Dev/Prodまたは既存Emulator dataに対する読取・適用へ、このpure plannerだけを根拠に進んではならない。

`PrivateSettings`は現行logical backupへ含めず、そのbackupを完全backupと呼ばない。当面の復旧基盤はmanaged Firestore backup/PITRとする。専用の暗号化logical backup/restoreは保存先、暗号化、IAM、保持、redaction、環境間restoreを別承認するまで未提供である。`SettingAudits` restoreは専用経路の同一company/schema/ID create-onlyだけを許可し、同値skip、異値で全体停止、update/delete/clear禁止とする。専用実装と復旧演習がない間は、いずれも利用可能なlogical restoreとして案内しない。

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
