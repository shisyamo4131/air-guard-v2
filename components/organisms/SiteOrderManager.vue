<script setup>
/**
 * @file components/arrangements/SiteOrderManager.vue
 * @description A component for managing the order of site elements.
 *
 * @slots
 * item - Slot for each site element.
 * title - Slot for the title of each site element.
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
  <v-dialog v-model="dialog" max-width="480" scrollable persistent>
    <template #activator="props">
      <slot name="activator" v-bind="props" />
    </template>
    <MoleculesCardsSubmitCancel
      :loading="loading"
      title="現場並び替え"
      @click:cancel="cancel"
      @click:submit="submit"
    >
      <draggable
        :model-value="siteOrder"
        item-key="key"
        :disabled="loading"
        @update:model-value="emit('update:site-order', $event)"
      >
        <template #item="props">
          <div>
            <slot name="item" v-bind="props">
              <v-list-item border class="pa-2 mb-2" rounded>
                <v-list-item-title>
                  <AtomsChipsShiftType
                    class="mr-2"
                    :shift-type="props.element.shiftType"
                  />
                  <slot name="title" v-bind="props">
                    <span>{{ props.element.docId }}</span>
                  </slot>
                </v-list-item-title>
              </v-list-item>
            </slot>
          </div>
        </template>
      </draggable>
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
