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
 *
 * @slots
 * - default: Slot for rendering the schedule item.
 */
import { computed } from "vue";
import { useLogger } from "@/composables/useLogger";
import { SITE_OPERATION_SCHEDULE_STATUS_DRAFT } from "air-guard-v2-schemas/constants";

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
const emit = defineEmits(["click:edit", "click:duplicate"]);

/** define composables */
const logger = useLogger();

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return schedule.workDescription || "通常警備";
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function handleWorkerAdded(addedEvent) {
  const { workerId, isEmployee, amount } = addedEvent.element;
  schedule.addWorker(workerId, isEmployee, amount, addedEvent.newIndex);
  await schedule.update();
}

async function handleWorkerRemoved(removedEvent) {
  const { workerId, isEmployee, amount } = removedEvent.element;
  schedule.removeWorker(workerId, amount, isEmployee);
  await schedule.update();
}

async function handleWorkerMoved(movedEvent) {
  const { isEmployee } = movedEvent.element;
  schedule.changeWorker(movedEvent.oldIndex, movedEvent.newIndex, isEmployee);
  await schedule.update();
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
    logger.error({ sender: "handleChange", message: error.message, error });
  }
}

/**
 * Update the detail status of the worker in the schedule.
 * @param {Object} workerInstance - The worker instance to update.
 * @param {String} status - The new status to set.
 */
async function handleUpdateDetailStatus({ worker, status }) {
  worker.status = status;
  await schedule.update();
}
</script>

<template>
  <v-card flat style="border: 1px dashed grey">
    <v-card-title class="text-subtitle-2 font-weight-regular pb-0">
      <v-icon v-if="schedule.isPersonnelShortage" color="error" size="small">
        mdi-information
      </v-icon>
      {{ `${label}(${schedule.requiredPersonnel})` }}
    </v-card-title>
    <v-container class="py-0 d-flex justify-center" style="column-gap: 20px">
      <v-checkbox
        :model-value="!schedule.isDraft"
        color="primary"
        :readonly="!schedule.isDraft && !schedule.isScheduled"
        hide-details
        density="compact"
        :disabled="schedule.isPersonnelShortage"
        style="height: 32px"
        @update:modelValue="
          ($event) => ($event ? schedule.toScheduled() : schedule.toDraft())
        "
      >
        <template #label>
          <span class="text-caption">予定確定</span>
        </template>
      </v-checkbox>
      <v-checkbox
        :model-value="schedule.isArranged"
        color="primary"
        density="compact"
        :disabled="!schedule.isScheduled && !schedule.isArranged"
        hide-details
        style="height: 32px"
        @update:modelValue="
          ($event) => ($event ? schedule.toArranged() : schedule.toScheduled())
        "
      >
        <template #label>
          <span class="text-caption">配置確定</span>
        </template>
      </v-checkbox>
    </v-container>
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
        disabled: !schedule.isWorkerChangeable,
        onChange: handleChangeWorkers,
        'onUpdate:status': handleUpdateDetailStatus,
        'onClick:remove': handleWorkerRemoved,
      }"
    />
    <v-container
      class="d-flex justify-end pt-0 pb-2 px-2"
      style="column-gap: 4px"
    >
      <!-- 複製ボタンはとりあえず用意 -->
      <v-btn
        disabled
        variant="tonal"
        size="x-small"
        @click="emit('click:duplicate', schedule)"
      >
        <v-icon>mdi-content-copy</v-icon>
      </v-btn>
      <v-btn
        :disabled="schedule.status !== SITE_OPERATION_SCHEDULE_STATUS_DRAFT"
        variant="tonal"
        size="x-small"
        @click="emit('click:edit', schedule)"
      >
        <v-icon>mdi-pencil</v-icon>
      </v-btn>
    </v-container>
  </v-card>
</template>

<style scoped></style>
