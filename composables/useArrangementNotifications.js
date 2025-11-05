/*****************************************************************************
 * useArrangementNotifications ver 1.0.0
 * @author shisyamo4131
 * @description A data layer composable for arrangement notifications.
 *
 * @prop {Object} dateRangeOptions - Options for the date range composable.
 * @prop {boolean} useDebounced - Whether to use debounced date range.
 *
 * @returns {Array} docs - The array of arrangement notification documents.
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { ArrangementNotification } from "@/schemas";
import { useDateRange } from "@/composables/useDateRange";

export function useArrangementNotifications({
  dateRangeOptions = {
    baseDate: dayjs().startOf("month").toDate(),
    endDate: dayjs().endOf("month").toDate(),
  },
  useDebounced = false,
} = {}) {
  const { dateRange, debouncedDateRange } = useDateRange(dateRangeOptions);

  /***************************************************************************
   * REACTIVE OBJECTS
   ***************************************************************************/
  const instance = Vue.reactive(new ArrangementNotification());

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  /**
   * Subscribe to arrangement notifications within the date range.
   * @returns {void}
   */
  function _subscribe() {
    const { from, to } = useDebounced
      ? debouncedDateRange.value
      : dateRange.value;
    instance.subscribeDocs({
      constraints: [
        ["where", "dateAt", ">=", from],
        ["where", "dateAt", "<=", to],
      ],
    });
  }

  /**
   * Unsubscribe from arrangement notifications.
   * @returns {void}
   */
  function _unsubscribe() {
    instance.unsubscribe();
  }

  /***************************************************************************
   * LIFECYCLE HOOKS
   ***************************************************************************/
  Vue.onUnmounted(_unsubscribe);

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  Vue.watchEffect(_subscribe);

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const docs = Vue.computed(() => instance.docs);

  /***************************************************************************
   * RETURN VALUES
   ***************************************************************************/
  return {
    docs,
  };
}
