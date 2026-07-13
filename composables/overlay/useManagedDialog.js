import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/**
 * submit / cancel を持つ Dialog の状態を管理します。
 *
 * Form コンポーネントを Dialog に載せる場合、呼び出し側では開閉状態、
 * submit 中の loading、submit / cancel 後に閉じるかどうか、error handling が
 * まとまりがちです。この composable はそれらの汎用的な制御だけを担当します。
 *
 * @param {Object} options
 * @param {Function} [options.onSubmit] - submit 時に実行する処理。
 * @param {Function} [options.onCancel] - cancel 時に実行する処理。
 * @param {boolean} [options.closeOnSubmit=true] - submit 成功後に Dialog を閉じるかどうか。
 * @param {boolean} [options.closeOnCancel=true] - cancel 後に Dialog を閉じるかどうか。
 * @param {string} [options.loggerName="useManagedDialog"] - logger の送信元名。
 * @returns {Object}
 * @returns {import("vue").Ref<boolean>} returns.isOpen - Dialog の v-model に渡す開閉状態。
 * @returns {import("vue").Ref<boolean>} returns.isLoading - submit 中の loading 状態。
 * @returns {Function} returns.open - Dialog を開きます。
 * @returns {Function} returns.close - Dialog を閉じます。
 * @returns {Function} returns.submit - onSubmit を実行します。
 * @returns {Function} returns.cancel - onCancel を実行します。
 */
export function useManagedDialog(options = {}) {
  const {
    onSubmit,
    onCancel,
    closeOnSubmit = true,
    closeOnCancel = true,
    loggerName = "useManagedDialog",
  } = options;

  const logger = useLogger(loggerName, useErrorsStore());
  const isOpen = Vue.ref(false);
  const isLoading = Vue.ref(false);

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  async function submit(payload) {
    isLoading.value = true;
    try {
      if (typeof onSubmit === "function") {
        await onSubmit(payload);
      }
      if (closeOnSubmit) {
        close();
      }
    } catch (error) {
      logger.error({ error });
    } finally {
      isLoading.value = false;
    }
  }

  async function cancel(payload) {
    try {
      if (typeof onCancel === "function") {
        await onCancel(payload);
      }
      if (closeOnCancel) {
        close();
      }
    } catch (error) {
      logger.error({ error });
    }
  }

  return {
    isOpen,
    isLoading,
    open,
    close,
    submit,
    cancel,
  };
}
