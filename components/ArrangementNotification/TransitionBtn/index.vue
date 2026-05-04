<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/TransitionBtn/index.vue
 * @description A component for displaying the transition button of an `ArrangementNotification`.
 * @extends VBtn
 *
 * @property {String} type - The type of transition, either "next" or "prev".
 * @property {String|Object} status - The current status of the notification, used to
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  type: {
    type: String,
    default: "next",
    validator: (value) => ["next", "prev"].includes(value),
  },
  notification: { type: Object, default: null },
});
const props = useDefaults(_props, "RecentArrangements");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { ARRANGEMENT_NOTIFICATION_STATUS: DEFINITION } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const currentStatus = computed(() => {
  if (!props.notification || !props.notification.status) return null;
  return props.notification.status;
});

/**
 * Get the current status definition based on the provided status prop.
 * If the status is missing, invalid, or does not have a corresponding definition, this will return null.
 */
const currentDefinition = computed(() => {
  return DEFINITION.value[currentStatus.value] || null;
});

/**
 * Get the target status definition based on the current status and the type of transition (next or prev).
 * If the current status or target status is missing, invalid, or does not have a corresponding definition, this will return null.
 */
const targetDefinition = computed(() => {
  if (!currentDefinition.value) return null;
  const targetStatus = currentDefinition.value?.[props.type]?.status;
  if (!targetStatus) return null;
  return DEFINITION.value?.[targetStatus] || null;
});

/**
 * Returns the attributes to be applied to the transition button
 * based on the `currentDefinition` and `targetDefinition'.
 * If either definition is missing or invalid, the button will be
 * disabled with a default text `操作できません`.
 * Otherwise, it will use the color and disabled state from the
 * target definition, and the text from the current definition.
 * @returns {Object}
 */
const attrs = computed(() => {
  const result = {
    color: undefined,
    disabled: true,
    text: "操作できません",
  };
  if (currentDefinition.value && targetDefinition.value) {
    result.color = targetDefinition.value.color;
    result.disabled = targetDefinition.value.disabled(
      currentDefinition.value.value,
    );
    result.text =
      currentDefinition.value?.[props.type]?.text || "操作できません";
  }

  return result;
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <v-btn v-bind="attrs" />
</template>
