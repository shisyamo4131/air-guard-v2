# Agreement（取極め）マスター実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-022
- 最終確認日: 2026-08-11（SPEC-DEEP-013でcomponent本文を再確認）
- 根拠ファイル: `pages/sites/[id].vue`、`components/Agreements/**`、`components/Agreement/**`、`components/OperationBilling/CustomInput/Agreement.vue`、`air-guard-v2-schemas/src/AgreementV2.js`、`WorkTimeBase.js`、`Site.js`、OperationResultの直接agreement参照、Sites Rules

## 確認済み方針

- 取極めなしのOperationResultは運用上あり得る。
- 請求稼働管理では、適用日・勤務区分上は通常適用外の取極めも手動選択してよい。
- 取極めなしでも請求日、単価、数量等を個別設定して請求対象化できる必要がある。

以上はユーザー確認済み方針であり、自動適用の実装条件や現在の入力validationとは区別する。

## 入口・権限

- 独立したAgreement一覧・詳細page、pageSettings、Firestore collection CRUDはない。
- AgreementV2は`Site.agreementsV2`配列の埋込みvalue objectで、`/sites/[id]`の`AgreementsManager`から作成・更新・削除し、最後に`Site.update()`でSite document全体を保存する。
- UI入口は`sites:read`。Rules境界もSites documentのため、同一会社認証Userまたはsuper-userに全read/writeを許す現行Site境界がそのまま適用される。
- schemaに`collectionPath="AgreementV2s"`はあるが、この調査範囲で独立documentとして保存・検索する到達経路や専用Rulesは見つからない。

## データ契約

- 所属Site/Customer IDをAgreement自身は持たない。親`Sites/{siteId}`と、そのSiteの`customerId/customer`によって文脈が決まる。
- WorkTimeBase由来の必須field: `dateAt`（適用開始日）、`shiftType`、`startTime`、`endTime`、`breakMinutes`、`regulationWorkMinutes`。
- AgreementV2固有の必須field: `rates`、`billingUnitType`、`cutoffDate`。`includeBreakInBilling`はdefault false。
- `rates`はWEEKDAY/SATURDAY/SUNDAY/HOLIDAYの各RateSetを必須で持つ。各RateSetは`unitPriceBase`、`overtimeUnitPriceBase`、`unitPriceQualified`、`overtimeUnitPriceQualified`を持ち、全てdefault 0かつrequired。
- `billingUnitType` defaultはPER_DAY。`shiftType` defaultはDAY。`dateAt` defaultは現在日の00:00、休憩・規定実働は共通field definitionのdefaultを使う。
- 読み取り専用プロパティは`date`、`startAt`、`endAt`、`isSpansNextDay`、`attendanceDateAt/attendanceDate`、`key`等。`key`は`${date}_${shiftType}`。
- `isKeyChanged`ゲッターは更新前後のkey差を返す。独立doc ID、status、有効終了日、archive flagはない。

## CRUD・validation

- `AirArrayManager`がitem-key=`key`で配列内CRUDを行い、同じ適用開始日・勤務区分のduplicateKeyを拒否する表示契約がある。
- component層はpermission、保存中single-flight、保存失敗時rollbackを独自実装せず、AirArrayManager/useBaseManagerと親の`doc.update()`へ委譲する。詳細は[Agreement components deep review](agreement-components-deep-review.md)を参照する。
- DAY/NIGHT tabごとに取極めを作成・編集し、copy buttonは選択中Agreementを新規入力の初期値として渡す。
- create時は表示中shiftTypeを強制し、Siteの埋込みCustomerにcutoffDateがあれば初期値に設定する。
- deleteは配列から除去し、専用archive、終了status、参照確認、revisionはない。親Siteの保存が成功するまでFirestoreへ反映されない。
- 開始/終了時刻、翌日開始、規定実働、休憩、請求単位、締日、4曜日×4単価を編集する。曜日を複数選択して同じRateSetを一括反映できる。
- breakMinutesとregulationWorkMinutesは負数を拒否する。工数と勤務時間の相互上限、価格fieldの負数・上限・小数精度、0円警告はAgreement固有には見つからない。
- 期間重複という概念はなく、同一shiftTypeでは開始日の系列として扱う。key完全重複だけがUI管理対象。

## 適用判定・検索

- `Site.getValidAgreement({date, shiftType})`はshiftType一致だけを抽出し、適用開始日降順で指定日以前の先頭を返す。指定日なしではそのshiftTypeの最新を返す。
- dayTypeは適用Agreementの選定条件ではなく、選定後に`rates[dayType]`を選ぶ条件。
- ViewerはshiftType別に開始日昇順で表示し、JST今日以前の最新を「現在適用」とする。未来分も前後navigationで閲覧・編集できる。
- 独立検索、site/customer横断一覧、終了済み検索はない。
- OperationBillingの手動選択UIはSiteの`agreementsV2`候補を利用する。承認済み方針どおり、適用日・勤務区分で候補を強制除外しない境界は自動適用とは別である。

## 単価・数量計算

- Agreement自体は数量を保存しない。単価、残業単価、請求単位、休憩を請求時間に含めるか、規定実働時間を提供する。
- OperationResultのoriginal計算は、実績のdayTypeに対応するRateSetを使い、base/qualifiedを分ける。
- PER_DAYでは各categoryの実績人数をquantityとする。PER_HOURではtotalWorkMinutesを60で割り、`includeBreakInBilling=true`ならbreakMinutesを加えてquantityとする。
- 残業金額は`overtimeMinutes × overtimeUnitPrice / 60`。通常金額は`quantity × unitPrice`。各金額にはRoundSettingが適用される。
- Agreementまたは該当dayType RateSetがなければoriginal単価・金額は0側となる。手動調整（useAdjusted）は別fieldから計算し、取極めなし請求の回復経路となる。

## 参照・snapshot

- SiteはAgreementV2配列をlive masterとして保持する。Schedule等がsiteIdから参照する時点では現在のSite取極めが適用候補となる。
- OperationResultは作成時またはgroup key変更時に`Site.getValidAgreement`の結果を`agreement` objectとして保存する。既存OperationResultはSite側取極めの更新・削除に自動追随しない。
- したがって、過去OperationResultの単価・締日計算はsnapshot、将来の自動適用は更新後masterという境界である。
- SiteのCustomer変更や埋込みCustomer staleにより、create時cutoffDate defaultとOperationResultへ同期されるcustomerIdの時点が混在し得る。

## 削除・終了

- Agreement単独の終了、無効化、archive、restoreはない。新しい開始日のAgreementを追加することで旧Agreementの適用を将来分から置き換える。
- 過去Agreementも親配列から直接編集・削除でき、status/date lockはない。
- 削除済みAgreementをsnapshotした既存OperationResultは保持するが、同日/shiftの未確定処理や再適用は残ったmasterから選定される。
- 親SiteをarchiveするとAgreement masterも通常Sites collectionから消える。Site archive/restore policyに従属する。

## Rules・tenant境界

- Agreement専用Rulesはなく、Sites Ruleだけが適用される。
- RulesはagreementsV2の構造、key重複、単価、日付、shiftType、Customer所属、既存OperationResult参照、変更主体を検証しない。
- schema/UI経由のvalidationは直接Firestore writeでは強制されない。

## 矛盾・未使用候補

- `AgreementV2.collectionPath`は定義されるが、現行経路はSite埋込みだけで独立collectionは未到達候補。
- 過去適用済みAgreementを上書き・削除できるが、既存OperationResultはsnapshotを保持するためmaster表示と過去実績の単価が一致しないことがある。
- priceはdefault 0で、Agreement固有の負数・上限・精度validationがない。
- ListItemは0円を`-`表示し、Tableは欠損enum/rate/priceを安全に正規化しない。表示対象配列が短縮・勤務区分変更された場合、viewer indexが範囲外に残り得る。
- copy後にdateを変え忘れた場合はduplicateKeyで拒否されるが、隣接期間や将来/過去の整合警告はない。
- Viewerの「現在適用」と手動選択可能範囲は意味が異なる。手動選択非制限は承認済みであり、不具合とは扱わない。
- 旧`Agreement` classとdeprecated getter群がschemaに残るが、現行Site UIはAgreementV2を使用する。

## 将来要対応

- FUT-0065: Agreement編集権限とRules validationを正式化する。
- FUT-0066: 単価・時間・締日の許容範囲を確定する。
- FUT-0067: 適用済みAgreementのrevision・削除policyを決める。
- FUT-0068: Agreement snapshotと再適用境界を明示・検証する。
- FUT-0069: AgreementV2の独立collection契約と旧classを整理する。

## 要確認事項

- CONF-0051〜CONF-0055を`pending-confirmations.md`へ登録した。

## 未確認範囲

- AirArrayManager内部のduplicate判定・rollback、OperationResult statistics/RoundSetting内部、請求集約処理。
- 実データ中の重複・負数・0円、独立AgreementV2s collectionの存在、必要index、Emulator/ブラウザ。
- 旧Agreement classの全利用箇所とmigration。
