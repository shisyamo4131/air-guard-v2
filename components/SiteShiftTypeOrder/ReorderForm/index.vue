<script setup>
/*****************************************************************************
 * @file ./components/SiteShiftTypeOrder/ReorderForm/index.vue
 * @description 現場勤務区分オーダーの並び替えを行うコンポーネント
 * - `Draft State Pattern` を使用して、内部モデル値を管理
 * - ユーザーの操作結果は `submit` イベントで通知
 *
 * @property {Array} siteShiftTypeOrder - 現場勤務区分オーダーの配列
 * @property {Boolean} loading - ローディング状態
 *
 * @emit {Function} submit - 並び替えた現場勤務区分オーダーの配列を引数に取るイベント
 * @emit {Function} cancel - キャンセル時に発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteShiftTypeOrderReorderForm",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  siteShiftTypeOrder: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SiteShiftTypeOrderReorderForm");
const emit = defineEmits(["submit", "cancel"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { items, init, cancel, submit, isChanged } = useIndex(props, emit);

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({ init, submit, cancel });
</script>

<template>
  <v-card :border="false">
    <v-toolbar color="secondary" density="compact" flat>
      <v-toolbar-title>
        <v-icon icon="mdi-sort" class="mr-2" />
        現場勤務区分並べ替え
      </v-toolbar-title>
    </v-toolbar>
    <v-card-item>
      <v-card-subtitle class="text-wrap">
        ドラッグで入れ替えて順序を変更します。
      </v-card-subtitle>
    </v-card-item>
    <v-card-text>
      <DraggableSiteShiftTypeOrder v-model="items" />
    </v-card-text>
    <v-card-actions>
      <MoleculesActionsSubmitCancel
        :loading="loading"
        :disabled="!isChanged"
        @click:cancel="cancel"
        @click:submit="submit"
      />
    </v-card-actions>
  </v-card>
</template>
