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
- 変更可能箇所は既存Company rootの`stripeCustomerId`・`subscription`だけとする。`codex-local` rehearsalに限り、そのCompany直下の既知形状`StripeData`も削除対象にできる。Devでは内部`StripeData`を削除せず、1件でも存在すれば停止する。Company rootの作成・削除、他field、他subcollectionの作成・変更・削除は行わない。
- reportは件数、分類、匿名化subject hash、64文字のplan digestだけを出し、Company ID、document path、field値、Stripe形式の値、秘密情報を出力しない。
- apply前にexact target、直前dry-run、対象identityと旧2 fieldのdigest一致、対象件数、Rules、状態再検査を確認する。DevはUWBと同じFirestore全体snapshotの成功を必須とし、Company rootが4件でない、または直接・入れ子・orphanを含む内部`StripeData`が1件でも存在する場合はwrite 0で停止する。
- Devの旧2 fieldは未使用scaffoldの恒久cleanupとし、maintenance、外部Stripeのinventory・前後確認、migration固有backup、旧fieldのdata rollbackを行わない。通常のCompany更新は旧2 fieldを書かずexact field updateであるため継続を許容し、非対象fieldの差分だけで停止しない。
- unexpectedな旧field形状、STRIPE-04 user-localの既存baseline不一致、対象identityまたは旧2 fieldの状態変化、schema package不整合、Rulesをdenyへ移行できない場合はwrite 0で停止し、推測削除しない。
- apply後は元の4 Companyが存在し、legacy root field 0、内部`StripeData` 0であることを確認する。再実行はcleanで変更0件となることを保証し、非対象fieldの正当な更新を上書きまたは失敗扱いしない。

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
- `codex-local`の合成data applyは既存のexact preimage backupと復旧演習を維持する。DevはUWB方式のFirestore全体snapshotを重大事故時の復旧候補として取得するが、未使用の旧2 fieldは恒久削除し、migration固有backup・data rollbackを提供しない。部分完了は現在状態を再確認して同じ処理を再実行し、code・Rules・Hostingの不具合は旧Stripe scaffoldを再公開せず前進修正する。全体snapshotからの復旧は正常な後続更新も戻し得るため自動実行せず、対象外dataを変更した重大事故に限り別承認のrepairで扱う。
- STRIPE-04の`user-local` Emulatorは、利用者が承認した限定例外として別backupを作成しない。既存`./saved-data`を変更しないimport-only rehearsalでCompany 1件の`stripeCustomerId`・`subscription`削除、`StripeData` 0件、他write 0件を確認し、不合格ならexportせず終了して同じbaselineから再開する。合格後は同じbaselineをimport＋export-on-exitで再起動し、同じmigrationと画面・data確認を再実行して確定する。確定後はpre-migration data rollbackを提供しない。
- external Stripe resourceは変更しないため、外部側rollbackは存在しない。

## 検証

- route、reader/writer、module、dependency、schema field、旧entitlement exportの不存在をdomain testで確認する。
- 新規Company payloadにlegacy fieldがないこと、旧fieldを持つCompanyの読込とmigrationを合成dataで確認する。
- Firestore Emulatorで同社・他社・SuperUser・未認証の`StripeData` read/create/update/deleteとnested pathをすべて拒否し、他の正当なCompany subcollectionを退行させない。
- migrationのdry-run、digest、state drift、redaction、idempotency、partial failureを合成dataで確認する。`codex-local`だけはbackup/rollback rehearsalも維持し、Devでは全体snapshot確認、4 Company、内部`StripeData` 0、旧2 field限定write、通常Company更新の保持、post-check、clean再実行を確認する。
- local UIでCompany基本情報、振込先、通常設定、稼働予定表示順、配置表示順、新規Company作成を確認し、checkout入口・Stripe通信がないことを確認する。
- Dev反映は別checkpointでfresh inventory、UWB方式の全体snapshot、maintenance不要、server・client先行反映、旧2 field限定migration、post-check、利用者最終UI acceptanceを固定する。外部Stripeの状態確認は含めない。

## 再検討条件

将来サブスクリプションを企画するとき、または未同期という確認と矛盾する外部連携証拠が見つかったときは、実データや外部resourceを変更せず停止し、別の仕様・roadmap・承認境界を作る。
