<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedule.
 *
 * @props {Boolean} isPersonnelShortage - Flag indicating personnel shortage.
 * @props {Number} requiredPersonnel - The number of required personnel.
 * @props {String|null} workDescription - Description of the work.
 * @props {Array} workers - List of workers assigned to the schedule.
 *
 * @emits click:edit - Event to edit the schedule.
 * @emits click:duplicate - Event to duplicate the schedule.
 * @emits click:notify - Event to notify about the schedule.
 *
 * @slots
 * - default: Slot for rendering the schedule item.
 */
import { computed } from "vue";
import DraggableIcon from "@/components/atoms/icons/Draggable.vue";

/** define props */
const props = defineProps({
  disabled: { type: Boolean, default: false },
  disableNotify: { type: Boolean, default: false },
  isPersonnelShortage: { type: Boolean, required: true },
  requiredPersonnel: { type: Number, required: true },
  workDescription: { type: [String, null], required: true },
  workers: { type: Array, default: () => [] },
});

/** define emits */
const emit = defineEmits(["click:edit", "click:duplicate", "click:notify"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return props.workDescription || "通常警備";
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <v-card flat style="border: 1px dashed grey; max-width: 100%" s>
    <div
      class="d-flex text-subtitle-2 font-weight-regular px-3 pt-2 pb-0 align-center"
      style="max-width: 100%"
    >
      <v-badge
        :color="isPersonnelShortage ? 'error' : 'primary'"
        :content="requiredPersonnel"
        inline
        size="x-small"
      />
      <span class="flex-grow-1 text-truncate" style="min-width: 0">
        {{ `${label}` }}
      </span>
      <DraggableIcon v-if="!disabled" />
    </div>
    <!--
      default slot for `MoleculesDraggableWorkers`.
    -->
    <slot name="default" :disabled="disabled" />
    <v-container
      class="d-flex justify-end pt-0 pb-2 px-2"
      style="column-gap: 4px"
    >
      <!-- 通知ボタン -->
      <v-btn
        :disabled="disabled || disableNotify"
        variant="tonal"
        size="x-small"
        @click="emit('click:notify')"
      >
        <v-icon>mdi-bullhorn</v-icon>
      </v-btn>
      <!-- 複製ボタン -->
      <v-btn variant="tonal" size="x-small" @click="emit('click:duplicate')">
        <v-icon>mdi-content-copy</v-icon>
      </v-btn>
      <v-btn
        :disabled="disabled"
        variant="tonal"
        size="x-small"
        @click="emit('click:edit')"
      >
        <v-icon>mdi-pencil</v-icon>
      </v-btn>
    </v-container>
  </v-card>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
</style>
