<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/DailyHeaderSummary.vue
 * @description 配置管理テーブルヘッダーコンポーネント
 * - 配置作業員数と必要配置作業員数およびその過不足を知らせるためのコンポーネント
 * @property {Object|null} summary 日別の稼働数・配置人数・差分
 *****************************************************************************/
defineOptions({ name: "ArrangementsManagerDailyHeaderSummary" });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({ summary: { type: Object, default: null } });

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const summary = computed(
  () => props.summary || { required: 0, assigned: 0, difference: 0 },
);
const balance = computed(() => {
  if (summary.value.difference < 0) {
    return {
      label: `不足${Math.abs(summary.value.difference)}`,
      colorClass: "text-error",
    };
  }
  if (summary.value.difference > 0) {
    return {
      label: `超過${summary.value.difference}`,
      colorClass: "text-warning",
    };
  }
  return { label: "充足", colorClass: "text-success" };
});
const ariaLabel = computed(
  () =>
    `日別配置人数集計、稼働${summary.value.required}人、配置${summary.value.assigned}人、${balance.value.label}`,
);
</script>

<template>
  <div class="daily-header-summary" :aria-label="ariaLabel">
    <span>稼働 {{ summary.required }}</span>
    <span>配置 {{ summary.assigned }}</span>
    <span :class="balance.colorClass">{{ balance.label }}</span>
  </div>
</template>

<style scoped>
.daily-header-summary {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-block-start: 2px;
  font-size: 0.7rem;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
