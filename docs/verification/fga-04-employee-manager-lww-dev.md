# FGA-04 Employee Manager・document LWW Dev反映記録

- Checkpoint: `FGA-04-EMPLOYEE-MANAGER-LWW-02`
- 実施日: 2026-09-12（Asia/Tokyo）
- 製品commit: `56694837561afc1b45ca91f988cab251a726f460`
- release commit: `49001e06e150637b7930d7d7d767b3daa3c3e3ea`
- Firebase project: `air-guard-v2-dev`
- 状態: Firestore Rules・Functions・HostingのDev反映完了。認証済み画面の技術smokeと利用者受入れは未実施

## 反映範囲

- 在職Employeeの作成と、基本・国籍・警備員・資格・3保険の通常更新をEmployee modelの標準保存へ揃えた画面をHostingへ反映した。
- 通常Employeeの同一tenant共通権限と、退職後の通常更新・client delete・archive CUDを拒否する境界をFirestore Rulesへ反映した。
- 現行画面から到達しない旧通常保存Function 6件をDevから削除し、残るFunctionsを同じsourceへ揃えた。
- Employee archive、退職・復職、復職情報取得、Employee連携仮User作成、Employee削除triggerは維持した。
- data migration、既存documentの一括変換、IAM変更、Storage、Realtime Database、Prod反映は行っていない。

## GitHub Actions結果

1. [Dev deployment #34660609185](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34660609185)はpushでFirestore・Functions・Hostingを選択し、固定構成、Dev生成、認証、dry-runまで成功した。削除用stepはpushのためスキップされ、通常deploy stepが失敗した。このrunだけでは反映完了と扱わない。
2. 利用者が事前承認した6件だけを削除する一時入力を使い、[Functions限定run #34660779653](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34660779653)を実行した。削除stepと後続Functions deployは成功した。
3. [Firestore限定run #34661007781](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34661007781)はdry-runとdeployに成功した。
4. [Hosting限定run #34661085831](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34661085831)はDev生成、dry-run、deployに成功した。
5. 6件だけを削除する一時workflow入力とstepは、成功後にsourceから撤去した。標準deployへ一括削除の`--force`は追加していない。

## 削除後の確認

固定Firebase CLI 15.29.0でDev Function一覧を再取得した。次の6件はすべて不在だった。

- `createEmployee`
- `updateEmployeeBasic`
- `updateEmployeeNationality`
- `updateEmployeeSecurity`
- `updateEmployeeCertifications`
- `transitionEmployeeInsurance`

次の維持対象はすべて存在した。

- `archiveEmployee`
- `terminateEmployee`
- `reinstateEmployee`
- `getEmployeeReinstatementContext`
- `createEmployeeLinkedTemporaryUser`
- `onEmployeeDeleted`

Dev HostingへのHTTP GETはstatus 200、最終URL一致、`text/html; charset=utf-8`、`no-store, must-revalidate, no-cache`、AirGuard識別子ありで成功した。

## Release前検証

Local実装と旧Callable撤去後のdomain・Emulator検証は[Local検証記録](fga-04-employee-manager-lww-local.md)を正とする。release前に最終sourceで次を追加確認した。

| Gate | 結果 | Exit status |
|---|---|---:|
| `npm run generate:dev` | Dev用静的生成成功 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全異常系fixture成功 | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7件成功 | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| `git diff --check` | errorなし | 0 |

## 未実施と次の受入れ

実行環境に操作可能なChromeまたはin-app browserが接続されていなかったため、Codex専用合成tenantでの認証済みEmployee画面操作は未実施である。次は同tenantだけで、在職一覧、作成、詳細の基本・国籍・警備員・資格・3保険の保存と再読込後表示を確認する。退職、復職、archive、User／Authentication、利用者・実在Employee、別tenant、applicationを介さないrequestは操作しない。見た目・使用感は利用者がDevで確認する。

この画面受入れが終わるまでcheckpoint完了と進捗加点を行わない。

## Rollback

旧6 Functionだけを戻す場合は、撤去前commit `4b79666e21885141c1752b48ad226e7efc96dde5`の6 exportと実装を復元し、同じ6件をDevへ再反映する。FGA-04の画面・Rulesを含めて戻す場合は、Employee製品変更前の既知commit `d283c77b2fc5d8de023de7095c2318e2a629cd08`を基準にrevert内容を作り、Firestore・Functions・Hostingを別承認後に再反映する。data migrationを実施していないためdata rollbackは不要である。
