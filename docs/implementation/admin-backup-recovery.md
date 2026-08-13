# Admin SDK バックアップ・復旧・保守コマンド（実装調査）

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-043
- 最終確認日: 2026-08-11
- 根拠ファイル: `air-guard-v2-admin-sdk/src/commands/backup.js`、`src/constants/collections.js`、`src/cli.js`、`src/index.js`、`src/firebaseAdmin.js`、`src/storage/*`、`README.md`、`COMMANDS.md`、`DESIGN.md`、`package.json`、既存 `system-maintenance.md`、`archive-restore.md`

## 入口・前提

Admin SDKはFirebase Admin SDKでFirestore、Authentication、任意でCloud Storageへ直接アクセスし、Firestore Rulesを迂回する。CLI実行者をアプリのrole/permissionで再認証する処理はなく、credentialと対象環境の選択が権限境界である。credential、環境値、実データは本調査で読み取っていない。

保存先は既定のlocal `./backups`、またはstorage adapterでFirebase Storageを選べる。backupはCompany maintenanceを要求しない。snapshot、差分復旧、選択復旧は`Company.maintenanceMode === true`を要求するが、完全復旧は確認しない。maintenanceのon/offは別commandで、復旧commandが自動で切替・解除することはない。

## command / API表

| 入口 | 実装 | 実際の契約 |
| --- | --- | --- |
| `backup company <companyId>` | `backupCompany` | Company、catalog内subcollection、非temporary Userに対応するAuth情報をtimestamp付きJSONへ保存する。 |
| `backup snapshot <companyId>` | `snapshotCompany` | maintenance必須。固定`temporary/.../snapshot.json`を上書き後、最新確定backupとの差分を自動計算する。 |
| `backup diff <companyId>` | `diffBackup` | snapshotと最新backupを比較し、summaryとcollection別diffを保存する。maintenance無効でも警告だけで計算する。 |
| `backup restore <companyId> -c A,B` | `restoreDiff` | maintenance必須。保存済みdiffのadded/modified/deletedをすべて`set`する。Users/Auth除外。 |
| `backup restore-full <companyId> -c A,B` | `restoreSelective` | maintenance必須。最新backupの指定collectionを`merge:true`でsetする。対象にないlive documentは削除しない。Users/Auth除外。 |
| `backup restore-complete <companyId>` | `restoreCompanyFromLatestBackup` | 最新backupを選び、catalog内live dataを削除してCompany/subcollections/Authを再作成する。maintenance確認なし。 |
| `backup list [companyId]` | `listBackups` | local/Storage上のbackup metadataを列挙する。 |
| `system/companies maintenance-on/off` | system/company commands | flagを更新するだけで、進行中処理やRules/Functions/Admin writeを排他しない。 |

`AirGuardAdminSDK.restoreDiff/restoreFull`は配列を第2引数へ渡すが、内部関数は第2引数をoptions objectとして読み、`options.collections.split()`を期待する。この公開class APIとREADMEの配列例は内部契約と不一致である。直接exportのREADME例も同じ不一致を持つ。CLIはcomma-separated stringをoptionsへ渡すが、READMEのspace-separated例はCommanderの単一option値契約と一致しない。`all`の展開処理はなく、`--collections all`はcatalog名と一致せず0件のまま成功し得る。

## backup scope・format

対象は`Companies/{companyId}`と次の一階層subcollectionだけである。順序はArticles、Customers、Customers_archive、Sites、Sites_archive、Employees、Employees_archive、Outsourcers、Outsourcers_archive、SiteOperationSchedules、OperationResults、Billings、DailyAttendances、ArrangementNotifications、Autonumbers、Users。未知collectionの探索、nested subcollectionの再帰取得、top-level System/admin_users、Cloud Storage業務objectは含まない。

実在schemaと照合すると、少なくとも`Articles_archive`、`AgreementV2s`、`DailyOperationsByEmployee`、`SiteEmployeeHistories`、`Notifications`、`Operations`、`SecurityReportIndexes`がcatalogにない。collectionによっては用途・現役性が未確認だが、「Firestore全コレクション」というREADME記述はcatalog方式と一致しない。

JSONはwrapperの`metadata`と`data`を持つ。dataにはbackupDate、companyId、Company data、collection別`[{docId,data}]`、Auth users、件数metadataが入る。Firestore Timestampはmarker付きISO文字列へ変換される。AuthはUID、email、emailVerified、displayName、photoURL、disabled、metadata、customClaimsを保存するがpassword hashは保存しない。空collectionはsubCollectionsから省略される。

local pathは`./backups/companies/{companyId}/backup_YYYY-MM-DD_HH-MM-SS.json`、Firebase Storageは`backups/companies/...`相当である。snapshot、diff、復旧用仮passwordは固定temporary pathへ上書きする。schema/artifact version、manifest、checksum、署名、暗号化、圧縮、retention/rotation、世代lockは確認できない。backupはcollectionとAuthを逐次読むため、単一の整合した復旧時点ではない。

## restore flow

### 差分復旧

diffは「最新backup → maintenance中snapshot」の変化を表す。snapshotにだけあるdocumentをadded、`updatedAt`がbackupより新しいものだけをmodified、backupにだけあるものをdeletedとする。`updatedAt`がない、逆行、同値、fieldだけ変化したdocumentはunchangedとなる。

restoreDiffはaddedとmodifiedへsnapshot data、deletedへbackup dataを`set`する。したがって「backup時点へrollback」ではなく、snapshot時点を再適用しつつsnapshotで削除済みのdocumentを復活させる混合動作である。addedを削除せず残し、deletedを復元するため、どちらの時点にも一致しない結果になり得る。diff生成後のlive revisionやartifact company/environmentをpreconditionで検証しない。

### 選択復旧

restoreSelectiveは最新backupの指定collectionを500件ずつ`merge:true`で書く。backupにないlive documentやbackupにないfieldを除去しないため、full replacementではない。未知collectionは明示errorにせず無視される。dry-run、件数上限、差分preview、revision lockはない。

### 完全復旧

restore-completeは環境不一致を警告し、通常は破壊確認、本番判定時は二重確認するが`--skip-confirmation`で省略できる。catalog順にlive subcollectionを全削除し、Companyを全置換、catalog順にsubcollectionをsetし、最後にAuthを元UIDで作成してcustom claimsを付ける。

clearはcollection全documentを単一batchへ積むため500件を超えるcollectionでcommit上限超過となる。restore writeは500件単位だが、batchをcommit後に新しいbatchへ差し替えず同じbatch objectを使う箇所があり、500件超の動作は実行確認が必要である。Auth削除対象は現在のAuth一覧ではなくbackup内Users doc IDなので、backup外のlive Auth userは残り得る。個別Auth削除・作成失敗は警告して継続し、skipped userがあっても全体successを返す。

Auth passwordは復元できないためランダム仮passwordを生成する。emailと仮passwordをconsoleへ出し、UID/email/tempPasswordを`temporary/.../restored_users_passwords.json`へ平文保存する。旧password、MFA/provider、token/session、全Auth metadataの復元は確認できない。

## maintenance連携

推奨手順としてbackup、company maintenance-on、snapshot/diff、選択または差分復旧、確認、maintenance-offが文書化される。ただしmaintenanceはアプリのroute redirectであり、Firestore Rules、Functions、Admin SDK、既に開始したwriteを停止しない。System maintenanceとの自動連携もない。完全復旧はcompany maintenanceを要求せず、失敗時の自動rollback/maintenance保持確認/recovery markerもない。

catalogの`waitAfterClear/waitAfterRestore`はFunctions trigger待機用だが全て0である。delete/create/update triggerは通常どおり発火し得る。順序コメントはCustomers→Sites、OperationResults→Billings/DailyAttendancesだけを想定し、現在の派生collection全体をcoverageしない。

## validation・failure・retry

- backup/snapshotはFirestore/Authをtransactionなしで逐次取得し、途中更新を防がない。
- restoreは複数batch、Company、Auth、Storageへまたがりtransaction/rollback不能で、途中失敗すると部分状態を残す。
- 再実行時のoperation ID、artifact revision、write precondition、idempotency ledgerはない。set自体が同値でもFunctions triggerやAuth再作成は安全な冪等性を保証しない。
- latest選択はtimestampを含むpathの辞書順で、manifest statusやcomplete markerを検証しない。
- JSON parse以外のschema/version/company/count/checksum検証、restore前の容量・参照・trigger検査はない。
- production確認は環境変数/options判定と対話に依存し、skip flagで省略できる。dry-runはない。

## security・audit

artifactには会社、取引先、従業員、勤怠、請求、User/Auth/custom claims等の機微情報が入り得る。local file permission、Storage Rules/IAM、暗号鍵、retention、access logはこのSDKで設定・検証しない。処理logには会社名、UID、email、error、完全復旧時の平文仮passwordが出る。相関ID、actor、reason、承認記録、操作manifest、durable audit logはない。

Rules bypassは保守には必要だが、誤ったcompany/environment、改変artifact、credential保有者の操作をアプリ側tenant/roleで防止できない。実運用ではcredential管理、二者承認、監査、artifact暗号化とrestore drillが別途必要である。

## coverage gaps・矛盾・未使用候補

- READMEの「Firestore全コレクション」「完全backup」はcatalog外collection/nested subcollection/Storageを含まない実装と矛盾する。
- `restore-full`はmerge型選択復旧であり、削除・全置換をしない。READMEの`all`例とspace-separated例も実装契約と不一致である。
- 公開class/direct APIのrestore引数と内部options契約が一致しない。
- diff restoreはrollbackにもsnapshot再現にもならない混合semanticsである。
- 完全復旧はmaintenanceを要求せず、catalog漏れdataを削除も復元もしない。Authも完全置換ではない。
- catalogの全trigger待機値が0で、コメント上の依存関係も現実装の派生collectionを網羅しない。
- 直接test directoryは確認できず、READMEの「実装済み」command例は実行結果・自動testを示さない。

## 将来要対応

- FUT-0146へArticles archiveのbackup漏れ証拠を追記。
- FUT-0147: version付きcollection/recursive scope catalogとcoverage検査。
- FUT-0148: restore semantics、preflight、batch、transaction/rollback、trigger/reconcileの安全化。
- FUT-0149: artifact暗号化・integrity・retentionと仮password廃止/安全配送。
- FUT-0150: CLI/公開API/READMEの引数・命名・`all`・dry-run契約統一。

## 要確認事項

- CONF-0124: 正式backup scope、RPO/RTO、整合点とStorage/Auth/nested collection対象。
- CONF-0125: rollback/forward recovery、差分/選択/完全復旧の正式semanticsとtrigger方針。
- CONF-0126: artifact保存、暗号化、保持、access、仮credential配送・破棄。
- CONF-0127: PROD実行者、二者承認、audit、drillとmaintenance解除条件。

## 未確認範囲

CLI/API、Firebase、Storage、Auth、実データは一切実行していない。artifact実例、500件超、部分障害、Functions trigger、復旧時間、actual IAM/Storage Rules、OS file permission、credential運用、PROD運用、backup restore drillは未確認である。関連repoのcode・configは変更していない。
