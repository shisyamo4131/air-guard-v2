<script setup>
/**
 * WorkerTag
 * @file components/Worker/Tag/index.vue
 * @description 作業員（従業員または外注先）情報表示用タグコンポーネントです。
 * - 従業員情報、外注先情報の表示に加え、作業時間情報の表示機能を備えたコンポーネントです。
 * - isEmployeeの値に応じて、EmployeeTagまたはOutsourcerTagを動的に切り替えます。
 *
 * [Added properties]
 * @property {String|Date} startTime - 開始時刻（オプション）
 * @property {String|Date} endTime - 終了時刻（オプション）
 * @property {Boolean} hideTime - 時間を表示するかどうか（既定値: false）
 * @property {Boolean} isEmployee - true: 従業員、false: 外注先
 * @property {Object} fetchEmployeeComposable - useFetchEmployeeのインスタンス（任意）
 * @property {Object} fetchOutsourcerComposable - useFetchOutsourcerのインスタンス（任意）
 * @property {String} workerId - 作業員ID（必須）
 *
 * [Properties imported from components/Tag]
 * @property {String | Number | Boolean} border - タグの枠線を表示するかどうか
 * @property {Boolean} highlight - タグを強調表示するかどうか
 * @property {Boolean} removable - タグに削除ボタンを表示するかどうか
 * @property {String} removeIcon - 削除ボタンのアイコン
 * @property {String | Number | Boolean} rounded - タグの角を丸くするかどうか
 * @property {Boolean} showDraggableIcon - ドラッグ可能アイコンを表示するかどうか
 * @property {String} size - タグのサイズ ('small', 'medium', 'large')
 * @property {String} variant - タグのバリアント ('default', 'success', 'warning', 'error', 'disabled')
 *
 * @slots
 *   - prepend-label: ラベルの前に表示するコンテンツ
 *   - append-label: ラベルの後に表示するコンテンツ
 *   - prepend-footer: フッター最上部に表示するコンテンツ
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

const { componentTag, attrs, startTime, endTime } = useIndex(props, emit);
</script>

<template>
  <Component :is="componentTag" v-bind="attrs">
    <!-- Pass through: prepend-label slot with slot props -->
    <template #prepend-label="slotProps">
      <slot name="prepend-label" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: append-label slot with slot props -->
    <template #append-label="slotProps">
      <slot name="append-label" v-bind="slotProps || {}" />
    </template>

    <!-- Footer -->
    <template #footer="slotProps">
      <!-- Slot: prepend-footer -->
      <slot name="prepend-footer" v-bind="slotProps || {}" />

      <!-- Slot: footer -->
      <slot name="footer" v-bind="slotProps || {}">
        <!-- Display time -->
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
      </slot>

      <!-- Slot: prepend-footer -->
      <slot name="prepend-footer" v-bind="slotProps || {}" />
    </template>

    <!-- Pass through: prepend-action slot -->
    <template #prepend-action>
      <slot name="prepend-action" />
    </template>
  </Component>
</template>

<style scoped></style>
