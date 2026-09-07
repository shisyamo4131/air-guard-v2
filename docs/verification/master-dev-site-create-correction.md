# Master Dev Site作成補正記録

- 実施日: 2026-09-07
- 対象: SITE-09初回Dev反映後に確認した、会社管理者によるCustomer紐付け・座標ありSite作成の拒否
- 変更class: `data-contract-schema-migration` と検証記録の `project-guidance-metadata`
- 環境: Codex専用Local Emulator、利用者が起動したimport-only Local環境、Chromeの会社管理者session
- 非対象: Dev再デプロイ、Hosting・Functions・Indexes再反映、Prod、migration、既存data補完、合成data削除

## 結論

Siteを登録できない一般的な状態ではない。初回Dev Rulesでは、Customer紐付け・非null座標・通常の検索tokenを含む正規34-field作成が、認可や保存値の不一致ではなくFirestore Rulesの1000式評価上限で拒否された。Localの同条件で再現し、保護条件を維持したRules評価数削減後は同じChrome画面から保存できた。

補正はLocalだけにあり、Devには未反映である。このためDevの同条件Site登録は、補正版Rulesを反映して再試行するまで未解決として扱う。

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
    "Dev behavior is unverified until the corrected Rules are separately approved and deployed"
  ]
}
```

評価は今回変更したRulesと既存のLocal自動試験に限定する。アプリ全体の包括的なセキュリティ保証ではない。

## 残作業・rollback

- 外部操作の明示承認後、補正版Firestore RulesだけをDevへ反映し、同条件のSite作成を再試行する。
- Dev再試行に失敗した場合は追加serviceを反映せず停止し、Rulesログと保存payloadの差だけを再診断する。
- 補正を採用しない場合は本checkpointのowned diffをrevertする。Local/Devの合成dataは別承認なしに削除しない。
