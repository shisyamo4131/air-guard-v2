# Geocoding・Stripe・ContextualError Functions deep review

## メタデータ

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-009
- 最終確認日: 2026-08-11
- 対象: `functions/modules/geocoding.js`、`functions/modules/stripe.js`、`functions/modules/utils/ContextualError.js`、`functions/modules/utils/geocoding.js`
- 境界: 直接entry/callerだけを照合し、外部API、secret値、runtime、実データは確認していない。

## ファイル別公開契約・到達性

| ファイル | 公開API | 責務・主要分岐 | entry到達性 |
| --- | --- | --- | --- |
| `modules/geocoding.js` | v2 callable `geocoding(request)` | `request.data.address`の存在/stringを検査し、`fetchCoordinates`結果を返す。nullまたは例外はgeneric `Error`へ変換 | `functions/index.js`からexportされるdeploy候補 |
| `modules/utils/geocoding.js` | `fetchCoordinates(address)` → `{lat,lng,formattedAddress}`またはnull | Functions parameterのAPI keyでGoogle Geocoding APIを呼び、status `OK`の先頭結果を返す | callableと`firebase.init.js`による`GeocodableMixin` server injection |
| `modules/stripe.js` | `webhooks`、`onCreateCheckoutSession` | Stripe署名検証・subscription同期、およびFirestore作成eventからCustomer/Checkout Session作成 | `functions/index.js`のexportがcomment outされ、現entryから未到達 |
| `modules/utils/ContextualError.js` | class `ContextualError`、`getFormattedContext()`、`toDetailedString()` | timestamp付きcontextを保持し、constructor時点でserver loggerへerror出力 | import/callerなし。`auth-v2.js` JSDocの記載だけ |

## Geocoding契約

callableはaddressをそのままserver helperへ渡す。認証、App Check、tenant、role、disabled User、長さ、文字種、rate limit、quota、cache、dedupeを検証しない。helperはAPI keyをFunctions parameterから取得し、URL queryへencodeしたaddressとkeyを設定してglobal `fetch`を実行する。key値をclientへ返したり明示logしたりはしない。

HTTP status、`response.ok`、JSON parse failure、results配列長、lat/lng有限数を個別検証しない。provider statusが`OK`なら`results[0]`を前提に返し、それ以外はnullである。timeout、AbortSignal、retry、backoff、quota status別分類はない。callableはnull時のmessageへ入力addressを含め、catchで`new Error(err.message)`へ変換するため、Firebase callable用error code・安全なuser message・retryable分類を保持しない。

成功時は緯度・経度、非OK時は入力addressとprovider response全体をserver logへ出す。Employee住所もserver Mixin経路から同じproviderへ送られるため、個人住所・精密座標・provider診断情報のprivacy境界はFUT-0143で管理する。

## Stripe checkout・webhook契約

### Checkout trigger

`Companies/{companyId}/StripeData/{sessionId}`作成eventから`price`、`success_url`、`cancel_url`を無検証で取得する。actor、role、App Check、Company status、field allowlist、price allowlist、URL originをhandlerで検証しない。CompanyにCustomer IDがなければCompanyの`email/name/abbr`でStripe Customerを作りIDを保存し、その後subscription mode・card・automatic tax・30日trialのCheckout Sessionを作る。

Stripe Customer、Company更新、Checkout Session、trigger document更新はtransaction化できず、Stripe idempotency key、Firestore lock、intent state machineもない。catchは`error.message`をdocumentへmergeして正常終了するため、通常のplatform retryは起きない。Customer/Session作成後の後続Firestore失敗や並行eventで外部resourceが重複し得る。server logにはcompanyId、Stripe customer ID、error objectを出す。

### Webhook

HTTP endpointはraw body、`stripe-signature`、webhook secretでStripe SDKの署名を検証する。署名不一致は400、対象外eventは200で無視する。対象はsubscription created/updated/deletedである。

署名検証前に`request.body.type`をlog・分岐用変数へ取り、検証済み`event.type`を分岐に使わない。署名が成功すれば通常両者は一致するが、trust boundaryを検証済みeventへ統一していない。customer IDでCompanyを検索し先頭1件だけを更新する。Company未発見はwarning後200、処理例外は400である。

event ID ledger、event created/version比較、現在subscription IDとの照合、out-of-order防止、reconcileはない。DELETEは現値を問わずsubscriptionをnull/0へ上書きするため、旧eventが再契約後のstateを消し得る。重複eventの同値update自体は概ね収束するが、処理済み判定・監査はない。

secretは`defineSecret`とFunction optionsでbindingされる。値は調査・転記していない。Stripe moduleが現entryから未exportのため、上記はlocal implementation contractであって現在のdeploy候補ではない。

## ContextualError・logging契約

constructorはmessageと任意contextを受け、現在ISO timestampを先に置いた後caller contextをspreadする。この順序のためcallerが`timestamp`を渡すと自動時刻を上書きできる。生成と同時にcontext全体をloggerへ出し、field redaction、size/cycle制限、severity選択はない。arguments、token、住所、User/Company objectを渡した場合は秘密・個人情報をlogし得る。

`getFormattedContext`はmessage/name/contextのplain objectを返すが、stack/causeは含めない。`toDetailedString`はcontextをJSON stringifyするため、循環参照やBigIntでそれ自体がthrowし得る。`Error`のJSON serializationを上書きする`toJSON`はない。repository内に実import/caller/testはなく、JSDocだけがthrow型として言及するためdead-code候補である。

## retry・部分失敗・テスト

- Geocodingは1回だけ外部APIを呼び、全errorを再throwする。callable側はgeneric Errorへ変換する。自動retry/idempotency stateはない。
- Checkout triggerは業務errorをdocumentへ保存してresolveするため自動retryしない。外部成功後の部分失敗をreconcileしない。
- Webhookは例外時400でStripe retryを誘発し得るが、event dedupe/order protectionがない。Company未発見だけは200で捨てる。
- 4ファイルの直接単体test、emulator integration test、webhook fixture testは静的検索で確認できなかった。

## 矛盾・未使用候補と台帳

- geocoding callable commentのCORS記述は疑問符付きで、実optionsは指定しない。認証/App Check/quota境界を説明・強制しない。
- Stripe moduleは詳細実装とUIが存在するがentry export停止中である。
- `ContextualError`はconstructor loggingを伴うが実callerがなく、auth-v2のJSDocと実throw型が一致しない。
- FUT-0099〜0104、FUT-0140、FUT-0143、FUT-0136、FUT-0138へ今回の本文証拠を統合する。既存CONF-0083〜0087、CONF-0114/0115、CONF-0120は設計判断であり、コード事実だけでは解消しない。新規FUT/CONFは追加しない。

## 未確認範囲

remote export/deploy、Stripe/Google console設定、secret値、provider quota・契約、Stripe retry schedule、実event payload、network timeout、runtime memory、log retention/閲覧権限、外部API・Emulator試験は未確認である。
