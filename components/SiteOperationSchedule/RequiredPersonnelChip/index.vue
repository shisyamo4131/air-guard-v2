<script setup>
/*****************************************************************************
 * 現場稼働予定管理 - 必要人員チップコンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

const _props = defineProps({
  count: { type: Number, default: 0 },
  hasMultiple: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
});
const props = useDefaults(_props, "SiteOperationScheduleRequiredPersonnelChip");

const emit = defineEmits(["click"]);
</script>

<template>
  <v-badge :model-value="props.hasMultiple" :content="props.count" color="info">
    <v-chip
      :text="props.total || '-'"
      size="small"
      @click="() => emit('click')"
    />
  </v-badge>
</template>
