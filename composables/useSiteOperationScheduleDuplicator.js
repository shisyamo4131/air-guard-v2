/***************************************************************************
 * useSiteOperationScheduleDuplicator
 * @version 1.0.0
 * @description A composable to duplicate site operation schedules.
 * @author shisyamo4131
 *
 * 現場稼働予定の複製を行うためのコンポーザブルです。
 * - `AirItemManager` に対して `attrs` を提供します。
 * - `useDocManager` を利用していますが、複製対象のドキュメントを `set` メソッドで受け入れるため
 *   コンポーネント自体が `doc` プロパティを受け付けず、`useDocManager` には内部で
 *   管理している `instance` を渡しています。
 ***************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useDocManager } from "@/composables/useDocManager";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";

/**
 * @returns {Object} - The site operation schedule duplicator composable.
 * @returns {Object} attrs - The binding attributes for the duplicator component.
 * @returns {Function} set - Function to set the schedule instance to duplicate.
 */
export function useSiteOperationScheduleDuplicator({
  redirectPath = null,
} = {}) {
  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  const instance = Vue.reactive(new SiteOperationSchedule());
  const selectedDates = Vue.ref([]);

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const docManager = useDocManager("useSiteOperationScheduleDuplicator", {
    doc: instance,
    redirectPath,
  });

  const loadingsStore = useLoadingsStore();

  /*****************************************************************************
   * METHODS (PRIVATE)
   *****************************************************************************/
  /**
   * Initializes the state.
   * @returns {void}
   */
  function _initialize() {
    instance.initialize();
    selectedDates.value = [];
  }

  /**
   * `instance` に設定されている現場稼働予定ドキュメントを複製します。
   * - `SiteOperationSchedule.duplicate` メソッドを実行します。
   * - `AirItemManager` の `handleUpdate` ハンドラとして利用されます。
   * @returns {Promise<void>}
   */
  async function _duplicate() {
    docManager.logger.clearError();
    const loadingKey = loadingsStore.add({ text: "Duplicating schedule..." });
    docManager.isLoading.value = true;
    try {
      await instance.duplicate(selectedDates.value);
      _initialize();
    } catch (error) {
      docManager.logger.error({ error });
    } finally {
      docManager.isLoading.value = false;
      loadingsStore.remove(loadingKey);
    }
  }

  /**
   * Returns whether the given date is allowed for duplication.
   * @param {Date} date - The date to check.
   * @returns {boolean} - Whether the date is allowed for duplication.
   */
  function _isDateAllowed(date) {
    return dayjs(date).format("YYYY-MM-DD") !== instance.date;
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/

  /*****************************************************************************
   * METHODS (PUBLIC)
   *****************************************************************************/
  /**
   * Set the schedule instance to duplicate.
   * @param {SiteOperationSchedule} schedule
   */
  function set(schedule) {
    if (!schedule || !(schedule instanceof SiteOperationSchedule)) {
      throw new Error("Invalid schedule instance");
    }
    instance.initialize(schedule.toObject());
    docManager.toUpdate();
  }

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  /**
   * Returns whether the duplicator is in a submittable state.
   * @returns {boolean} - Whether the duplicator is submittable.
   */
  const isSubmittable = Vue.computed(() => {
    if (selectedDates.value.length === 0) return false;
    if (selectedDates.value.length > 20) return false;
    if (docManager.isLoading.value) return false;
    return true;
  });

  /**
   * Returns the binding options for the duplicator component.
   * @returns {Object} - The binding options for the duplicator component.
   */
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,

      // docManager の attrs を上書き
      handleCreate: () => {
        docManager.logger.error({ message: "作成処理はできません。" });
      },
      handleUpdate: () => _duplicate(),
      handleDelete: () => {
        docManager.logger.error({ message: "削除処理はできません。" });
      },

      // 追加属性
      dialogProps: { width: 376 },
      editorProps: {
        disableCancel: docManager.isLoading.value,
        disableSubmit: !isSubmittable.value,
      },
      hideDeleteBtn: true,
      label: "予定複製",
      onInitialized: _initialize,

      // SiteOperationScheduleDuplicator に特有の属性
      allowedDates: _isDateAllowed,
      selectedDates: selectedDates.value,
      "onUpdate:selected-dates": (value) => (selectedDates.value = value),
    };
  });

  return { attrs, set };
}
