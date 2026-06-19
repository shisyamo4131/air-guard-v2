<script setup>
/*****************************************************************************
 * 現場稼働予定管理用カード必要人数アバターコンポーネント
 * - `SiteOperationSchedule/Card/index.vue` で使用されるコンポーネント
 *****************************************************************************/
const props = inject("props");

const color = computed(() => {
  if (props.schedule?.isPersonnelShortage) {
    return "error";
  }
  if (props.schedule?.isPersonnelSurplus) {
    return "warning";
  }
  return "primary";
});

const content = computed(() => {
  return props.schedule?.requiredPersonnel || "-";
});
</script>

<template>
  <v-avatar :color="color" :size="20">
    <span class="text-caption white--text">{{ content }}</span>
  </v-avatar>
</template>
