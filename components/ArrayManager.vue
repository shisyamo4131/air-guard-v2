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

/** useLogger を通して useErrorsStore のエラーを初期化する関数 */
function clearError() {
  logger.clearError();
}
</script>

<template>
  <air-array-manager @error="pushError" @error:clear="clearError">
    <!-- AirArrayManager のデフォルトスロットを転送します -->
    <template #default="slotProps">
      <slot name="default" v-bind="{ ...slotProps }" />
    </template>
  </air-array-manager>
</template>
