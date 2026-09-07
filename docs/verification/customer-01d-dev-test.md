# CUSTOMER-01D Dev release・試験記録

- 状態: Customerの会社管理者通常操作・不具合修正・cleanup確認済み / 権限別remote試験未実施
- 実施日: 2026-09-03 JST
- Checkpoint: `CUSTOMER-01D-DEV-TEST-001`
- 計画: [Customer Dev反映・受入れ](../implementation/customer-dev-release.md)
- 初回source: `52de0349b7230d4306bad845a9c93a55c0497a53`

## 初回反映

利用者はDevテスト開始、利用停止なし、専用合成dataの作成と終了時削除、指定既存取引先の編集を承認した。maintenance、migration、全件再走査は行っていない。

対象は`air-guard-v2-dev`、Firestore `(default)`、RulesとHostingだけ。installed Firebase CLI 15.28.1とprocess内`NODE_USE_SYSTEM_CA=1`を使用した。read-only preflightでRulesは記録済み比較元`c3b29c59903928159f0d1c6f2ee3852b6ad7b46c`と一致した。Firestore STANDARD / FIRESTORE_NATIVE / asia-northeast1、PITR有効も確認した。

| 実行 | 結果 | Exit status |
|---|---|---:|
| `npm run generate:dev` | 固定HEAD・cleanから生成成功。一次出力`5ddd4f` | 0 |
| local artifact照合 | 181 files / 24,795,614 bytes、設定・Emulator無効・placeholder不在・参照解決を確認。`1d7466` | 0 |
| installed CLI `deploy --project air-guard-v2-dev --only firestore:rules --non-interactive` | compile・release成功。`4de618` / `db848f` | 0 |
| Rules readback | candidateとの本文一致。`f66d9c` | 0 |
| installed CLI `deploy --project air-guard-v2-dev --only hosting --non-interactive` | 181 files反映成功。`a2527d` / `14183b` | 0 |
| Hosting/Rules metadata readback | 以下revisionを確認。`b6de97` | 0 |
| 公開artifact取得・比較 | index/SWと抽出した26 assets、計28ファイルがHTTP 200かつlocal内容一致。`1321ef` | 0 |

初回artifact tree SHA-256は`27773269fbe91835e18c7856d3438e299de76047c948e3ae41eb12a3179b6dae`。[前回と同じ算出方式](customer-01c-local-preparation.md#artifact-identity)を使用した。local index内参照は27箇所、公開比較は重複を除く抽出asset 26件。indexとSWのcacheは`no-cache, no-store, must-revalidate`、assetsは`public, max-age=31536000, immutable`。

初回Rules ruleset: `53f3d89b-aa2f-4524-8348-9736041e5278`、更新`2026-09-03T01:03:42.732759Z`。Hosting version: `8587e93385568c09`、live release: `1788397461530000`、公開`2026-09-03T01:04:21.530Z`。以前のRules rulesetは`ecd575a6-4621-4482-a78e-ebf32ad8a78a`、Hosting versionは`8278606c098fccef`。旧Rulesへの自動復帰は行わない。

## 初回Chrome試験と不具合

会社管理者としてサインイン済みの利用者Chromeを再読込し、通常のメニュー、文字入力、登録・保存buttonで操作した。内部state・token取得や直接method呼出しは行っていない。

- 合成取引先を、計画の住所・必須名称・略称・カナ・既定支払条件で登録したところ「取引先を登録できませんでした。」が表示された。consoleは固定文言`Customer create failed`で、詳細原因は表示されなかった。
- 利用者指定の既存取引先は備考だけを空欄から確認用文字列へ変更したが「取引先の基本情報を更新できませんでした。」が表示された。取消し後に再読込し、備考は空欄のままと確認した。
- 合成取引先の名称検索は0件だった。新規作成成功・既存更新成功はまだ確認できていない。関連dataはまだ作成していない。
- 指定document IDだけを条件にした補助backend読取りはSDK module解決の初回失敗後、collection-group queryでcode 9となった。会社のpathだけを列挙し、同じ指定document IDを直接取得する経路へ変更したところ、該当1件の26 fields過不足なし、location/geopoint双方あり、備考未変更、同tenantの検証名称0件を確認した（`a04eca` / exit 0）。Customer全件走査・index変更・data更新は行っていない。これはAdminによる状態確認であり、Rulesの正常保存証拠ではない。

local調査で`firestore.rules`のGeoPoint比較が`latitude` / `longitude`というproperty参照だった。公式[Rules LatLng API](https://firebase.google.com/docs/reference/rules/rules.LatLng)は`latitude()` / `longitude()`のmethodを定めている。既存local陽性fixtureはlocation=nullで、この分岐を検証できていなかった。

## 座標比較の修正

`CUSTOMER-01D-DEV-FIX-002`でdeveloperがRulesの2箇所をmethod呼出しへ修正し、`test/local/codex-local-harness.test.mjs`へ座標付きcreate、既存座標への備考・住所更新、緯度/経度不一致のcreate/update拒否を追加した。認可・tenant・field境界を変更せず、data移行も不要。security担当の独立read-only reviewに修正要求なし。

| Command | 結果 | Exit status |
|---|---|---:|
| `npm run test:local -- -TestNamePattern Customer`（test追加・Rules未修正） | 7件中5成功・2失敗。非null create/updateでLatLngをmap/pathとして扱う型エラーを再現 | 1 |
| `npm run test:local`（修正後） | 113/113成功。loopback限定、利用者saved-data不変、専用saved-data読取りのみ | 0 |
| `node --test test/domain/*.test.mjs` | 817/817成功。親の独立実行`baf105`も同じ結果 | 0 |
| `git diff --check` | 空白errorなし | 0 |

Emulator終了後にdeveloperが自分の空runtime directoryだけを除去し、専用portのlistener不在を確認した。Hosting codeは不変のため、初回Hosting versionを保持してRulesだけを更新した。反映結果は次節のとおり。

## 修正後のDev再試験

修正source `ae5abef9b2666266963412812a79125c3271ca94`から同じRules限定deploy commandを実行し、exit 0（`d37739` / `cb7d5a`）。readbackもexit 0（`f7e860`）で候補本文と一致した。rulesetは`bc736891-8433-4753-a732-a3208eb81cac`、更新時刻`2026-09-03T01:18:08.614675Z`。Hosting versionは初回のままであり、再生成・再deployしていない。

- 同じ入力の新規Customer登録が成功し、一覧検索1件・詳細への反映を確認した。
- 合成Customerの名称・住所・備考を更新できた。締日20日、入金月2か月後、入金日25日の保存後に再読込して一致を確認した。
- 指定既存取引先の備考だけを更新し、再読込後の保存を確認した。空欄へ戻して保存し、再読込とAdminの対象限定読取り（`f277e9` / exit 0）で復元を確認した。実対象の名称・住所・支払条件は変更していない。
- 合成Siteを通常UIで作成し、新規Agreementフォームの初期締日20日を確認して保存せず閉じた。
- Site作成後に合成Customerの名称と締日15日を更新し、Site詳細の取引先名同期と、新規Agreementフォームの初期締日15日を確認した。Agreementはまだ保存していない。

## 請求確認の移管とcleanup

利用者の停止指示前に、既存`initBillingDoc`をDevの合成Customer/Siteへ適用し、請求日2026-09-15から期日2026-11-25となることを確認した。実績・入金0件、0円DRAFTのBillingをcreate-onlyで1件作成した（`228e2d` / exit 0）。これはbackendでの限定初期化確認であり、稼働実績からの自動生成・請求書発行の受入れではない。

その後、利用者はCustomer管理フェーズに請求書まで含めるのは過大と指摘し、請求確認を稼働実績管理改修後の請求書発行機能確認へ移管した。直ちに請求試験を停止した。PDF出力、稼働実績、従業員・勤怠・入金data、取極め保存は実施していない。フェーズ着手前にテスト範囲を利用者と合意する運用をproject rulesへ反映する。

今回作成したexact3件を、名称・関係・DRAFT/空実績・空入金、subcollectionなし、参照先の予定/実績/配置通知なし、他の参照Site/Billingなしで照合した。各documentの取得時updateTimeを削除preconditionとして1 batchで削除し、独立readで3件不存在と既存備考復元を確認した（`23b126` / exit 0）。Customer/Siteをarchiveへ移す操作は使っていない。

| 削除した検証用resource | ID |
|---|---|
| Customer | `cxzZh8yNngCyw5t3eOx5` |
| Site | `NM8FRlgJJkwTFaGINCag` |
| Billing | `cxzZh8yNngCyw5t3eOx5_NM8FRlgJJkwTFaGINCag_2026-09-15` |

削除後のChrome名称検索も0件。検索を解除して通常の取引先一覧へ戻し、利用者Chromeを残した。既存指定取引先の備考は復元済み、今回の検証data残存は0件。

## 未完了と次工程

正常create/basic/payment、既存指定対象の保存・復元、関連Site同期・新規Agreement初期締日は上述の範囲で確認した。請求期日・PDFの機能受入れは後続へ移管した。閲覧専用actor、他社・権限不足・delete/archiveの主要remote拒否は、今回利用した会社管理者sessionでは確認していない。Adminによる補助読取り・cleanupをRules拒否の証拠にしない。113件のlocal Emulator成功とremote未実施を区別し、Customer全体の全actor受入れ完了とは記録しない。

Rules修正後のdomain・local Emulator証拠を上記へ記録した。続くproject ruleと文書変更はgovernance classとしてcomprehensive gateを選び、各結果・exit statusはcoordinatorの最終command報告とcurrent handoffへ記録する。製品codeはその後不変のためdomain・Emulatorを再反復しない。Hosting codeが変わらないRules限定修正では、初回Hosting artifactを別HEADの生成物として扱わない。製品要件・schema・data lifecycleは変更していないため、製品仕様version・data contract・新規ADRは追加しない。既存のフェーズ承認運用を明確化するproject ruleと実行計画を正本とする。
