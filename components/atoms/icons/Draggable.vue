<script setup>
/**
 * @file components/atoms/icons/Draggable.vue
 * @description A component that displays a draggable icon.
 *
 * @update 2025-12-25 - Change icon to `mdi-drag` from `mdi-menu` for better clarity.
 */
</script>

<template>
  <v-icon icon="mdi-drag" class="drag-handle" />
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
</style>
