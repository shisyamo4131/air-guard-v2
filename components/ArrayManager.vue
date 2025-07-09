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
        <air-data-table v-bind="slotProps.tableProps" />
        <v-dialog v-bind="slotProps.dialogProps">
          <MoleculesEditCard v-bind="slotProps.editorProps">
            <air-item-input v-bind="slotProps.inputProps" />
          </MoleculesEditCard>
        </v-dialog>
      </slot>
    </template>
  </air-array-manager>
</template>
