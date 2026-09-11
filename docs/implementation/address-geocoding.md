# 住所入力・座標取得の実装差と設計

## 共通仕様との対応（2026-09-06）

保存可否・失敗通知・旧座標消去・不変時保持・古い応答の拒否は[確認済み共通仕様](../specification.md#住所と座標)を参照する。各masterでは取得対象住所・必須項目・用途・actorだけを固有条件として定める。以下の旧hook調査を、専用writer導入後の全masterの実経路と取り違えない。

| 対象 | 今回の静的再照合 | 共通仕様への差・実装時の検証 |
|---|---|---|
| Customer | Customer schemaの`GeocodableMixin` hook、FireModel／ClientAdapterのdocument全体write | create時と住所変更update時の位置情報生成、未取得通知を確認 |
| Site | `composables/application/site/useSiteActions.js`でtransaction外取得、`utils/site/siteWriter.js`で取得基準住所と保存予定住所を照合 | Employeeの最新住所照合へ参考にする。0座標と未取得通知は別に確認 |
| Employee | 旧Manager/model保存。専用保存は未実装 | EMP-02で共通原則を適用。最新権限・RESIGNED拒否・住所競合を最終保存で再確認 |
| Company | `functions/modules/company/updateCompanyProfile.js`は住所変更でlocation/geopointをnull化 | 現専用経路が毎回geocodingすると記載しない。共通化を根拠に座標取得機能を新設しない |
| 共通hook/provider | 0座標のtruthy判定、失敗吸収、認可不足と住所/座標logが残る | FUT-0140〜0143。全体適用済みとはしない。Employeeに必要な経路の是正と他masterの後続対応を分ける |

Employeeの設計では既存shapeを使い、未取得は`location=null`と`geopoint=null`で表現する。保存APIはdocument保存の結果とは別に座標未取得を返し、成功後だけwarningを表示する。providerはtransaction外で呼び、最終transactionで現在認可・状態と取得基準住所を照合する。不一致時は古い結果を破棄しdraftを保持して再読込みを促す。無関係なfield更新では取得も座標patchも行わない。全collection共通の新status fieldや自動再取得jobは追加しない。

共通受入れ例は、取得成功/失敗後の再読込、住所不変/非住所編集の取得0回、0座標、不正座標、取得待ち中の住所変更・権限喪失・退職、Firestore保存拒否/結果不明、transaction再試行での外部呼出し重複なしとする。今回はsource照合だけで、runtime・実provider・実dataは未検証である。

## 旧共通hookの実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-041、SPEC-DEEP-009
- 最終確認日: 2026-08-11
- 根拠ファイル: schemas `src/mixins/GeocodableMixin.js`、`src/parts/accessorDefinitions.js`、`src/parts/fieldDefinitions/oneLine.js`、`select.js`、`object.js`、`Customer.js`、`Site.js`、`Employee.js`、`Company.js`、`plugins/03.air-firebase.init.js`、`functions/modules/geocoding.js`、`functions/modules/utils/geocoding.js`、`functions/modules/firebase.init.js`、`components/Site/CustomInput/index.vue`、`Base.vue`、`components/Employee/CustomInput/ToRegist.vue`
- 関連調査: `customer-master.md`、`site-master.md`、`employee-master.md`、`company-settings.md`、`error-logging-feedback.md`

## 対象・API

| 対象 | API・責務 |
| --- | --- |
| schema住所field | `zipcode`、`prefCode`、`city`、`address`、`building`、`location`。`prefecture`と`fullAddress`は読み取り専用プロパティ。 |
| `air-postal-code` | zipcode入力と`update:address` event。結果の`prefcode/address1/address2/address3`を住所fieldへ反映する。内部providerは本repoから確認不能。 |
| `GeocodableMixin` | create/update前のgeocoding、`location`設定、Firestore converterで`geopoint`生成。 |
| client plugin | Callable `geocoding({address})`をMixinへ注入。error時はconsole出力後nullを返す。 |
| Callable `geocoding` | addressの存在・stringだけを検証し、server utilityを呼ぶ。 |
| `fetchCoordinates` | Google Maps Geocoding APIへaddressを送り、`lat/lng/formattedAddress`を返す。 |
| server adapter初期化 | Functions内部でMixinへ`fetchCoordinates`を直接注入する。 |

Functions 2ファイルの公開API、入口、provider error/log契約のfile単位確認は[Geocoding・Stripe・ContextualError Functions deep review](geocoding-stripe-error-functions-deep-review.md)を参照する。

## 住所データ契約

- `zipcode`: 共通one-line field、default null、postal componentを使う。format、桁数、hyphen、全半角のschema validatorは確認できない。
- `prefCode`: 2桁想定のselectで都道府県optionsを使う。`prefecture`はprefCodeからtitleを求め、不明codeはwarning後空文字になる。
- `city`: 最大20文字。
- `address`: 「町域名・番地」、最大30文字。
- `building`: 「建物名・階数」、最大30文字。
- `fullAddress`: `prefecture + city + address`。zipcodeとbuildingは含まない。
- `location`: `{formattedAddress, lat, lng}`。hidden fieldで、geocoding成功時だけ設定する。
- `geopoint`: converterがlocationのlat/lngからFirestore GeoPointを追加する。schema classPropsとして全modelに明示されるfieldではなく、converter出力である。

trim、Unicode正規化、数字・hyphen正規化、空白挿入、建物分離、住所一意性は実装されない。

## 入力・validation

1. zipcode fieldの既定componentは`air-postal-code`である。
2. componentが`update:address`をemitすると、field definition callbackが`prefCode`、`prefecture`、`city`、`address`を一括更新する。
3. `prefecture`は読み取り専用でsetterが空のため、event結果の`prefecture`代入は保存値にならず、実効値はprefCodeから再導出される。
4. 利用者はprefCode、city、address、buildingを手入力で変更できる。Site/Employee custom inputではこれらの結線を確認した。
5. requiredはmaster別に異なり、format検証より存在検証が中心である。

郵便番号検索の外部provider、network contract、候補0件・複数件・error表示、cache、retry、rate limitは、利用componentの実装が確認範囲外にあり未確認である。

## geocoding flow

### client create/update

1. `GeocodableMixin.beforeCreate`は`skipGeocoding`でなければ必ず`fullAddress`を処理する。
2. `beforeUpdate`は現在と`_beforeData.fullAddress`が一致すればskipする。zipcode/buildingだけの変更はfullAddressに含まれないためgeocodingしない。
3. plugin注入関数がFirebase Callable `geocoding`へfullAddressを送る。
4. CallableがGoogle Maps Geocoding APIへaddressを送る。
5. 成功時、Mixinは`formattedAddress/lat/lng`をlocationへ保存し、converterがgeopointを生成する。
6. provider無効応答・callable error・注入関数なしの場合、Mixinはlocationをnullにし、create/update自体は継続する。

### server利用

Functions側では同じMixinへ`fetchCoordinates`を直接注入するため、server model create/updateはCallableを経由せずproviderへ到達する。`skipGeocoding:true`なら住所変更検査も実行せず、既存locationを維持したまま保存できる。

成功判定は`coordinates.lat && coordinates.lng`、GeoPoint生成も`obj.location?.lat && obj.location?.lng`であるため、緯度または経度が数値0の正当な座標を失敗扱いする。

## master別利用

| master | required住所field | 入力・自動更新 | location |
| --- | --- | --- | --- |
| Customer | zipcode/prefCode/city/address required、building任意 | schema既定field componentによるpostal/手入力。保存hookでgeocode。 | hidden |
| Site | prefCode/city/address required、zipcode/building任意 | custom inputでpostal component、都道府県select、各text field。保存hookでgeocode。 | fieldはhidden指定でなく、custom UIで直接表示は未確認 |
| Employee | zipcode/prefCode/city/address required、building任意 | 登録custom inputでpostal componentと手入力。保存hookでgeocode。 | hidden。個人住所である |
| Company | 全住所field任意 | schema既定componentをmanagerが生成する範囲。保存hookでgeocode。 | hidden |

Employeeの`emergencyContactAddress`と`domicile`は独立stringで、GeocodableMixinのfullAddress/geocoding対象ではない。

## failure・cache・rate

- 空fullAddressはlocation=nullにする。
- geocoding関数未注入、Callable失敗、provider非OK、座標shape不正はlocation=nullとなり、master保存をblockしない。
- 住所変更失敗時は旧locationを残さずnullへ置換するため、通常経路ではstale座標より座標欠損になる。
- `skipGeocoding:true`で住所を変えると旧location/geopointを維持し得る。確認できた直接利用はmigrationだけで、通常UIは指定しない。
- HTTP status、response.ok、provider結果配列の存在を独立検証せずJSONと先頭resultを前提にする。timeout、Abort、retry、backoff、cache、dedupe、quota/rate limitはない。
- Callableはprovider/null/errorをgeneric `Error`へ変換し、`HttpsError` code、retryable分類、安全なuser messageを保持しない。
- client pluginがerrorをnullへ変換し、Mixinもerrorを吸収するため、保存callerはgeocoding失敗を成功した保存と区別できない。

## privacy・security

- Callableは`request.auth`、tenant、role、App Checkを検証せず、任意addressをproviderへ送れる。未認証・自動呼出しによるquota/cost消費を防ぐapplication制御は確認できない。
- providerへCustomer/Site/Company所在地およびEmployee自宅住所を送る。利用目的、同意、provider privacy、保持、regionはコードから確認できない。
- server utilityは成功時に緯度経度、失敗時に入力addressとprovider responseをlogする。Callable errorもaddressをmessageへ含める場合があり、個人住所・座標がlogへ残る候補である。
- API keyはFunctions parameterから取得しclientへ直接返さない。値は読取・転記していない。
- address長上限、rate limit、abuse monitoringがCallable入口にない。

## 矛盾・未使用候補

- Siteのclass commentはfullAddressにzipcode・buildingも含むと記すが、共通accessorはprefecture・city・addressだけを結合する。
- postal callbackは読み取り専用`prefecture`も更新対象に含めるが、setterは何もしない。
- building/zipcode変更ではgeocodeしない。座標精度にbuildingを含める意図は未決定である。
- 0緯度/経度をtruthy判定で拒否し、正当な座標・GeoPointを保存できない。
- providerの`formattedAddress`はlocation内に保存するが、入力住所fieldを正規化して上書きしない。
- address→locationを使う直接的なmap UIや検索利用は本範囲では確認していない。

## 将来要対応

- FUT-0140: geocoding Callableの認証・濫用・quota境界を実装する。
- FUT-0141: geocoding失敗・stale/null・0座標・保存判定を一貫させる。
- FUT-0142: 住所field・fullAddress・郵便番号正規化契約を統一する。
- FUT-0143: 個人住所・座標のprovider送信とlog privacyを設計する。

## 要確認事項

- CONF-0117: geocoding失敗時の保存可否とlocation必須用途。
- CONF-0118: 郵便番号provider・正規化・候補選択契約。
- CONF-0119: fullAddressの粒度と建物・郵便番号・正規化住所の扱い。
- CONF-0120: Employee個人住所のgeocoding目的・同意・保持・log方針。

## 未確認範囲

- `air-postal-code`内部、郵便番号provider、外部利用規約・quota・料金・SLA。
- 実Callable/API実行、parameter値、実住所・座標、Firebase/Google console設定。
- map UI、距離検索、tracking、geopoint query、migration実行結果、全master CRUD UI。
