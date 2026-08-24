# Test / development routes

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-057
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/test/*.vue`、`utils/pageSettings.js`、`middleware/auth.global.js`、`nuxt.config.js`、`firestore.rules`
- 制約: runtime、外部環境、実data、各composable/trigger内部は未確認。

## route一覧・production到達性

| route | page設定 / guard | 直接作用 | 分類候補 |
| --- | --- | --- | --- |
| `/test/component-test` | `developer`、navigation表示 | 固定3 Employee IDをFirestoreから取得しclient cacheをclearする。writeなし | 開発診断。固定IDを除去し、production除外または隔離候補 |
| `/test/permissions-test` | `developer`、default layout | 現在UserのUID、email、role、permissionを表示。writeなし | authorization診断。production除外または厳格隔離候補 |
| `/test/rollback-operation-result` | `developer`、navigation表示 | 同一company内OperationResultをdelete後、同じdocIdのSiteOperationScheduleをupdate | 破壊的保守。現状のpage直書きは廃止し、監査付きserver処理へ移行候補 |
| `/test/round-setting-test` | `developer`、navigation表示 | browser内testとprocess-globalな`RoundSetting` mode変更。Firestore writeなし | 開発test。自動testへ移しproduction除外候補 |
| `/test/user-permission-info` | pageSettings未登録。global middlewareは設定なし実在pageを許可 | `/permissions-test`と同一内容を表示。writeなし | 重複・設定漏れ候補。削除または登録判断が必要 |

Nuxtのfile-based routingにより5 pageはいずれもroute候補になる。`nuxt.config.js`にはenvironment別page除外、route pruning、production-only guardがないため、production buildにも含まれる候補である。実build artifactは生成していない。

## guardとserver enforcement

- 登録済み4 routeはclient `pageSettings`の`DEVELOPER` access policyだけで入口を制限する。これはserver authorizationではない。
- `/test/user-permission-info`は明示設定がなく、`getPageConfig`が`/`の`PUBLIC` policyへfallbackする。未認証Userは到達でき、メール確認・会社claim確立済みの認証Userは公開page扱いでdashboardへredirectされる。未確認または会社未確立Userは専用分岐で`/unconfirmedEmail`へredirectされる。
- permission表示2 pageはlocal store情報だけを読む。UID/email/role/permissionは個人・認可情報であり、画面到達者へそのまま表示する。
- Employee取得はFirestore Rulesが実際のtenant read境界となる。固定IDはtenantや環境に適合する保証がない。
- rollbackはclientからFirestoreへ直接delete/updateするため、実際の許可はRulesの同一company認証境界に依存する。`developer` roleはRulesで強制されず、直接API利用を防がない。

## 操作・失敗境界

`component-test`はrunning中の再実行を抑止し、各case errorを結果へ表示する。固定ID取得によりFirestore readが発生し、cache resetはlocal作用である。

permission 2 pageは操作buttonや外部作用を持たず、現在storeの派生値を表示する。両fileは実質同一で、片方だけpageSettingsに存在しない。

rollback pageはdoc ID入力、fetch/subscribe、不可逆確認dialog、loading中button disable、error表示を持つ。ただし次の順次処理でtransaction/batchではない。

1. `Companies/{companyId}/OperationResults/{docId}`をdeleteする。
2. `Companies/{companyId}/SiteOperationSchedules/{docId}`の`operationResultId`をnullへupdateする。

第1段階後に第2段階が失敗するとOperationResultだけが削除された部分状態になる。Schedule doc IDをOperationResult doc IDと同一と仮定し、OperationResult内scheduleIdを使わない。削除triggerの派生cleanupと独立に直接schedule更新するため、競合・重複cleanup候補でもある。confirm後のserver-side reason/audit、idempotency、precondition、復旧入口はない。

round-setting pageはlocal instanceのvalidation/clone等を実行する一方、static `RoundSetting` modeも切り替える。process-global設定を共有する同一tabの後続計算へ影響し得る。自動test runnerではなく、結果は画面内だけである。

## 矛盾・未使用候補

- `permissions-test.vue`と`user-permission-info.vue`は同一実装で、後者はpageSettings未登録である。
- module navigationには4 childrenしかなく、`user-permission-info`はnavigationから未到達である。
- rollbackのSchedule pathはdoc ID同一性を仮定し、現在のOperationResult生成契約のoptional `scheduleId`と一致しない候補である。
- `developer` routeは名称上test/dev専用だが、production bundle除外契約がない。

## 将来要対応・要確認事項

- FUT-0001: 未設定実在pageを専用errorにする承認済み方針へ`user-permission-info`を含める。
- FUT-0160: RoundSetting test routeをproductionから隔離する。
- FUT-0164: test/dev route surfaceをbuild、server authorization、監査の共通方針で閉じる。
- CONF-0136: test/dev routeの正式な保持・production除外・operator経路を決定する。

## 未確認範囲

- production build artifact、Hosting rewrite、実deploy時のroute到達性。
- 実role付与状況、実data、Rules emulator、各操作のruntime結果。
- `useFetchEmployee`内部query、OperationResult削除trigger全体は既存文書を参照し再調査していない。
- rollbackの正式な業務用途、利用履歴、復旧手順。
