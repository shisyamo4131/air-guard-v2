# Outsourcer OUT-07 local統合確認証拠

- 完了日: 2026-09-05
- 検証baseline: `fbe05445d78034baf8ba6282b8c13a4947602a08`
- 対象環境: Codex専用demo project `demo-air-guard-v2-codex`、loopback、合成data、外部作用deny
- 結論: OUT-01からOUT-06で確定したOutsourcer master CRUDのlocal統合確認は成功した。利用者は2026-09-05に、拒否actorの実browser確認を自動UI契約テストと専用EmulatorのRules陰性で代替するOUT-07固有の完了判定を明示承認した。
- 先行記録: 安全な合成session再確立ができず停止した経緯は[進行記録](outsourcer-out07-local-progress.md)を参照する。

## 完了条件と結果

- write actorの実UIでは、Outsourcer一覧、合成data作成、入力validation、名称prefix検索、名称更新、`ACTIVE`から`TERMINATED`を経て`ACTIVE`へ戻す状態変更、delete・archive入口不在を確認した。
- 拒否actorは実browserを未実施とし、同じ未実施を隠さない。代わりにdomain source contractでrole別control契約、local Emulatorでread-only、未知role、他tenant、無効・仮登録、非管理super-user等のRules陰性を確認した。この代替はOUT-07だけの利用者承認であり、一般的なUI受入れ省略規則へ拡張しない。
- UI後のread-only backend assertionでlive document 1件、exact 11 field、更新後名称、`ACTIVE`、archive 0件を確認した。未認証REST queryはRulesで拒否された。
- 同じOutsourcerを同一scheduleへ2明細追加する実UI操作は、UI用snapshotに稼働予定が0件だったため未実施である。削除後非再採番、再追加、並べ替え、通知identity、OperationResultへの1対1変換は対象domain回帰で確認した。

## 検証結果

| Gate | Command | 結果 | Exit |
|---|---|---|---:|
| Outsourcer対象回帰 | `node --test test/domain/outsourcer-mutation-policy.test.mjs test/domain/outsourcer-operations.test.mjs test/domain/outsourcer-ui-source-contract.test.mjs test/domain/outsourcer-list-pagination.test.mjs test/domain/outsourcer-duplicate-placement.test.mjs` | 48/48成功 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 961/961成功 | 0 |
| local-emulator-suite | `npm run test:local` | 147/147成功。Auth、Firestore、Realtime Database、Storage、Functions Emulatorをloopbackで起動し、外部作用をdenyした | 0 |
| local-ui-build | `npm run test:local:ui:build` | Nuxt/Nitro buildと専用build identity検証が成功 | 0 |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | Markdown 236件、ADR 50件、roadmap 9件、TOML 8件の検証成功 | 0 |
| diff-check | `git diff --check` | whitespace errorなし。WindowsのLFからCRLFへの変換warningのみ | 0 |

- 最終browser consoleはerror 0件だった。配置画面到達時に既存deprecated API warning 1件を観測したが、transaction系の改修へ広げず記録に留めた。
- `project-docs`と`diff-check`は本証拠を含む状態で個別に実行し、exit 0を確認した。後続の証拠文言修正後にも両gateを再実行し、最終completion reportでexit statusを独立して報告する。

## 範囲・未確認・cleanup

- 製品code、Rules、Functions、schema、package、配置・通知・実績等のFirestore更新経路、migration、Dev・Prod・remote・実dataは変更していない。
- 完全なbrowser network traceは実行環境のread-only timing API制約により未確認である。専用build identity、loopback endpoint、外部作用deny、browser console error 0件は確認した。
- Dev・Prod、remote Firestore、既存実data、旧client併存、実利用者actorはOUT-08の別承認範囲であり未確認である。
- 各UI実行後にCodex起動のtab、server、Emulator、今回のbuild生成物をcleanupし、専用seedと利用者用saved-dataの指紋不変、専用port閉鎖、tracked worktree cleanを確認した。
- OUT-07は製品変更を追加していないため製品rollbackは不要である。必要時はOUT-07の検証・完了記録commitだけを通常のrevert commitで戻し、OUT-01からOUT-06の実装・契約を戻さない。
