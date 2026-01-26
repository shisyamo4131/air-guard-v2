<script setup>
import importedProps from "@/components/Worker/Tag/props";
import { useDefaults } from "vuetify";
import { SiteOperationSchedule, SiteOperationScheduleDetail } from "@/schemas";

const _props = defineProps({
  ...importedProps,
  hideEditBtn: { type: Boolean, default: false },
  schedule: { type: Object, default: () => new SiteOperationSchedule() },
  worker: { type: Object, default: () => new SiteOperationScheduleDetail() },
});

const props = useDefaults(_props, "SiteOperationScheduleWorkerTag");
const emit = defineEmits(["click:edit"]);
</script>

<template>
  <WorkerTag>
    <template #append-footer>
      <v-icon
        v-if="!props.hideEditBtn"
        class="ml-2"
        :disabled="!props.schedule?.isEditable || true"
        icon="mdi-pencil"
        size="x-small"
        @click="emit('click:edit')"
      />
    </template>
  </WorkerTag>
</template>
