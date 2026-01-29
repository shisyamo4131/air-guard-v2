<script setup>
/**
 * SiteOperationScheduleWorkerTag
 * @file components/SiteOperationSchedule/Worker/Tag/index.vue
 * @description WorkerTag コンポーネントをベースにした、現場作業員情報表示用タグコンポーネントです。
 * - `worker` プロパティとして `SiteOperationScheduleDetail` インスタンスを受け取り、
 *   作業員の作業開始・終了時刻を表示します。
 * - `schedule` プロパティとして `SiteOperationSchedule` インスタンスを受け取ります。
 * - `worker` の時刻が `schedule` の時刻と異なる場合、時刻表示が強調表示されます。
 * - WorkerTag コンポーネントが受け付ける `id`, `startTime`, `endTime`, `isEmployee` プロパティは
 *   `worker` オブジェクトから自動的に取得されます。
 *
 * [Added properties]
 * @property {Object} worker - 作業員情報オブジェクト（SiteOperationScheduleDetail の worker オブジェクト）
 * @property {Object} schedule - SiteOperationSchedule インスタンス（worker の時刻と比較して強調表示を判定）
 *
 * @property {Boolean} hideTime - 時刻表示エリアを非表示にするかどうか。
 * @property {Object} fetchEmployeeComposable - 従業員情報を取得するためのコンポーザブル
 * @property {Object} fetchOutsourcerComposable - 外注先情報を取得するためのコンポーザブル
 * @property {String | Number | Boolean} border - タグの枠線を表示するかどうか。
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
 *   - prepend-start-time: 開始時刻の前に表示するコンテンツ
 *   - startTime: 開始時刻の表示をカスタマイズ（slotProps: { startTime }）
 *   - append-start-time: 開始時刻の後に表示するコンテンツ
 *   - prepend-end-time: 終了時刻の前に表示するコンテンツ
 *   - endTime: 終了時刻の表示をカスタマイズ（slotProps: { endTime }）
 *   - append-end-time: 終了時刻の後に表示するコンテンツ
 *   - prepend-footer: 時刻表示の下（フッター最上部）に表示するコンテンツ
 *   - footer: prepend-footerとappend-footerの間に表示するコンテンツ
 *   - append-footer: フッター最下部に表示するコンテンツ
 *   - prepend-action: アクションエリアの先頭に表示するコンテンツ
 *
 * @emits click:remove - 削除ボタンがクリックされた際に発火
 */
import { useDefaults } from "vuetify";
import importedProps from "./props";
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

    <!-- Pass throuth: prepend-start-time slot with slot props -->
    <template #prepend-start-time="slotProps">
      <slot name="prepend-start-time" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: start-time slot with slot props -->
    <template #start-time="slotProps">
      <slot name="start-time" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: append-start-time slot with slot props -->
    <template #append-start-time="slotProps">
      <slot name="append-start-time" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: prepend-end-time slot with slot props -->
    <template #prepend-end-time="slotProps">
      <slot name="prepend-end-time" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: end-time slot with slot props -->
    <template #end-time="slotProps">
      <slot name="end-time" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: append-end-time slot with slot props -->
    <template #append-end-time="slotProps">
      <slot name="append-end-time" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: prepend-footer slot with slot props -->
    <template #prepend-footer="slotProps">
      <slot name="prepend-footer" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: footer slot with slot props -->
    <template #footer="slotProps">
      <slot name="footer" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: append-footer slot with slot props -->
    <template #append-footer="slotProps">
      <slot name="append-footer" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: prepend-action slot -->
    <template #prepend-action>
      <slot name="prepend-action" />
    </template>
  </WorkerTag>
</template>

<style scoped></style>
