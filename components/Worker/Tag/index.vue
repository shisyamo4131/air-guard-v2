<script setup>
/**
 * WorkerTag
 * @file components/Worker/Tag/index.vue
 * @description Tag コンポーネントをベースにした、作業員情報表示用タグコンポーネントです。
 * - フッタースロットを使用して開始時刻、終了時刻を表示できるようにしています。
 * - このコンポーネントは直接使用されることを想定していません。`ScheduleWorkerTag` へ拡張するために
 *   描画すべき情報を整理・定義するために作成されています。
 *
 * [Added Properties]
 * @property {String} endTime - 終了時刻
 * @property {String} startTime - 開始時刻
 *
 * @property {String | Number | Boolean} border - タグの枠線を表示するかどうか。
 * @property {Boolean} highlight - タグを強調表示するかどうか。
 * @property {String} label - タグに表示するラベル文字列。
 * @property {Boolean} loading - タグが読み込み中状態かどうか。
 * @property {Boolean} removable - タグに削除ボタンを表示するかどうか。
 * @property {String} removeIcon - 削除ボタンのアイコン。
 * @property {String | Number | Boolean} rounded - タグの角を丸くするかどうか。
 * @property {String} size - タグのサイズ。('small', 'medium', 'large')。
 * @property {String} variant - タグのバリアント。('default', 'success', 'warning', 'error', 'disabled')。
 *
 *
 * @slots
 *   - prepend-label: Content before the label.
 *   - append-label: Content after the label.
 *   - startTime: Slot for customizing the start time display.
 *   - endTime: Slot for customizing the end time display.
 *   - prepend-footer: Slot for content before the start time.
 *   - footer: Slot for customizing the entire footer area.
 *   - append-footer: Slot for customizing the footer display.
 *   - prepend-action: Content in the prepend action area.
 *
 * @emits click:remove - Emitted when the remove button is clicked.
 */
import { useDefaults } from "vuetify";
import importedProps from "@/components/Tag/props";
import { useIndex } from "./useIndex";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  ...importedProps,
  /** End time of the worker's shift */
  endTime: { type: String, default: undefined },
  /** Start time of the worker's shift */
  startTime: { type: String, default: undefined },
});
const props = useDefaults(_props, "WorkerTag");
const emit = defineEmits(["click:remove"]);

const { attrs, startTime, endTime } = useIndex(props, emit);
</script>

<template>
  <Tag v-bind="attrs" @click:remove="emit('click:remove')">
    <!-- Pass through: prepend-label slot with slot props -->
    <template #prepend-label="slotProps">
      <slot name="prepend-label" v-bind="slotProps" />
    </template>

    <!-- Pass through: append-label slot with slot props -->
    <template #append-label="slotProps">
      <slot name="append-label" v-bind="slotProps" />
    </template>

    <!-- Footer: display start and end times -->
    <template #footer="slotProps">
      <slot name="footer" v-bind="slotProps || {}">
        <v-list-item-subtitle>
          <div class="d-flex align-center text-caption text-no-wrap">
            <!-- Slot: prepend-footer -->
            <slot name="prepend-footer" />

            <!-- Slot: startTime -->
            <slot name="startTime" :start-time="startTime">
              <span>{{ startTime }}</span>
            </slot>

            <span> - </span>

            <!-- Slot: endTime -->
            <slot name="endTime" :end-time="endTime">
              <span>{{ endTime }}</span>
            </slot>

            <!-- Slot: append-footer -->
            <slot name="append-footer" />
          </div>
        </v-list-item-subtitle>
      </slot>
    </template>

    <!-- Pass through: prepend-action slot -->
    <template #prepend-action>
      <slot name="prepend-action" />
    </template>
  </Tag>
</template>

<style scoped></style>
