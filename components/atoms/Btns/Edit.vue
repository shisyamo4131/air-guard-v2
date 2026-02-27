<script setup>
/*****************************************************************************
 * @file ./components/atoms/Btns/Edit.vue
 * @description 編集ボタンコンポーネント
 * @author shisyamo4131
 *
 * @emit click - ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useBtns } from "./useBtns.js";

defineOptions({ name: "AtomsBtnsEdit" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  color: { type: String, default: undefined },
  icon: { type: [Boolean, String], default: false },
  prependIcon: { type: String, default: "mdi-pencil" },
  text: { type: String, default: "編集" },
});

const props = useDefaults(_props, "AtomsBtnsEdit");
const emit = defineEmits(["click"]);

/** SETUP COMPOSABLE */
const { attrs } = useBtns(props, emit);
</script>

<template>
  <v-btn v-bind="attrs" />
</template>
