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

defineOptions({ name: "ItemManager" });

const props = defineProps({
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
});

const sender = "ItemManager.vue";

/** useLogger を使用してエラーログを出力する関数 */
function pushError(error) {
  logger.error({
    sender,
    message: error.message,
    error,
  });
}

const component = useTemplateRef("component");

defineExpose({
  get errors() {
    return component.value?.errors || [];
  },
  get hasError() {
    return component.value?.hasError || false;
  },
  get isEditing() {
    return component.value?.isEditing || false;
  },
  get isLoading() {
    return component.value?.isLoading || false;
  },
  get isCreate() {
    return component.value?.isCreate || false;
  },
  get isUpdate() {
    return component.value?.isUpdate || false;
  },
  get isDelete() {
    return component.value?.isDelete || false;
  },
  get editMode() {
    return component.value?.editMode || "CREATE";
  },
  get item() {
    return component.value?.item || null;
  },
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
  submit: () => component.value?.submit(),
  quitEditing: () => component.value?.quitEditing(),
  setError: (error) => component.value?.setError(error),
  clearErrors: () => component.value?.clearErrors(),
  toggleEditMode: (mode) => component.value?.toggleEditMode(mode),
  updateProperties: (properties) =>
    component.value?.updateProperties(properties),
  pushError,
  logger,
});
</script>

<template>
  <air-item-manager
    ref="component"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    @error="pushError"
    @error:clear="logger.clearError"
  >
    <template #default="slotProps">
      <slot name="default" v-bind="slotProps">
        <v-dialog v-bind="slotProps.dialogProps">
          <template #activator>
            <v-btn icon="mdi-pencil" @click="slotProps.toUpdate()" />
          </template>
          <MoleculesEditCard v-bind="slotProps.editorProps">
            <air-item-input v-bind="slotProps.inputProps" />
          </MoleculesEditCard>
        </v-dialog>
      </slot>
    </template>
  </air-item-manager>
</template>
