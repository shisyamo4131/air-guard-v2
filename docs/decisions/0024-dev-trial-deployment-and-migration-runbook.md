# 0024 Dev試行環境の積極的deployとmaintenance migration標準手順

- 日付: 2026-08-27
- 状態: Accepted
- 関連仕様: 検証・試行環境、プロジェクト運用
- 関連手順: [運用・開発手順](../operations.md)
- 共通runbook: [Dev環境deploy runbook](../runbooks/dev-deployment.md)
- Migration runbook: [data migration runbook](../runbooks/data-migrations.md)
- 関連ロードマップ: [AirGuardV2 正式運用準備ロードマップ](../roadmaps/airguard-v2.md)

## 背景

Devは利用者の会社と協力会社が実際に試験運用する非本番環境である。従来の正本は、正式運用準備の未完了とDev deploy可否を結び付け、認証・認可マイルストーン全体の完了までdeployしないと記録していた。この境界では、Devで得るべき実利用条件の証拠を、正式運用準備の完了まで取得できない循環が生じる。

UWBはrole・permission、User/Authの作成・更新・削除、lifecycle、競合制御、Rules、client UI、email・Employee予約を一体として変更した。予約だけをmigrationまたは選択deployし、旧Functionsや旧clientを運用へ戻すと、予約欠損、stale pointer、誤ったrole編集control、旧認可による更新が再発する。

## 決定

Devは正式運用準備または正式運用開始の完了判定とは独立して、検証済み変更を積極的にdeploy・受入れする試行環境とする。対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を記載した一つのbounded Dev release checkpointを利用者が承認した場合、そのrunbook内の静的生成、deploy、remote検証はcommandごとの再承認を必要としない。

project共通のCLI・trust・認証preflight、release分類、build、deploy、remote検証、停止条件はDev環境deploy runbookを正本とする。client/Hostingのみ、Functionsのみ、互換なRules・Indexes変更へ、本ADRのmaintenance、snapshot、migrationを自動適用しない。release classがclient/serverの非互換な同時変更、data migration、破壊的repairへ強まる場合に、data・互換性境界に応じた手順を追加する。

data migrationはrelease checkpoint内でも固有の対象、dry-run、apply、post-check、rollbackを明示する。新しいmigration、破壊的repair、対象拡張、Prod適用は承認を引き継がない。一般公開されていないことをsecurity controlの代替にせず、Devの実account・実dataを秘密情報・個人情報境界として扱う。

schemaまたはruntimeと既存dataの同時切替が必要なreleaseは、固定commitのclient生成preflight、System全体maintenance、整合snapshot、server境界deploy、fresh migration、client deploy、maintenance中検証、解除後受入れを一つのcutoverとする。client生成preflightはmaintenance開始とremote変更より前に完了させる。maintenanceはclient route制御であって排他lockではないため、他operator、Dev接続client、開始済みrequest、scheduled・direct Functionsを別に収束・監視する。

UWB初回導入では、予約関連Functionだけを選択deployしない。UWBで変更したRules、全Functions、共有Schemas contract、予約migration、client/Hostingを同じreleaseとして導入し、全体確認後にだけmaintenanceを解除する。

## 理由

- Devの目的は、正式運用前に実利用条件の不具合、権限、IAM、Functions transport、migration、rollbackを発見することである。
- 正式運用準備の未完了をDev deploy blockerにすると、remote証拠を取得できず完了条件へ進めない。
- 一つのbounded checkpointは、commandごとの形式的な再承認を減らしながら、対象・data・復旧・停止条件を固定できる。
- client生成をmaintenance前のpreflight gateにすれば、PWA、依存関係、環境設定等のbuild blockerをremote変更前に検出できる。
- server、data、clientをmaintenance期間内で整合させれば、旧clientが残ってもserver最終認可を維持し、migration後に旧処理がdata contractを壊す期間を作らない。

## 代替案

- 正式運用準備が完了するまでDevへdeployしない案は、試行環境の目的とremote受入れ証拠の取得を妨げるため採用しない。
- 予約Functionとmigrationだけを先行する案は、旧role・User/Auth処理とclientが残り整合性を再破壊できるため採用しない。
- maintenanceを排他lockとして扱う案は、Rules、Functions、Admin SDK、開始済みwriteを停止しない実装と一致しないため採用しない。
- Devへの無期限・無範囲の包括許可は、実dataと外部作用の境界を失うため採用しない。

## 影響

- Dev deploy可否は正式運用準備スコアと分離され、Dev受入れ結果がroadmapの証拠になる。
- Codexは承認済みcheckpoint内でDev build、deploy、remote検証を継続できるが、対象外service・dataへ拡張しない。
- migrationを伴うreleaseは、backupだけでなく、追加documentをimportで削除できない等の固有rollback制約を記録する。
- project-wide approval policyの変更であるため、検証・local commit後にactive coordinatorを完全な新規taskへ交代する。

## 移行

現行UWB releaseは、固定commitのDev静的生成をremote変更前に成功させてから、全server境界をDevへdeployし、旧revisionのin-flight処理を収束させ、予約migrationをfresh dry-run・create-only apply・再dry-runし、同じ生成物をUWB client/Hostingへdeployしてからmaintenanceを解除する。実行前に正確なrelease commit、Firebase対象、gcloud snapshot、service account、validation、failure stopをcheckpointへ固定する。

既存の「認証・認可マイルストーン全体の完了までdeployしない」というroadmap記述を廃止し、Firestore Rules全体のtenant内write縮小、App Check、rate limitを正式運用準備の残作業として維持する。これらが未完了でもDev deploy・受入れは行うが、正式運用開始可とは判定しない。

## ロールバック

server deploy前の失敗はremote変更を開始せず停止する。server deploy後またはmigration後の失敗はSystem maintenanceを維持し、新contractに沿うcorrective releaseまたは証拠付きrepairを使う。予約backfill後に予約を保守しない旧Functionsへ戻してtrafficを再開しない。Git force、history rewrite、推測data削除、backup importだけでの追加document削除に依存しない。

本ADRの文書・project rules変更自体はlocal commitからrevertできるが、実施済みremote deployまたはdata migrationはGit revertだけで取り消せない。remote rollbackは実行証拠と対象環境の現在状態を確認した別checkpointで行う。

## 検証

- project-owned document validator、managed governance validator、renderer drift、`git diff --check`を独立実行する。
- Dev checkpointごとにmaintenance前のbuild preflight、Rules、Functions、Hosting、migration dry-run/apply/post-check、maintenance status、role・tenant・User/Auth lifecycleの正常・拒否経路を独立したexit statusとremote evidenceで確認する。`injectManifest`を採用するService Workerでは、必須挿入点をsource-contract testで固定する。
- Firebase CLIとgcloudは別のtrust・token refresh経路として独立確認し、対象projectをcommandへ明示する。CLI、TLS、credential、token refresh、account、project、IAM、API、buildの失敗層を切り分け、未導入と確認できないCLIの再install、TLS検証無効化、token本文の表示、persistent CA設定を診断の近道にしない。
- 正式運用準備の進捗はDev deployだけで加点せず、roadmapのmilestone完了条件が揃った場合だけ更新する。

## 再検討条件

Devの利用会社、公開範囲、data分類、operator、CI/CD、preview環境、production projectが変わる場合、またはmaintenanceをserver-side排他へ変更する場合に、checkpoint粒度と承認境界を再検討する。
