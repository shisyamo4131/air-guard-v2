# FGA-06 稼働実績client物理削除 Local検証記録

## 対象

- checkpoint: `FGA-06-RESULT-DELETE-CLIENT-06`
- 固定製品commit: `07511fb3a0fb33e83f6bb3af30b49453b9c5ca22`
- branch: `codex/fga-06-operation-result-delete`
- 検証日: 2026-09-14
- change class: `ui-css-layout`、`application-logic`、`data-contract-schema-migration`

## 実装した境界

- 稼働実績詳細の既存削除dialogを`OperationResultManager`へ接続し、`OperationResult.delete()`／FireModel ClientAdapterのclient deleteへ移した。表示ボタン、確認dialog、文言、詳細画面の配置は変更していない。
- Rulesは同一tenantの有効な本登録User、document ID一致、既存の非lock状態を要求する。create、locked result、仮登録・無効User、User不在、他tenantは拒否する。
- `saveOperation`は実績`delete` commandを入力段階で拒否する。現場稼働予定deleteは別checkpointのためCallableを維持する。
- OperationResult削除後の請求、日次勤怠、勤務回数実績、現場従業員履歴、予定・日報の連携は既存Trigger・cleanupへ維持し、Trigger実装自体は変更していない。
- schema変更、data migration、既存data一括変更、archive追加はない。

## 実行結果

| command | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/operation-editor.test.mjs test/domain/operation-write.test.mjs test/domain/firestore-rules-reservation-source-contract.test.mjs` | 78/78 pass | 0 |
| `node --test test/domain/*.test.mjs` | 固定製品sourceで1454/1454 pass | 0 |
| `npm run test:local` | 180/180 pass。Codex専用demo project、loopback、合成data。勤務者10名を含むOperationResultのclient削除を含む | 0 |
| `npm run test:local:ui:build` | 固定製品commit `07511fb3`のclient／server build成功 | 0 |
| `git diff --check` | 製品commit前の差分にerrorなし | 0 |

最初のLocal Emulator実行は、旧Callable deleteを前提とした2件の既存testが失敗した。期待値と試験経路を新しいclient境界へ更新した後、最終実行180件を終了コード0で確認した。最初のUI buildはsandbox内のWindows `readlink`拒否でserver buildが停止したが、同一固定commitを権限昇格して再実行し、client／server buildを終了コード0で確認した。

## Security Rules監査

```json
{
  "score": 5,
  "summary": "OperationResults delete is limited to an active registered user in the same tenant and an existing unlocked document whose stored ID matches the path.",
  "findings": []
}
```

今回変更したOperationResults delete境界を監査した。認証identityは検証済みclaimと同一tenantの有効な本登録User documentから導出され、他tenant、仮登録、無効User、User不在を拒否する。削除対象はpathと保存済み`docId`の一致および`isLocked == false`を必須とする。role非依存は現行仕様のtenant信頼境界であり、意図しない権限拡大とは判定しない。

## 未実施・残存risk

- Dev／Prod反映、remote／実data読取り、browser UI操作、見た目の目視比較、remote Trigger logと派生document全件の収束確認は未実施。
- 勤務者行がある旧Callable削除で発生した汎用errorの内部原因は個別に切り分けていない。新しいclient経路では同条件に相当する勤務者10名の削除が成功した。
- Trigger実装は変更していない。関連moduleの削除処理は全domain testに含まれるが、Dev受入れでは合成実績の削除後に必要な関連dataの収束を確認する。
- applicationを介さない同一tenantの有効な本登録Userも、非lock実績を削除できる。これは確定済みの通常業務・transaction物理削除境界であり、画面到達後の特別なrole制御を追加しない。

## Rollback

固定製品commit `07511fb3`をrevertし、Firestore Rules、Functions、Hostingを直前の固定releaseへ戻す。schema変更とmigrationがないためdata変換は不要である。rollback実行と環境操作は別承認を要する。
