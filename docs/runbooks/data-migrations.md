# AirGuardV2 Data Migration Runbook

- 状態: 運用中
- 役割: data migrationに共通する実行順序と、個別migration手順・判断・証拠への索引
- 実行境界: local / Dev。Prod migrationは個別手順で明示されない限り提供しない

この文書はdata migrationの入口である。実行前に共通手順と対象migrationの個別手順を読み、Devを含む場合は[Dev deploy runbook](dev-deployment.md)も読む。maintenanceを伴うmigrationでは、個別手順に加えて[maintenance・data change runbook](maintenance-and-data-change.md)を必読とする。maintenanceを排他lockとみなさず、対象Functionのbounded quiet period、log、連続dry-run digest、整合snapshot、post-checkを組み合わせる。

## Migration索引

| Migration | 状態 | 個別手順 | 判断・実装 | 実行証拠・履歴 |
|---|---|---|---|---|
| Company legacy Stripe scaffold removal | Historical cleanup / script available | [Stripe scaffold removal](data-migrations/company-legacy-stripe.md) | [ADR 0038](../decisions/0038-legacy-stripe-scaffold-removal.md) | [roadmap](../roadmaps/company-stripe-removal.md)、[STRIPE-05 receipt](../verification/stripe-05-dev-release.md) |
| 旧CCB Company設定migration | Historical / unavailable | 実行手順なし | [ADR 0028](../decisions/0028-ccb-parity-backup-audit-restore.md)、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md) | [historical roadmap](../roadmaps/company-settings.md) |
| UWB-04 User予約migration | Confirmed | [User予約migration](data-migrations/user-reservations.md) | [User write boundary](../implementation/user-write-boundary.md) | [AirGuardV2 roadmap](../roadmaps/airguard-v2.md) |
| `isSuperUser` claim正規化 | Confirmed / related repository | [claim正規化](data-migrations/is-super-user-claim.md) | 実装所有者は`air-guard-v2-admin-sdk` | 個別手順の実行結果を対象checkpointへ記録 |

旧CCBの8 target、`PrivateSettings`、`SettingAudits`を扱うmigration・restore commandはcorrective rollback済みで、現在は利用できない。将来のCompany data migrationでは旧plannerや旧mappingを再利用せず、その時点の対象、backup、dry-run、write allowlist、停止条件、post-check、rollback、受入れを新しいbounded checkpointで確定する。

## 小規模Dev migrationの共通手順

本節はmigrationが必要と判断された後の実行手順である。機能改修時に既存Dev documentの全件診断・一括修復を標準前提とせず、要否は[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)で判断する。条件に該当する場合は影響範囲の状態確認を必須とし、変換が必要なら本節と固有契約に従う。状態確認で変換不要が確認できた場合は、その根拠をreleaseの`data-impact`へ記録する。

小規模であることだけを根拠に確認や復旧手段を省略しない。一方、すべてのmigrationへmaintenance、全体snapshot、専用backup、外部service確認を一律に追加しない。対象writer、旧新runtimeの互換性、追加・更新・削除の別、冪等性、件数、外部作用、失敗時の復旧難度を個別ADR・script・release checkpointで確認し、必要なものだけを選ぶ。

1. 対象project、database、release commit、許可するwrite、期待件数、停止条件、復旧方法、UI影響を固定する。migration固有のADRまたは節と専用scriptがない場合は開始しない。
2. maintenanceは実際のwriterと互換性から、復旧手段は別backupなし、PITR、Firestore全体snapshot、migration専用backupから理由付きで選ぶ。別backupなしは、追加だけ、再構築可能、PITR等で復旧可能など、data loss時の回復経路と理由を固定できる場合だけ許可する。削除・上書きで回復経路がない場合は許可しない。前のmigrationの例外を流用しない。
3. credential、project、database、database edition、Emulator不使用、cleanな固定commitをremote接続またはwrite前に確認する。値、document ID、credential、実dataを証拠へ出さない。
4. 旧新runtimeの併存順を決め、必要なRules・Functions・clientを[Dev deploy runbook](dev-deployment.md)に従って互換な順序で反映する。
5. fresh dry-runを実行し、計画digest、期待件数、停止条件を固定する。変更予定を専用終了codeで示すtoolでは、期待された計画状態と実際の失敗を区別して記録する。
6. 最初のapplyは独立した1回として記録し、tool内post-checkの成功を確認する。その後、独立processのdry-runでcleanを確認する。失敗時に盲目的な再試行をせず、現在状態を再取得・再計画して固有契約に従う。同一目的の確認を回数だけで反復せず、quiet periodや一貫性確認など別の証拠目的を持つ固有checkは省略しない。
7. UI影響がある場合だけ主要画面を確認し、remote状態とerror logはreleaseで影響したserviceに限定して確認する。件数、digest、operation状態、各commandの結果とexit statusを記録する。
8. 計画差分、未知状態、部分失敗、証拠不一致があれば、推測deleteや自動rollbackを行わない。現在状態を再読込して計画を作り直し、承認範囲が変わる場合は停止する。

個別migrationで承認されたmaintenance、backup、外部確認、rollbackの例外は、そのmigration固有の証拠と判断にだけ適用する。別の小規模migrationへ継承しない。

## 記録の置き場所

- この索引と個別runbookには、再利用可能な実行順序、停止条件、rollback、証拠へのリンクだけを置く。
- 特定日の件数、digest、commit、test結果、受入れ結果は、既存のverification receipt、roadmap、implementation、CHANGELOGのうち役割に合う正本へ記録する。
- 完了済みmigrationの結果をrunbookへ複写しない。過去の実行に専用receiptがない場合も、既存記録をリンクし、事後的にimmutable receiptを作ったように扱わない。
