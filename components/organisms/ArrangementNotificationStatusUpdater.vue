<script setup>
/**
 * @file components/organisms/ArrangementNotificationStatusUpdater.vue
 * @description A menu component for updating arrangement notification statuses.
 */
import {
  ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRAY,
  ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED,
  ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED,
  ARRANGEMENT_NOTIFICATION_STATUS_LEAVED,
} from "air-guard-v2-schemas/constants";
import { useLogger } from "@/composables/useLogger";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const logger = useLogger("ArrangementNotificationStatusUpdater");

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const emit = defineEmits(["update:status"]);

/*****************************************************************************
 * DEFINE REFS
 *****************************************************************************/
const menu = ref(false);
const notification = ref(null);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(menu, (newVal) => {
  if (newVal) return;
  notification.value = null;
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const items = computed(() => {
  return ARRANGEMENT_NOTIFICATION_STATUS_ARRAY.map((item) => {
    return {
      title: item.title,
      value: item.value,
      disabled: item.value === notification.value?.status,
    };
  });
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function set(obj) {
  notification.value = obj;
  menu.value = true;
}

async function updateStatus(newStatus) {
  try {
    if (!notification.value) {
      throw new Error("Notification is required");
    }
    const handler = {
      [ARRANGEMENT_NOTIFICATION_STATUS_ARRANGED]: notification.value.toArranged,
      [ARRANGEMENT_NOTIFICATION_STATUS_CONFIRMED]:
        notification.value.toConfirmed,
      [ARRANGEMENT_NOTIFICATION_STATUS_ARRIVED]: notification.value.toArrived,
      [ARRANGEMENT_NOTIFICATION_STATUS_LEAVED]: notification.value.toLeaved,
    };
    const fn = handler[newStatus];
    if (!fn) {
      throw new Error(`No handler found for status: ${newStatus}`);
    }
    await fn.call(notification.value);
    menu.value = false;
  } catch (error) {
    logger.error({ message: error.message, error });
  }
}

/*****************************************************************************
 * DEFINE EXPOSES
 *****************************************************************************/
defineExpose({ set });
</script>

<template>
  <v-menu v-model="menu">
    <v-card>
      <v-container>
        <v-chip-group>
          <v-chip
            v-for="item of items"
            :key="item.value"
            :value="item.value"
            :disabled="item.disabled"
            label
            @click="updateStatus(item.value)"
          >
            {{ item.title }}
          </v-chip>
        </v-chip-group>
      </v-container>
    </v-card>
  </v-menu>
</template>
