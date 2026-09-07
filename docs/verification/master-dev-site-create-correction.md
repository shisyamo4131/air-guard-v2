# Master Dev Site作成補正・SITE-09 Dev受入れ記録

- 実施日: 2026-09-07
- 対象: SITE-09初回Dev反映後に確認したSite作成拒否の補正と、補正後のDev機能受入れ
- 変更class: `data-contract-schema-migration`、`build-release-deploy` と検証記録の `project-guidance-metadata`
- 環境: Codex専用Local Emulator、利用者が起動したimport-only Local環境、DevのFirestore `(default)`、Chromeの会社管理者・経理session
- 非対象: Hosting・Functions・Indexes再反映、Prod、migration、既存data補完、Siteの見た目・操作感の追加改善

## 結論

Siteを登録できない一般的な状態ではない。初回Dev Rulesでは、Customer紐付け・非null座標・通常の検索tokenを含む正規34-field作成が、認可や保存値の不一致ではなくFirestore Rulesの1000式評価上限で拒否された。Localの同条件で再現し、保護条件を維持したRules評価数削減後は同じChrome画面から保存できた。

補正版Firestore RulesだけをDevへ反映し、同じ会社管理者・Customer紐付け・非null座標の条件でSiteを再登録した結果、保存に成功して詳細画面へ遷移した。この経路の不具合は解消した。その合成Siteで編集、検索、終了、終了済み検索、再有効化、参照なしarchiveを確認し、経理accountではSite一覧へ到達できる一方で作成導線が表示されないことを確認した。利用者は見た目・操作感の追加改善を後続phaseへ送り、SITE-09の機能面を完了と判断した。

## 変更

- `firestore.rules`: Siteの明示matchと重なるCompanies fallbackを`Sites`で早期拒否した。非null location validatorを共通化し、既に必須field・source値・create metadataで保証される重複検証を除いた。exact allowed keys、全必須field参照、actor、tenant、maintenance、Customer exact projection、GeoPoint一致は維持した。
- `test/local/codex-local-harness.test.mjs`: 同一tenant会社管理者、既存Customer、非null location/GeoPoint、通常規模tokenMapを組み合わせた正規Site create回帰を追加した。
- `test/domain/firestore-rules-reservation-source-contract.test.mjs`: `Sites`のfallback拒否を、同値の先頭判定を含めて検証するよう更新し、Customer projectionのexact key契約を現在のRules表記へ合わせた。

## 実測

| 検証 | 結果 | exit status |
|---|---|---:|
| 修正前の追加Emulator回帰 | 1000式評価上限で拒否を再現 | 1 |
| 修正後のSite Rules対象試験 | 13/13成功 | 0 |
| Chrome Local UIの同条件Site作成 | 保存成功し詳細画面へ遷移 | UI操作のため非該当 |
| `node --test test/domain/*.test.mjs` | 1509/1509成功 | 0 |
| `npm run test:local` | 182/182成功 | 0 |
| `npm run test:local:ui:build`（補正前の試行） | dirty/uncommitted sourceを拒否するpreconditionで停止 | 1 |
| `npm run test:local:ui:build`（commit `c1be8faf`） | 専用Local UI build成功 | 0 |
| installed Firebase CLI version確認 | `15.28.1`を確認 | 0 |
| Dev Firestore database identity確認 | project・`(default)`・Standard edition・Native mode・`asia-northeast1`を確認 | 0 |
| `firebase deploy --project air-guard-v2-dev --only firestore:rules --dry-run --non-interactive` | Rules compile・dry-run成功 | 0 |
| `firebase deploy --project air-guard-v2-dev --only firestore:rules --non-interactive` | `firestore.rules`のupload・release成功 | 0 |
| Chrome Dev UIの同条件Site作成 | 保存成功し詳細画面へ遷移 | UI操作のため非該当 |
| Chrome Dev UIの会社管理者Site編集 | 合成Siteの基本情報を保存し詳細・一覧へ反映 | UI操作のため非該当 |
| Chrome Dev UIの稼働中Site検索 | 更新したSite codeで1件を表示 | UI操作のため非該当 |
| Chrome Dev UIの終了・終了済み検索 | reason付き終了に成功し、名称検索で終了済み一覧へ表示 | UI操作のため非該当 |
| Chrome Dev UIの再有効化 | 新しい工期・reasonでACTIVEへ復帰 | UI操作のため非該当 |
| Chrome Dev UIの参照なしarchive | 利用者の確定時承認後に成功し、稼働中・終了済み一覧から除外 | UI操作のため非該当 |
| Chrome Dev UIの経理account | Site一覧へ到達、作成導線なし、archive済み旧URLはnot-found | UI操作のため非該当 |

`npm run test:local`の拒否actor・不正shapeケースでは期待された`PERMISSION_DENIED`や一部の評価上限ログが出るが、全ケースが拒否・write 0を確認してsuiteは成功した。正規のCustomer紐付け・座標ありcreateは追加回帰と実UIの双方で成功した。

## Firestore Rules security audit

```json
{
  "securityRating": 4,
  "findings": [],
  "verified": [
    "same-tenant active registered actor and strict Site write authority remain required",
    "cross-tenant, malformed actor, maintenance, archive collision, delete and archive client writes remain denied",
    "Site allowed keys, required field access, derived values, location and GeoPoint match remain enforced",
    "linked Customer is read from the same tenant and its six-field projection must match"
  ],
  "limitations": [
    "some negative update paths fail closed at the Rules expression limit rather than a more specific predicate",
    "the accounting remote smoke verified client-side write control absence; server-side accountant denial was not invoked after the only synthetic Site had been archived and remains covered by the unchanged Local Rules and Callable actor tests",
    "existing Dev Site and archive populations were not scanned; the approved initial acceptance used synthetic data"
  ]
}
```

評価は今回変更したRulesと既存のLocal自動試験に限定する。アプリ全体の包括的なセキュリティ保証ではない。

## SITE-09完了判断・残作業

- SITE-09は機能面のDev受入れを完了し、Siteロードマップを95%から100%へ更新する。利用者が後回しとした見た目・操作感の追加改善は別phaseで扱う。
- 今回作成した合成Siteは承認済みの製品archive経路で通常一覧から除外した。通常画面から復元できない。合成CustomerはDevに残しており、別承認なしに削除しない。
- 今回はHosting・Functions・Indexes、Prod、migration、既存data補完を変更していない。
- 既存Dev Site／archiveの全件shape確認、`runDailySiteTermination`公開、legacy data補完はSITE-09の完了範囲へ含めず、それらが必要になる後続checkpointで別承認する。
- remote Rules反映後はcodeのrevertだけではDevを戻せない。不具合が判明した場合は追加serviceやdataを変更せず停止し、影響を限定したforward correctionとRules-only再反映を別承認で扱う。
