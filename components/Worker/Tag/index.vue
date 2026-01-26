<script setup>
/**
 * WorkerTag
 * @file components/Worker/Tag/index.vue
 * @description Tag コンポーネントをベースにした、作業員情報表示用タグコンポーネントです。
 * workerIdを指定すると、自動的に従業員情報を取得してdisplayNameを表示します。
 *
 * @property {String | Number | Boolean} border - タグの枠線を表示するかどうか。
 * @property {String} workerId - 作業員ID（必須）。従業員情報を取得するために使用されます。
 * @property {Object} fetchEmployeeComposable - useFetchEmployeeのインスタンス（任意）。親から渡すとキャッシュを共有できます。
 * @property {Boolean} highlight - タグを強調表示するかどうか。
 * @property {Boolean} removable - タグに削除ボタンを表示するかどうか。
 * @property {String} removeIcon - 削除ボタンのアイコン。
 * @property {String | Number | Boolean} rounded - タグの角を丸くするかどうか。
 * @property {Boolean} showDraggableIcon - ドラッグ可能アイコンを表示するかどうか。
 * @property {String} size - タグのサイズ。('small', 'medium', 'large')。
 * @property {String} variant - タグのバリアント。('default', 'success', 'warning', 'error', 'disabled')。
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

const { attrs } = useIndex(props, emit);
</script>

<template>
  <Tag v-bind="attrs">
    <!-- Pass through: prepend-label slot with slot props -->
    <template #prepend-label="slotProps">
      <slot name="prepend-label" v-bind="slotProps" />
    </template>

    <!-- Pass through: append-label slot with slot props -->
    <template #append-label="slotProps">
      <slot name="append-label" v-bind="slotProps" />
    </template>

    <!-- Footer -->
    <template #footer="slotProps">
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
