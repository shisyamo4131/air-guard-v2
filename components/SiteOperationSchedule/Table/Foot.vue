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
</script>

<template>
  <tfoot>
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
        <slot name="footer" v-bind="{ dayObject }" />
      </th>
    </tr>
  </tfoot>
</template>
