<script setup>
/**
 * @file @/components/arrangements/Toolbar.vue
 * @description A toolbar component for arrangements manager.
 * @props modelValue - The number of days to display.
 * @emit click:workers - Emits when the workers button is clicked.
 * @emit update:modelValue - Emits when the number of days to display is updated.
 */

/*****************************************************************************
 * PROPS & EMITS
 *****************************************************************************/
/** define modelValue */
const model = defineModel();

/** define emits */
const emit = defineEmits(["click:workers"]);

/*****************************************************************************
 * CONSTANTS
 *****************************************************************************/
/** 選択可能な表示日数の定数 */
const DISPLAY_DAYS_OPTIONS = [
  { title: "7日間", value: 7 },
  { title: "14日間", value: 14 },
  { title: "30日間", value: 30 },
];

/** ツールバーの設定定数 */
const TOOLBAR_CONFIG = {
  title: "配置管理",
  density: "comfortable",
};

/** 作業員ボタンの設定定数 */
const WORKERS_BUTTON_CONFIG = {
  icon: "mdi-account-group",
  text: "作業員",
};

/** セレクターの設定定数 */
const SELECTOR_CONFIG = {
  width: "120",
  label: "表示日数",
  density: "compact",
};

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/** items for display-days-selector */
const selectableDays = computed(() => DISPLAY_DAYS_OPTIONS);

/*****************************************************************************
 * EVENT HANDLERS
 *****************************************************************************/
/** 作業員ボタンクリックハンドラー */
const handleWorkersClick = (event) => {
  emit("click:workers", event);
};
</script>

<template>
  <v-toolbar
    :density="TOOLBAR_CONFIG.density"
    :title="TOOLBAR_CONFIG.title"
    class="arrangements-toolbar"
  >
    <template #append>
      <v-spacer />

      <!-- Workers Button -->
      <v-btn
        :prepend-icon="WORKERS_BUTTON_CONFIG.icon"
        :text="WORKERS_BUTTON_CONFIG.text"
        @click="handleWorkersClick"
        class="workers-btn"
      />

      <!-- Display Days Selector -->
      <air-select
        v-model="model"
        :width="SELECTOR_CONFIG.width"
        :label="SELECTOR_CONFIG.label"
        :density="SELECTOR_CONFIG.density"
        :items="selectableDays"
        hide-details
        class="days-selector"
      />
    </template>
  </v-toolbar>
</template>

<style scoped>
.arrangements-toolbar {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.workers-btn {
  margin-right: 12px;
}

.days-selector {
  min-width: 120px;
}
</style>
