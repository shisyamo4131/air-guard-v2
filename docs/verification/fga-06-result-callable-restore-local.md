# FGA-06 稼働実績Callable復元 Local検証記録

## 対象

- checkpoint: `FGA-06-RESULT-CALLABLE-RESTORE-07`
- 固定製品commit: `5dac8d49f48339011f47fc5b8ab6c43f7312ec6e`
- branch: `codex/fga-06-callable-restoration`
- 検証日: 2026-09-14
- change class: `ui-css-layout`、`application-logic`、`data-contract-schema-migration`、`project-guidance-metadata`

## 実装した境界

- 過去実装を基準に、稼働実績の基本情報を`OperationResultManager`／`AirItemManager`、作業員配列を複数形`WorkersManager`／`AirArrayManager`と親`OperationResult.update()`へ接続した。
- `useOperationResultWriter`、Employee存在確認client transaction、再読込handler、実績`overview`／`workers`／`delete`のCallable入力を撤去した。実績作成・複製、稼働外売上、請求、lock、予定、通知、実績化は維持した。
- Rulesは同一tenantの有効な本登録User、actor UID、document ID、既存の非lock状態、専用operation所有fieldを保護する。通常実績updateではSite／Customerの存在確認を要求しない。
- schema変更、data migration、既存data一括変更、archive追加、Dev・Prod変更はない。

## UI非変更の扱い

- カード、作業員toolbar、従業員／外注先追加、編集／削除button、既存入力、760px dialog、lock表示、稼働外売上一覧、削除dialogの構造と文言を変更していない。
- source contractで標準Manager接続と既存表示controlを確認し、固定製品commitの専用Nuxt client／server buildを完了した。ブラウザ実操作と見た目の最終受入れはDev反映後に行う。

## 実行結果

| command | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/*.test.mjs` | 固定製品sourceで1446/1446 pass | 0 |
| `npm run test:local` | 179/179 pass。Codex専用demo project、loopback、合成data。利用者保存data不変 | 0 |
| `npm run test:local:ui:build` | 固定製品commit `5dac8d49`のclient／server build成功 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 313 Markdown、72 ADR、12 roadmaps、8 TOML pass | 0 |
| `git diff --check` | 製品commit前の差分にerrorなし | 0 |

最初のLocal Emulator実行は、撤去した実績`overview`／`workers` Callableを成功前提とした既存3件が失敗した。旧経路の期待値を削除し、通常updateをclient／Rules経路へ変更した後、最終実行179件を終了コード0で確認した。旧Employee archive対実績worker Callable競合試験を1件撤去したため、総数は従来の180件から179件となった。

最初の専用UI buildはsandbox内のWindows `readlink`拒否でserver buildが停止した。同一固定製品commitを権限昇格して再実行し、client／server buildを終了コード0で確認した。Browserslist data経過、chunk size、sourcemap、Node export mappingの警告は既存build警告であり、build失敗ではない。

## Security Rules監査

認証済みidentity、同一tenantの有効な本登録User、actor UID、pathと保存済み`docId`、非lock状態、create拒否、lock・articles・請求調整・billing version・lifecycle ID等の保護、fallback回避を確認した。未認証、未検証claim、仮登録、無効User、User不在、他tenant、UID偽装、document ID偽装、locked update／delete、保護field変更はLocal Emulatorで拒否された。通常updateのSite／Customer存在確認撤去とrole非依存は確定仕様である。

通常業務fieldの完全なshape、任意field追加、document sizeをRulesで重複検査しないため、applicationを介さない同一tenantの有効Userによる通常fieldのschema汚染余地は残る。これはProd前のtenant信頼境界として受容された既知riskであり、新しい安全保証として扱わない。

## 未実施・残存risk

- Dev／Prod反映、remote／実data読取り、browser UI操作、見た目比較、remote Trigger logと関連data収束は未実施。
- 実績作成・複製、稼働外売上、請求、lock、予定のCallableは今回変更していない。これらが必要かは後続checkpointで操作ごとに判定する。
- `saveOperation`内部にはresult commandを処理できる実装断片が残るが、公開入力、認可、適用の三境界で`overview`／`workers`／`delete`を拒否する。残存内部codeの追加削除は別checkpointで行う。

## Rollback

固定製品commit `5dac8d49`をrevertし、Firestore Rules、Functions、Hostingを直前の固定releaseへ戻す。schema変更とmigrationがないためdata変換は不要である。rollback実行と環境操作は別承認を要する。
