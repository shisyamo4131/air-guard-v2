# 請求稼働管理の暫定権限と手動調整境界の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-011 — 暫定権限・取極め選択・取極めなし請求境界
- 最終確認日: 2026-08-26
- 根拠ファイル: `utils/pageSettings.js` の請求page設定・access helper、`@shisyamo4131/air-guard-v2-schemas/constants`、`utils/auth/authorization.js`、`firestore.rules` のhelperとOperationResults match、請求稼働一覧・詳細page、OperationBilling Agreement/Adjust UI、schemas `OperationResult`・`OperationBilling` のfield・sales・billing・lock契約

## ユーザー確認済み方針

- 現在のpermission・role・Rulesは試作中の暫定実装であり、確定仕様ではない。正式な機能別権限は将来決定する。
- 取極め候補を適用日・勤務区分で強制制限しない。通常適用外の取極めを手動選択できる。
- 取極めなし実績も、請求日・単価・数量等を個別設定して請求対象にできなければならない。
- 手動請求はOperationResult内の稼働外売上・ArticleDetailを正規経路とし、別Billing child manual-line modelは採用しない。課税区分等の不足fieldは実務に合わせて将来追加する。
- 権限はUser管理画面で利用者が設定する現行方針だが、機能別read/writeの2種を含む正式modelはusabilityを考慮して再考するため未確定である。

## 暫定権限表

2026-08-13にOperationResultの編集境界だけが確定した。特別な管理者区分ではなく、Userまたはrole presetが持つpermissionで判定する。`operation-results:write`はlockされていない稼働実績の編集・削除、`operation-billings:write`は請求項目の編集と`isLocked`の設定・解除を担う。請求書発行・入金・取消等の権限は引き続き未確定である。

| 境界 | 現在の実装 | 確定性 |
|---|---|---|
| 一覧・詳細page表示 | `billings:read` を要求 | 暫定 |
| manager preset | `billings:write`。authorization展開でreadも取得 | 暫定 |
| accountant preset | `operation-billings:write` と `billings:write`。readも派生 | 暫定 |
| 個別permission | User role配列に直接 `billings:read` があればpage通過 | 暫定 |
| super-user UI | wildcard `*` ですべて通過 | 暫定 |
| OperationResults Rules | 同一companyIdの認証ユーザーはread/write全許可。super-userも許可 | 暫定 |

controller presetにはbillings権限がないため通常はpageを通過しない。ただしRulesはroleを見ないため、同一会社の認証controllerが直接SDKでOperationResultsを書ける実装である。

## Rules境界

- pathは `Companies/{companyId}/OperationResults/{docId}` で、request.auth.token.companyIdとpath companyIdの一致を検査する。別会社pathは通常Userに拒否される。
- allow read, writeを一括指定し、create/update/deleteの区別、変更可能field、isLocked、billings permission、agreement整合を検査しない。
- super-userはcompanyId一致なしで許可される。
- document内のcustomerId・siteId等とpath companyIdの対応はこのmatchでは検査しない。

UIのpage guardとRulesは別境界である。page guardを通らないUserもRules上の同社writeは可能であり、pageで `billings:read` を持つUserはUI編集へ到達する。

## 手動調整項目と値決定

| 項目 | 保存field | 値への反映 |
|---|---|---|
| 調整を使用 | `useAdjusted` | trueならsalesAmountはsales.adjusted、falseならsales.original |
| 基本・資格数量 | `adjustedQuantityBase/Qualified` | 調整後の通常売上数量 |
| 基本・資格残業時間 | `adjustedOvertimeMinutesBase/Qualified` | 調整後残業売上。15分単位validator |
| 基本・資格単価 | `adjustedUnitPriceBase/Qualified` | 調整後通常単価 |
| 基本・資格残業単価 | `adjustedOvertimeUnitPriceBase/Qualified` | 調整後残業単価 |
| 請求日 | `billingDateAt` | billingDate・billingMonthとisBillableを導出 |
| 取極め | `agreement` | 選択時にcutoffDateからbillingDateAtを再計算。original単価にも使用 |

- Adjust componentはoriginalの数量・単価をreadonly表示し、buttonでquantity群またはunitPrice群をadjusted fieldへ複製する公開契約を持つ。ただしSPEC-DEEP-029で、`OperationBillingManager`がcustom-inputをAirItemManagerへ渡さず、activatorのexposeも参照しないため、現行詳細pageからこの専用componentへ到達する静的結線を確認できなかった。runtime fallbackは未確認である。
- useAdjusted=falseでは調整入力がdisabledになる。trueでは各調整fieldがrequiredである。
- sales.adjustedは取極めを参照せず、保存した調整数量×調整単価と残業時間×残業単価を計算する。
- 数量・単価validatorはnumber型を検査するが負数を拒否しない。残業時間は15分単位を追加検査するが、負の倍数は拒否しない。
- isBillableはagreement有無ではなく `billingDateAt != null && customerIdあり` である。

## 取極めなし回復フロー

1. 月次一覧に表示された非請求OperationResultを開く。
2. Agreement専用入力componentは、取極めを選ばず請求日を手動設定する契約を持つ。
3. Adjust専用入力componentは、useAdjustedをtrueにして基本・資格の数量、残業時間、単価、残業単価を設定する契約を持つ。
4. AirItemManagerがsubmitした場合、OperationBilling managerが同じOperationResults documentをupdateする。
5. isBillableがtrueとなり、別のFunctions triggerがBilling集約へ反映する。

手順2・3の専用componentは現行ManagerからAirItemManagerへ結線されていないため、詳細routeで実際に開くinputとend-to-end操作はruntime未確認である。model・専用component・後続triggerの個別契約と、現行UI到達性を区別する。

取極めなしでuseAdjusted=falseのまま請求日だけ設定してもisBillableはtrueになるが、original単価は0のため稼働分salesAmountは0になる。請求対象化と正の請求額設定は別条件である。

## 取極め手動選択

- 候補はSite.agreementsV2全件で、AgreementSelectにも日付・shiftType filterはない。
- manual setterはagreement keyが変われば受け入れ、cutoffDateから請求日を計算する。
- 将来適用・別勤務区分の取極めを選択できることは承認済み現行方針である。
- 日付・shiftType・siteIdのgroupKeyを別editorで変更した場合だけ、beforeUpdateがSite.getValidAgreementを自動再適用する。手動選択と自動再適用は異なる契約である。

## ロック・テナント・集約済み・同時更新

- OperationBillingはlock checkをoverrideして無効化するため、isLocked=trueでも請求画面からupdateできる。Rulesもlockを検査しない。
- 通常Userの別会社pathはcompanyId claimで拒否される。super-userは例外である。
- 既にBilling集約済みのOperationResultを更新すると、Functionsが同一billing keyではembedded resultを置換し、key変更ではtransactionで旧集約から新集約へ移す。
- 元OperationResult updateとFunctionsのBilling更新は同一transactionではない。同一keyのBilling配列更新もtransactionなしのread-modify-writeである。
- Rulesは同社全員のwriteを許すため、複数User・Functionsとの同時更新をfield単位で防がない。最終write優先や集約lost updateの可能性はEmulator未検証である。

## 仕様との一致

- modelと専用入力componentは取極めなし＋手動請求日＋調整数量・単価による請求契約を持ち、確認済み方針と一致する。ただし現行Managerのcustom-input未結線により、UIのend-to-end到達性は一致未確認である。
- 適用日・勤務区分で候補を制限しない実装は確認済み現行方針と一致する。
- 暫定permissionとRulesを確定仕様として扱わず、将来決定事項として分離した。

## 矛盾・未使用候補

- pageは `billings:read`、実際のUIはwriteを行い、Rulesはさらに広い同社全員writeであり、3境界の粒度が一致しない。
- `allowEmptyAgreement` はJSDocだけで、実際の境界はbillingDateAt、customerId、useAdjustedと調整fieldである。
- useAdjusted labelは請求締日も調整対象と説明するが、billingDateAt inputはuseAdjusted=falseでも入力可能である。
- 負の数量・単価・残業時間をmodel validatorが拒否しない。
- Managerの`customInput` propとBase/Agreement/Adjust activatorのexposed inputがAirItemManagerへ未結線であり、専用手動調整UIの到達性が文書上の操作flowと一致しない（FUT-0174）。

## 仮説

- 負数が値引き・相殺の意図的用途でなければ、負のsalesAmountや請求額を作れる可能性がある。
- 同一OperationResultを複数担当者が別cardから同時編集すると、clone全体のupdateで互いの変更を上書きする可能性がある。基底managerのmerge契約は未確認である。

## 将来要対応

- 正式な閲覧・調整・lock・create/delete権限とRules field制限を設計する（FUT-0031）。
- 非制限の取極め選択は維持し、必要なら通常適用外の任意警告・理由記録を設計する（FUT-0032）。
- 手動調整の負数、上限、精度、0円請求の可否を決定してvalidationする（FUT-0034）。
- concurrent updateとBilling集約の競合を検証する（FUT-0033）。

## 質問

- なし。正式権限と調整値範囲は将来仕様化する事項である。

## 未確認範囲

- Rules test、Emulatorでの同時更新・別会社・super-user・lock update。
- base managerがdocument全体または差分のどちらを保存するか。
- Billing以降の請求書、PDF、税計算、会計上の負数・0円運用。
- 正式なrole/permission設計。
