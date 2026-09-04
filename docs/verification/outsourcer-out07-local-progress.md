# Outsourcer OUT-07 local統合確認の進行記録

- 記録日: 2026-09-05
- 対象commit: `fbe05445d78034baf8ba6282b8c13a4947602a08`
- 状態: In progress。権限別UIの拒否actor確認が未完了のため、OUT-07を完了扱いせず進捗は80%のままとする。
- 対象環境: Codex専用demo project `demo-air-guard-v2-codex`、loopback、合成data、外部作用deny

## 成功した確認

| Gate | Command | 結果 | Exit |
|---|---|---|---:|
| Outsourcer対象回帰 | `node --test test/domain/outsourcer-mutation-policy.test.mjs test/domain/outsourcer-operations.test.mjs test/domain/outsourcer-ui-source-contract.test.mjs test/domain/outsourcer-list-pagination.test.mjs test/domain/outsourcer-duplicate-placement.test.mjs` | 48/48成功 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 961/961成功 | 0 |
| local-emulator-suite | `npm run test:local` | 147/147成功。Auth、Firestore、Realtime Database、Storage、Functions Emulatorをloopbackで起動し、外部作用をdenyした | 0 |
| local-ui-build | `npm run test:local:ui:build` | Nuxt/Nitro buildと専用build identity検証が成功 | 0 |

- write actorのlocal UIで、Outsourcer一覧、合成data作成、入力validation、名称prefix検索、名称更新、`ACTIVE`から`TERMINATED`を経て`ACTIVE`へ戻す状態変更、delete・archive入口不在を確認した。
- UI後のread-only backend assertionでlive document 1件、exact 11 field、更新後名称、`ACTIVE`、archive 0件を確認した。未認証REST queryはRulesで拒否された。
- 最終browser consoleはerror 0件だった。配置画面到達時に既存deprecated API warning 1件を観測したが、transaction系の改修へ広げず本記録に留める。
- UI用snapshotに稼働予定が0件だったため重複配置2行の実UI操作は未実施である。削除後非再採番、再追加、並べ替え、通知identity、OperationResultへの1対1変換は対象domain回帰で確認した。
- 各実行後にCodex起動のtab、server、Emulator、今回のbuild生成物をcleanupし、専用seedと利用者用saved-dataの指紋不変、専用port閉鎖、tracked worktree cleanを確認した。

## 未完了と停止理由

- 保存済みUI snapshotにはcompany-adminの合成actor 1件だけがあり、代表的なread-only actorはない。write actorの実browser確認は成功したが、拒否actorの実browser確認は未完了である。
- 稼働中Emulator内だけで合成Userを`controller`へ一時変更する準備は可能だが、browser sessionが失われた再試行では製品topのsign-in画面で停止した。
- ADR 0021の一時random password方式を検討したが、terminal側のAuth Emulator setupとbrowser操作の隔離runtime間に、passwordをtool出力、prompt、file、clipboard、DOM、URL、logへ出さずに渡せる確認済み経路がない。安全境界を迂回せず、Auth変更、role変更、sign-inを行わなかった。
- 続行には、利用者または確認済みhelperによる事前確立済みの専用IAB合成sessionを用意するか、実browser拒否actorをdomain source contractとlocal Emulator Rules陰性で代替する完了条件変更について利用者の明示判断が必要である。

## 範囲とcleanup

- 製品code、Rules、Functions、schema、package、配置・通知・実績等のFirestore更新経路、migration、Dev・Prod・remote・実dataは変更していない。
- 失敗した再試行でもbrowser tab、server、Emulatorを停止し、専用port閉鎖、saved-data指紋不変、build生成物削除を確認した。
- rollback対象となる製品変更はない。本記録を取り消す場合は記録commitだけを通常のrevert commitで戻し、OUT-01からOUT-06の実装・契約を戻さない。
