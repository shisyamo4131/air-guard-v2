<script setup>
/*****************************************************************************
 * @file ./components/molecules/Actions/SelectCancel.vue
 * @description 選択とキャンセルのアクションコンポーネント
 * @author shisyamo4131
 *
 * @prop {Boolean} disabled - 選択ボタンを無効化するかどうか
 * @prop {Boolean} loading - ボタンをローディング状態にするかどうか
 *
 * @emit click:cancel - キャンセルボタンがクリックされたときに発火するイベント
 * @emit click:select - 選択ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import * as Vue from "vue";
import { useDefaults } from "vuetify";
import propsDefinition from "./props.js";

defineOptions({ name: "MoleculesActionsSelectCancel" });

/** SETUP PROPS & EMITS */
const _props = defineProps({ ...propsDefinition });
const props = useDefaults(_props, "MoleculesActionsSelectCancel");
const emit = defineEmits(["click:cancel", "click:select"]);

const attrsCancel = Vue.computed(() => {
  return {
    disabled: props.loading,
    onClick: () => emit("click:cancel"),
  };
});

const attrsSelect = Vue.computed(() => {
  return {
    disabled: props.disabled || props.loading,
    loading: props.loading,
    onClick: () => emit("click:select"),
  };
});
</script>

<template>
  <div class="flex-grow-1 d-flex justify-space-between">
    <AtomsBtnsCancel v-bind="attrsCancel" />
    <AtomsBtnsSelect v-bind="attrsSelect" />
  </div>
</template>
