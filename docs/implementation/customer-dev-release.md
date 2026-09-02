# Customer Dev反映・受入れ計画

- 状態: Local preparation / Dev実行は未開始
- checkpoint: `CUSTOMER-01C-LOCAL-PREP-001`
- 更新日: 2026-09-03
- 正本: [仕様](../specification.md)、[既存Dev documentの3条件](../../governance/project-rules.md#dev試用中の既存document)、[Dev runbook](../runbooks/dev-deployment.md)
- 利用者指示: PM-15と既存担当を継続し、Dev環境でのテストに入る直前まで準備する。

## 対象と停止位置

localの影響確認、必要な修正・検証、Dev向け静的生成、手順の固定までを今回の範囲とする。Dev接続、deploy、System maintenance変更、通常のDev CRUD、実dataのmigration・repairはまだ実行しない。

反映案は`air-guard-v2-dev` / Firestore `(default)`の`firestore.rules`とHosting `dist/`。設定根拠は[firebase.json](../../firebase.json)と[Dev runbook](../runbooks/dev-deployment.md)。Functions、Indexes、Storage、Realtime Database、packageの更新は不要である。

local生成物で発見したService WorkerのFirebase設定未注入もHostingへ含める。独立したService Worker buildへ設定変換pluginを渡す修正で、既存の通知処理や権限要求を追加しない。通知送信試験は本計画へ含めない。

比較元は[直前releaseの記録](../verification/stripe-05-dev-release.md)にある`c3b29c59903928159f0d1c6f2ee3852b6ad7b46c`。現在のremote revisionとは未照合であり、rollback先として確定したものではない。Rules差分はCustomerのactor・operation・field境界、delete/archive拒否、fallback除外だけである。ローカルmigration scriptの差分はdeployにも実行にも含めない。

## Data impact

次の判断は記録済みreleaseからのlocal差分と関連経路に基づく。現在、data変換を必要とする具体的な根拠は確定していない。既存の[保存形式検査](../verification/customer-01b-dev-compatibility.md)は未修復の証拠として保持し、全件再診断・ID別一覧・予防修復toolは追加しない。

| 条件 | 確認結果と必要な対処 |
|---|---|
| 1. Schemaの明らかな変更 | Schemaとroot/Functionsのpackage・lockは比較元から不変で、field追加・削除・改名・意味変更はない。ただしRulesのlocation形・formattedAddress長・tokenMapサイズ等の保存条件は強化される。実効的な保存条件も確認対象に含め、既存検査でこれらの形式を確認済みとする。該当理由は0だったため、この条件だけを根拠とする変換は計画しない。既存任意文字列の不適合が解消したとは扱わない |
| 2. 他機能への明確な影響 | 該当。Customer更新は関連Siteの`customer`へ同期される。`cutoffDate`は新規Agreementの初期値、`paymentMonth/paymentDate`は新規Billingの支払期日、名称・住所はPDFへ流れる。対象fieldの意図した値と関連機能の状態確認をDev受入れに必須で残す |
| 3. その他確実に必要 | 該当。既知の形式不適合と変更fieldだけの保存により、未編集fieldが原因の拒否が起こり得る。問題の存在は既存検査で確認済み。通常Dev保存で失敗した場合はそのID・field・操作を確認し、必要な修正を確定する。原因未特定のまま一括補完しない |

下流の根拠は`functions/modules/dependentSync.js`のCustomerからSiteへの同期、`components/Agreements/Manager/index.vue`の新規Agreement初期化、`functions/modules/billings/utils.js`の新規Billing支払期日、`composables/pdf/useBillingPdf.js`のPDF生成。これらのconsumer自体は今回変更していない。既存形式検査は派生値の業務上の正しさ・同期・実表示の受入れ証拠ではないため、条件2を確認済み完了としない。

新規Billingの期日だけが初期化され、Customer変更による既存Billing期日の再計算はない。一方、関連Siteの同期はACTIVE限定ではなく、PDFは固定snapshotではない。Dev試験の更新対象を承認するときは、関連Siteへの自動同期と、過去Billingを再表示したときの名称・住所への影響も含める。

通常の更新は変更したoperation fieldと監査metadataだけを保存する。modelが欠損をdefaultで補って表示できても、未編集fieldの補完がFirestoreへ保存されるとは限らない。更新後のdocument全体がRulesを満たさなければ保存が拒否される。実際に失敗したID・field・操作を絞り、通常画面で修正可能か、処理の修正が必要かを判断する。

## 切替と復旧

旧clientは全体保存・client時刻を使うため、新Rulesとの書込み互換性を前提にできない。短い切替時間を設け、利用者の入力と保留保存を終了し、旧tabを閉じる。maintenanceはclient経路の停止案内であり、server全体の排他lockとして扱わない。

承認後の順序は次のとおり。

1. 固定source commit、clean、artifact identityを確認し、対象Devの現在のRules/Hosting revisionと復旧候補をread-onlyで照合する。記録済み比較元と違う場合は差分を再評価する。
2. 切替対象・停止時間を利用者と固定し、必要なmaintenanceと旧clientの作業終了を確認する。data migrationを伴わないため、migration用の全件scan・dry-run・snapshotは追加しない。
3. installed Firebase CLIで`deploy --project air-guard-v2-dev --only firestore:rules --non-interactive`を実行し、Rules反映を確認する。
4. 同じ承認済みartifactを`deploy --project air-guard-v2-dev --only hosting --non-interactive`で反映する。配信revision、index・Service Worker・参照asset、cache headerを確認する。
5. 新しい画面へ再読込して以下の通常操作と主要拒否経路を確認し、停止を解除してDev受入れへ進む。

CLIの存在・version・認証・trust・対象projectの照合と、commandごとのexit status記録はDev runbookに従う。現在の接続権限・remote状態は今回未確認である。

deploy自体は既存Customerを変更しないため、data復元は不要。Hostingだけを旧版へ戻すと旧writerが新Rulesに拒否される。Rulesも旧版へ戻すとCustomerの書込み・削除権限が再拡大するため、自動rollbackせず、停止中の修正releaseを優先する。旧Rulesへの復帰が必要な場合は対象revision・権限再拡大・clientとの整合を明示して承認する。新規test dataや通常操作の結果を推測削除・一括復元しない。

## Devで試す操作

| 操作 | 期待結果・確認範囲 |
|---|---|
| 新規作成 | 承認された検証用Customerを1件作成し、一覧・詳細へ反映される |
| 基本情報 | 名称・住所・任意fieldを編集して保存し、再表示と検索を確認する。住所検索失敗時も保存を継続する既存仕様を維持 |
| 支払条件 | 締め・支払月・支払日を編集し、再表示と請求期日の利用経路を確認する。既存Billingを勝手に再生成しない |
| 関連機能 | 上記条件2の対象として、関連Siteへの同期、新規Agreementの初期締め日、新規Billingの支払期日、PDFの名称・住所を承認済み検証対象で確認する。既存Agreementや過去Billingの一括再計算はしない |
| 既存Customer | 実際に編集する対象で保存を試す。不適合が再現した場合だけID・field・修正内容を限定して記録し、その操作を修正する |
| 閲覧専用actor | 一覧・詳細のreadを維持し、作成・編集・delete・archiveの入口を出さない |
| Rules拒否 | 承認済み合成対象で他社アクセス、書込み権限不足、delete/archiveの主要拒否を確認する。UI非表示とserver拒否を区別する |

既存local陰性testの全件をremoteで反復しない。拒否probeは正規tokenと存在必須precondition等を使い、承認されていない実会社・実dataを使わない。旧clientの更新拒否は想定済みの切替条件として扱い、形式不適合による通常保存の失敗とは分ける。

住所入力を伴う作成・編集は、既存Callable経由でGoogle Mapsへの住所送信を行う。次のbounded Dev承認に、この外部住所検索と使用する検証住所を含める。`functions/modules/utils/geocoding.js`は成功時の座標、検索失敗時の住所・応答をFunctions logへ記録するため、raw logを取得・転記せず、必要な状態・件数だけを確認する。

## 残る確認と停止条件

- Devの現在revision、operator権限、切替時の利用者・旧client状態はremote工程で確認する。
- `tokenMap`と位置情報の意味上の正しさをRulesだけでは完全に検証できない。専用writerの派生値生成を維持し、server生成化は[Customer実装の後続課題](customer-master.md#将来要対応)へ残す。
- artifactのsource/config/hash不一致、意図しないservice差分、他社アクセス許可、権限不足actorのwrite成功、対象外data変更、Rules/Hostingの反映失敗時は停止する。
- 終了・再有効化・archive/restore、code一意化、請求snapshot等の後続機能は今回の受入れへ拡張しない。

製品要件・data contract・進捗値は変更しない。今回の準備とbuild結果は実行証拠へ、現在の再開位置は[current handoff](current-coordinator-handoff.md)へ記録する。
