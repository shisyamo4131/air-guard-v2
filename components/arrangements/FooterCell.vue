<script setup>
import { toRef } from "vue";
import {
  useColumnStyles,
  validateDateProp,
} from "@/composables/useColumnStyles";

/** define props */
const props = defineProps({
  dateAt: {
    type: [Date, String, Object],
    required: true,
    validator: validateDateProp,
  },
});

/** use composable */
const { cssClasses } = useColumnStyles(toRef(props, "dateAt"));
</script>

<template>
  <th :class="cssClasses">
    <span class="grey--text text--darken-2 text-subtitle-2"> 稼働数: </span>
  </th>
</template>
