# FGA-05 Outsourcer Manager・通常保存 Local検証記録

- 対象: `FGA-05-OUTSOURCER-MANAGER-LWW-01`のLocal実装
- 判定: Local実装・必須自動検証は合格。checkpoint全体はDev受入れ前のため未完了
- 測定日: 2026-09-12（Asia/Tokyo）

## 確認した範囲

- 単数`OutsourcerManager`を`AirItemManager`、複数形`OutsourcersManager`を`AirArrayManager`へ接続した。
- 単数ManagerはOutsourcer instance、複数形Managerは全要素がOutsourcer instanceの配列であることを検査する。
- 通常CREATE・UPDATEはOutsourcer modelの標準`create()`／`update()`を使い、document単位last-write-winsとした。
- 旧専用作成・編集dialog、role policy、application action、部分transaction writer、同一field競合拒否を撤去した。
- 作成時はstatus入力を出さず、model既定の`ACTIVE`とする。項目、長さ、表示、状態変更、一覧、Autocomplete、配置、通知、実績、請求、帳票、storageの形状は変えていない。
- 一覧とAutocompleteの検索を仕様どおり正規化後1〜40文字へ統一した。
- Rulesは同一tenantの有効な本登録Userへrole非依存でcreate/updateを許可し、actor UID一致を要求する。client deleteとarchive CUD拒否を維持した。

## 検証結果

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| 対象Outsourcer UI・保存契約 | `node --test test/domain/outsourcer-ui-source-contract.test.mjs` | 8件合格 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,448件合格 | 0 |
| local-emulator-suite | `npm run test:local` | 178件合格 | 0 |
| local-ui-build | `npm run test:local:ui:build` | 固定commit `fed8449e`の専用Local UI build合格 | 0 |

Local Emulatorは`demo-air-guard-v2-codex`、loopback限定、合成dataだけで実行した。利用者保存dataは変更せず、専用seedはread-onlyだった。

`npm run test:local:ui:build`の最初の実行は、製品errorではなく「cleanな固定commitだけをbuildする」という事前条件によりexit status 1で停止した。変更をcommit `fed8449e`へ固定した後に同じcommandを再実行し、exit status 0で合格した。Browserslist dataの更新案内、既存のchunk size、sourcemap、Node非推奨警告は出たが、build失敗ではない。

## Security Rules監査

- 維持した境界: 認証済み、email確認済み、同一tenant、同じUIDのUser document、有効、本登録、書込みdataの`uid`が実行者と一致、live delete拒否、archive write拒否。
- roleなし、未知role、会社管理者、通常role、super-user区分は通常Outsourcerのwrite可否に使わない。
- Rulesは通常documentのfield集合・型・長さ・状態・timestampを検査しないため、正規applicationを介さない同一tenant requestによる項目汚染はRules単独では防がない。これはADR 0065で明示的に受け入れた通常master共通riskであり、model validationと正規UIを前提とする。

## 未実施・残作業

- DevへのFirestore Rules・Hosting反映と、Codex専用tenantでの作成・更新・再読込・見た目確認。
- Prod、既存dataの一括変換、Functions、schema packageは対象外で、変更していない。

## Rollback

Local実装commitを一組としてrevertする。data shapeとmigrationは変更していないためdata rollbackは不要である。Dev反映後は同じ旧Rules・Hosting sourceをGitHub Actionsで再反映する。
