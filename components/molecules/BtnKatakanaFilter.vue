<script setup>
const model = defineModel({ type: Number, default: 0 });
const props = defineProps({
  items: { type: Array, default: () => [] },
});
</script>

<template>
  <v-btn-toggle
    v-model="model"
    class="d-flex flex-column"
    style="max-width: 24px"
    mandatory
  >
    <v-btn
      v-for="(item, index) in items"
      :key="index"
      :value="index"
      class="text-caption ma-0 pa-1"
      color="primary"
      rounded="0"
      size="x-small"
      variant="tonal"
      style="min-width: 24px; height: 24px"
    >
      {{ item.title }}
    </v-btn>
  </v-btn-toggle>
</template>

<style scoped>
.v-slide-group__content {
  gap: 2px !important;
}

.v-btn-toggle {
  height: auto !important;
}
</style>
