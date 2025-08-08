<script setup>
/** define model */
const schedules = defineModel();

/** define props */
const props = defineProps({
  schedules: { type: Array, default: () => [] },
  siteId: { type: String, required: true },
  shiftType: { type: String, required: true },
});

/** define emits */
const emit = defineEmits(["change", "click:edit"]);
</script>

<template>
  <ArrangementsDraggableSiteSchedules
    v-model="schedules"
    :site-id="siteId"
    :shift-type="shiftType"
    @change="$emit('change', $event)"
    @click:edit="$emit('click:edit', $event)"
  />
</template>
