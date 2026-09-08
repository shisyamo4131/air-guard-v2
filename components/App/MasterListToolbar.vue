<script setup>
/*****************************************************************************
 * @file components/App/MasterListToolbar.vue
 * @description マスタ画面で使用するツールバーコンポーネント
 * @property {String|null} search - 検索文字列
 * @property {Number} searchDelay - 検索文字列の更新を遅延させる時間（ミリ秒）
 * @emit update:search - 検索文字列の更新イベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
defineOptions({ name: "AppMasterListToolbar", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  search: { type: String, default: null },
  searchDelay: { type: Number, default: 0 },
});
const props = useDefaults(_props, "AppMasterListToolbar");
const emit = defineEmits(["update:search"]);
</script>

<template>
  <v-toolbar v-bind="$attrs" class="px-4">
    <slot name="prepend" />
    <AtomsSearchTextField
      :model-value="props.search"
      :delay="props.searchDelay"
      @update:model-value="emit('update:search', $event)"
    />
    <slot name="append" />
  </v-toolbar>
</template>
