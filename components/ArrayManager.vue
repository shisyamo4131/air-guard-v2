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
</script>

<template>
  <air-array-manager @error="pushError" @error:clear="logger.clearError">
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
