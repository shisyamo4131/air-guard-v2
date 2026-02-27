<script setup>
/*****************************************************************************
 * @file ./components/molecules/Actions/SubmitCancel.vue
 * @description 確定とキャンセルのアクションコンポーネント
 * @author shisyamo4131
 *
 * @prop {Boolean} disabled - 確定ボタンを無効化するかどうか
 * @prop {Boolean} loading - ボタンをローディング状態にするかどうか
 *
 * @emit click:cancel - キャンセルボタンがクリックされたときに発火するイベント
 * @emit click:submit - 確定ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import * as Vue from "vue";
import { useDefaults } from "vuetify";
import propsDefinition from "./props.js";

defineOptions({ name: "MoleculesActionsSubmitCancel" });

/** SETUP PROPS & EMITS */
const _props = defineProps({ ...propsDefinition });
const props = useDefaults(_props, "MoleculesActionsSubmitCancel");
const emit = defineEmits(["click:cancel", "click:submit"]);

const attrsCancel = Vue.computed(() => {
  return {
    disabled: props.loading,
    onClick: () => emit("click:cancel"),
  };
});

const attrsSubmit = Vue.computed(() => {
  return {
    disabled: props.disabled || props.loading,
    loading: props.loading,
    onClick: () => emit("click:submit"),
  };
});
</script>

<template>
  <div class="flex-grow-1 d-flex justify-space-between">
    <AtomsBtnsCancel v-bind="attrsCancel" />
    <AtomsBtnsSubmit v-bind="attrsSubmit" />
  </div>
</template>
