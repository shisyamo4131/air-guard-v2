<script setup>
/**
 * @file ArrayManager.vue
 *
 * @description AirArrayManager をラップしたプロジェクト専用の ArrayManager です。
 *              - AirArrayManager で発生したエラーに関する処理を定義しています。
 */
import { useLogger } from "../composables/useLogger";
const logger = useLogger();

defineOptions({ name: "ArrayManager" });

const sender = "ArrayManager.vue";

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
  get item() {
    return component.value?.item || null;
  },
  get items() {
    return component.value?.items || [];
  },
  get label() {
    return component.value?.label || undefined;
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
  <air-array-manager
    ref="component"
    @error="pushError"
    @error:clear="logger.clearError"
  >
    <template #default="slotProps">
      <slot name="default" v-bind="slotProps">
        <slot name="table" v-bind="slotProps.tableProps">
          <air-data-table v-bind="slotProps.tableProps" />
        </slot>
        <v-dialog v-bind="slotProps.dialogProps">
          <slot
            name="editor"
            v-bind="{
              editorProps: slotProps.editorProps,
              inputProps: slotProps.inputProps,
            }"
          >
            <MoleculesEditCard v-bind="slotProps.editorProps">
              <slot name="input" v-bind="slotProps.inputProps">
                <air-item-input v-bind="slotProps.inputProps" />
              </slot>
            </MoleculesEditCard>
          </slot>
        </v-dialog>
      </slot>
    </template>
  </air-array-manager>
</template>
