<script setup>
/**
 * @file ItemManager.vue
 *
 * @description AirItemManager をラップしたプロジェクト専用の ItemManager です。
 *              - AirItemManager で発生したエラーに関する処理を定義しています。
 *              - AirItemManager の `handleCreate`, `handleUpdate`, `handleDelete` の処理を
 *                props で定義しています。
 *                - handleCreate: async (item) => await item.create()
 *                - handleUpdate: async (item) => await item.update()
 *                - handleDelete: async (item) => await item.delete()
 *                これらの定義はそれぞれ対応するプロパティで変更することが可能です。
 */
import { useLogger } from "../composables/useLogger";
const logger = useLogger();

defineOptions({ inheritAttrs: false, name: "ItemManager" });

const props = defineProps({
  dialogProps: { type: Object, default: () => ({}) },
  handleCreate: {
    type: Function,
    default: async (item) => await item.create(),
  },
  handleUpdate: {
    type: Function,
    default: async (item) => await item.update(),
  },
  handleDelete: {
    type: Function,
    default: async (item) => await item.delete(),
  },
  label: { type: String, default: undefined },
});

const sender = "ItemManager.vue";

const defaultDialogProps = {
  maxWidth: "480",
  persistent: true,
  scrollable: true,
  transition: "dialog-bottom-transition",
};

/** useLogger を使用してエラーログを出力する関数 */
function pushError(error) {
  logger.error({
    sender,
    message: error.message,
    error,
  });
}

/** useLogger を通して useErrorsStore のエラーを初期化する関数 */
function clearError() {
  logger.clearError();
}
</script>

<template>
  <air-item-manager
    v-bind="$attrs"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    @error="pushError"
    @error:clear="clearError"
  >
    <!-- AirItemManager のデフォルトスロットを転送します -->
    <template #default="slotProps">
      <slot
        name="default"
        v-bind="{
          ...slotProps,
          dialogProps: {
            ...defaultDialogProps,
            ...props.dialogProps,
            modelValue: slotProps.isEditing,
            'onUpdate:modelValue': slotProps.quitEditing,
          },
          editorProps: {
            disabled: slotProps.isDelete || slotProps.isLoading,
            editMode: slotProps.editMode,
            isLoading: slotProps.isLoading,
            label: props.label,
            isDelete: slotProps.isDelete,
            'onClick:cancel': slotProps.quitEditing,
            'onClick:close': slotProps.quitEditing,
            'onClick:submit': slotProps.submit,
            'onUpdate:isDelete': ($event) =>
              slotProps.toggleEditMode($event ? 'DELETE' : 'UPDATE'),
          },
        }"
      ></slot>
    </template>
  </air-item-manager>
</template>
