<script setup>
/**
 * WorkerTag
 * @file components/Worker/Tag/index.vue
 * @description Tag コンポーネントをベースにした、作業員情報表示用タグコンポーネントです。
 * - フッタースロットを拡張して開始時刻、終了時刻を表示できるようにしています。
 * - 開始時刻および終了時刻が未設定の場合は、時刻表示エリア自体が非表示になります。
 * - このコンポーネントは直接使用されることを想定していません。`ScheduleWorkerTag` の継承元として
 *   描画すべき情報を整理・定義するために作成されています。
 *
 * [Added Properties]
 * @property {String} endTime - 終了時刻
 * @property {String} startTime - 開始時刻
 *
 * @property {String | Number | Boolean} border - タグの枠線を表示するかどうか。
 * @property {Boolean} hideTime - 時刻表示エリアを非表示にするかどうか。
 * @property {Boolean} highlight - タグを強調表示するかどうか。
 * @property {String} label - タグに表示するラベル文字列。
 * @property {Boolean} loading - タグが読み込み中状態かどうか。
 * @property {Boolean} removable - タグに削除ボタンを表示するかどうか。
 * @property {String} removeIcon - 削除ボタンのアイコン。
 * @property {String | Number | Boolean} rounded - タグの角を丸くするかどうか。
 * @property {Boolean} showDraggableIcon - ドラッグ可能アイコンを表示するかどうか。
 * @property {String} size - タグのサイズ。('small', 'medium', 'large')。
 * @property {String} variant - タグのバリアント。('default', 'success', 'warning', 'error', 'disabled')。
 *
 *
 * @slots
 *   - prepend-label: ラベルの前に表示するコンテンツ
 *   - append-label: ラベルの後に表示するコンテンツ
 *   - startTime: 開始時刻の表示をカスタマイズ（slotProps: { startTime }）
 *   - endTime: 終了時刻の表示をカスタマイズ（slotProps: { endTime }）
 *   - prepend-footer: 時刻表示の下（フッター最上部）に表示するコンテンツ
 *   - footer: prepend-footerとappend-footerの間に表示するコンテンツ
 *   - append-footer: フッター最下部に表示するコンテンツ
 *   - prepend-action: アクションエリアの先頭に表示するコンテンツ
 *
 * @emits click:remove - 削除ボタンがクリックされた際に発火
 */
import { useDefaults } from "vuetify";
import importedProps from "@/components/Worker/Tag/props";
import { useIndex } from "./useIndex";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({ ...importedProps });
const props = useDefaults(_props, "WorkerTag");
const emit = defineEmits(["click:remove"]);

const { attrs, startTime, endTime } = useIndex(props, emit);
</script>

<template>
  <Tag v-bind="attrs">
    <!-- Pass through: prepend-label slot with slot props -->
    <template #prepend-label="slotProps">
      <!-- Draggable Icon -->
      <AtomsIconsDraggable v-if="props.showDraggableIcon" />
      <slot name="prepend-label" v-bind="slotProps" />
    </template>

    <!-- Pass through: append-label slot with slot props -->
    <template #append-label="slotProps">
      <slot name="append-label" v-bind="slotProps" />
    </template>

    <!-- Footer: display start and end times -->
    <template #footer="slotProps">
      <v-list-item-subtitle v-if="!props.hideTime">
        <div class="d-flex align-center text-caption text-no-wrap">
          <!-- Slot: startTime -->
          <slot name="startTime" :start-time="startTime">
            <span>{{ startTime }}</span>
          </slot>

          <span> - </span>

          <!-- Slot: endTime -->
          <slot name="endTime" :end-time="endTime">
            <span>{{ endTime }}</span>
          </slot>
        </div>
      </v-list-item-subtitle>
      <!-- Slot: prepend-footer -->
      <slot name="prepend-footer" />

      <!-- Slot: footer -->
      <slot name="footer" v-bind="slotProps || {}" />

      <!-- Slot: append-footer -->
      <slot name="append-footer" />
    </template>

    <!-- Pass through: prepend-action slot -->
    <template #prepend-action>
      <slot name="prepend-action" />
    </template>
  </Tag>
</template>

<style scoped></style>
