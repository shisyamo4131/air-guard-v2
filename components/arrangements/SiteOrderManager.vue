<script setup>
/**
 * @file components/arrangements/SiteOrderManager.vue
 * @description A component for managing the order of site elements.
 */
import draggable from "vuedraggable";

/** define model */
const dialog = defineModel({ type: Boolean, default: false });

/** define props */
const props = defineProps({
  siteOrder: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

/** define emits */
const emit = defineEmits([
  "update:model-value",
  "update:site-order",
  "click:cancel",
  "click:submit",
]);

/** methods */
function cancel() {
  emit("click:cancel");
}

function submit() {
  emit("click:submit");
}
</script>

<template>
  <v-dialog v-model="dialog" max-width="600" scrollable persistent>
    <template #activator="props">
      <slot name="activator" v-bind="props" />
    </template>
    <MoleculesCardsSubmitCancel
      :loading="loading"
      @click:cancel="cancel"
      @click:submit="submit"
    >
      <v-card-title>現場並び替え</v-card-title>
      <v-container>
        <draggable
          :model-value="siteOrder"
          item-key="key"
          :disabled="loading"
          @update:model-value="emit('update:site-order', $event)"
        >
          <template #item="{ element }">
            <div>
              <slot name="item" :element="element" />
            </div>
          </template>
        </draggable>
      </v-container>
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
