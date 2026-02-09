<script setup>
/**
 * DraggableWorkers
 * @file components/Draggable/Workers/index.vue
 * @description 現場作業員情報表示用のドラッグ可能なリストコンポーネントです。
 * - `modelValue` プロパティとして `SiteOperationSchedule` インスタンスを受け取り、
 *   その `workers` 配列をドラッグ可能なリストとして表示します
 * - 作業員の追加・順序変更・削除が行われると、`update:modelValue` イベントが発火し、
 *   新しい `SiteOperationSchedule` インスタンスがペイロードとして渡されます。
 *
 * @extends vuedraggable
 *
 * @property {String} groupName - vue-draggable の group 名
 * @property {String} handle - vue-draggable の drag handle セレクタ
 * @property {String} itemKey - vue-draggable の item key 名
 * @property {Object} modelValue - SiteOperationSchedule インスタンス
 *
 * @slot {default} - 各作業員要素のカスタムレンダリング用スロット。
 *
 * @emits {event} update:modelValue - 作業員の追加・順序変更・削除が行われた際に発火します。
 *                                    イベントペイロード: 新しい SiteOperationSchedule インスタンス
 */
import draggable from "vuedraggable";
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

defineOptions({ name: "DraggableWorkers" });

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  // vue-draggable の group 名
  groupName: { type: String, default: "workers" },
  // vue-draggable の drag handle セレクタ
  handle: { type: String, default: ".drag-handle" },
  // vue-draggable の item key 名
  itemKey: { type: String, default: "workerId" },
  // 現場稼働予定オブジェクト
  modelValue: { type: Object, required: true },
});
const props = useDefaults(_props, "DraggableWorkers");

const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, defaultSlotProps } = useIndex(props, emit);
</script>

<template>
  <draggable v-bind="attrs">
    <template #item="{ element: worker }">
      <div>
        <slot name="default" v-bind="{ worker, ...defaultSlotProps }" />
      </div>
    </template>
  </draggable>
</template>
