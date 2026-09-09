# GitHub Actions Dev deploy初回検証記録

- 状態: Completed
- 実施日: 2026-09-09
- release ID: GitHub Actions `Dev deployment` #5、run `34315943258`、第2試行
- release commit: `ef1a85dc2e2981cfa18fe4176f7ad318ff416974`
- Firebase project: `air-guard-v2-dev`
- operator: `github-actions-dev-deploy@air-guard-v2-dev.iam.gserviceaccount.com`
- credential route: Workload Identity Federation
- 対象service: Firestore、Storage、Realtime Database、Functions、Hosting
- release class: build / release / deploy

## 目的と境界

GitHub Actions専用service account、GitHub `dev` Environment、Workload Identity Federation、Private AirVuetify3の読み取り専用Deploy keyを使い、利用者PCのFirebase loginやGoogle CloudのJSON秘密鍵に依存せず、固定commitをDevへ全service deployできることを確認した。

data migration、repair、実dataの直接操作、Prod、製品機能の変更は対象外とした。maintenanceとbackupは、data変換・破壊操作を含まず、同じ製品commitとRulesを再deployするため使用していない。rollbackは既知の正常commitを同じActions経路で再deployする方法とした。

## 事前検証

| gate・確認 | 結果 | exit |
|---|---|---:|
| AirVuetify3 package characterization | 8 group、23 test成功 | 0 |
| AirVuetify3 policy negative test | 14 case成功 | 0 |
| AirGuard domain test | 1577件成功 | 0 |
| `npm run generate:dev` | 成功 | 0 |
| project document validator | 成功 | 0 |
| project document negative test | 成功 | 0 |
| capacity regression | 成功 | 0 |
| managed governance | 成功 | 0 |
| diff check | 成功 | 0 |

Codex専用Localと利用者環境Localは実施していない。今回新たに証明する事項はGitHub上の固定source取得、鍵なし認証、Firebase CLI dry-run、実deploy、Dev配信であり、Local環境では代替できない。製品sourceの回帰はdomain testとDev生成で確認済みで、製品機能自体は変更していない。

## Actions実行結果

第1試行は、固定AirVuetify3 source取得、依存install、Dev Hosting生成、Workload Identity認証、Firebase CLI `15.29.0`、全service dry-runまで成功した。実deployでは多数のFunctions更新後、次のscheduled Functionsで`cloudscheduler.jobs.update`が拒否され、exit 2で停止した。Functions削除は実行されなかった。

- `reconcileUserLifecycleOperations`
- `runDailySiteTermination`
- `runDailyTask`

この失敗はremote変更開始後だったため、部分的に更新済みのFunctionsが存在した。利用者の承認後、Actions専用service accountへDev projectのCloud Scheduler Adminを追加した。

同じrun、commit、全service指定で第2試行を行い、対象選択jobとdeploy jobがともに成功した。実deploy commandはdatabase、storage、firestore、functions、hostingを対象とし、`Deploy complete!`を出力してexit 0となった。第1試行で拒否された3つのscheduled Functionsを含むFunctions確認も通過し、権限拒否は再発しなかった。

- [Actions run #5](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34315943258)
- deploy job所要時間: 2分10秒
- workflow全体: 2分15秒

## Dev配信確認

Firebase Consoleで、Hosting site `air-guard-v2-dev`の現在リリースが2026-09-09 14:57 JSTにActions専用service accountから反映され、Hosting release hashが`50dc56`であることを確認した。既定domainは`air-guard-v2-dev.web.app`と`air-guard-v2-dev.firebaseapp.com`である。

| 確認 | 結果 | exit |
|---|---|---:|
| `https://air-guard-v2-dev.web.app/`へのHTTP GET | 200、最終URL一致、`text/html`、AirGuard識別子あり、`no-store, must-revalidate, no-cache` | 0 |
| 新規Chrome tabでDev URLを表示 | `/dashboard`へ到達し、AirGuardのheader、navigation、footerを表示 | 該当なし |

このremote確認は、固定commitのActions経路とHosting配信成立を保証する。製品機能を変更していないため、actor別操作、Rulesの正常・拒否経路、Functionsの業務呼出し、実data内容は再試験しておらず、それらの新しい受入れ証拠にはしない。Firestore Rulesのcompile時にwarningが表示されたが、compileとdeployは成功している。

## 完了時の判断

GitHub Actionsを標準のDev deploy経路として使用できることを、全service指定で確認した。Google Cloud認証には長期JSON秘密鍵を使わない。Private AirVuetify3の取得だけは当該repositoryを読み取るSSH Deploy keyをGitHub `dev` Environmentへ保存する。

Cloud Scheduler AdminはDev project内のScheduler jobを作成・変更・削除できるため、Actions専用service accountと`main`限定のWorkload Identity条件を維持する。Prod、data migration、未確認の製品操作は本記録の保証範囲外である。
