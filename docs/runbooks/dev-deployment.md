# Dev環境deploy runbook

- 状態: Confirmed
- 最終確認日: 2026-09-09
- 役割: `air-guard-v2-dev`へのbuild、deploy、remote検証に共通する手順と、個別手順・判断・証拠への索引
- 対象外: Prod、新しいdata migration、破壊的repair、未承認service・dataへの拡張
- 関連判断: [ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md)、[ADR 0062](../decisions/0062-risk-based-environment-verification.md)、[ADR 0063](../decisions/0063-github-actions-dev-deployment.md)

## 目的と適用境界

Devは、固定commitの製品を実際のFirebase設定・認証・権限・通信・対象dataと結合して確認する非本番試行環境である。製品変更の最終受入れは、承認済みrelease checkpointに固定した画面・actor・service・data経路のDev検証で行う。Codex専用Localと利用者環境LocalはDev前の手戻り抑制用であり、両方またはいずれかを一律の前提にしない。

この文書にはreleaseごとに共通する順序だけを置く。個別機能、Windows固有環境、data migration、過去の実行結果は下表から参照し、ここへ複写しない。

## 手順・記録の索引

| 目的 | 参照先 | 適用条件 |
|---|---|---|
| GitHub Actionsの設定・実行・復旧 | [GitHub Actions Dev deploy](dev-deployment/github-actions.md) | 標準のDev releaseで読む |
| local Firebase CLIとWindowsのtrust | [Dev deployの認証とWindows環境](dev-deployment/authentication-and-windows.md) | Actions障害時に承認されたlocal fallbackを使う場合だけ読む |
| service別のremote検証 | [Dev remote検証](dev-deployment/remote-verification.md) | release対象serviceと受入れ経路に該当する節だけ読む |
| Customer保存形式の事前検査 | [Customer互換性検査](dev-deployment/customer-compatibility.md) | project rulesの3条件に該当し、検査が必要な場合だけ読む |
| data migration | [Data Migration Runbook](data-migrations.md) | data変換が必要なreleaseだけ読む |
| maintenance、snapshot、repair、restore | [Maintenance・Data Change Runbook](maintenance-and-data-change.md) | 互換性、writer、復旧条件から必要と判断した場合だけ読む |
| UWB初回cutover | [ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md)、[User予約migration](data-migrations/user-reservations.md) | 当該migrationの再実行または履歴照合時だけ読む |
| legacy Stripe cleanup | [Stripe migration](data-migrations/company-legacy-stripe.md)、[STRIPE-05 receipt](../verification/stripe-05-dev-release.md) | 当該cleanupの再実行または履歴照合時だけ読む |
| 過去のDev実行結果 | [検証証拠索引](../verification/README.md) | 実行日、commit、件数、結果を照合する場合に読む |

## 1. Releaseを固定する

remote接続前に、次を独立commandで確認する。

```powershell
Get-Location
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
git worktree list --porcelain
```

push前のrelease checkpointへ次を記録する。

```text
release-id:
release-commit:
firebase-project: air-guard-v2-dev
operator: github-actions
credential-route: workload-identity-federation
services:
release-class:
data-impact:
local-validation:
build-command:
backup:
rollback:
stop-conditions:
remote-verification:
maintenance-required:
approved-migration-or-repair:
```

worktreeがdirty、HEAD不一致、primary repository以外のworktree、対象project・service・data影響が未確定の場合は停止する。未commit scriptや別commitのartifactをreleaseに使わない。標準経路では、この確認済みcommitの`main` push承認が、変更fileから自動選択されたserviceのDev deploy承認を兼ねる。

既存Dev documentの状態確認・migration要否は[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)で判断する。非該当を示すためだけの全件走査や一括修復は行わず、必要なfieldと利用経路に絞る。

## 2. Releaseを分類する

| Release class | 必須preflight | 標準deploy順 | maintenance・backup |
|---|---|---|---|
| client / Hostingのみ | client test、`generate:dev`、artifact identity | Hosting | 通常不要。server contract非互換やdata影響があれば再分類 |
| Functionsのみ | syntax、対象Functions test、config・runtime確認 | Functions | 通常不要。既存dataを一括処理する場合は再分類 |
| Rules・Indexesを含むserver境界 | Rules test、index/config検査、影響するclient確認 | Rules・Indexesと必要Functionsを整合単位でdeploy | 継続互換なら通常不要。write contract変更時は個別判断 |
| client / server contract同時変更 | client build、server test、旧新client互換性 | server、remote確認、同一artifactのclient | 非互換期間があればmaintenance。data影響に応じてsnapshot |
| data migrationを含む | 固有dry-run、plan、digest、復旧、post-check | server、fresh dry-run、apply、再dry-run、client | 個別migrationの契約に従う |
| 破壊的repair | exact対象、事前事後証拠、復旧、dry-run相当 | 承認された限定repairだけ | 別の明示承認が必要 |

複数classに該当する場合は、必要なgateを合算し、最も強いdata・互換性境界を採用する。maintenanceはclient route制御であり、Rules、Functions、Admin SDK、scheduled処理、開始済みwriteを排他しない。

## 3. Remote変更前preflightを行う

次がすべて成功するまでdeploy、maintenance、snapshot、migration、remote data変更を開始しない。

1. repository、branch、release commit、clean、primary-only worktreeを固定する。
2. Dev project、release class、対象service、data影響、backup、rollback、停止条件、検証を固定する。
3. 標準経路は[GitHub Actions手順](dev-deployment/github-actions.md)の専用service accountと鍵なし認証に固定する。local fallbackだけ[Windows認証手順](dev-deployment/authentication-and-windows.md)を読む。
4. workflowが固定したFirebase CLI version、Dev project、対象service、GitHub Environment設定を確認する。remote変更直前の認証とdry-runはActions内で行う。
5. gcloudを使うreleaseだけ、gcloudのtrust・token refresh・Dev projectへのread-only到達を独立確認する。
6. 対象serviceの構文検査、validator、test、config検査を独立実行する。
7. Hostingを含む場合、GitHub `dev` Environmentの暗号化設定を使い、Actions内で`npm run generate:dev`を独立実行する。
8. artifactのsource SHA、Dev project、Emulator無効、必要fileをActions logで確認する。
9. checkpointの承認範囲と現在状態を再照合する。

`firebase login`済みであることを標準releaseの前提にしない。Actions認証に失敗した場合、利用者account、保存済み鍵、gcloud・RESTへ自動で切り替えず停止する。

Dev server、Local browser検証、Codex専用UI buildはHosting release artifactの代替ではない。deploy対象と同じbuild commandをremote変更前に完了させる。

## 4. `main`へpushして対象を限定deployする

- push直前に対象commit、変更file、予想service、data影響、rollback、remote検証を提示し、`main` pushの明示承認を得る。
- `.github/workflows/dev-deploy.yml`はpush差分を`scripts/select-dev-deploy-targets.mjs`へ渡し、Hosting、Functions、Firestore、Storage、Realtime Databaseのうち影響対象だけを選ぶ。文書・governance・test・workflowだけの変更はdeployしない。
- workflowはGitHub `dev` Environment、鍵なし認証、固定Firebase CLIを使い、`--project`と`--only`を明示してdry-run後に実deployする。
- Hostingを含む場合は同じjobで依存関係を固定installし、Dev設定で生成した`dist/`をdeployする。Functionsを含む場合はFunctions依存関係も固定installする。
- client/server同時変更は、旧clientが残ってもserverが最終認可を維持できる互換性をpush前に確認する。workflowが一括deployする順序では安全でない場合、標準経路を使わず個別releaseを計画する。
- 手動dispatchは初回検証、障害からの限定再試行、明示されたserviceの再deployだけに使い、commitとserviceごとの別承認を得る。

data migrationのdry-run・apply・post-checkはここへ追加せず、[共通migration手順](data-migrations.md#小規模dev-migrationの共通手順)と個別migration手順に従う。

## 5. Devで検証する

deploy後は、[Dev remote検証](dev-deployment/remote-verification.md)から今回の変更が影響するservice・actor・data経路だけを選ぶ。Dev受入れが保証するのはcheckpointに固定した範囲だけであり、Prod、未確認経路、全利用者・全dataへ一般化しない。

必要なremote確認が失敗または未実施の場合は完了としない。原因に対応する自動検証またはLocalへ戻って修正し、新しい固定commitを再deployして対象範囲を確認する。

## 停止とrollback

- preflight失敗: remote変更を開始せず停止する。
- deploy開始後の失敗: 成功済みservice、失敗service、remote revision、data変更有無を確認し、限定再試行の可否を判断する。
- maintenance中の必須check失敗: maintenanceを維持し、corrective releaseまたは承認済みrepairを使う。
- migration部分失敗: 推測deleteや自動rollbackをせず、現在状態を再取得して再計画する。
- code・artifact rollback: Git上の既知の正常commitから同じ環境設定で再生成する。
- data contract変更後: codeだけを戻して安全かを確認し、追加documentや外部状態を別に扱う。

Prod、main merge、history rewrite、credential変更、persistent CA・gcloud設定、実data削除は本runbookの承認に含まれない。`main` pushの承認範囲だけはproject rulesに従い、自動選択されたDev deployを含む。

## 証拠と完了報告

完了報告にはrelease ID、commit、project、service、release class、data影響、backup、各commandとexit status、remote operation・revision、maintenance状態、artifact identity、選択したremote検証、受入れ範囲、未確認事項、rollback状態、Git/worktree状態を含める。Codex専用Local・利用者環境Localを実施した場合は各証明事項を、実施しなかった場合は選択理由を記録する。秘密情報、実account、個人・顧客・勤怠・請求data、token、raw runtime configは含めない。
