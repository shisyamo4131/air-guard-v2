<script setup>
/**
 * @file components/molecules/CardActionsEdit.vue
 * @description A card actions component with an edit button.
 * @version 1.0.0
 * @author shisyamo4131
 * @create 2025-12-11
 *
 * @emit click:edit - Event emitted when the edit button is clicked.
 */
import { useDefaults } from "vuetify";

/** SETUP PROPS & EMITS */
const _props = defineProps({});
const props = useDefaults(_props, "MoleculesCardActionsEdit");

const emit = defineEmits(["click:edit"]);
</script>

<template>
  <div class="d-flex flex-grow-1 justify-end">
    <v-btn text="編集" prepend-icon="mdi-pencil" @click="emit('click:edit')" />
  </div>
</template>
