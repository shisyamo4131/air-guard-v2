<script setup>
/*****************************************************************************
 * 稼働予定管理用テーブルフッターコンポーネント
 * - `OperationSchedules/Table.vue` で使用されるコンポーネント
 *
 * @slot - footer - 各日付フッターのカスタム表示用スロット
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *****************************************************************************/
const columns = inject("columns");
</script>

<template>
  <tfoot :style="{ position: 'sticky', bottom: '0', 'z-index': '2' }">
    <tr>
      <th
        v-for="(column, colIndex) in columns"
        :key="colIndex"
        :style="{ background: `rgb(var(--v-theme-surface))` }"
        :class="column.colorClass"
      >
        <!-- SLOT: footer -->
        <slot name="footer" v-bind="{ column }" />
      </th>
    </tr>
  </tfoot>
</template>
