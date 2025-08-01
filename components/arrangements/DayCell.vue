<script setup>
import { toRef } from "vue";
import {
  useColumnStyles,
  validateDateProp,
} from "@/composables/useColumnStyles";

/** constants */
const HOLIDAY_ICON = "mdi-flag-variant";
const HOLIDAY_COLOR = "red";

/** define props */
const props = defineProps({
  dateAt: {
    type: [Date, String, Object],
    required: true,
    validator: validateDateProp,
  },
});

/** use composable */
const { isHoliday, dateLabel, cssClasses } = useColumnStyles(
  toRef(props, "dateAt")
);
</script>

<template>
  <th :class="cssClasses">
    <v-icon
      v-if="isHoliday"
      :icon="HOLIDAY_ICON"
      :color="HOLIDAY_COLOR"
      class="mr-1"
    />
    {{ dateLabel }}
  </th>
</template>
