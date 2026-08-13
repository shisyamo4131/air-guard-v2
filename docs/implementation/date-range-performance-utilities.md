# Date range・performance utilities

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-061
- 最終確認日: 2026-08-11
- 固定母集団: `useDateUtil.js`、`useDateRange.js`、`useTimedSet.js`、`usePerformanceOptimization.js`、`validators/rangeValidator.js`
- 直接関連: `plugins/06.dayjs.js`、直接import caller、range query constraints
- 制約: runtime、実data、各caller業務本文は未確認。

## timezone・日付表現

dayjs pluginはlocale `ja`、UTC/timezone/isSameOrAfterを登録し、default zoneを`Asia/Tokyo`へ設定する。`useDateUtil`はDateを`dayjs(date).tz()`、非Dateを`dayjs.tz(value)`でJST解釈する。format/holiday/range表示はこのJST変換を使う。

一方、`isValidDate`だけは`dayjs(date).isValid()`でdefault timezone conversionを明示しない。文字列のtimezone offset有無やparser許容が他APIと完全に同一とは保証しない。native DateはUTC epochを保持し、Firestore queryへ渡す境界ではJST day start/endを対応するUTC instantとして表す。

Asia/Tokyoは現在DSTを採用しないため通常日は24時間だが、utilityはzoneをparameter化せずJST固定である。他zone/DSTの正式対応はない。

## `useDateUtil`

| API | 入力・結果 | invalid behavior |
| --- | --- | --- |
| `validateAndProcessDateRange(from,to)` | `to` numberならfromからcalendar day加算。date/stringなら両端比較 | console error＋null。number 0可、負数不可。小数/Infinity/NaNは明示拒否しない |
| `validateDateRange(from,to)` | 同値を許す包含range | console error＋false |
| `formatDate(date,format)` | JST format、default `YYYY-MM-DD` | console error＋null |
| `isValidDate(date)` | dayjs parser validity | boolean。typeをDate/stringに限定しない |
| `isHoliday(date)` | JST Dateへ変換しholiday-jp | 事前validity確認がなくinvalidをproviderへ渡す |

errorはstore/loggerへ結線せずconsoleだけで、callerがnull/falseを扱う必要がある。

## `useDateRange`

### 範囲契約

- defaultは今日をbaseに14日。
- startは`baseDate + offsetDays`のJST `startOf(day)`。
- endはstartから`dayCount - 1` calendar day後のJST `endOf(day)`。
- よってFirestore query callerの`>= from` / `<= to`では両端包含である。
- endDate初期指定時はJST day diff + 1でdayCountを決め、endDateを優先する。
- 月移動は移動先月の初日〜末日へ再設定する。
- `daysInRangeMap`はstartからdayCount回を昇順挿入し、keyはJST `YYYY-MM-DD`。Arrayも同じ安定順である。

dayCountはnumberかつ`>0`だけを検証し、integer、finite、最大値を要求しない。小数/Infinityでend計算やloop件数が予測しにくくなり、非常に大きい値はO(dayCount)の日付生成・祝日判定・render/query期間へ波及する。offsetも任意numberでfinite/integer制約がない。

`dateRange` setterは`to`がDateの場合、現在の`startDate`との差+1を設定する。fromとtoを同時に渡すと`setBaseDate(from)`後にreactive computed startを参照するため通常は新fromを使うが、invalid to/stringは無視する。`moveToDate`はtargetDateを事前検証せずInvalid Dateをstateへ入れ得る。

### debounce・caller差

即時`dateRange`と500ms defaultの`debouncedDateRange`を並行公開する。Schedule table/displayは即時rangeを使い、Firestore data layerはdebounced start/endを使うcallerが多いため、操作直後最大delay間は見出しとdata queryが異なる期間を示し得る。`flushDebounce`で同期可能だがcallerごとの使用は統一されない。

直接callerはarrangements、operation schedules、OperationResult、Billing operations/customer billing、Site detail schedule、Attendance index/export、dashboard chart、recent arrangements等である。data layerのrange queryは概ね`>= from`/`<= to`で包含するが、Employee/Outsourcer等はdomain固有overlap条件を持つため「同じrange utility＝同じ抽出意味」ではない。

## `rangeValidator`

- `rangeIsRef`はfrom/toがVue Refかだけを確認し、内容は見ない。
- `rangeIsValid`はunref後が`instanceof Date`か、from <= toかを確認し、違反時TypeError/RangeErrorをthrowする。
- `new Date(NaN)`もDate instanceなのでvalidとして通る。timezone、start/end-of-day、max spanは確認しない。

`useDateUtil.validateDateRange`がboolean、`rangeIsValid`がthrow、`useDateRange` setterがwarnして旧値保持という3種類のinvalid contractが共存する。

## timer・cache・subscription

### `useTimedSet`

keyをSetへ追加しtimeout後に削除する。既配置worker強調表示で直接利用される。timer IDをkey別に保持せず、manual remove後に同keyを再addすると旧timerが新しいentryを早期削除し得る。unmount時cleanup、clear-all、timeout validationはない。

### `useDebouncedRef`

`useDateRange`から直接利用される唯一のperformance exportである。単一timerを更新時にclearし、`immediate`はtimer取消し＋両ref同期する。unmount時clearしないため、破棄後もcallbackが発火し得る。delayの負/NaN/Infinity validationはない。

### その他performance exports

直接import callerを確認できなかったため未使用候補である。

- `useMemoizedComputed`: dependenciesを`join('|')`またはJSON文字列化してMap cache。primitive delimiter/object string衝突、circular JSON例外、TTL後も当該key再訪までcleanupしない。
- `useShallowComputed`: computed resultの参照同一性だけを比較。
- `useBatchProcessor`: max sizeでqueueをspliceし、errorをconsole後に吸収。processing lockがなくasync batch重複、flush完了待ち不可、timer cleanupなし。
- `useFrameThrottled`: requestAnimationFrame 1件へlast argsを畳む。cancel/unmount/SSR guardなし。
- `useMemoryMonitor`: Chromium非標準`performance.memory`。startはinterval IDだけを返しstop/auto cleanupなし。
- `useLazyLoader`: IntersectionObserverをvisibility後だけdisconnect。未表示のままunmountするcleanupなし。

## 同等utility・重複

- schema packageにも`getDateAt`/`formatJstDate`があり、app `useDateUtil`とJST format責務が重複する。
- date validationはdayjs boolean、Date instanceof、schema field type Objectに分散する。
- debounceは`useDebouncedRef`で提供するが、他data layerはwatch/subscription timingを個別実装する。
- holiday判定はschema day-type `getDayType`とapp `useDateUtil.isHoliday`の双方がholiday-jpを直接使う。

## 横断risk・将来要対応

- FUT-0167: range入力検証、timer/observer cleanup、single-flight/cache keyを共通化する。
- CONF-0138: 正式なJST両端包含、最大range、invalid/fallback、即時UI対debounced queryの契約を決める。
- 個別CSV/PDFの日跨ぎ・UTC filenameは既存文書のscopeであり、このutilityが一律に決めない。

## 未確認範囲

- runtimeのdayjs parser、holiday-jp timezone、Firestore Timestamp conversion、ブラウザtimer throttling。
- 実range size、render/query性能、route離脱後callback、memory/observer leakの再現。
- callerごとのquery内部・sort・pagination・index、schema utilityの全実装。
- Node/SSRでperformance/requestAnimationFrame/IntersectionObserverを呼ぶ経路。
