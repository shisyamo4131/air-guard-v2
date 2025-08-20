<script setup>
/**
 * @file components/molecules/draggable/SiteOperationSchedule.vue
 * @description A component for draggable site-operation-schedule.
 *
 * @props {String} date - The date for which schedules are being managed.
 * @props {String} shiftType - The type of shift for which schedules are being managed.
 * @props {String} siteId - The ID of the site for which schedules are being managed.
 *
 * @emits click:edit - Event to edit the schedule.
 * @emits click:duplicate - Event to duplicate the schedule.
 * @emits click:notify - Event to notify about the schedule.
 *
 * @slots
 * - default: Slot for rendering the schedule item.
 */
import { computed } from "vue";
import { useLogger } from "@/composables/useLogger";

/** define model-value and emit `update:model-value` */
const schedule = defineModel({ type: Object, required: true });

/** define props */
const props = defineProps({
  /** The date of the schedule */
  date: { type: String, required: true },
  /** The shiftType of the schedule */
  shiftType: { type: String, required: true },
  /** The siteId of the schedule */
  siteId: { type: String, required: true },
});

/** define emits */
const emit = defineEmits(["click:edit", "click:duplicate", "click:notify"]);

/** define composables */
const logger = useLogger("ScheduleTag");

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return schedule.value.workDescription || "通常警備";
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function handleWorkerAdded(addedEvent) {
  const { workerId, isEmployee, amount } = addedEvent.element;
  schedule.value.addWorker(workerId, isEmployee, amount, addedEvent.newIndex);
  await schedule.value.update();
}

async function handleWorkerRemoved(removedEvent) {
  const { workerId, isEmployee, amount } = removedEvent.element;
  schedule.value.removeWorker(workerId, amount, isEmployee);
  await schedule.value.update();
}

async function handleWorkerMoved(movedEvent) {
  const { isEmployee } = movedEvent.element;
  schedule.value.changeWorker(
    movedEvent.oldIndex,
    movedEvent.newIndex,
    isEmployee
  );
  await schedule.value.update();
}

/**
 * vuedraggable の change ハンドラ
 * @param event
 */
async function handleChangeWorkers(event) {
  logger.clearError();
  try {
    if (event.added) {
      await handleWorkerAdded(event.added);
    } else if (event.removed) {
      await handleWorkerRemoved(event.removed);
    } else if (event.moved) {
      await handleWorkerMoved(event.moved);
    }
  } catch (error) {
    logger.error({ message: error.message, error });
  }
}

/**
 * Update the detail status of the worker in the schedule.
 * @param {Object} workerInstance - The worker instance to update.
 * @param {String} status - The new status to set.
 */
async function handleUpdateDetailStatus({ worker, status }) {
  worker.status = status;
  await schedule.value.update();
}
</script>

<template>
  <v-card flat style="border: 1px dashed grey; max-width: 100%" s>
    <div
      class="d-flex text-subtitle-2 font-weight-regular px-3 pt-2 pb-0 align-center"
      style="max-width: 100%"
    >
      <v-badge
        :color="schedule.isPersonnelShortage ? 'error' : 'primary'"
        :content="schedule.requiredPersonnel"
        inline
        size="x-small"
      />
      <span class="flex-grow-1 text-truncate" style="min-width: 0">
        {{ `${label}` }}
      </span>
      <v-icon icon="mdi-menu" class="drag-handle" />
    </div>
    <!--
      default slot for `MoleculesDraggableWorkers`.
    -->
    <slot
      name="default"
      v-bind="{
        modelValue: schedule.workers,
        date,
        shiftType,
        siteId,
        onChange: handleChangeWorkers,
        'onUpdate:status': handleUpdateDetailStatus,
        'onClick:remove': handleWorkerRemoved,
      }"
    />
    <v-container
      class="d-flex justify-end pt-0 pb-2 px-2"
      style="column-gap: 4px"
    >
      <!-- 通知ボタン -->
      <v-btn
        variant="tonal"
        size="x-small"
        @click="emit('click:notify', schedule)"
      >
        <v-icon>mdi-bullhorn</v-icon>
      </v-btn>
      <!-- 複製ボタンはとりあえず用意 -->
      <v-btn
        variant="tonal"
        size="x-small"
        @click="emit('click:duplicate', schedule)"
      >
        <v-icon>mdi-content-copy</v-icon>
      </v-btn>
      <v-btn
        variant="tonal"
        size="x-small"
        @click="emit('click:edit', schedule)"
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
