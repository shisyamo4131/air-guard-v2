# FGA-04 Employee Manager・通常保存 Local検証記録

- 対象: `FGA-04-EMPLOYEE-MANAGER-LWW-02`の最初のLocal実装
- 判定: Local実装・必須自動検証は合格。checkpoint全体は未完了
- 測定日: 2026-09-12（Asia/Tokyo）

## 確認した範囲

- 在職一覧の新規作成を複数形Employee Managerへ接続した。
- 詳細の基本・国籍・警備員情報を単数Employee Managerと専用CustomInputへ接続した。
- 通常保存はEmployee modelの`create`／`update`を使い、document単位のlast-write-winsとした。
- 通常Employeeの一覧・詳細・Firestore Rulesは、同一tenantの有効な本登録Userへrole非依存で許可した。
- 退職後の通常更新、client delete、archive、退職・誤退職訂正、User/Authの既存専用境界を維持した。
- 公開schema packageに含まれない既存`insuranceOperationVersions`を全文保存で落とさないlocal schema互換層を追加した。新規作成時だけ3種を0で初期化し、fieldがない既存documentは読込みだけで補完しない。

## 検証結果

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| 対象schema互換 | `node --test test/domain/employee-schema-compatibility.test.mjs` | 4件合格 | 0 |
| 対象Employee UI・認可 | 対象4 domain test file | 38件合格 | 0 |
| Employee reader | `node --test test/domain/employee-reader.test.mjs` | 23件合格 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,555件合格 | 0 |
| 対象Rules | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "FGA04 normal Employee"` | 1件合格 | 0 |
| local-emulator-suite | `npm run test:local` | 182件合格 | 0 |
| application build | `npm run build` | client・server build合格 | 0 |

Local Emulatorは`demo-air-guard-v2-codex`、loopback限定、合成dataだけで実行した。利用者保存dataは変更せず、専用seedはread-onlyだった。

## 未実施・残作業

- 資格と3保険の画面は、旧専用保存とrole制限のままである。保険を秘密情報として制限せず、加入・喪失等の状態遷移条件だけを残す整理が必要である。
- Dev・Prod反映、remote data操作、既存dataの一括変換は行っていない。
- Devでの見た目・使用感の確認は未実施である。
- `local-ui-build`は必須gateではなく、commit前はclean worktree要件を満たさないため未実施。固定commit後に実行する。

## Rollback

このLocal実装を固定するcommit単位でrevertする。data migrationとremote writeを行っていないため、Local sourceとRulesを戻す以外のdata rollbackは不要である。
