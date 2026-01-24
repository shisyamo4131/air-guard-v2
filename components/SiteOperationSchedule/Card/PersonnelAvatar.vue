<script setup>
/*****************************************************************************
 * 現場稼働予定管理用カード必要人数アバターコンポーネント
 * - `SiteOperationSchedule/Card/index.vue` で使用されるコンポーネント
 *****************************************************************************/
const props = inject("props");

const color = computed(() => {
  return props.schedule?.isPersonnelShortage ? "error" : "primary";
});

const content = computed(() => {
  return props.schedule?.requiredPersonnelCount || "10";
});
</script>

<template>
  <v-avatar :color="color" :size="28">
    <span class="text-subtitle-2 white--text">{{ content }}</span>
  </v-avatar>
</template>
