# FGA-04 Employee Manager・document LWW Dev反映記録

- Checkpoint: `FGA-04-EMPLOYEE-MANAGER-LWW-02`
- 実施日: 2026-09-12（Asia/Tokyo）
- 製品commit: `56694837561afc1b45ca91f988cab251a726f460`
- release commit: `49001e06e150637b7930d7d7d767b3daa3c3e3ea`
- Firebase project: `air-guard-v2-dev`
- 状態: Firestore Rules・Functions・HostingのDev反映と、認証済みChromeによる通常操作の受入れ完了

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

## 認証済みChromeによるDev受入れ

利用者の指示でTerra／Mediumの別タスク「テスター（AirGuardV2）-01」を作成し、既存Chromeの管理者sessionとCodex専用合成tenantだけを使うread-only実装担当として検証を委任した。テスターは文書、code、Gitを変更せず、結果をWaitThread方式でcoordinatorへ返した。

1. 在職Employee一覧を表示し、通常UIから合成Employee `FGA04D0926 / 検証花子`を作成した。架空住所を使い、既存のgeocoding経路を通常どおり実行した。
2. 詳細画面で基本情報、国籍、警備員情報、資格、雇用保険、健康保険、厚生年金を順に通常保存し、すべて成功表示と画面反映を確認した。
3. 詳細画面の再読込後、全保存値が再表示されることと、在職一覧へ作成Employeeが表示されることを確認した。
4. 一覧、詳細、各編集dialog、保存完了表示に明確な崩れやerror表示は確認されなかった。

合成EmployeeはUser未連携・在職中のまま残した。退職、復職、archive、User／Authentication、別tenant、applicationを介さないrequest、保険の喪失・復元、geocoding結果そのものは操作・確認していない。これらは今回変更していない専用または対象外経路であり、通常作成・更新の受入れを妨げない。Local自動検証、Dev反映、認証済み通常操作が揃い、指定範囲に追加改修を要する問題はないと判断した。

## Rollback

旧6 Functionだけを戻す場合は、撤去前commit `4b79666e21885141c1752b48ad226e7efc96dde5`の6 exportと実装を復元し、同じ6件をDevへ再反映する。FGA-04の画面・Rulesを含めて戻す場合は、Employee製品変更前の既知commit `d283c77b2fc5d8de023de7095c2318e2a629cd08`を基準にrevert内容を作り、Firestore・Functions・Hostingを別承認後に再反映する。data migrationを実施していないためdata rollbackは不要である。
