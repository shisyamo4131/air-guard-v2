<script setup>
import { SiteOperationSchedule, SiteOperationScheduleDetail } from "@/schemas";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

defineOptions({
  name: "SiteOperationScheduleWorkerDetailManager",
  inheritAttrs: false,
});

const loadingsStore = useLoadingsStore();
const manager = useTemplateRef("manager");
const internalSchedule = ref(new SiteOperationSchedule());
const internalWorker = ref(new SiteOperationScheduleDetail());

function toCreate({ schedule, worker = new SiteOperationScheduleDetail() }) {
  internalSchedule.value = schedule;
  internalWorker.value = worker;
  manager.value?.toCreate(internalWorker.value);
}

function toUpdate({ schedule, worker }) {
  internalSchedule.value = schedule;
  internalWorker.value = worker;
  manager.value?.toUpdate(internalWorker.value);
}

function toDelete({ schedule, worker }) {
  internalSchedule.value = schedule;
  internalWorker.value = worker;
  manager.value?.toDelete(internalWorker.value);
}

async function saveWorker(action, worker) {
  const loadingKey = loadingsStore.add("作業員情報を更新中...");
  try {
    internalSchedule.value[action](worker);
    await internalSchedule.value.update();
  } finally {
    loadingsStore.remove(loadingKey);
  }
}

defineExpose({ toCreate, toUpdate, toDelete });
</script>

<template>
  <SiteOperationScheduleDetailManager
    ref="manager"
    v-bind="$attrs"
    :model-value="internalWorker"
    :handle-create="(worker) => saveWorker('addWorker', worker)"
    :handle-update="(worker) => saveWorker('changeWorker', worker)"
    :handle-delete="(worker) => saveWorker('removeWorker', worker)"
  />
</template>
