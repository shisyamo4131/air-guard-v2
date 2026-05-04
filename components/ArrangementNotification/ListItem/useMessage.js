/*****************************************************************************
 * @file ./components/ArrangementNotification/ListItem/useMessage.js
 * @description A dedicated composable of `ArrangementNotificationListItem`.
 *****************************************************************************/
import * as Vue from "vue";
import { useConstants } from "@/composables/useConstants";

/**
 * @param {Object} props
 * @returns {ComputedRef<{ text: string, icon: string, color: string }>} message
 */
export function useMessage(props) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { ARRANGEMENT_NOTIFICATION_STATUS } = useConstants();

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * Returns `props.notification.status` value or null if it is undefined.
   * @type {ComputedRef<string>}
   */
  const status = Vue.computed(() => {
    return props?.notification?.status || null;
  });

  /**
   * Returns an object containing the message text, icon, and color based on the `status` value.
   * @type {ComputedRef<{ text: string, icon: string, color: string }>}
   */
  const message = Vue.computed(() => {
    if (!status.value) {
      return {
        text: "不明なステータスです。",
        icon: "mdi-help-circle-outline",
        color: "error",
      };
    }

    const statusDefinition =
      ARRANGEMENT_NOTIFICATION_STATUS.value?.[status.value];
    if (!statusDefinition) {
      return {
        text: "ARRANGMENT NOTIFICATION STATUS の定義にエラーがあります。",
        icon: "mdi-help-circle-outline",
        color: "error",
      };
    }

    return {
      text: statusDefinition.text,
      icon: statusDefinition.icon,
      color: statusDefinition.color,
    };
  });

  return { message };
}
