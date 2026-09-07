# Employee EMP-07 独立課題確認記録

- checkpoint: EMP-07
- 実施日: 2026-09-07
- repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/employee-master-roadmap`
- baseline: `d9ebfd113c64570aea90489cc55a07fc7ffb8e33`
- 環境: Local source readとNode domain test。Firestore remote、Dev、Prod、実data、外部providerは使用していない

## 結論

FUT-0075〜0079、0126、0143、0146、0159、0181を、確認済み仕様、EMP-02〜06の実装、現在の到達経路、対象testへ照合した。EMP-08のLocal統合確認を止める未修正の製品問題は確認しなかった。対象なしなら実装を増やさないというEMP-07完了条件に従い、application、Functions、Rules、schema、UI、testは変更しない。

## 分類

| FUT | 現在必要な部分 | EMP-07判定 | 後続 |
|---|---|---|---|
| 0075 | 7actor read、roleなし等の拒否、操作別write、直接CUD拒否 | EMP-02〜06で実装・検証済み | 項目別mask、法的保持・監査は将来判断 |
| 0076 | Employee/User 0/1、専用退職・訂正、cleanup/reconcile、旧削除trigger停止 | 現在経路は実装・回帰済み | Dev既存予約/Auth状態はEMP-09 |
| 0077 | 当日以前の退職、誤退職訂正、User/Auth非復元 | 実装・回帰済み | 将来日退職・実再雇用は新workflow |
| 0078 | 専用archive、12従属、参照競合、認可、同ID拒否 | EMP-05で実装・検証済み | restore・匿名化・物理削除は別工程 |
| 0079 | 任意重複可code、独立表示名カナ、既存候補条件、検索/cache | 採用仕様とEMP-02/05/06が一致 | 新採番・一意性・status変更は不採用 |
| 0126 | 資格・警備情報の操作別保存と直接write拒否 | EMP-02〜05で実装・検証済み | 追加監査制度・項目別閲覧は将来判断 |
| 0143 | 住所変更時だけのgeocode、最新値再確認、安全な失敗処理 | EMP-02で実装・検証済み | provider契約・同意・過去log・他masterは別scope |
| 0146 | Employee archive envelopeとclient直接CUD拒否 | EMP-05で実装・検証済み | retention・hold・匿名化・purge・共通化はEMP外 |
| 0159 | 3保険の専用遷移、競合、結果不明、世代値 | EMP-04で実装・検証済み | 制度別書式・行政連携・全面監査は将来判断 |
| 0181 | Employee到達経路のManager依存廃止 | EMP-06で実装・検証済み | 他master・transactionを含む全Manager改修は別scope |

到達しない`useEmployeesResigned`、legacy `Employee/Manager`、`Employee/ScheduleCalendar`は、現在の製品経路を壊す根拠がなく、削除による価値より回帰範囲が増えるため変更しない。Employee詳細のUser購読開始前に空表示となり得る点はserver側予約・作成policyを迂回せず、今回の実測でdata不整合や操作失敗を確認していないため、未確認の見た目変更を加える根拠にしない。

## 実測

| command | 結果 | exit |
|---|---|---:|
| 下記Employee/ライフサイクル関連17 test fileの`node --test` | 272/272成功 | 0 |
| `node --test test/domain/*.test.mjs` | 1501/1501成功 | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 256 Markdown / 60 ADR / 11 roadmap / 8 TOML | 0 |
| `git diff --check` | 所有差分の空白検査成功 | 0 |

```text
node --test test/domain/employee-archive-editor.test.mjs test/domain/employee-archive.test.mjs test/domain/employee-background-references.test.mjs test/domain/employee-editor.test.mjs test/domain/employee-insurance.test.mjs test/domain/employee-list-session.test.mjs test/domain/employee-reader.test.mjs test/domain/employee-save.test.mjs test/domain/employee-ui-restoration.test.mjs test/domain/employee-ui-source-contract.test.mjs test/domain/employee-user-manager-temporary-deletion.test.mjs test/domain/get-employee-reinstatement-context.test.mjs test/domain/terminate-employee-callable.test.mjs test/domain/terminate-employee.test.mjs test/domain/user-lifecycle-client.test.mjs test/domain/user-lifecycle-policy.test.mjs test/domain/user-lifecycle-ui-policy.test.mjs
```

変更classはproject-guidance-metadataとdocumentation-onlyであり、completion gateはproject-docsとdiff-checkを選択した。製品sourceを変更していないため、project-docs-negative、capacity-regression、managed-governance、local Emulator、UI build、Chrome受入れはpolicy上省略した。domain-fullは分類の直接証拠として追加実行した。Dev/Prod generateはrelease-onlyかつ未承認である。

## 未検証・承認境界

- Dev/Prod、remote、実data、既存予約/Auth不整合、実provider、法令・社内規程は未確認。
- future workflow、restore、匿名化、purge、追加監査、全Manager改修を採用した判断ではない。
- 見た目の変更はなく、現在のChrome操作を必要とする新しい受入れ項目もない。
- rollbackは本checkpointの文書差分をcorrective commitで戻す。旧Manager保存、広域client write、削除triggerを再開しない。
