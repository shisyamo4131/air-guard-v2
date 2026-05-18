/*****************************************************************************
 * @file ./composables/storage/useSecurityReports.js
 * @description 警備日報写真管理コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import {
  uploadSecurityReport,
  listSecurityReports,
  deleteSecurityReport,
} from "@/utils/storage";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSecurityReports(scheduleId) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useSecurityReports", useErrorsStore());

  /*****************************************************************************
   * VALIDATION
   *****************************************************************************/
  if (!Vue.isRef(scheduleId)) {
    logger.error(
      "scheduleId は ref である必要があります。リアクティビティが失われる可能性があります。",
    );
  }

  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const file = Vue.ref(null); // アップロードするファイル
  const reports = Vue.ref([]); // 警備日報写真の一覧 [{ ref, url, thumbUrl, timeCreated }, ...]
  const isUploading = Vue.ref(false); // アップロード処理中かどうか
  const isListing = Vue.ref(false); // 一覧取得処理中かどうか
  const uploadError = Vue.ref(null); // アップロードエラーのメッセージ
  const listError = Vue.ref(null); // 一覧取得エラーのメッセージ
  const deletingPaths = Vue.ref(new Set()); // 現在削除処理中のファイルパスのセット

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * scheduleId が変わったら日報一覧を取得する
   */
  Vue.watch(scheduleId, (newId) => {
    if (!newId) return;
    fetch();
  });

  /**
   * file が選択されたらアップロードを実行する
   */
  Vue.watch(file, async (newFile) => {
    if (!newFile) return;
    uploadError.value = null;
    isUploading.value = true;
    try {
      await uploadSecurityReport(Vue.unref(scheduleId), newFile);
      await fetch();
    } catch (e) {
      uploadError.value = e.message;
    } finally {
      isUploading.value = false;
      file.value = null;
    }
  });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 警備日報写真の一覧を取得する
   */
  async function fetch() {
    if (!Vue.unref(scheduleId)) {
      listError.value = "scheduleId を入力してください。";
      return;
    }
    listError.value = null;
    isListing.value = true;
    try {
      reports.value = await listSecurityReports(Vue.unref(scheduleId));
    } catch (e) {
      listError.value = e.message;
    } finally {
      isListing.value = false;
    }
  }

  /**
   * 警備日報写真を削除する
   * @param report
   */
  async function del(report) {
    const path = report.ref.fullPath;
    deletingPaths.value = new Set([...deletingPaths.value, path]);
    try {
      await deleteSecurityReport(report.ref);
      reports.value = reports.value.filter((r) => r.ref.fullPath !== path);
    } catch (e) {
      logger.error(e);
    } finally {
      const next = new Set(deletingPaths.value);
      next.delete(path);
      deletingPaths.value = next;
    }
  }

  /**
   * 指定されたreportが現在削除処理中かどうかを判定する
   * @param {*} report
   * @returns {boolean} 削除処理中であればtrue、そうでなければfalse
   */
  function isDeleting(report) {
    const path = report.ref.fullPath;
    return deletingPaths.value.has(path);
  }

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  const attrs = Vue.computed(() => {
    return {
      modelValue: file.value,
      label: "日報写真をアップロード",
      accept: "image/*",
      loading: isUploading.value,
      disabled: isUploading.value || isListing.value,
      "onUpdate:modelValue": (newFile) => (file.value = newFile),
    };
  });

  const isEmpty = Vue.computed(() => reports.value.length === 0);

  return {
    attrs, // VFileInput に渡す属性
    file,
    reports,
    isUploading,
    isListing,
    isDeleting,
    isEmpty,
    uploadError,
    listError,
    deletingPaths,
    fetch,
    del,
  };
}
