<script setup>
/**
 * @file components/molecules/CardActionsSubmitCancel.vue
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
const props = useDefaults(_props, "MoleculesCardActionsSubmitCancel");

const emit = defineEmits(["click:submit", "click:cancel"]);
</script>

<template>
  <v-card-actions class="justify-space-between">
    <slot name="btn-cancel">
      <v-btn text="キャンセル" @click="emit('click:cancel')" />
    </slot>
    <slot name="btn-submit">
      <v-btn text="確定" @click="emit('click:submit')" />
    </slot>
  </v-card-actions>
</template>
