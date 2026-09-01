# 0038 未同期Stripe scaffoldの完全撤去

- 日付: 2026-09-01
- 状態: Accepted
- 関連仕様: `docs/specification.md` の「現在の範囲外または未確定」「Company設定とtenant lifecycle」「サブスクリプション」
- 関連roadmap: `docs/roadmaps/company-stripe-removal.md`

## 背景

AirGuardV2にはStripe Checkout画面、`StripeData`、Companyの`stripeCustomerId`・`subscription`、未公開のStripe Functions、Stripe依存packageがscaffoldとして残っている。Functions entrypointはStripe moduleをexportしていない一方、SuperUserは直接URLからcheckout画面へ到達でき、clientから`StripeData`だけを作成して応答を待ち続ける部分実装になっている。

利用者は、これらをscaffoldとして用意しただけであり、現在までStripe側とCompanyの契約情報を同期したことはないと確認した。したがって既存Stripe Customer、Subscription、Webhook、Price、外部契約の調査・変更・解約・削除・復旧をこの改修へ含める必要はない。

## 決定

### 撤去対象

- checkout pageとroute設定、legacy customer type reader、CompanyStoreのsubscription依存を削除する。
- 未公開Stripe Functions module、entrypointの残存comment、FunctionsのStripe依存packageを削除する。
- Company schemaから`stripeCustomerId`と`subscription`を削除し、新規Companyがこれらを生成しないことを保証する。
- 旧CCB packageに残るStripe由来のentitlement・PrivateSettings entitlement・legacy mappingを削除する。Company profile・billing・operations・arrangement parserと共有role markerは保持する。
- Firestore Rulesでは`Companies/{companyId}/StripeData/{document=**}`を全actorのread/write拒否として予約し、汎用Company descendant ruleからの除外を維持する。
- 既存Company rootから`stripeCustomerId`と`subscription`だけを削除し、存在する`StripeData` documentは事前inventoryと停止条件を満たす場合だけ削除する。

### 対象外

- Stripe Dashboard/API、Customer、Subscription、Price、Webhook endpoint、Secret、外部契約へのread/writeは行わない。
- 将来サブスクリプションのprovider、料金、契約、利用上限を決めない。
- Companyの通常情報、振込先、通常設定、表示順、Company既定取極め・位置情報等の別legacy fieldを同じmigrationで変更しない。
- Prod、main merge、push、Dev反映、remote data操作、package公開は、それぞれ別の承認境界を維持する。

### schema package境界

`air-guard-v2-schemas@2.4.2-dev.167`は既に公開済みであり、unpublishや内容の上書きをしない。Schemas repositoryで前進versionを作り、root applicationとFunctionsを同じexact version・tarball・integrityへ更新する。関連repositoryの編集とpackage公開は別承認とし、公開前に既知consumerとAdmin SDKの互換性を確認する。

### data migration契約

- localとDevで同じmigration plannerを使用し、既定はdry-runとする。Prod targetは提供しない。
- 変更可能箇所は既存Company rootの`stripeCustomerId`・`subscription`と、そのCompany直下の`StripeData`だけとする。Company rootの作成・削除、他field、他subcollectionの作成・変更・削除は行わない。
- reportは件数、分類、匿名化subject hash、64文字のplan digestだけを出し、Company ID、document path、field値、Stripe形式の値、秘密情報を出力しない。
- apply前にexact target、backup、直前dry-run、digest一致、対象件数、Rules、状態再検査を確認する。Devで想定するCompany rootは4件だが、fresh確認が4件でない場合はwrite 0で停止する。
- unexpectedなStripeData、対象外field差分、backup失敗、dry-run後の状態変化、schema package不整合、Rulesをdenyへ移行できない場合はwrite 0で停止し、推測削除しない。
- apply後はlegacy root field 0、StripeData 0、Company件数不変、非対象field不変を確認する。再実行はcleanで変更0件となることを保証する。

## 理由

未完成scaffoldを保持すると、到達可能だが完了しない画面、不要なclient write、同一tenantへの過剰なdata公開、将来誤って再公開されるFunctionsというriskが残る。一方、同期実績のない外部Stripeまで調査・変更すると、存在しない連携を前提にscopeと危険性を増やす。AirGuard内の残存物だけをfail closedで撤去するのが最小かつ十分である。

## 代替案

- Functionsだけを未公開のまま残す案: checkout pageとRulesが到達可能で、schema/dataも増え続けるため不採用。
- `StripeData` rule自体を削除して汎用Company descendant ruleへ戻す案: 汎用許可から再びread/writeできる可能性があるため不採用。
- 公開済みSchemas packageを上書きまたはunpublishする案: 既存consumerと履歴再現性を壊すため不採用。
- 外部Stripe resourceを確認してから撤去する案: 利用者確認済みの未同期scaffoldに不要な外部作用を追加するため不採用。

## 影響

- SuperUserを含む全利用者からcheckout入口がなくなり、`StripeData`は全操作拒否になる。
- Company読込・新規作成はlegacy Stripe fieldを必要としないschemaへ移る。
- 既存4 Companyは別承認のbounded migrationでAirGuard内のlegacy fieldだけを除去する。
- 将来のサブスクリプションはこのschema、Functions、route、Stripe providerを互換前提にしない。

## rollback

- code・Rules・文書はreview済みcommitのrevertで戻す。ただし公開済みpackageをunpublishせず、必要なら別の前進versionで復元する。
- data apply前にexact preimage backupを取得する。data rollbackはbackupの対象Companyと対象fieldだけを、現状態の衝突検査後に別の明示承認で復元する。
- external Stripe resourceは変更しないため、外部側rollbackは存在しない。

## 検証

- route、reader/writer、module、dependency、schema field、旧entitlement exportの不存在をdomain testで確認する。
- 新規Company payloadにlegacy fieldがないこと、旧fieldを持つCompanyの読込とmigrationを合成dataで確認する。
- Firestore Emulatorで同社・他社・SuperUser・未認証の`StripeData` read/create/update/deleteとnested pathをすべて拒否し、他の正当なCompany subcollectionを退行させない。
- migrationのdry-run、digest、state drift、redaction、idempotency、partial failure、backup/rollback rehearsalを合成dataで確認する。
- local UIでCompany基本情報、振込先、通常設定、稼働予定表示順、配置表示順、新規Company作成を確認し、checkout入口・Stripe通信がないことを確認する。
- Dev反映は別checkpointでfresh inventory、backup、maintenance要否、release順、post-check、利用者最終UI acceptanceを固定する。

## 再検討条件

将来サブスクリプションを企画するとき、または未同期という確認と矛盾する外部連携証拠が見つかったときは、実データや外部resourceを変更せず停止し、別の仕様・roadmap・承認境界を作る。
