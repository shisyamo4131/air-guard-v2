<script setup>
/*****************************************************************************
 * SiteShiftTypeOrderReorder.vue
 * @description 現場オーダーの並び替えを行うコンポーネント
 * - `type` プロパティで並び替えるオーダーの種類を指定可能
 * - `Draft State Pattern` を使用して、内部モデル値を管理
 * - ユーザーの操作結果は `submit` イベントで通知
 *
 * @property {Array} items - 現場オーダーの配列
 * @property {Boolean} loading - ローディング状態
 * @property {Object} fetchSiteComposable - 現場情報取得用コンポーザブル
 *
 * @emits {Function} submit - 並び替えた現場オーダーの配列を引数に取るイベント
 * @emits {Function} cancel - キャンセル時に発火するイベント
 *
 * @slots title - カードのタイトルスロット
 * @slots subtitle - カードのサブタイトルスロット
 * @slots actions - カードのアクションスロット（デフォルトで送信・キャンセルボタンを提供）
 *****************************************************************************/
import draggable from "vuedraggable";
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/** SETUP PROPS */
const _props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  fetchSiteComposable: { type: Object, default: undefined },
});
const props = useDefaults(_props, "SiteShiftTypeOrderReorder");

/** SETUP EMITS */
const emit = defineEmits(["submit", "cancel"]);

/** SETUP COMPOSABLES */
const { items, init, cancel, submit, isChanged } = useIndex(props, emit);

defineExpose({ init, submit, cancel });
</script>

<template>
  <v-card>
    <template v-if="$slots.title" #title="slotProps">
      <slot name="title" v-bind="slotProps || {}" />
    </template>
    <template v-if="$slots.subtitle" #subtitle="slotProps">
      <slot name="subtitle" v-bind="slotProps || {}" />
    </template>
    <template #text>
      <draggable v-model="items" item-key="key">
        <template #item="{ element }">
          <SiteShiftTypeOrderListItem
            v-bind="element"
            :fetch-site-composable="fetchSiteComposable"
            border
            class="pa-2 mb-2"
            rounded
          />
        </template>
      </draggable>
    </template>
    <template #actions>
      <slot
        name="actions"
        v-bind="{ cancel, submit, loading, disabled: !isChanged }"
      >
        <MoleculesActionsSubmitCancel
          :loading="loading"
          :disabled="!isChanged"
          @click:cancel="cancel"
          @click:submit="submit"
        />
      </slot>
    </template>
  </v-card>
</template>
