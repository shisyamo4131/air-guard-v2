<script setup>
/*****************************************************************************
 * 現場稼働予定管理用ツールバーコンポーネント
 *
 * @inject dateRangeComposable - 日付範囲コンポーザブル
 *
 * @emits click:sort - ソートボタンがクリックされたとき
 * @emits click:create - 作成ボタンがクリックされたとき
 *****************************************************************************/
import dayjs from "dayjs";

/** SETUP COMPOSABLES */
const dateRangeComposable = inject("dateRangeComposable");
const { dateRange, move } = dateRangeComposable;

/** SETUP EMITS */
const emit = defineEmits(["click:sort", "click:create"]);

/** LABEL */
const label = computed(() => {
  return `${dayjs(dateRange.value.from).format("YYYY年MM月")}`;
});

/** PREVIOUS BUTTON ATTRIBUTES */
const prevBtnAttrs = computed(() => {
  return {
    icon: "mdi-chevron-left",
    onClick: () => move({ value: -1, unit: "month" }),
  };
});

/** NEXT BUTTON ATTRIBUTES */
const nextBtnAttrs = computed(() => {
  return {
    icon: "mdi-chevron-right",
    onClick: () => move({ value: 1, unit: "month" }),
  };
});
</script>

<template>
  <v-toolbar class="flex-grow-0" color="secondary" density="compact">
    <v-toolbar-title class="ml-0">
      <div class="d-flex align-center">
        <!-- PREVIOUS BUTTON -->
        <v-btn v-bind="prevBtnAttrs" />

        <span>{{ label }}</span>

        <!-- NEXT BUTTON -->
        <v-btn v-bind="nextBtnAttrs" />
      </div>
    </v-toolbar-title>
    <template #append>
      <v-btn icon="mdi-sort" @click="emit('click:sort')" />
      <v-btn icon="mdi-plus" @click="emit('click:create')" />
    </template>
  </v-toolbar>
</template>
