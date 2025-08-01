<script setup>
/**
 * @file ScheduleTableRow.vue
 * @description スケジュールテーブルの現場行コンポーネント
 */
import { SHIFT_TYPE } from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  colspan: { type: Number, required: true },
  shiftType: { type: String, required: true },
  site: { type: Object, default: undefined },
});
</script>

<template>
  <tr>
    <td class="site-row" :colspan="props.colspan">
      <div v-if="site" class="text-subtitle-1 fixed-left">
        <div class="d-flex align-center">
          <v-chip class="mr-2" label size="small">
            {{ SHIFT_TYPE[shiftType] }}
          </v-chip>
          <span>{{ site.name }}</span>
        </div>
      </div>
      <v-progress-circular v-else indeterminate size="small" />
    </td>
  </tr>
</template>

<style scoped>
.site-row {
  background-color: beige;
}
/* 現場名を左側に固定してスクロールしても動かないようにする */
.fixed-left {
  display: inline-block;
  position: sticky;
  left: 16px;
  z-index: 1 !important;
}
</style>
