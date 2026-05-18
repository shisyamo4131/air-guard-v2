/*****************************************************************************
 * @file ./composables/storage/useSecurityReports.js
 * @description 警備日報写真管理コンポーザブル
 * - Storage に警備日報写真をアップロードし、一覧取得・削除を行う機能を提供します。
 * - 原則として、コンポーネント側で fetch を呼び出すまではデータを取得しません。
 * - `fetchOnMounted` オプションを true にすると、コンポーネントのマウント時に自動で fetch を呼び出します。
 * - `fetchOnChanged` オプションを true にすると、scheduleId が変更された際に自動で fetch を呼び出します。
 *****************************************************************************/
import * as Vue from "vue";
import {
  uploadSecurityReport,
  listSecurityReports,
  deleteSecurityReport,
} from "@/utils/storage";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSecurityReports(
  scheduleId,
  { fetchOnMounted = false, fetchOnChanged = false } = {},
) {
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
      console.error("[useSecurityReports] アップロードエラー:", e);
      uploadError.value = e.message;
    } finally {
      isUploading.value = false;
      file.value = null;
    }
  });

  /**
   * scheduleId が変更されたら一覧を再取得する
   * - fetchOnChanged が true の場合のみ実行する
   * - scheduleId が null/undefined から有効な値に変わった場合もトリガーされる
   * - scheduleId が同じ値に変更された場合はトリガーされない
   */
  Vue.watch(scheduleId, async (newScheduleId, oldScheduleId) => {
    if (!fetchOnChanged) return;
    if (newScheduleId === oldScheduleId) return;
    await fetch();
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

  if (fetchOnMounted) {
    Vue.onMounted(fetch);
  }

  return {
    attrs, // VFileInput に渡す属性

    /** STATES */
    file,
    reports, // 一覧取得した警備日報写真の配列
    isUploading, // アップロード処理中かどうか
    isListing, // 一覧取得処理中かどうか
    isEmpty, // 警備日報写真の一覧が空かどうか
    uploadError, // アップロードエラーのメッセージ
    listError, // 一覧取得エラーのメッセージ
    deletingPaths, // 現在削除処理中のファイルパスのセット

    /** METHODS */
    isDeleting, // 指定されたreportが現在削除処理中かどうかを判定する関数
    fetch, // 警備日報写真の一覧を取得するメソッド
    del, // 警備日報写真を削除するメソッド
  };
}
