<script setup>
/**
 * SiteOperationScheduleDraggableSchedules
 * @file components/SiteOperationSchedule/Draggable/Schedules/index.vue
 * @description 現場稼働予定情報表示用のドラッグ可能なリストコンポーネントです。
 * - `modelValue` プロパティとして `SiteOperationSchedule` インスタンスの配列を受け取り、
 *   それらをドラッグ可能なリストとして表示します
 * - スケジュールの追加、順序変更、削除が行われると、`update:modelValue` イベントが発火し、
 *   新しい `SiteOperationSchedule` インスタンスの配列がペイロードとして渡されます。
 *
 * @extends vuedraggable
 *
 * @property {String} date - 現場稼働日（YYYY-MM-DD 形式）
 * @property {Boolean} disabled - vue-draggable 無効化フラグ
 * @property {String} groupName - vue-draggable の group 名
 * @property {String} handle - vue-draggable の drag handle セレクタ
 * @property {String} itemKey - vue-draggable の item key 名
 * @property {Array} modelValue - SiteOperationSchedule インスタンスの配列
 *
 * @slot {default} - 各スケジュール要素のカスタムレンダリング用スロット。
 *
 * @emits {event} update:modelValue - スケジュールの追加、順序変更、削除が行われた際に発火します。
 *                                    イベントペイロード: 新しい SiteOperationSchedule インスタンスの配列
 */
import draggable from "vuedraggable";
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

defineOptions({ name: "SiteOperationScheduleDraggableSchedules" });
/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  // 現場稼働日（YYYY-MM-DD 形式）
  date: { type: String, required: true },
  // vue-draggable 無効化フラグ
  disabled: { type: Boolean, default: false },
  // vue-draggable の group 名
  groupName: { type: String, default: "schedules" },
  // vue-draggable の drag handle セレクタ
  handle: { type: String, default: ".drag-handle" },
  // vue-draggable の item key 名
  itemKey: { type: String, default: "docId" },
  // 現場稼働予定オブジェクト配列
  modelValue: { type: Array, default: () => [] },
  // 現場ID
  siteId: { type: String, required: true },
  // 勤務区分
  shiftType: { type: String, required: true },
});
const props = useDefaults(_props, "SiteOperationScheduleDraggableSchedules");
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useIndex(props, emit);
</script>

<template>
  <draggable v-bind="attrs">
    <template #item="{ element: schedule }">
      <div>
        <slot name="default" v-bind="{ schedule, ...defaultSlotProps }" />
      </div>
    </template>
  </draggable>
</template>
