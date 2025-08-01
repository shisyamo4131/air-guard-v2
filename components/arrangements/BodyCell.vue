<script setup>
import { toRef } from "vue";
import {
  useColumnStyles,
  validateDateProp,
} from "@/composables/useColumnStyles";

/** define model */
const schedules = defineModel();

/** define props */
const props = defineProps({
  dateAt: {
    type: [Date, String, Object],
    required: true,
    validator: validateDateProp,
  },
  schedules: { type: Array, default: () => [] },
  siteId: { type: String, required: true },
  shiftType: { type: String, required: true },
});

/** define emits */
const emit = defineEmits(["change", "click:edit"]);

/** use composable */
const { cssClasses } = useColumnStyles(toRef(props, "dateAt"));
</script>

<template>
  <td :class="cssClasses">
    <ArrangementsDraggableSiteSchedules
      v-model="schedules"
      :site-id="siteId"
      :shift-type="shiftType"
      @change="$emit('change', $event)"
      @click:edit="$emit('click:edit', $event)"
    />
  </td>
</template>
