# FGA-04 Employee Manager・通常保存 Local検証記録

- 対象: `FGA-04-EMPLOYEE-MANAGER-LWW-02`の最初のLocal実装
- 判定: Local実装・必須自動検証は合格。checkpoint全体は未完了
- 測定日: 2026-09-12（Asia/Tokyo）

## 確認した範囲

- 在職一覧の新規作成を複数形Employee Managerへ接続した。
- 詳細の基本・国籍・警備員情報を単数Employee Managerと専用CustomInputへ接続した。
- 資格と3保険の画面から専用Callable、最新値比較、競合拒否、role制限を外し、Employee modelの通常更新へ接続した。
- 保険の加入・喪失等の状態遷移条件と入力検査は維持した。
- 通常保存はEmployee modelの`create`／`update`を使い、document単位のlast-write-winsとした。
- 通常Employeeの一覧・詳細・Firestore Rulesは、同一tenantの有効な本登録Userへrole非依存で許可した。
- 退職後の通常更新、client delete、archive、退職・誤退職訂正、User/Authの既存専用境界を維持した。
- 公開schema packageに含まれない既存`insuranceOperationVersions`を全文保存で落とさないlocal schema互換層を追加した。新規作成時だけ3種を0で初期化し、fieldがない既存documentは読込みだけで補完しない。
- 現行画面から到達しない旧通常保存Callable `createEmployee`、`updateEmployeeBasic`、`updateEmployeeNationality`、`updateEmployeeSecurity`、`updateEmployeeCertifications`、`transitionEmployeeInsurance`と、その専用API・保存module・旧EditorをLocal sourceから撤去した。Employee archive、退職・再雇用、Employee連携User作成は維持した。

## 検証結果

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| 対象schema互換 | `node --test test/domain/employee-schema-compatibility.test.mjs` | 4件合格 | 0 |
| 対象Employee UI・認可 | 対象4 domain test file | 38件合格 | 0 |
| Employee reader | `node --test test/domain/employee-reader.test.mjs` | 23件合格 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,550件合格 | 0 |
| 対象Rules | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "FGA04 normal Employee"` | 1件合格 | 0 |
| local-emulator-suite | `npm run test:local` | 182件合格 | 0 |
| application build | `npm run build` | client・server build合格 | 0 |
| local-ui-build | `npm run test:local:ui:build` | 固定commit `86b8a1c3`の専用Local UI build合格 | 0 |

Local Emulatorは`demo-air-guard-v2-codex`、loopback限定、合成dataだけで実行した。利用者保存dataは変更せず、専用seedはread-onlyだった。

## 旧Callable撤去後の再検証

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| 撤去対象・関連画面 | `node --test test/domain/codex-functions-entrypoint.test.mjs test/domain/employee-archive.test.mjs test/domain/employee-editor.test.mjs test/domain/employee-ui-source-contract.test.mjs test/domain/employee-ui-restoration.test.mjs` | 65件合格 | 0 |
| 対象Emulator | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "EMP05-D HTTP archive\|FGA04 normal Employee"` | 2件合格 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,466件合格 | 0 |
| local-emulator-suite | `npm run test:local` | 178件合格 | 0 |

最初の対象Emulator実行は、アーカイブ後の再作成拒否fixtureへAdmin SDKのTimestampをClient SDKの`setDoc`で渡したため1件失敗した。製品処理ではなくtest data形式を最小の有効なEmployee create入力へ修正し、対象2件と全Emulator 178件を再実行して成功した。

## 未実施・残作業

- Dev上に既に存在する旧通常保存Function 6件の削除は未実施である。新Hostingと同じrelease sourceへ揃える反映順、正確な削除対象、復旧方法を提示して別承認を得る必要がある。
- Dev・Prod反映、remote data操作、既存dataの一括変換は行っていない。
- Devでの見た目・使用感の確認は未実施である。

## Rollback

このLocal実装を固定するcommit単位でrevertする。旧FunctionをDevから削除する前ならLocal sourceを戻すだけでよい。削除後は、この撤去前commitの6 exportを復元して同じ6 Functionを再反映する。data migrationを行わないためdata rollbackは不要である。
