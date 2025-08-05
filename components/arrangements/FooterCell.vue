<script setup>
/** define props */
const props = defineProps({
  requiredPersonnelTotal: {
    type: Number,
    default: 0,
  },
  cssClasses: { type: Object, default: () => ({}) },
});
</script>

<template>
  <th :class="cssClasses">
    <span class="grey--text text--darken-2 text-subtitle-2">
      稼働数: {{ requiredPersonnelTotal }}
    </span>
  </th>
</template>
