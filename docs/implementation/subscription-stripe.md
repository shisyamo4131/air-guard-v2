# Subscription・Stripe連携（実装調査）

> 2026-09-01 current disposition: 利用者は本実装がscaffoldであり、Stripe側とCompany契約情報を同期した実績がないと確認した。[ADR 0038](../decisions/0038-legacy-stripe-scaffold-removal.md)により、外部Stripeを操作せずAirGuard内のroute、reader/writer、Functions、Rules、schema、legacy dataを撤去する。以下は撤去前実装の確認記録であり、提供予定の正式Stripe仕様ではない。

## Customer type utility最終確認（SPEC-DEEP-045b）

- `getCustomerType`はsubscription ID欠損をfree、`canceled`/`past_due`/`unpaid`または期限超過をexpired、`active`/`trialing`をpaid、それ以外の未知statusをfreeとする。
- `currentPeriodEnd`はFirestore Timestampの`toMillis()`を前提とし、Date/string/不正objectを正規化しない。期限判定は呼出し時刻だけで、時刻経過によるreactive再計算はutility自身にない。
- 未知statusをfail-closedな不明状態として扱わずfreeへ縮退するため、Stripe state追加や破損data時のentitlement・案内契約が曖昧である。

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-029、SPEC-DEEP-009
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/settings/checkout.vue`、`stores/useCompanyStore.js`、`utils/subscription/getCustomerType.js`、`functions/modules/stripe.js`、`functions/index.js`、`utils/pageSettings.js`、`firestore.rules`、schemas `src/Company.js`
- 区別: 本文のSubscriptionはAirGuard利用契約/Stripe課金であり、警備業務のBilling・OperationBilling・請求書とは別系統である。

## 入口・権限

- `/settings/checkout`はpageSettingsで`SUPER_USER` access policy、`navigation:false`。Company admin向けnavigationには表示されない。
- checkout pageは現在状態と登録buttonだけを持ち、解約、再開、支払方法変更、Stripe Customer Portal入口はない。
- StripeData Rulesは同一company claimの認証Userまたはsuper-userにread/createを許し、client update/deleteを拒否する。page roleとRules create主体が一致しない。
- Company Rulesは同一会社の全認証Userに`stripeCustomerId/subscription`を含むCompany全writeを許すため、derived契約状態をclientが直接改変できる。
- `functions/index.js`のStripe module exportはコメントアウトされている。したがってこのソース構成では`webhooks`と`onCreateCheckoutSession`はFunctions公開入口へ接続されていない。

Stripe module全体の公開API、外部作用、署名・retry・部分失敗境界のfile単位確認は[Geocoding・Stripe・ContextualError Functions deep review](geocoding-stripe-error-functions-deep-review.md)を参照する。

## データ契約

独立したSubscription schema/collectionはなく、Company documentに次を埋め込む。

| field | 契約 |
|---|---|
| `stripeCustomerId` | hidden string、最大100。Stripe Customer ID |
| `subscription.id` | Stripe Subscription IDまたはnull |
| `subscription.status` | Stripe status文字列またはnull |
| `subscription.currentPeriodEnd` | Firestore Timestampまたはnull |
| `subscription.employeeLimit` | number。Company default 10、webhook削除時0、create/update時metadataを整数化し欠損時0 |

一時request/responseは`Companies/{companyId}/StripeData/{autoDocId}`に保存する。

- client input: `price`、`success_url`、`cancel_url`、`createdAt`
- Function output: `sessionUrl`、`customerId`、`error`
- session ID、event ID、processedAt、request actor UID、plan snapshot、idempotency key、expiry/cleanup statusは保存しない。

### customerType導出

- subscription.idなし: `free`
- statusが`canceled/past_due/unpaid`: `expired`
- currentPeriodEndが現在より過去: `expired`
- statusが`active/trialing`: `paid`
- その他: `free`

Webhook deleteはidをnullにするため、削除後の実効customerTypeは`free`となり、`canceled => expired`分岐には到達しない。

## checkout・portal

1. pageは固定の単一price ID、現在originから作ったsuccess/cancel URL、server timestampをStripeDataへaddする。
2. clientは作成docをonSnapshotし、errorなら表示、sessionUrlなら`window.location.href`でStripeへ遷移する。
3. onCreate triggerはCompanyを読み、stripeCustomerIdがなければStripe Customerを作りCompanyへ保存する。
4. Stripe Checkout Sessionをsubscription mode、自動税、card、30日trialで作り、session URLをStripeDataへmergeする。
5. clientはStripeから戻ったquery `success=true`だけで「登録完了」と表示する。Stripe sessionやCompany subscription同期の完了確認はしない。

serverはStripeDataのprice/success_url/cancel_urlを許可list・origin・planで検証しない。Rules上は同一会社の一般認証Userも任意値でcreateできる。

Customer作成時はCompanyの`email/name/abbr`を参照するが、Company schemaの名称は`companyName/companyNameKana`でemailもないため、通常のCompany契約ではCustomer name/emailが未設定になる。

Customer Portal、解約callable、再契約専用処理、checkout session cleanupは確認できない。

## webhook・state machine

- HTTP webhookは署名header、rawBody、webhook secretでStripe署名を検証する。
- 対象eventは`customer.subscription.created/updated/deleted`。その他は200で無視する。
- customer IDでCompaniesをqueryし、先頭1件だけを更新する。
- created/updatedはid/status/currentPeriodEnd/metadata.employeeLimitをCompanyへ上書きする。
- deletedはsubscriptionをid/status/period null、employeeLimit 0へ上書きする。
- event ID、created時刻、subscription IDの現値比較、順序/version、重複処理記録はない。
- 古いupdated/delete eventが新しい契約後に届くと、新しいCompany subscriptionを上書き/消去し得る。

## Company・store反映

- Auth初期化後のCompany live subscriptionがStripe webhookによる変更をCompanyStoreへ反映する。
- `customerType`は現在時刻を引数に取る純粋関数をcomputedから呼ぶが、時刻経過そのものはreactive dependencyではない。period endを跨いでも他のreactive更新がなければcomputedが再評価されず、画面stateがstaleになり得る。
- UIはcustomerTypeがpaidならstatus/employeeLimit/period endを表示し、paid以外ならcheckout buttonを表示する。
- checkoutはsubscription metadataへemployeeLimitを設定しないため、当該sessionからのwebhookでは通常default 0となる契約である。

## failure・idempotency

- Stripe module未exportの現状ではStripeData作成後にserver更新がなく、pageはloadingのまま待ち続ける。
- triggerを有効化した場合も、Stripe Customer/Checkout Session作成とFirestore更新はatomicでない。Stripe成功後・doc update前のretryは重複Customer/sessionを作り得る。
- 同一companyで複数StripeDataを並行作成すると、stripeCustomerId未設定の同じCompanyから複数Customerを作り得る。
- Stripe APIへのidempotency key指定がない。StripeData doc IDもStripe requestのidempotencyに使わない。
- webhook Company未発見はwarning後200成功となるため、Stripe retryによる自然回復は起きずsubscription同期が失われる。
- webhook処理errorは400を返すが、event重複/順序逆転を安全に処理する状態はない。
- webhookは署名検証前の`request.body.type`をevent分岐に使い、検証済み`event.type`へ統一していない。Company未発見は200で捨て、その他の例外だけ400としてStripe retry対象にする。
- checkout errorはerror.messageをStripeDataへ保存し同一会社Userが読める。内容のsanitization契約はない。

## Rules・security

- secret値はFunctions secretsとして定義し、client codeへは置かない。本文へ値は転記していない。
- pageのprice IDはclientに固定埋込みされ、plan/priceのserver allowlistはない。
- 任意redirect URLをserverがStripeへ渡すため、直接Firestore createできるactorは任意originへのCheckout遷移を生成し得る。
- StripeData readは同一会社User全員に許され、sessionUrl/customerId/error/request URL等を閲覧できる。
- Company subscriptionはRulesでserver-ownedにされず、customerType/employeeLimit/statusを直接偽装できる。
- webhook署名検証はあるが、Company lookupはstripeCustomerIdの一意性を検証せず先頭1件を採る。

## 矛盾・未使用候補

- Stripe module全体がFunctions indexからexportされず、UIコメントのCloud Function連携が到達不能。
- pageSettingsはsuper-user限定だがStripeData Rulesは同一会社User全create、Company Rulesは契約state全writeを許す。
- Company Customer作成field名がschemaと不一致（`name/abbr/email`対`companyName`）。
- checkoutはemployeeLimit metadataを設定しないがwebhookはmetadataだけを値源とし、欠損時0。
- 成功queryは検証なしで完了表示し、Company subscription同期を成功条件にしない。
- Portal/解約/再開/cleanupは実装なし。画面文言の「すべての機能」や料金体系に対応するplan契約もコード上で確定していない。
- customerTypeの時刻判定はtimerを持たず、period end跨ぎでstaleになり得る。

## 将来要対応

- FUT-0099〜FUT-0104を`future-actions.md`へ登録し、FUT-0090へsubscription改変の証拠を追加した。

2026-09-01に、Stripe本体、checkout、webhook、plan、status、employeeLimitを保留・再利用せず、未同期scaffoldとして完全撤去する方針へ更新した。CCBでserver-owned entitlement documentやclient projectionを準備しない。将来のサブスクリプションはproviderを含めて新規設計し、現行実装を正式課金仕様へ昇格しない。

## 要確認事項

- CONF-0083〜CONF-0087は2026-08-28に正式release直前まで明示保留とした。

## 未確認範囲

- Devのfresh Company件数・legacy field形状、`StripeData`件数、旧Stripe Function IDの不存在。
- local ignored saved-dataの値を露出しない分類とmigration rehearsal。
- 将来サブスクリプションのprovider、料金、契約、利用上限は別企画まで未設計。
