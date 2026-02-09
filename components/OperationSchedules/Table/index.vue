<script setup>
/*****************************************************************************
 * 稼働予定管理用テーブルコンポーネント
 * - 横長のテーブルになるため、親コンポーネント側をスクロールコンテナとする場合は
 *   `class="d-flex"` を指定すること。
 *
 * @property {Object} cachedSites - キャッシュ済み現場データオブジェクトマップ
 * @property {Array} columnColors - 各列の背景色クラス配列
 * @property {String|Number} columnWidth - 各列の幅
 * @property {String} dayFormat - 日付フォーマット（ヘッダーカラム表示用）
 * @property {String|Number} dayHeight - 日付セルの高さ
 * @property {String|Object} endDate - 終了日付
 * @property {String} holidayIcon - 祝日アイコン
 * @property {String} holidayIconColor - 祝日アイコンの色
 * @property {Array} schedules - 現場稼働予定ドキュメントの配列
 * @property {Array} siteShiftTypeOrder - 現場オーダー配列
 * @property {String|Object} startDate - 開始日付
 * @property {String} weekdayFormat - 曜日フォーマット（ヘッダーカラム表示用）
 * @property {String|Number} weekdayHeight - 曜日セルの高さ
 *
 * @emits click:cell - 各セルクリック時に発火するイベント
 *
 * @slot - prepend-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の前）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 * @slot - day - 各日付ヘッダーのカスタム表示用スロット
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 * @slot - append-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の後）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 * @slot - prepend-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の前）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 * @slot - weekday - 各曜日ヘッダーのカスタム表示用スロット
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 * @slot - append-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の後）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 * @slot - prepend-site-shift-type-order - 各現場行のカスタム表示用スロット（現場オーダー表示部の前）
 *         @property {Object} order - 現場オーダー情報オブジェクト
 *         @property {string} order.siteId - 現場ID
 *         @property {string} order.shiftType - シフトタイプ
 *         @property {string} order.key - 現場オーダーキー（`${siteId}-${shiftType}`）
 * @slot - site-shift-type-order - 各現場行のカスタム表示用スロット
 *         @property {Object} order - 現場オーダー情報オブジェクト
 *         @property {string} order.siteId - 現場ID
 *         @property {string} order.shiftType - シフトタイプ
 *         @property {string} order.key - 現場オーダーキー（`${siteId}-${shiftType}`）
 * @slot - append-site-shift-type-order - 各現場行のカスタム表示用スロット（現場オーダー表示部の後）
 *         @property {Object} order - 現場オーダー情報オブジェクト
 *         @property {string} order.siteId - 現場ID
 *         @property {string} order.shiftType - シフトタイプ
 *         @property {string} order.key - 現場オーダーキー（`${siteId}-${shiftType}`）
 * @slot - cell - 各セルのカスタム表示用スロット
 *         @property {String} siteId - 現場ID
 *         @property {String} shiftType - シフトタイプ
 *         @property {String} date - 日付（YYYY-MM-DD形式）
 *         @property {Object} dateAt - 日付（dayjsオブジェクト）
 *         @property {String} groupKey - グループキー（`${siteId}-${shiftType}-${date}`形式）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *         @property {Number} count - 必要人員数
 *         @property {Boolean} hasMultiple - 必要人員が複数かどうか
 *         @property {Number} total - 総必要人員数
 *         @property {Array} schedules - 現場稼働予定ドキュメント配列
 *         @property {Function} onClick - クリック時のコールバック関数
 * @slot - footer - 各日付フッターのカスタム表示用スロット
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useTable } from "./useTable.js";
import Head from "./Head.vue";
import Foot from "./Foot.vue";

/**
 * SETUP PROPS
 */
const _props = defineProps({
  /**
   * キャッシュ済み現場データオブジェクトマップ
   * - 現場IDをキー、現場データオブジェクトを値とするマップオブジェクトを指定します。
   * - 現場オーダー行の表示に使用されます。
   */
  cachedSites: { type: Object, default: undefined },
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
   * 各列の幅
   */
  columnWidth: { type: [String, Number], default: undefined },
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
   * 祝日アイコン
   * - 祝日を示すために使用するアイコン名を指定します。
   */
  holidayIcon: { type: String, default: "mdi-flag" },
  /**
   * 祝日アイコンの色
   * - 祝日アイコンの色を指定します。
   */
  holidayIconColor: { type: String, default: "red" },
  /**
   * 現場稼働予定ドキュメントの配列
   * - groupKey ごとに分類されて cell スロットプロパティで提供されます。
   */
  schedules: { type: Array, default: () => [] },
  /**
   * 現場オーダー配列
   * - 各現場オーダーのデータオブジェクトを含む配列を指定します。
   */
  siteShiftTypeOrder: { type: Array, default: () => [] },
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
const emit = defineEmits(["click:cell"]);

/** SETUP COMPOSABLES */
const {
  daysInRangeArray,
  currentDayCount,
  cellColorClass,
  groupKeyMappedData,
  resolvedColumnWidth,
} = useTable(props);
</script>

<template>
  <v-table id="site-operation-schedule-table" fixed-header>
    <!-- 列幅定義 -->
    <colgroup>
      <col
        v-for="(_, colIndex) in daysInRangeArray"
        :key="colIndex"
        :style="{ width: resolvedColumnWidth, minWidth: resolvedColumnWidth }"
      />
    </colgroup>

    <!-- ヘッダー部 -->
    <Head>
      <!-- SLOT: prepend-day -->
      <template #prepend-day="slotProps">
        <slot name="prepend-day" v-bind="slotProps" />
      </template>

      <!-- SLOT: day -->
      <template #day="slotProps">
        <slot name="day" v-bind="slotProps" />
      </template>

      <!-- SLOT: append-day -->
      <template #append-day="slotProps">
        <slot name="append-day" v-bind="slotProps" />
      </template>

      <!-- SLOT: prepend-weekday -->
      <template #prepend-weekday="slotProps">
        <slot name="prepend-weekday" v-bind="slotProps" />
      </template>

      <!-- SLOT: weekday -->
      <template #weekday="slotProps">
        <slot name="weekday" v-bind="slotProps" />
      </template>

      <!-- SLOT: append-weekday -->
      <template #append-weekday="slotProps">
        <slot name="append-weekday" v-bind="slotProps" />
      </template>
    </Head>

    <!-- ボディ部 -->
    <tbody>
      <template
        v-for="(order, rowIndex) in props.siteShiftTypeOrder"
        :key="rowIndex"
      >
        <!-- TR: siteShiftTypeOrder -->
        <tr>
          <td
            class="bg-grey-lighten-4"
            style="height: unset"
            :colspan="currentDayCount"
          >
            <div class="fixed-left d-inline-flex align-center">
              <!-- SLOT: prepend-site-shift-type-order -->
              <slot
                name="prepend-site-shift-type-order"
                v-bind="{ ...order }"
              />

              <!-- SLOT: site-shift-type-order -->
              <slot name="site-shift-type-order" v-bind="{ ...order }">
                <div class="py-1 d-flex align-center">
                  <AtomsChipsShiftType
                    :shift-type="order.shiftType"
                    class="mr-2"
                    density="compact"
                  />
                  {{ props.cachedSites?.[order.siteId]?.name || "...loading" }}
                </div>
              </slot>

              <!-- SLOT: append-site-shift-type-order -->
              <slot name="append-site-shift-type-order" v-bind="{ ...order }" />
            </div>
          </td>
        </tr>

        <!-- TR: schedule -->
        <tr>
          <td
            v-for="(dayObject, colIndex) in daysInRangeArray"
            :key="colIndex"
            :style="{ padding: '8px' }"
            :class="[
              dayObject.isHoliday
                ? cellColorClass[0]
                : cellColorClass[dayObject.format('d')],
            ]"
          >
            <div class="d-flex flex-column justify-start fill-height">
              <!-- SLOT: cell -->
              <!-- { siteId, shiftType, date, dateAt, groupKey, dayObject } -->
              <slot
                name="cell"
                v-bind="{
                  siteId: order.siteId,
                  shiftType: order.shiftType,
                  date: dayObject.date,
                  dateAt: dayObject.dateAt,
                  groupKey: `${order.key}-${dayObject.date}`,
                  dayObject,
                  ...groupKeyMappedData.get(`${order.key}-${dayObject.date}`),
                  onClick: () => {
                    emit('click:cell', {
                      siteId: order.siteId,
                      shiftType: order.shiftType,
                      date: dayObject.date,
                      dateAt: dayObject.dateAt,
                      groupKey: `${order.key}-${dayObject.date}`,
                    });
                  },
                }"
              />
            </div>
          </td>
        </tr>
      </template>
    </tbody>

    <!-- フッター部 -->
    <Foot v-if="$slots.footer">
      <!-- SLOT: footer -->
      <template #footer="slotProps">
        <slot name="footer" v-bind="slotProps" />
      </template>
    </Foot>
  </v-table>
</template>

<style scoped>
.fixed-left {
  position: sticky;
  left: 16px;
  z-index: 1;
}
</style>
