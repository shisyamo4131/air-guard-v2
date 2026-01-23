<script setup>
/*****************************************************************************
 * 現場稼働予定管理用テーブルフッターコンポーネント
 * - `SiteOperationSchedule/Table.vue` で使用されるコンポーネント
 *
 * @slot - footer - 各日付フッターのカスタム表示用スロット
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *****************************************************************************/
const props = inject("props"); // 未使用だが一応取得しておく
const daysInRangeArray = inject("daysInRangeArray");
const cellColorClass = inject("cellColorClass");

const resolvedStyle = computed(() => {
  return {
    position: "sticky",
    bottom: "0",
    "z-index": "2",
    background: `rgb(var(--v-theme-surface))`,
  };
});
</script>

<template>
  <tfoot :style="resolvedStyle">
    <tr>
      <th
        v-for="(dayObject, colIndex) in daysInRangeArray"
        :key="colIndex"
        :class="[
          dayObject.isHoliday
            ? cellColorClass[0]
            : cellColorClass[dayObject.format('d')],
        ]"
      >
        <!-- SLOT: footer -->
        <slot name="footer" v-bind="{ dayObject }" />
      </th>
    </tr>
  </tfoot>
</template>
