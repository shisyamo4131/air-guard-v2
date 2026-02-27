<script setup>
/*****************************************************************************
 * @file ./components/atoms/Btns/Cancel.vue
 * @description キャンセルボタンコンポーネント
 * @author shisyamo4131
 *
 * @emit click - ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useBtns } from "./useBtns.js";

defineOptions({ name: "AtomsBtnsCancel" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  color: { type: String, default: undefined },
  icon: { type: [Boolean, String], default: false },
  prependIcon: { type: String, default: "mdi-close" },
  text: { type: String, default: "キャンセル" },
});

const props = useDefaults(_props, "AtomsBtnsCancel");
const emit = defineEmits(["click"]);

/** SETUP COMPOSABLE */
const { attrs } = useBtns(props, emit);
</script>

<template>
  <v-btn v-bind="attrs" />
</template>
