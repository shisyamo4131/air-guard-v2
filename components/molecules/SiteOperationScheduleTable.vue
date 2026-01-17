<script setup>
/*****************************************************************************
 * 現場稼働予定管理用テーブルコンポーネント
 * - 横長のテーブルになるため、親コンポーネント側をスクロールコンテナとする場合は
 *   `class="d-flex"` を指定すること。
 *
 * @slot - prepend-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の前）
 * @slot - day - 各日付ヘッダーのカスタム表示用スロット
 * @slot - append-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の後）
 * @slot - prepend-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の前）
 * @slot - weekday - 各曜日ヘッダーのカスタム表示用スロット
 * @slot - append-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の後）
 * @slot - prepend-site-order - 各現場行のカスタム表示用スロット（現場オーダー表示部の前）
 * @slot - site-order - 各現場行のカスタム表示用スロット
 * @slot - append-site-order - 各現場行のカスタム表示用スロット（現場オーダー表示部の後）
 * @slot - cell - 各セルのカスタム表示用スロット
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useDateRange } from "@/composables/useDateRange";

/**
 * SETUP PROPS
 */
const _props = defineProps({
  /**
   * 各列の背景色クラス配列
   * - 日付範囲内の曜日に対応する背景色クラスを配列で指定します。
   * - 配列のインデックスは曜日（0=日曜、1=月曜、...、6=土曜）に対応します。
   */
  columnColors: {
    type: Array,
    default: () => [
      "bg-red-lighten-5", // 日曜
      undefined, // 月曜
      undefined, // 火曜
      undefined, // 水曜
      undefined, // 木曜
      undefined, // 金曜
      "bg-blue-lighten-5", // 土曜
    ],
    validator: (v) => v.length === 7,
  },
  /**
   * 日付フォーマット（ヘッダーカラム表示用）
   * - ヘッダーカラムでの日付表示に使用するフォーマット文字列です。
   * - `useDateRange` の `formatDate` を使用してフォーマットされます。
   */
  dayFormat: { type: String, default: "YYYY-MM-DD" },
  /**
   * 日付セルの高さ
   * - 各日付セルの高さを指定します。
   */
  dayHeight: { type: [String, Number], default: undefined },
  /**
   * 終了日付
   * - テーブル表示の終了日付を指定します。
   */
  endDate: { type: [String, Object], required: true },
  /**
   * 祝日配列
   * - 祝日として扱う日付を日付文字列または日付オブジェクトの配列で指定します。
   * - 背景色は日曜日と同じ色が適用されます。
   */
  holidays: { type: Array, default: () => [] },
  /**
   * 現場オーダー配列
   * - 各現場オーダーのデータオブジェクトを含む配列を指定します。
   */
  siteOrder: { type: Array, default: () => [] },
  /**
   * 開始日付
   * - テーブル表示の開始日付を指定します。
   */
  startDate: { type: [String, Object], required: true },
  /**
   * 曜日フォーマット（ヘッダーカラム表示用）
   * - ヘッダーカラムでの曜日表示に使用するフォーマット文字列です。
   * - `useDateRange` の `formatDate` を使用してフォーマットされます。
   */
  weekdayFormat: { type: String, default: "ddd" },
  /**
   * 曜日セルの高さ
   * - 各曜日セルの高さを指定します。
   */
  weekdayHeight: { type: [String, Number], default: undefined },
});
const props = useDefaults(_props, "SiteOperationScheduleTable");

/**
 * SETUP DATE RANGE COMPOSABLE
 */
const dateRangeComposable = useDateRange({
  baseDate: new Date(props.startDate),
  endDate: new Date(props.endDate),
});
const { daysInRangeArray, currentDayCount } = dateRangeComposable;

watch(
  () => props.holidays,
  (newHolidays) => {
    dateRangeComposable.setHolidays(newHolidays);
  },
  { immediate: true, deep: true }
);

/**
 * 日付セルの高さを解決して返します。
 */
const resolvedDayHeight = computed(() => {
  if (!props.dayHeight) return undefined;
  return typeof props.dayHeight === "number"
    ? `${props.dayHeight}px`
    : props.dayHeight;
});

/**
 * 曜日セルの高さを解決して返します。
 */
const resolvedWeekdayHeight = computed(() => {
  if (!props.weekdayHeight) return undefined;
  return typeof props.weekdayHeight === "number"
    ? `${props.weekdayHeight}px`
    : props.weekdayHeight;
});

/**
 * 曜日（0=日曜、1=月曜、...、6=土曜）に対応する背景色クラスを返します。
 */
const cellColorClass = computed(() => {
  return {
    0: props.columnColors[0],
    1: props.columnColors[1],
    2: props.columnColors[2],
    3: props.columnColors[3],
    4: props.columnColors[4],
    5: props.columnColors[5],
    6: props.columnColors[6],
  };
});

/**
 * 現場オーダーと日付オブジェクトからグループキーを生成する
 * @param order
 * @param dayObject
 * @returns {string} グループキー
 */
function getGroupKey(order, dayObject) {
  return `${order.key}-${dayObject.format("YYYY-MM-DD")}`;
}
</script>

<template>
  <v-table id="site-operation-schedule-table" fixed-header>
    <!-- ヘッダー部 -->
    <thead>
      <!-- TR:日付 -->
      <tr>
        <th
          v-for="(dayObject, colIndex) in daysInRangeArray"
          :key="colIndex"
          :style="{ height: resolvedDayHeight }"
          :class="[
            cellColorClass[dayObject.format('d')],
            dayObject.isHoliday ? cellColorClass[0] : '',
          ]"
        >
          <div class="d-flex justify-center">
            <slot name="prepend-day" v-bind="{ dayObject }" />
            <slot name="day" v-bind="{ dayObject }">
              <span>{{ dayObject.format(props.dayFormat) }}</span>
            </slot>
            <slot name="append-day" v-bind="{ dayObject }" />
          </div>
        </th>
      </tr>

      <!-- TR:曜日 -->
      <tr>
        <th
          v-for="(dayObject, colIndex) in daysInRangeArray"
          :key="colIndex"
          :style="{ height: resolvedWeekdayHeight }"
          :class="[
            cellColorClass[dayObject.format('d')],
            dayObject.isHoliday ? cellColorClass[0] : '',
          ]"
        >
          <div class="d-flex justify-center">
            <slot name="prepend-weekday" v-bind="{ dayObject }" />
            <slot name="weekday" v-bind="{ dayObject }">
              <div class="d-flex align-center">
                <span>{{ dayObject.format(props.weekdayFormat) }}</span>
                <v-icon
                  v-if="dayObject.isHoliday"
                  icon="mdi-flag"
                  color="red"
                  size="small"
                />
              </div>
            </slot>
            <slot name="append-weekday" v-bind="{ dayObject }" />
          </div>
        </th>
      </tr>
    </thead>

    <!-- ボディ部 -->
    <tbody>
      <template v-for="(order, rowIndex) in props.siteOrder" :key="rowIndex">
        <!-- TR: siteOrder -->
        <tr>
          <td
            class="bg-grey-lighten-4"
            style="height: unset"
            :colspan="currentDayCount"
          >
            <div class="fixed-left d-inline-flex align-center">
              <!-- SLOT: prepend-site-order -->
              <!-- { siteId, shiftType, key } -->
              <slot name="prepend-site-order" v-bind="{ ...order }" />

              <!-- SLOT: site-order -->
              <!-- { siteId, shiftType, key } -->
              <slot name="site-order" v-bind="{ ...order }" />

              <!-- SLOT: append-site-order -->
              <!-- { siteId, shiftType, key } -->
              <slot name="append-site-order" v-bind="{ ...order }" />
            </div>
          </td>
        </tr>

        <!-- TR: schedule -->
        <tr>
          <!-- スロットで配置されるコンポーネントの高さに従うよう、height は unset にする -->
          <td
            v-for="(dayObject, colIndex) in daysInRangeArray"
            :key="colIndex"
            style="height: unset"
            :class="[
              cellColorClass[dayObject.format('d')],
              dayObject.isHoliday ? cellColorClass[0] : '',
            ]"
          >
            <!-- SLOT: cell -->
            <!-- { siteId, shiftType, date, dateAt, groupKey, dayObject } -->
            <slot
              name="cell"
              v-bind="{
                siteId: order.siteId,
                shiftType: order.shiftType,
                date: dayObject.date,
                dateAt: dayObject.dateAt,
                groupKey: getGroupKey(order, dayObject),
                dayObject,
              }"
            />
          </td>
        </tr>
      </template>
    </tbody>

    <!-- フッター部 -->
    <tfoot v-if="$slots.footer">
      <tr>
        <th
          v-for="(dayObject, colIndex) in daysInRangeArray"
          :key="colIndex"
          :class="[
            cellColorClass[dayObject.format('d')],
            dayObject.isHoliday ? cellColorClass[0] : '',
          ]"
        >
          <!-- SLOT: footer -->
          <!-- { dayObject } -->
          <slot name="footer" v-bind="{ dayObject }" />
        </th>
      </tr>
    </tfoot>
  </v-table>
</template>

<style scoped>
/* 現場オーダー行の固定設定 */
.fixed-left {
  /* background-color: red !important; */
  position: sticky;
  left: 16px; /* td の padding に合わせる */
  z-index: 1 !important;
}
</style>
