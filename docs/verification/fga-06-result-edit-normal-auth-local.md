# FGA-06 稼働実績の通常編集認可 Local検証記録

## 対象

- checkpoint: `FGA-06-RESULT-EDIT-NORMAL-AUTH-02`
- baseline: `9242a2a8dafa61d592dabab71f3ad3e10eefa8ae`
- branch: `codex/fga06-result-edit-normal-auth`
- 検証日: 2026-09-12
- change class: `application-logic`、`project-guidance-metadata`

## 検証した境界

- 同じtenantの有効な本登録Userは、role、会社管理者、super-user区分に依存せず、lockされていない既存OperationResultの`overview`と`workers`を保存できる。
- 稼働実績の`create`、`duplicate`、`delete`、`articles`、全`billing`操作、予定の`notify`・`convert`はtenant共通編集へ含めない。
- User不在、disabled、temporary、tenant不一致、transaction内のidentity変化を拒否する。
- clientの`expected`と最新状態が一致しない場合、および保存前にlockされた場合はwrite 0で拒否する。
- 許可操作と拒否操作が同じbatchへ混在した場合はrequest全体をwrite 0で拒否する。
- `saveOperation` Callable、transaction、audit、OperationResult commit後の勤怠・請求・SiteEmployeeHistory等の既存同期経路は変更していない。

## 実行結果

| command | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/operation-write.test.mjs` | 初回は旧permission拒否を期待する1件が、新仕様で認可通過後のlock拒否となり失敗。期待値を`failed-precondition`へ訂正した | 1 |
| `node --test test/domain/operation-write.test.mjs` | 訂正後35/35 pass | 0 |
| `node --test test/domain/operation-client-boundary-parity.test.mjs` | 4/4 pass | 0 |
| `node --test test/domain/operation-write.test.mjs` | security review指摘の回帰test追加後37/37 pass | 0 |
| `node --test test/domain/operation-client-boundary-parity.test.mjs` | security review指摘の回帰test追加後4/4 pass | 0 |
| `node --test test/domain/*.test.mjs` | final worktree stateで1453/1453 pass | 0 |

## 独立security review

認可predicate、parser、Callable identity、tenant、lock、最新状態、batch atomicity、対象外操作をread-onlyで確認し、実装上の権限漏れは検出されなかった。初回reviewで不足していたbillingの同名action、stale expected、保存直前lock、混在batchの陰性testを追加し、直接対象testを再実行した。

## 未実施・対象外

Local Emulator、UI、build、Firestore Rules、schema、data migration、Dev・Prod、remote、実data、deployed Functionは検証していない。今回のcheckpointでは明示的に対象外である。製品挙動を変える変更の最終受入れは固定commitのDev反映・対象範囲のDev受入れ後であり、このLocal記録だけでは完了扱いにしない。

Firestore Dev targetは既存記録でStandard edition / Native modeだが、今回remote freshnessを再確認していない。本変更はedition固有API、query、Rulesへ依存しない。

## Rollback

Functionsのtenant共通result edit判定、対応test、今回更新した仕様・ADR・実装記録・roadmapをbaselineへ戻す。schema・Rules・dataを変更していないためmigrationやdata rollbackは不要である。
