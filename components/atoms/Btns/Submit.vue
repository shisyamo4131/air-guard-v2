<script setup>
/*****************************************************************************
 * @file ./components/atoms/Btns/Submit.vue
 * @description 確定ボタンコンポーネント
 * @author shisyamo4131
 *
 * @emit click - ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useBtns } from "./useBtns.js";

defineOptions({ name: "AtomsBtnsSubmit" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  color: { type: String, default: "primary" },
  icon: { type: [Boolean, String], default: false },
  prependIcon: { type: String, default: "mdi-check" },
  text: { type: String, default: "確定" },
});

const props = useDefaults(_props, "AtomsBtnsSubmit");
const emit = defineEmits(["click"]);

/** SETUP COMPOSABLE */
const { attrs } = useBtns(props, emit);
</script>

<template>
  <v-btn v-bind="attrs" />
</template>
