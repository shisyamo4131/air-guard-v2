# GitHub Actions Dev deploy

- 状態: Confirmed
- 最終確認日: 2026-09-09
- 役割: `main` pushからDevへ自動deployする標準手順、設定、停止・復旧
- 対象外: Prod、data migration、repair、IAM変更の自動化

## 構成

`.github/workflows/dev-deploy.yml`が`main`へのpushを受け、`scripts/select-dev-deploy-targets.mjs`で変更fileをFirebase serviceへ対応付ける。GitHub `dev` Environmentは`main`だけを許可する。Google Cloudの専用service accountはGitHub OIDCとWorkload Identity連携で一時的に借用し、Google CloudのJSON秘密鍵をGitHubへ保存しない。

Hosting buildが使う`air-vuetify-v3`はPrivate repositoryである。workflowはAirVuetify3の読み取り専用Deploy keyを使い、検証済みcommit `62ec8eedd36ad623e42ae983780d6d1456942d84`を`air-vuetify-v3/`へ取得する。branch先端を暗黙に取得しない。package sourceを更新する場合は、AirVuetify3側の必須検証とpushを完了し、AirGuard側の固定commit、build、Dev検証を同じreleaseで更新する。

service accountは用途ごとに複数作成できる。Actions専用accountをlocal実行用・Firebase runtime用accountから分け、Firebase Admin、Cloud Functions Admin、Service Account User、Cloud Scheduler Adminを付与する。Cloud Scheduler Adminはscheduled Functionsのjobを更新するために必要であり、Dev project内のScheduler jobを作成・変更・削除できる。provider側でもrepositoryと`refs/heads/main`を条件にする。

GitHub `dev` Environmentには次を設定する。値はGitHub画面とGoogle/Firebase Consoleのactual targetで照合し、文書やlogへ複写しない。

- Variables: `FIREBASE_DEV_PROJECT_ID`、`GCP_WORKLOAD_IDENTITY_PROVIDER`、`GCP_DEV_DEPLOY_SERVICE_ACCOUNT`
- Secrets: `NUXT_PUBLIC_FIREBASE_API_KEY`、`NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN`、`NUXT_PUBLIC_FIREBASE_DATABASE_URL`、`NUXT_PUBLIC_FIREBASE_PROJECT_ID`、`NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET`、`NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`、`NUXT_PUBLIC_FIREBASE_APP_ID`、`NUXT_PUBLIC_FIREBASE_REGION`、`NUXT_PUBLIC_FIREBASE_VAPID_KEY`、`AIR_VUETIFY_DEPLOY_KEY`

`AIR_VUETIFY_DEPLOY_KEY`はAirVuetify3だけを読み取るSSH秘密鍵であり、FirebaseやGoogle Cloudの権限を持たない。対応する公開鍵はAirVuetify3のDeploy keysへ書込み許可なしで登録する。漏えい、取得失敗、管理者変更時は鍵を削除して新しい組を登録し、旧鍵を再利用しない。

## 標準release

1. [共通runbook](../dev-deployment.md)でcommit、release class、data影響、rollback、停止条件、remote検証を固定し、必要なlocal gateを完了する。
2. 変更fileから予想されるserviceを確認する。`firebase.json`または`.firebaserc`は全service、各Rules・Indexes fileは対応service、`functions/`はFunctions、それ以外の製品sourceはHostingを選ぶ。
3. 利用者へ対象commitと予想serviceを示し、`main` pushの承認を得る。この承認は自動選択されたDev deployまでを含む。
   - Functionsのexportを削除したreleaseでは、Devから削除されるFunction名と復旧方法を別に示し、破壊操作として明示承認を得る。非対話deployの確認promptを回避する場合は、承認済みのexact Functionだけを`functions:delete --force`で削除する一時stepを使い、成功後に撤去する。deploy全体へ`--force`を常設しない。
4. `main`へpushし、GitHub Actionsの`Dev deployment`を開く。
5. `Select changed Firebase services`の選択結果を確認する。文書等だけで空になった場合は正常終了し、Firebaseへ接続しない。
6. deploy jobではDev識別子検査、固定AirVuetify3 sourceの取得、必要な依存install、Hosting生成、Google Cloudの鍵なし認証、Firebase CLI version、dry-run、実deployの順に各stepを確認する。
7. workflowが成功したcommitだけを[remote検証](remote-verification.md)で受け入れる。Actions成功は画面・actor・data経路の受入れを代替しない。

## 手動実行

Actions画面の`Run workflow`は、初回の全service検証、失敗serviceの限定再試行、同じcommitの明示的な再deployに限る。実行前に`main`上のcommitと`all`または単一serviceを固定し、別承認を得る。任意のservice文字列は入力できず、workflow定義の選択肢だけを使う。

## 停止と復旧

- 対象選択が予想と異なる: deploy jobへ進めず、classifierと変更fileを修正して新しいcommitを承認・pushする。
- GitHub EnvironmentまたはOIDC認証が失敗: Variables、`main`制限、provider条件、service account接続、IAMをread-only確認する。秘密鍵を作らず、利用者loginへ自動切替しない。
- AirVuetify3取得が失敗: 固定commitがremoteに存在すること、Deploy keyが読み取り専用で登録されていること、`AIR_VUETIFY_DEPLOY_KEY`が`dev` Environmentに存在することを確認する。
- dry-run失敗: 実deployは開始されない。対象service、API、IAM、Firebase CLI互換性を確認する。
- Functions削除の承認がない、または削除対象が事前確認と異なる: 実deployを開始せず、source exportと現在のDev Function一覧を照合する。一時stepの`--force`を未承認削除の根拠にせず、deploy全体へ追加しない。
- scheduled Functionsで`cloudscheduler.jobs.update`が拒否される: Actions専用service accountにDev projectのCloud Scheduler Adminがあることを確認する。付与・変更はIAM変更として別承認を得る。
- 一部deploy後に失敗: Actions logとFirebase Consoleから成功済みserviceを確定し、同一commitの限定再実行か既知の正常commitへのreleaseを判断する。
- Actions自体を使えない: [local fallback](authentication-and-windows.md)を別承認した場合だけ使う。

Firebase CLIはworkflow内でversionを固定する。更新時は公式releaseを確認し、dry-runと全serviceの手動検証を完了してからworkflowと本文を同じ変更で更新する。
