<script setup>
/*****************************************************************************
 * @file ./components/molecules/ActionsEdit.vue
 * @description 編集ボタンを含むアクションコンポーネント
 * @author shisyamo4131
 *
 * @prop {Boolean} disabled - 編集ボタンを無効化するかどうか
 * @prop {Boolean} loading - ボタンをローディング状態にするかどうか
 *
 * @emit click:edit - 編集ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import * as Vue from "vue";
import { useDefaults } from "vuetify";
import propsDefinition from "./props.js";

defineOptions({ name: "MoleculesActionsEdit" });

/** SETUP PROPS & EMITS */
const _props = defineProps({ ...propsDefinition });
const props = useDefaults(_props, "MoleculesActionsEdit");
const emit = defineEmits(["click:edit"]);

const attrs = Vue.computed(() => {
  return {
    disabled: props.disabled || props.loading,
    loading: props.loading,
    onClick: () => emit("click:edit"),
  };
});
</script>

<template>
  <div class="d-flex flex-grow-1 justify-end">
    <AtomsBtnsEdit v-bind="attrs" />
  </div>
</template>
