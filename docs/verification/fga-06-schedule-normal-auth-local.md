# FGA-06 現場稼働予定の通常C/U/D認可 Local検証記録

- 対象: `FGA-06-SCHEDULE-NORMAL-AUTH-01`のLocal実装
- 判定: Local実装と自動検証は合格。checkpoint全体はFunctionsのDev反映・受入れ前のため未完了
- 測定日: 2026-09-12（Asia/Tokyo）

## 確認した範囲

- 現場稼働予定の作成、複製、基本情報変更、配置作業員変更、表示順変更、削除を、同一tenantの有効な本登録Userへroleに依存せず許可するserver認可へ変更した。
- `saveOperation` Callable、現在のAuth accountとUserの再確認、tenant境界、maintenance拒否、Site revision、関連配置通知の取消し、追加Employee参照、実績化済み予定の変更・削除拒否を維持した。
- 配置通知作成、現場稼働予定から稼働実績への確定、稼働実績、請求のactor条件を変更していない。
- roleなしの合成Userによる作成、更新、複製、削除が成功することを確認した。同じ要求に対象外の通知操作を混ぜた場合は全体が拒否され、許可対象の更新も保存されないことを確認した。
- 無効User、仮登録User、処理中にtenantが変わったidentityは拒否し、書込みが0件となることを確認した。

## 検証結果

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| 対象認可・保存契約 | `node --test test/domain/operation-client-boundary-parity.test.mjs test/domain/operation-write.test.mjs` | 37件合格 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,449件合格 | 0 |
| local-emulator-suite | `npm run test:local` | 179件合格 | 0 |

Local Emulatorは`demo-air-guard-v2-codex`、loopback限定、合成dataだけで実行した。利用者保存dataは変更されず、専用保存dataはread-onlyだった。Functions Emulatorを含むsuiteで`saveOperation`の実経路を確認した。

## 未実施・残作業

- 固定commitのFunctions Dev反映と、同一tenantの通常actorによる現場稼働予定の作成・更新・削除のDev受入れ。
- 画面・route・buttonのrole別表示は変更していないため、今回のLocal UI build対象外とした。
- 既存data、schema、Firestore Rules、migration、Prodは対象外で、変更していない。

## Rollback

Local実装commitを一組としてrevertする。data shape、Rules、migrationは変更していないためdata rollbackは不要である。Dev反映後は旧Functions sourceをGitHub Actionsで再反映する。
