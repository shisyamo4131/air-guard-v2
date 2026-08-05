<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/DailyStatusSummary.vue
 * @description 配置管理テーブル状態集計コンポーネント
 * - 配置明細単位の5状態と、通知不整合・未知状態の要確認件数を表示します。
 * @property {Object|null} summary 日別の配置状態集計
 *****************************************************************************/
defineOptions({ name: "ArrangementsManagerDailyStatusSummary" });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({ summary: { type: Object, default: null } });

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const summary = computed(
  () =>
    props.summary || {
      provisional: 0,
      arranged: 0,
      confirmed: 0,
      arrived: 0,
      leaved: 0,
      needsReview: 0,
    },
);

const items = computed(() => [
  ["仮配置", summary.value.provisional],
  ["配置済", summary.value.arranged],
  ["確認済", summary.value.confirmed],
  ["上番済", summary.value.arrived],
  ["下番済", summary.value.leaved],
]);
const ariaLabel = computed(() => {
  const statuses = items.value
    .map(([label, count]) => `${label}${count}件`)
    .join("、");
  return `日別配置状態集計、${statuses}、要確認${summary.value.needsReview}件`;
});
</script>

<template>
  <div class="daily-status-summary" role="group" :aria-label="ariaLabel">
    <div class="daily-status-summary__visual" aria-hidden="true">
      <span v-for="[label, count] in items" :key="label">
        {{ label }} {{ count }}
      </span>
      <span v-if="summary.needsReview" class="text-error font-weight-bold">
        要確認 {{ summary.needsReview }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.daily-status-summary__visual {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px 6px;
  padding-block: 4px;
  font-size: 0.68rem;
  line-height: 1.25;
  white-space: nowrap;
}
</style>
