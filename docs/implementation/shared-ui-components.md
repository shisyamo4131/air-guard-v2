# 共通UIコンポーネント実装カタログ

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-033
- 最終確認日: 2026-08-11
- 根拠ファイル: `components/atoms/`、`components/molecules/`の選定対象、`components/Tag/`、各`Autocomplete.vue`、`ShiftType/`、`SecurityType/Select`、`DayType/Chip.vue`、`IsStartNextDay/Checkbox.vue`、直接composable

## 選定基準

atoms/molecules、または複数の予定・実績・請求・勤怠・master画面から参照される入力、選択、操作、dialog、tag/status表示を対象とした。個別業務のmanager/editor、layout/navigation、Air Vuetify内部は除外した。

## カテゴリ・API表

| 分類 | component | 主なAPI・責務 |
|---|---|---|
| 入力 | `AtomsSearchTextField` | AirTextFieldへcompact/clear/search icon/SEARCH label等のdefaultを与える。attrs/model/eventはrootへ透過 |
| 入力 | `AtomsHourInput` | model minutesを表示hoursへ変換。`precision=1`、null/非numberはnull、hours×60をroundして`update:modelValue` |
| 選択 | Article/Customer/Employee/Outsourcer/Site Autocomplete | label/itemTitle/itemValue/returnObject、master検索APIとID fetch、`update:model-value`。Customer等は`creatable`でmanagerを開く |
| 選択 | `MoleculesMonthSelector` | Date model、前後月button、`update:modelValue/from/to/date-range`。JST月初/月末をemit |
| 選択 | ShiftType Tabs/RadioGroup、SecurityType Select | schema constantsから選択肢を生成しmodel更新。RadioGroupは`useAll` |
| 操作 | Atoms Submit/Select/Edit/Cancel | color/icon/prependIcon/text、clickを再emit。`useBtns`でicon表示とtext表示を切替 |
| 操作 | Molecules Actions SubmitCancel/SelectCancel/Edit | disabled/loadingをbuttonへ配線。処理自体は行わずclick eventのみemit |
| dialog | `AtomsDialogsFullscreen` | Vuetify mobileではfullscreen、全slot/attrsをv-dialogへ透過 |
| dialog | `MoleculesCardsSelectCancel` | activator/dialog/internal selection、select時だけmodel emit、cancel/closeでrollback・子reset |
| 表示 | `Tag` / `MoleculesWorkerTag` | label、variant、size、loading、drag icon、remove action、時刻footerと多数slot |
| 表示 | `MoleculesActivatorCard` / FloatingTitleCard | toolbar/cardのtitle・編集action・header/default/footer slot |
| 表示 | DayType/ShiftType Chip | constantのtitle/colorをchip表示。不明値は`ERROR` |
| 補助 | `AtomsAlertsWarn` | warning v-alertのborder/density/variant defaultとslot |
| 補助 | `IsStartNextDayCheckbox` | AirCheckbox labelへ翌日開始のtooltipを追加 |
| 配置 | `MoleculesWorkerSelector` | employee/outsourcer tab、カナfilter、slot表示、drag clone source |
| floating | `MoleculesFloatingWindow` | desktop/touch drag、viewport内clamp、close/move、unmount時document listener cleanup |

## event・data flow

共通componentは原則としてmodel/eventを親へ返し、create/update/deleteを自身では実行しない。例外的にAutocompleteの`creatable` slotは業務Managerを内包してcreate UIを起動するが、保存はManager handler側である。Action群はclickをemitするだけで、親がloadingをtrueに戻すまで再clickを内部で抑止しない。

Autocompleteは`useFetch`で親provideをinjectし、N-gram検索を`returnAllCached:false`でAirAutocompleteApiへ渡す。client追加filterを常時trueとしてserver検索結果をそのまま候補にする。既存key表示は`getX`で取得する。

## validation・state

- HourInputは型変換のみで、min/max/requiredはAirNumberInputへ渡されたattrs側に依存する。
- enum inputsの一部はschema constant validatorを持つが、DayTypeChipはvalidatorを持たず不明値をERROR表示する。
- Action群はloading中にcancelとprimary actionをdisabled、primaryにはloading indicatorを出す。
- Tagはloading中にlabelを隠しprogressを表示し、remove/drag/highlight/disabledは表示契約である。
- error/empty表示を統一する独立共通componentは、選定範囲ではWarn alert以外に確認できない。Autocompleteの検索error表示はAir componentと`useFetchBase` loggerに依存する。

## accessibility・responsive

Fullscreen dialogはVuetify `mobile`判定でresponsive化する。Tagは長文ellipsis、mobile時loading text省略、progressに`aria-label="読み込み中"`を持つ。FloatingWindowはmouse/touch dragとviewport clamp、listener cleanupを実装するがkeyboard移動はない。

MonthSelectorの左右icon button、Autocompleteの作成用`v-icon`、Tagのremove iconなどにはコード上で明示的な日本語aria-labelが揃っていない。iconだけの意味がassistive technologyで伝わるかはVuetify/Air componentの内部defaultに依存する。WorkerSelectorのdragはtouch fallbackを持つがkeyboardによる並替え/選択代替は確認できない。

## 直接依存

Vue/Vuetify、dayjs timezone、vuedraggable、schema constants、`useFetch`、`useConstants`、`useKatakanaFilter`、AirTextField/NumberInput/AutocompleteApi/Select/Checkbox、業務ListItem/Managerに依存する。Air Vuetify内部は未確認である。

## 利用例

- HourInput: 取極め、配置通知、予定、実績、請求調整の時間・分入力。
- MonthSelector: 勤怠一覧/出力、稼働実績一覧、請求稼働一覧、取引先請求。
- SubmitCancel: Site/Customer/Employee/OperationResult詳細、並替え、複製。
- Autocomplete: SiteのCustomer選択、予定/実績/請求のSite選択、商品明細選択。
- Fullscreen dialog: 稼働予定選択・並替え、汎用SelectCancel card。

## 矛盾・未使用候補

- OutsourcerAutocompleteのdefault item rendererが`EmployeeListItem`で、コメントもemployee作成のまま残る。外注用表示契約との不一致候補である。
- ShiftTypeTabsのwatch callbackはoldValueを受けるが未使用で、props同期直後にもupdateをemitし得る。
- Action wrappersは同じ`$attrs`をcancel/submit両方へ後勝ちmergeするため、親のbutton属性やclick属性が両方へ伝播し、個別指定しにくい。
- `useBtns`自身のコメントにも単純すぎる可能性が記録される。
- error/empty/focus回復を統一するapp共通契約は見つからず、外部Air componentまたは各親へ分散する。

## Molecules deep-review addendum

- SPEC-DEEP-028で`components/molecules/**` 12ファイルをfile単位確認した。Action wrappersは同期emitだけで、同じ`$attrs`を複数buttonへbindする。`cards/SelectCancel`は内部model update handlerのconst再代入、`WorkerSelector`は未発火`tab-changed`、Employees等のcallerは[shared molecules deep review](molecules-components-deep-review.md)を参照する。
- `FloatingWindow`はmouse/touch document listenerをunmount時に解除するが、keyboard drag/Escape/close buttonの明示labelはない。`MonthSelector`は操作時だけrange eventをemitし、初期rangeは通知しない。

## 将来要対応

FUT-0115〜FUT-0117を`future-actions.md`へ追加した。

## 要確認事項

CONF-0096〜CONF-0097を`pending-confirmations.md`へ追加した。

## Atoms button / chip deep-review addendum

- SPEC-DEEP-017 confirmed that the four `AtomsBtns*` wrappers have only color/icon/prependIcon/text as explicit props; `v-btn` attributes fall through, while `useBtns` replaces the binding `onClick` key.
- The atom wrappers neither latch submission nor validate/authorize/persist; their parent remains responsible for loading, duplicate prevention, errors, retry, and accessible names in icon mode.
- `components/atoms/chips/{ArrangementNotification,isStartNextDay}.vue` had no static caller. They are separate from the currently referenced notification chip and next-day checkbox; `ArrangementNotification` has no unknown-status safe fallback. See [Atoms buttons / chips deep review](atoms-buttons-chips-deep-review.md).

## 未確認範囲

### SPEC-DEEP-018 addendum

- `AtomsHourInput` performs only minute/hour conversion; NaN and infinities pass its JavaScript number check, while min/max/required/finite validation is delegated to root attributes and Air input runtime behavior.
- `AtomsQualifiedTypeChip` declares `label` and `variant`, but neither is bound to its `v-chip`. Billing/Qualified chips use `ERROR` display fallback; static callers were not found for either chip, Alert Warn, or HolidayFlag.
- SearchTextField and Fullscreen dialog are presentation wrappers: queries/errors and dialog open/close/focus policy remain caller/Vuetify behavior. Draggable is only a cursor/icon affordance and HasLicense/HolidayFlag rely on caller or library accessibility attributes.
- Full file-level evidence is in [Atoms core controls deep review](atoms-core-deep-review.md).

### SPEC-DEEP-019 addendum

- DayType/ShiftType chips use `ERROR` fallback, while EmploymentStatus directly indexes its constant. ShiftType Tabs/RadioGroup use different option sources and only RadioGroup exposes UI-only `ALL`.
- WeeklyOperationQuantityBar uses known security-type datasets, leaves unknown types invisible, does not use its public `label`, and captures `hideLabel` in a non-reactive options object. Its loading/error/empty behavior remains outside the chart atom.
- Tag lowercases only for validation but applies the original variant to CSS class names; uppercase accepted variants therefore do not match the lowercase styles. IsStartNextDay and SecurityType wrappers delegate model/validation/accessibility to Air controls.
- Full file-level evidence is in [Enum display, chart, and Tag deep review](enum-display-chart-tag-deep-review.md).

Air Vuetify内部のARIA、keyboard、debounce、error/empty、validation、dialog focus trap、各業務専用component、実ブラウザ・mobile・screen reader検証は未確認である。

## Organisms deep-review addendum

SPEC-DEEP-032で`components/organisms/**`の6ファイルをfile単位確認した。`ChangeAdminUserDialog`は`UsersManager`から到達し、4段階dialog、open/close購読、loading中の再実行抑止、`changeAdminUser` callable呼出しを持つ。WindowItem 1〜4はinjectされたUser/selectionを表示する薄いchildで、独自props/emits、validation、error、ARIA/focus契約はない。`SiteOrderManager.vue`は`siteOrder`の旧drag/submit wrapperで、直接callerを確認できないlegacy候補である。

admin移譲のclient `auth.isAdmin` guardとcallableのserver検証差は[User/Auth lifecycle](user-auth-lifecycle.md)および`FUT-0080`、icon/dragとdialog focusの共通課題は`FUT-0115`、fileごとの根拠は[Organisms components deep review](organisms-components-deep-review.md)を参照する。
