<script setup>
/** constants */
const HOLIDAY_ICON = "mdi-flag-variant";
const HOLIDAY_COLOR = "red";

/** define props */
const props = defineProps({
  isHoliday: { type: Boolean, default: false },
  label: { type: String, default: "" },
  cssClasses: { type: Object, default: () => ({}) },
});
</script>

<template>
  <th :class="cssClasses">
    <v-icon
      v-if="isHoliday"
      :icon="HOLIDAY_ICON"
      :color="HOLIDAY_COLOR"
      class="mr-1"
    />
    {{ label }}
  </th>
</template>
