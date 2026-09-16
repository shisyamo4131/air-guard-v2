# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進む案内です。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。Git・remote・dataの現在状態は実targetで別途確認し、過去の実行記録を現在値として使いません。

## 現在の作業

- 棚卸し解消の継続先は[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md)。解消順、状態、次checkpointは同roadmapを正とし、既存phaseとの関係も同書から確認します。
- SCR-01「Billings入金予定日」は標準Manager／Class保存、Rules整合、旧Function撤去、Local自動検証、Dev反映・受入れまで完了し、同ロードマップで10点を加点済みです。SCR-02「配置通知の状態更新・編集」は標準Manager／Class接続を完了し、Schemas `3.0.0-dev.3`をroot/Functionsへ導入しました。PostAdoption、直接対象test、TESTERのLocal UI確認、ユーザー本人の遷移確認、domain-full 1433/1433、Local Emulator 180/180、最終Local T21は成功しました。GitHub ActionsによるDevのHosting/Functions反映と会社管理者によるDev UI表示も成功し、DEV read-only確認で配置通知2579件と関連予定・勤務実績の整合を確認してmigration/repair不要と判断しました。未確定dataが0件のため確定操作のDev受入れは未完了です。Generatorのscroll補正とsource regression test（TESTER最終39/39、review finding 0件）は完了し、Local UIも利用者確認により左Listと右Detail本文の独立scroll、右側操作部の固定、確定操作への到達を合格としました。release merge commit `05600c5dd8f7a5f55afae94832dd8f7b246fa531`のGitHub Actions run `35046048154`はsuccessとなり、HostingのみをDevへ反映しました。Dev URLはHTTP 200・final URI一致・no-store/must-revalidate/no-cacheで、会社管理者Chromeの対象3画面表示を確認しました。未確定現場稼働は0件のため今回のscroll補正のDev再受入れは未完了です。現在はDev補正反映済み・Dev再受入れ待ち、得点0です。[SCR-02 Local検証記録](../verification/scr-02-arrangement-notification-local.md)と[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md#scr-02受入れ前-ui-layout-regression-補正)を参照してください。
- 製品全体の残作業は[正式運用ロードマップ](../roadmaps/airguard-v2.md)、確認済み要件は[現行仕様](../specification.md)、実行証拠は[検証索引](../verification/README.md)を参照します。

## 未決事項と承認

- 利用者判断は[確認事項台帳](pending-confirmations.md)、独立した問題は[将来対応台帳](future-actions.md)へ照合します。回答済み・保留・統合関係を確認し、台帳のOpenを一律に再質問しません。
- 稼働実績詳細の稼働外売上は追加・編集・削除できる現行画面を維持します。role・permissionを操作へ影響させるかは未決であり、FGA-06の通常業務簡素化から権限変更を推論しません。[現行仕様](../specification.md#テナントと認証)と[Operation CRUD棚卸し](operation-crud-simplification-inventory.md)を参照します。
- 通常Employee archiveのtenant開放、Site自動終了公開、見た目・操作感、Prod、実data補完、package、緊急restore、retention/purgeは既存の別工程です。対象・状態は[Employeeロードマップ](../roadmaps/employee.md)、[Siteロードマップ](../roadmaps/site.md)、[4マスター反映範囲](master-dev-release-surfaces.md)を参照します。過去releaseの承認を次の操作へ拡張しません。
- data変換・索引補完やIAM・Callable公開設定の不足が確認された場合は、対象・必要性・作用・検証・復旧を提示し、既存の承認境界へ戻ります。未確認を理由に全件scan、補完、tenant開放を自動実行しません。
- Spark taskと破棄済みEmployee案は再利用せず、Sparkを再採用しません。判断の参照先は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)と[CAS-02試験記録](customer-archive-cas02-developer-trial.md)です。

## 次の作業

次は[標準CRUD整合ロードマップの受入れ前UI補正checkpoint](../roadmaps/standard-crud-alignment.md#scr-02受入れ前-ui-layout-regression-補正)に従い、対象dataを用意できた後、会社管理者で同範囲を再受入れする。既存のDev反映とDev UI表示、今回の補正反映は成功済みだが、未確定dataが0件のため確定操作のDev受入れは未完了である。Local UIでは利用者確認により左Listと右Detail本文の独立scroll、右側操作部の固定、確定操作への到達を合格としたため、対象dataを用意できた後に同範囲を確認する。得点加点はDev受入れまで行わない。Prod、FCM実配信、backend日付算術、dashboard本人表示は未実施または未検証であり、Rules、実data、package publishは別の承認境界に残す。

### 既存FGA工程の参照（2026-09-15時点）

1. `FGA-06-RESULT-DELETE-CLIENT-06`、`FGA-06-RESULT-CALLABLE-RESTORE-07`、見落としていた一覧CREATEを補正する`FGA-06-RESULT-CREATE-CLIENT-08`はDev反映・会社管理者受入れまで完了しました。[一覧CREATEのDev受入れ記録](../verification/fga-06-result-create-client-dev.md)を参照します。
2. 初回Dev受入れで作業員の勤務初期値継承不足を確認し、過去repositoryと現行`WorkersManager`契約に合わせて8つのdefault値を渡す補正をcommit `8d90d5d1`で反映しました。補正後は作業員追加・更新・削除・再読込、実績物理削除、Trigger errorなし、一覧0件、既存UIを確認済みです。
3. `FGA-06-SCHEDULE-MANAGER-RESTORE-09`では、現場稼働予定の通常CRUD、配置作業員、複製、配置通知をAir Manager／model保存へ戻し、Rulesをtenant境界へ簡素化しました。上下番確定の左右画面を上書きしていた表示口の重複も補正してDevへ再反映済みです。[ADR 0073](../decisions/0073-schedule-manager-and-rules-restoration.md)と[Dev反映記録](../verification/fga-06-schedule-manager-restore-dev.md)を参照します。
4. 左一覧・右詳細・日報写真の見た目は利用者が暫定確認済みですが、対象データ発生後の配置管理・上下番確定処理の受入れは残っています。この未完事項は[FGAロードマップ](../roadmaps/foundational-governance-alignment.md#fga-06-transaction系内部checkpoint)で管理し、SCR-02の調査と同じ修正・受入れを二重計上しません。
5. 予定入力内の現場新規登録は[FUT-0190](future-actions.md#fut-0190-現場稼働予定入力内の現場新規登録を復旧する)、サインアウト／session切替と従属cacheのcleanupは[FUT-0005](future-actions.md#fut-0005-サインアウト完了条件へmodel-cleanupを含める)へ分離済みです。次checkpointへの追加はscope合意に従います。

## 参照

- [4マスターの反映範囲・準備と復旧の記録](master-dev-release-surfaces.md)
- [4マスターのDev受入れ計画・結果](master-dev-acceptance-plan.md)
- [Site作成補正の検証記録](../verification/master-dev-site-create-correction.md)
- [Customer状態](../roadmaps/customer-status.md)・[Customer archive safety](../roadmaps/customer-archive-safety.md)・[Outsourcer](../roadmaps/outsourcer.md)のロードマップ
- [Project rules](../../governance/project-rules.md)・[local UI手順](../runbooks/local-ui-testing.md)

完了した準備一覧、過去のcommit・検証件数・受入れ詳細は各正本とGit履歴へ辿り、この案内へ再掲しません。
