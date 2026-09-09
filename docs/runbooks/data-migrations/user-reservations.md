# UWB-04 User予約migration

- 状態: Confirmed
- 役割: Userのemail予約とEmployee予約を監査・再構築する個別migration手順
- 実装・検証記録: [User write boundary](../../implementation/user-write-boundary.md)
- 進捗・実行履歴: [AirGuardV2 roadmap](../../roadmaps/airguard-v2.md)

> この文書は再実行可能な手順と停止条件だけを扱う。日付固有のtest件数と受入れ結果は上記の記録を参照する。


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
- `.codex-test/saved-data`を直接上書きしない。candidate importへdry-run・apply・再dry-runを行い、backend verifierと既存candidate acceptance/promotion gateを通した後だけsnapshotを置換する。Codex専用candidateでの操作は個別承認を要しない。`migrate-user-reservations.mjs`で利用者用`saved-data`を更新する場合は、事前backupとexport candidate検証なしに上書きしない。この予約migration規則は、[STRIPE-04限定例外](company-legacy-stripe.md)を変更しない。
- Dev applyはmaintenance、必要なbackup、直前dry-run、利用者の実data migration承認、project名とbackup確認flagを必須とする。dry-run後にUser・Employee・予約が変化するとdigestまたはtransaction再検査で停止する。途中失敗で一部create済みの場合は予約を推測削除せず、再dry-runして残りのcreateだけを再計画する。
- Dev rollbackは自動deleteやUser/Auth変更を行わない。公開前の追加予約は既存runtimeに参照されないが、削除が必要な場合は事前・事後証拠から本migrationが新規作成したexact reservationだけを特定し、別のrepair・実data操作承認で扱う。Prod migrationは未提供である。
