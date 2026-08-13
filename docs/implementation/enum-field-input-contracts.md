# Enum・field definition・input contracts

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-060
- 最終確認日: 2026-08-11
- 固定母集団: `coverage-audit.md`の28 files（schema constants/error/field definitions 15、app input/display components 13）
- 直接照合: schemas `select.js`と直接model validator/default、app `useConstants.js`と直接caller
- 制約: 個別業務flow、runtime、実dataは調査していない。

## domain別契約

| domain | 保存値 / 候補 | default / nullable | UI・schema整合 |
| --- | --- | --- | --- |
| 勤務区分 | string `DAY` / `NIGHT` | `DAY` | Tabs/Chipは2値validator、Radioは同2値に表示filter専用`ALL`を追加。schema `shiftType`はitems/defaultを持つが集合validatorなし |
| 曜日区分 | string `WEEKDAY` / `SATURDAY` / `SUNDAY` / `HOLIDAY` | `WEEKDAY` | Chipはunknownを`ERROR`表示。schema selectは候補/defaultのみで集合validatorなし。`getDayType(Date)`はholiday→Sun→Sat→weekday |
| 請求単位 | string `PER_DAY` / `PER_HOUR` | `PER_DAY` | Chip propは2値validator。schema fieldはitems/defaultだけで集合validatorなし |
| 雇用状態 | string `ACTIVE` / `RESIGNED` | `ACTIVE` | Chipはunknown fallbackがなくlookup property accessでerror候補。Employee transition固有validationはあるが汎用field自体に集合validatorなし |
| 性別 | string `MALE` / `FEMALE` | `MALE` | schema items/defaultのみ。非binary/unknown/未回答値なし、nullable方針なし |
| 血液型 | string `A` / `B` / `O` / `AB` | `A` | Employeeは警備員登録時にrequired＋集合validator。未登録時のnull/旧値扱いはmodel条件依存 |
| 緊急連絡先続柄 | string `PARENT` / `SPOUSE` / `CHILD` / `SIBLING` / `OTHER` | `PARENT` | Employeeは警備員登録時にrequired＋集合validator。`OTHER`詳細は別field validation |
| 都道府県 | 2桁string `01`〜`47` | null | optionsとlength 2はあるが集合validatorなし。任意2文字やtypoをfield definition単体では拒否しない |
| 支払月 | number `0`〜`6` | `1` | numberとして保存。options/defaultのみでinteger/range validatorなし |
| 曜日番号 | number `0`〜`6` | Companyの該当fieldは`0` | optionsは数値。汎用定義単体のrange validatorなし |
| 警備種別 | string `UNSET/FACILITY/CROWD/TRAFFIC/TRAINING/OTHER` | `UNSET` | Selectは同constantからitems化。field definitionに集合validatorなし。TRAININGだけsales/quantity aggregation false |
| 資格単価区分 | string `BASE` / `QUALIFIED` | component required | schema constantではなくapp `useConstants`内にhard-code。Chip validatorあり、unknownは`ERROR` |

`useConstants`はschema constantへCompany color overrideを重ねる。value/titleはschema由来だが、資格単価区分だけapp local定義である。色変更は保存値を変えない。

## field definition共通契約

- `defaultDefinition`はtype String、default nullで、required/length/validatorはundefinedである。
- `dateTimeAt`はtype Object、default null。Date/Timestamp/valid dateをfield definition自体では検証しない。
- `multipleLine`はString/null、length 200とUI maxlength/counterを持つが、当該definition内validatorはない。`notificationError`と`remarks`は同型でlabelだけが異なる。
- `radio`は汎用radio componentを指定するだけで、候補・default・validatorを持たない。
- select系enum fieldはitemsとdefaultを定義するが、多くはallowed values validatorを定義しない。UI選択は候補へ制限しても、direct assignment、旧document、Rules/Admin SDK経路のunknownをmodel field単体では拒否しない。
- `VALIDATION_ERRORS`は11 factoryを持ち、error objectはcode、英語message、日本語messages.jaを返す。

## UI component契約

| component群 | unknown / nullable | 保存作用・注意 |
| --- | --- | --- |
| ShiftType Tabs/Chip | prop validatorでDAY/NIGHT。Chipはlookup失敗時`ERROR` | Tabs emitはstring。Radioの`ALL`はfilter専用で、保存fieldへ渡すとschema集合外 |
| DayTypeChip | required string、unknownは`ERROR` | display only |
| EmploymentStatusChip | required string、unknown/null fallbackなし | display時TypeError候補 |
| SecurityTypeSelect | `$attrs`をAirSelectへ渡し、itemsはschema定数 | component自身はmodel validatorなし |
| BillingUnitType/QualifiedType Chip | required＋2値validator、unknown表示は`ERROR` | display only。QualifiedTypeはschema exportと共有しない |
| Tag 3 files | size small/medium/large、variant default/success/warning/error/disabled | UI-onlyで業務enum保存ではない。validatorは大文字小文字を許すがvariant classはraw値を使うため大文字値はstyle不一致候補 |
| HolidayFlag / HasLicense | color stringだけ | boolean/資格IDを保持せず、親の条件判定をicon表示するだけ |

Tagはlabel欠損をloadingと同一扱いにするため、正当な空labelと未取得を区別しない。removeはeventをemitするだけで外部作用は親責務である。

## validation不整合

### 存在しないerror factory

`VALIDATION_ERRORS`には`REQUIRED_FIELD_ERROR(fieldName)`があるが`REQUIRED_ERROR`はない。直接import検索では`Article.js`と`ArticleDetail.js`がrequired branchで`VALIDATION_ERRORS.REQUIRED_ERROR()`を呼ぶ。該当branchへ到達すると意図したvalidation error objectでなくTypeErrorになる確定不整合である。

### 候補と保存集合

- `shift-type.VALIDATOR`は`Object.keys(VALUES).includes(value)`で、現在はkeyとvalueが同名なので一致する。将来key/valueを分離すると誤判定する。
- prefecture/payment month/gender/employment status/day type/day-of-week/billing unit等はoptionsとdefaultがあるだけで、field definitionに共通集合validatorがない。
- Employeeのblood type/emergency relationはmodel固有validatorを持つが、同じconstantを使う全modelで同等強制される保証はない。
- Rulesはenum集合を横断強制しないため、client UI validationをserver enforcementとは扱えない。

## 旧値・deprecated・同名別意味

- unknown/removed valueの共通表示はない。Chipにより`ERROR`、例外、空/undefinedが混在する。
- enum definitionにdeprecated alias、version、migration mapはない。
- `ALL`はShiftType filter UIだけの値で、保存enumではない。
- `Tag.variant=disabled`は見た目のvariantで、業務status/disabled fieldではない。
- `HolidayFlag`は日付のHOLIDAY enumを保存せず、親判定の視覚表示だけである。
- `HasLicense`は資格有無のiconで、Certification ID/type/statusとは別意味である。
- `QUALIFIED_TYPE`は請求/配置上の基本・資格区分で、従業員資格masterのtypeとは同一contractではない。

## 未使用候補

- `QualifiedTypeChip`、`BillingUnitTypeChip`、`HolidayFlag`はtemplate callerを対象検索で確認できず、Vuetify aliases登録またはauto-import経由のdynamic利用を除けば未使用候補である。
- DayType/EmploymentStatus/SecurityType/ShiftType/Tag/HasLicenseは直接callerがあり到達する。
- `radioFields.radio`、`dateTimeAtFields.dateTimeAt`はaggregate `defField`経由のため、直接import欠如だけでunusedとは判定しない。

## 横断risk・将来要対応

- FUT-0166: error factory名、enum validator、unknown fallback、legacy mappingを単一contractへ揃える。
- typo/unknownが保存された場合、表示error、集計除外、key不一致、再保存失敗がdomainごとに異なり得る。
- CONF-0137で、unknown/廃止値をreject、legacy mapping、read-only表示、fallbackのどれにするかを上位判断する。
- role/permission enumは別の`authorization-model.md`のscopeであり、本28 filesに含めない。

## 未確認範囲

- BaseClass/FireModelがtype/required/length/validatorを実行する正確な時点と旧data hydration時の挙動。
- 全Rules、Admin SDK、migration、実dataのunknown/旧値件数。
- Vuetify/Air componentがitems外自由入力を許すruntime挙動。
- 28 files外の全constants、全field definitions、全domain validator。
