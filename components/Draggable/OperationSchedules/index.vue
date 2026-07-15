<script setup>
/*****************************************************************************
 * @file ./components/Draggable/OperationSchedules/index.vue
 * @description 現場稼働予定情報用の Draggable コンポーネント
 * - `schedules` プロパティで `SiteOperationSchedule` インスタンスの配列を受け取り、
 *   それらをドラッグ可能なリストとして表示します。
 * - ドラッグ操作により配列の要素追加、削除、順序変更が発生した場合、
 *   `update:schedules` イベントが発火し、新しい配列がペイロードとして渡されます。
 * - Optimistic Update に対応するため、内部で `props.schedules` のコピーを管理し、
 *   スケジュールの追加、順序変更、削除が行われると `update:schedules` イベントが発火します。
 *
 * @extends vuedraggable
 *
 * @property {Boolean} disabled - vue-draggable 無効化フラグ
 * @property {String} groupName - vue-draggable の group 名
 * @property {String} handle - vue-draggable の drag handle セレクタ
 * @property {String} itemKey - vue-draggable の item key 名
 * @property {Array} schedules - SiteOperationSchedule インスタンスの配列
 *
 * @slot {default} - 各スケジュール要素のカスタムレンダリング用スロット。
 *
 * @emits {event} update:schedules - スケジュールの追加、順序変更、削除が行われた際に発火します。
 *                                   イベントペイロード: 新しい SiteOperationSchedule インスタンスの配列
 *****************************************************************************/
import draggable from "vuedraggable";
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "DraggableOperationSchedules", inheritAttrs: false });

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  // vue-draggable 無効化フラグ
  disabled: { type: Boolean, default: false },
  // vue-draggable の group 名
  groupName: { type: String, default: "schedules" },
  // vue-draggable の drag handle セレクタ
  handle: { type: String, default: ".drag-handle" },
  // vue-draggable の item key 名
  itemKey: { type: String, default: "docId" },
  // 現場稼働予定オブジェクト配列
  schedules: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "DraggableOperationSchedules");
const emit = defineEmits(["update:schedules"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, defaultSlotProps } = useIndex(props, emit);
</script>

<template>
  <draggable v-bind="{ ...$attrs, ...attrs }">
    <template #item="{ element: schedule }">
      <div>
        <slot name="default" v-bind="{ schedule, ...defaultSlotProps }">
          <!-- SiteOperationScheduleCard が配置されることを前提としたスロット -->
        </slot>
      </div>
    </template>
  </draggable>
</template>
