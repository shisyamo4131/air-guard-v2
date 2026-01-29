<script setup>
/**
 * SiteOperationScheduleWorkerTag
 * @file components/SiteOperationSchedule/Worker/Tag/index.vue
 * @description WorkerTag コンポーネントをベースにした、現場作業員情報表示用タグコンポーネントです。
 * - `SiteOperationScheduleDetail` インスタンスを受け取り、作業員の作業開始・終了時刻を表示します。
 *
 * [Added properties]
 * @property {Object} fetchComposable - 作業員情報を取得するためのコンポーザブル
 *
 * @property {Boolean} isEmployee - true: 従業員、false: 外注先
 * @property {String} startTime - 開始時刻
 * @property {String} endTime - 終了時刻
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

const { attrs } = useIndex(props, emit);
</script>

<template>
  <WorkerTag v-bind="attrs">
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
  </WorkerTag>
</template>

<style scoped></style>
