<script setup>
/*****************************************************************************
 * @file ./components/Arrangements/Manager/CommandTextDialog.vue
 * @description `ArrangementsManager` 専用 配置テキスト表示ダイアログ
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "ArrangementsManagerCommandTextDialog",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: { type: String, default: null },
});
const props = useDefaults(_props, "ArrangementsManagerCommandTextDialog");
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function close() {
  emit("update:modelValue", null);
}
</script>

<template>
  <v-dialog
    :model-value="!!props.modelValue"
    max-width="600"
    @update:model-value="close"
  >
    <v-card>
      <v-card-title class="text-h6">配置テキスト</v-card-title>
      <v-card-text>
        <v-textarea :value="props.modelValue" rows="10" readonly outlined />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
