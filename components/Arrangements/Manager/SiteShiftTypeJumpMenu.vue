<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/SiteShiftTypeJumpMenu.vue
 * @description `ArrangementsManager` 専用 現場勤務区分ジャンプメニュー
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "ArrangementsManagerSiteShiftTypeJumpMenu",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: { type: Boolean, default: false },
  siteShiftTypeOrder: { type: Array, default: () => [] },
  target: { type: null, default: null },
});
const props = useDefaults(_props, "ArrangementsManagerSiteShiftTypeJumpMenu");
const emit = defineEmits(["update:modelValue", "click:select"]);
</script>

<template>
  <v-menu
    :model-value="props.modelValue"
    :target="props.target"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SiteShiftTypeOrderList
      :site-shift-type-order="props.siteShiftTypeOrder"
      density="compact"
      @click:select="emit('click:select', $event)"
    />
  </v-menu>
</template>
