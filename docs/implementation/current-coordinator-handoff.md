# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進む案内です。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。Git・remote・dataの現在状態は実targetで別途確認し、過去の実行記録を現在値として使いません。

## 現在の作業

- 製品改修の継続先は[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)。機能順、進捗、checkpointの完了条件・状態は同roadmapを正とします。
- 製品全体の残作業は[正式運用ロードマップ](../roadmaps/airguard-v2.md)、確認済み要件は[現行仕様](../specification.md)、実行証拠は[検証索引](../verification/README.md)を参照します。

## 未決事項と承認

- 利用者判断は[確認事項台帳](pending-confirmations.md)、独立した問題は[将来対応台帳](future-actions.md)へ照合します。回答済み・保留・統合関係を確認し、台帳のOpenを一律に再質問しません。
- 稼働実績詳細の稼働外売上は追加・編集・削除できる現行画面を維持します。role・permissionを操作へ影響させるかは未決であり、FGA-06の通常業務簡素化から権限変更を推論しません。[現行仕様](../specification.md#テナントと認証)と[Operation CRUD棚卸し](operation-crud-simplification-inventory.md)を参照します。
- 通常Employee archiveのtenant開放、Site自動終了公開、見た目・操作感、Prod、実data補完、package、緊急restore、retention/purgeは既存の別工程です。対象・状態は[Employeeロードマップ](../roadmaps/employee.md)、[Siteロードマップ](../roadmaps/site.md)、[4マスター反映範囲](master-dev-release-surfaces.md)を参照します。過去releaseの承認を次の操作へ拡張しません。
- data変換・索引補完やIAM・Callable公開設定の不足が確認された場合は、対象・必要性・作用・検証・復旧を提示し、既存の承認境界へ戻ります。未確認を理由に全件scan、補完、tenant開放を自動実行しません。
- Spark taskと破棄済みEmployee案は再利用せず、Sparkを再採用しません。判断の参照先は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)と[CAS-02試験記録](customer-archive-cas02-developer-trial.md)です。

## 次の作業

1. `FGA-06-RESULT-DELETE-CLIENT-06`と`FGA-06-RESULT-CALLABLE-RESTORE-07`はDev反映・会社管理者受入れまで完了しました。見落としていた一覧CREATEは`FGA-06-RESULT-CREATE-CLIENT-08`で複数形Manager／model保存へLocal修正し、旧Callable入力を閉じました。[Local検証記録](../verification/fga-06-result-create-client-local.md)を参照します。
2. 初回Dev受入れで作業員の勤務初期値継承不足を確認し、過去repositoryと現行`WorkersManager`契約に合わせて8つのdefault値を渡す補正をcommit `8d90d5d1`で反映しました。補正後は作業員追加・更新・削除・再読込、実績物理削除、Trigger errorなし、一覧0件、既存UIを確認済みです。
3. 現在の次操作は08の最終Local検証、commit、承認後のDev反映・一覧作成受入れです。それを閉じてから、現場稼働予定の通常CRUDと物理削除をManager／client／Trigger境界へ戻せるか設計します。
4. 予定入力内の現場新規登録は[FUT-0190](future-actions.md#fut-0190-現場稼働予定入力内の現場新規登録を復旧する)、サインアウト／session切替と従属cacheのcleanupは[FUT-0005](future-actions.md#fut-0005-サインアウト完了条件へmodel-cleanupを含める)へ分離済みです。次checkpointへの追加はscope合意に従います。

## 参照

- [4マスターの反映範囲・準備と復旧の記録](master-dev-release-surfaces.md)
- [4マスターのDev受入れ計画・結果](master-dev-acceptance-plan.md)
- [Site作成補正の検証記録](../verification/master-dev-site-create-correction.md)
- [Customer状態](../roadmaps/customer-status.md)・[Customer archive safety](../roadmaps/customer-archive-safety.md)・[Outsourcer](../roadmaps/outsourcer.md)のロードマップ
- [Project rules](../../governance/project-rules.md)・[local UI手順](../runbooks/local-ui-testing.md)

完了した準備一覧、過去のcommit・検証件数・受入れ詳細は各正本とGit履歴へ辿り、この案内へ再掲しません。
