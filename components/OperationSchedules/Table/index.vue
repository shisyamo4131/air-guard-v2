<script setup>
/*****************************************************************************
 * 稼働予定管理用テーブルコンポーネント
 * - 横長のテーブルになるため、親コンポーネント側をスクロールコンテナとする場合は
 *   `class="d-flex"` を指定すること。
 *
 * [更新履歴]
 * 2026-06-18 - 現場オーダー行に現場稼働予定登録のためのアイコンを追加
 *            - `click:add-schedule` イベントを追加
 * 2026-06-15 - `props.cachedSites` を廃止し、`useFetch` を使用するように変更
 *
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
 * @emits click:remove-site-order - 現場オーダーを削除する際に発火するイベント
 * @emits click:add-schedule - 新規に現場稼働予定を登録する際に発火するイベント
 *        @property {Object} order - 現場オーダー情報オブジェクト
 *        @property {string} order.siteId - 現場ID
 *        @property {string} order.shiftType - シフトタイプ
 *        @property {string} order.key - 現場オーダーキー（`${siteId}_${shiftType}`形式）
 *
 * @slot - prepend-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の前）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - day - 各日付ヘッダーのカスタム表示用スロット
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - append-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の後）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - prepend-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の前）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - weekday - 各曜日ヘッダーのカスタム表示用スロット
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - append-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の後）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - row-prepend - 各現場行のカスタム表示用スロット（現場オーダー表示部の前）
 *         @property {Object} row - 現場オーダー情報オブジェクト
 *         @property {string} row.siteId - 現場ID
 *         @property {string} row.shiftType - シフトタイプ
 *         @property {string} row.key - 現場オーダーキー（`${siteId}_${shiftType}`）
 *
 * @slot - row-header - 各現場行のカスタム表示用スロット
 *         @property {Object} row - 現場オーダー情報オブジェクト
 *         @property {string} row.siteId - 現場ID
 *         @property {string} row.shiftType - シフトタイプ
 *         @property {string} row.key - 現場オーダーキー（`${siteId}_${shiftType}`）
 *
 * @slot - row-append - 各現場行のカスタム表示用スロット（現場オーダー表示部の後）
 *         @property {Object} row - 現場オーダー情報オブジェクト
 *         @property {string} row.siteId - 現場ID
 *         @property {string} row.shiftType - シフトタイプ
 *         @property {string} row.key - 現場オーダーキー（`${siteId}_${shiftType}`）
 *
 * @slot - cell - 各セルのカスタム表示用スロット
 *         @property {String} siteId - 現場ID
 *         @property {String} shiftType - シフトタイプ
 *         @property {String} date - 日付（YYYY-MM-DD形式）
 *         @property {Object} dateAt - 日付（dayjsオブジェクト）
 *         @property {String} groupKey - グループキー（`${siteId}_${shiftType}_${date}`形式）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {Number} count - 必要人員数
 *         @property {Boolean} hasMultiple - 必要人員が複数かどうか
 *         @property {Number} total - 総必要人員数
 *         @property {Array} schedules - 現場稼働予定ドキュメント配列
 *         @property {Boolean} isSelected - 日付が選択されているかどうか
 *         @property {Function} onClick - クリック時のコールバック関数
 *
 * @slot - footer - 各日付フッターのカスタム表示用スロット
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useOperationSchedulesTableModel } from "./useOperationSchedulesTableModel";
import Head from "./Head.vue";
import Body from "./Body/index.vue";
import Foot from "./Foot.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
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
   * 選択された日付
   * - 指定された日付に該当するセル以外をぼやけさせます。
   */
  selectedDate: { type: String, default: undefined },
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
const props = useDefaults(_props, "OperationSchedulesTable");
const emit = defineEmits([
  "click:cell",
  "click:remove-site-order",
  "click:add-schedule",
]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { columns, rows, schedulesIndex } =
  useOperationSchedulesTableModel(props);

provide("props", props);
provide("columns", columns);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <v-table id="operation-schedules-table" fixed-header density="compact">
    <!-- 列幅定義 -->
    <colgroup>
      <col
        v-for="(column, index) in columns"
        :key="index"
        :style="column.style.col"
      />
    </colgroup>

    <!-- ヘッダー部 -->
    <Head>
      <!-- SLOT: prepend-day -->
      <template v-if="$slots['prepend-day']" #prepend-day="slotProps">
        <slot name="prepend-day" v-bind="slotProps" />
      </template>

      <!-- SLOT: day -->
      <template v-if="$slots['day']" #day="slotProps">
        <slot name="day" v-bind="slotProps" />
      </template>

      <!-- SLOT: append-day -->
      <template v-if="$slots['append-day']" #append-day="slotProps">
        <slot name="append-day" v-bind="slotProps" />
      </template>

      <!-- SLOT: prepend-weekday -->
      <template v-if="$slots['prepend-weekday']" #prepend-weekday="slotProps">
        <slot name="prepend-weekday" v-bind="slotProps" />
      </template>

      <!-- SLOT: weekday -->
      <template v-if="$slots['weekday']" #weekday="slotProps">
        <slot name="weekday" v-bind="slotProps" />
      </template>

      <!-- SLOT: append-weekday -->
      <template v-if="$slots['append-weekday']" #append-weekday="slotProps">
        <slot name="append-weekday" v-bind="slotProps" />
      </template>
    </Head>

    <!-- ボディ部 -->
    <Body
      :columns="columns"
      :rows="rows"
      :schedules-index="schedulesIndex"
      :selected-date="selectedDate"
      @click:cell="emit('click:cell', $event)"
      @click:add-schedule="emit('click:add-schedule', $event)"
      @click:remove-site-order="emit('click:remove-site-order', $event)"
    >
      <template v-if="$slots['row-prepend']" #row-prepend="slotProps">
        <slot name="row-prepend" v-bind="slotProps" />
      </template>

      <template v-if="$slots['row-header']" #row-header="slotProps">
        <slot name="row-header" v-bind="slotProps" />
      </template>

      <template v-if="$slots['row-append']" #row-append="slotProps">
        <slot name="row-append" v-bind="slotProps" />
      </template>

      <template v-if="$slots['cell']" #cell="slotProps">
        <slot name="cell" v-bind="slotProps" />
      </template>
    </Body>

    <!-- フッター部 -->
    <Foot v-if="$slots['footer']">
      <!-- SLOT: footer -->
      <template #footer="slotProps">
        <slot name="footer" v-bind="slotProps" />
      </template>
    </Foot>
  </v-table>
</template>

<style scoped>
/* v-tableのスタイル */
#operation-schedules-table {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

/* fixed テーブルに */
/* min-width を指定する必要があるとのことだが、これがなくても うまく動いている。一旦コードは残すが、後で不要なら削除するかもしれない。 */
#operation-schedules-table :deep(table) {
  table-layout: fixed !important;
}

.fixed-left {
  position: sticky;
  left: 16px;
  z-index: 1;
}
</style>
