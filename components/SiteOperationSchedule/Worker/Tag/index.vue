<script setup>
/**
 * SiteOperationScheduleWorkerTag
 * @file components/SiteOperationSchedule/Worker/Tag/index.vue
 * @extends components/arrangements/Worker/Tag/index.vue
 * @description 現場作業員情報表示用タグコンポーネントです。
 * - `worker` プロパティとして `SiteOperationScheduleDetail` インスタンスを受け取り、
 *   作業員の作業開始・終了時刻を表示します。
 * - `schedule` プロパティとして `SiteOperationSchedule` インスタンスを受け取ります。
 * - `worker` の時刻が `schedule` の時刻と異なる場合、時刻表示が強調表示されます。
 * - WorkerTag コンポーネントが受け付ける `id`, `startTime`, `endTime`, `isEmployee` プロパティは
 *   `worker` オブジェクトから自動的に取得されます。
 * - `notifications` プロパティとして、`notificationKey` をキーとした配置通知オブジェクトのマップを受け取ります。
 * - `worker` プロパティが持つ `notificationKey` に該当する配置通知オブジェクトを検索し、これを `ArrangementNotificationChip` コンポーネントに渡して表示します。
 * - 編集ボタンと通知表示エリアは `props.schedule` の `isEditable` プロパティが `false` の場合、自動的に無効化されます。
 * - `removable` プロパティは `props.removable` と `props.schedule.isEditable` の両方が `true` の場合にのみ有効化されます。
 * - `isDraggable` プロパティは `props.isDraggable` と `props.schedule.isEditable` の両方が `true` の場合にのみ有効化されます。
 *
 * [Added properties]
 * @property {Boolean} disableEdit - 編集ボタンを無効化するかどうか。
 *                                   `props.schedule.isEditable` が `false` の場合、自動的に無効化されます。
 * @property {Boolean} disableNotification - 通知表示エリアを無効化するかどうか。
 *                                   `props.schedule.isEditable` が `false` の場合、自動的に無効化されます。
 * @property {String} editIcon - 編集ボタンのアイコン。
 * @property {Boolean} hideEdit - 編集ボタンを非表示にするかどうか。
 * @property {Boolean} hideNotification - 通知表示エリアを非表示にするかどうか。
 * @property {Object} notifications - 配置通知オブジェクトのマップ。
 * @property {Object} schedule - SiteOperationSchedule インスタンス（worker の時刻と比較して強調表示を判定）
 * @property {Object} worker - 作業員情報オブジェクト（SiteOperationScheduleDetail の worker オブジェクト）
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
 * @property {Boolean} isDraggable - ドラッグ可能アイコンを表示するかどうか。
 * @property {String} size - タグのサイズ。('small', 'medium', 'large')。
 * @property {String} variant - タグのバリアント。('default', 'success', 'warning', 'error', 'disabled')。
 *
 *
 * @slots
 *   - prepend-label: ラベルの前に表示するコンテンツ
 *   - append-label: ラベルの後に表示するコンテンツ
 *   - prepend-start-time: 開始時刻の前に表示するコンテンツ
 *   - start-time: 開始時刻の表示をカスタマイズ（slotProps: { startTime }）
 *   - append-start-time: 開始時刻の後に表示するコンテンツ
 *   - prepend-end-time: 終了時刻の前に表示するコンテンツ
 *   - end-time: 終了時刻の表示をカスタマイズ（slotProps: { endTime }）
 *   - append-end-time: 終了時刻の後に表示するコンテンツ
 *   - edit: 編集ボタンの表示をカスタマイズ（slotProps: { disabled, icon, size, onClick }）
 *   - prepend-footer: 時刻表示の下（フッター最上部）に表示するコンテンツ
 *   - footer: prepend-footerとappend-footerの間に表示するコンテンツ
 *   - append-footer: フッター最下部に表示するコンテンツ
 *   - notification: 配置通知表示エリア用スロット
 *
 * @emits click:edit - 編集ボタンがクリックされた際に発火
 * @emits click:remove - 削除ボタンがクリックされた際に発火
 * @emits click:notification - 通知ボタンがクリックされた際に発火
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
const emit = defineEmits(["click:remove", "click:edit", "click:notification"]);

const { attrs, editProps, notificationProps } = useIndex(props, emit);
</script>

<template>
  <WorkerTag v-bind="attrs">
    <!-- Provide `prepend-label` slot with slot props -->
    <template #prepend-label="slotProps">
      <slot name="prepend-label" v-bind="slotProps || {}">
        <AtomsIconsHasLicense v-if="props.worker.isQualified" />
      </slot>
    </template>

    <!-- Provide `append-label` slot with slot props -->
    <template #append-label="slotProps">
      <slot name="append-label" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `prepend-start-time` slot with slot props -->
    <template #prepend-start-time="slotProps">
      <slot name="prepend-start-time" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `start-time` slot with slot props -->
    <template #start-time="slotProps">
      <slot name="start-time" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `append-start-time` slot with slot props -->
    <template #append-start-time="slotProps">
      <slot name="append-start-time" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `prepend-end-time` slot with slot props -->
    <template #prepend-end-time="slotProps">
      <slot name="prepend-end-time" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `end-time` slot with slot props -->
    <template #end-time="slotProps">
      <slot name="end-time" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `append-end-time` and `edit` slots -->
    <template #append-end-time="slotProps">
      <div class="d-flex align-center">
        <slot name="append-end-time" v-bind="slotProps || {}" />

        <!-- Edit icon -->
        <div v-if="!props.hideEdit" class="pl-2 d-flex align-center">
          <slot name="edit" v-bind="editProps">
            <v-icon v-bind="editProps" />
          </slot>
        </div>
      </div>
    </template>

    <!-- Provide `prepend-footer` slot with slot props -->
    <template #prepend-footer="slotProps">
      <slot name="prepend-footer" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `footer` slot with slot props -->
    <template #footer="slotProps">
      <slot name="footer" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `append-footer` slot with slot props -->
    <template #append-footer="slotProps">
      <slot name="append-footer" v-bind="slotProps || {}" />
    </template>

    <!-- Provide `prepend-action` slot as `notification` slot -->
    <template #prepend-action>
      <div v-if="!props.hideNotification">
        <slot name="notification" v-bind="notificationProps">
          <ArrangementNotificationChip v-bind="notificationProps" />
        </slot>
      </div>
    </template>
  </WorkerTag>
</template>

<style scoped></style>
