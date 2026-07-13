<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/WeekdayActions.vue
 * @description `ArrangementsManager` 専用 曜日セル アクションコンポーネント
 *
 * @note 集中モードは機能拡充ができるまでは開発者のみ利用可能
 * - 集中モード機能の完成を以てこの条件を削除する
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "ArrangementsManagerWeekdayActions",
  inheritAttrs: false,
});

/*****************************************************************************
 * 集中モードは機能拡充ができるまでは開発者のみ利用可能
 * - 集中モード機能の完成を以てこの条件を削除すること。
 *****************************************************************************/
import { useAuthStore } from "@/stores/useAuthStore";
const { isDeveloper } = useAuthStore();

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  column: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
});
const props = useDefaults(_props, "ArrangementsManagerWeekdayActions");
const emit = defineEmits([
  "click:focus",
  "click:pdf",
  "click:command-text",
  "click:jump-list",
]);
</script>

<template>
  <div class="d-flex ga-6">
    <v-btn
      v-if="isDeveloper"
      v-tooltip:top="`集中モード切替`"
      :icon="props.isSelected ? 'mdi-eye-off' : 'mdi-eye'"
      size="x-small"
      @click="emit('click:focus', props.column.date)"
    />
    <v-btn
      v-tooltip:top="`配置表をダウンロード`"
      icon="mdi-table-large"
      size="x-small"
      @click="emit('click:pdf', props.column.date)"
    />
    <v-btn
      v-tooltip:top="`配置指示テキストを表示`"
      icon="mdi-text-box-outline"
      size="x-small"
      @click="emit('click:command-text', props.column.date)"
    />
    <v-btn
      v-tooltip:top="`現場へジャンプ`"
      icon="mdi-format-list-checkbox"
      size="x-small"
      @click="emit('click:jump-list', $event)"
    />
  </div>
</template>
