# Master Dev Site作成補正記録

- 実施日: 2026-09-07
- 対象: SITE-09初回Dev反映後に確認した、会社管理者によるCustomer紐付け・座標ありSite作成の拒否
- 変更class: `data-contract-schema-migration`、`build-release-deploy` と検証記録の `project-guidance-metadata`
- 環境: Codex専用Local Emulator、利用者が起動したimport-only Local環境、DevのFirestore `(default)`、Chromeの会社管理者session
- 非対象: Hosting・Functions・Indexes再反映、Prod、migration、既存data補完、合成data削除

## 結論

Siteを登録できない一般的な状態ではない。初回Dev Rulesでは、Customer紐付け・非null座標・通常の検索tokenを含む正規34-field作成が、認可や保存値の不一致ではなくFirestore Rulesの1000式評価上限で拒否された。Localの同条件で再現し、保護条件を維持したRules評価数削減後は同じChrome画面から保存できた。

補正版Firestore RulesだけをDevへ反映し、同じ会社管理者・Customer紐付け・非null座標の条件でSiteを再登録した結果、保存に成功して詳細画面へ遷移した。この限定経路の不具合は解消した。残る権限別・操作別のSITE-09受入れは未完了である。

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
    "the remote smoke covers only the approved company-admin linked-Customer geocoded create path; broader actor and operation acceptance remains incomplete"
  ]
}
```

評価は今回変更したRulesと既存のLocal自動試験に限定する。アプリ全体の包括的なセキュリティ保証ではない。

## 残作業・rollback

- SITE-09の残る権限別・操作別受入れは別checkpointで行う。今回作成した合成Customerと合成SiteはDevに残しており、対象と復旧不能性を確認した別承認なしに削除しない。
- 今回はHosting・Functions・Indexes、Prod、migration、既存data補完を変更していない。
- remote Rules反映後はcodeのrevertだけではDevを戻せない。不具合が判明した場合は追加serviceやdataを変更せず停止し、影響を限定したforward correctionとRules-only再反映を別承認で扱う。
