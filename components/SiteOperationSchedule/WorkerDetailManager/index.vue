<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedule/WorkerDetailManager/index.vue
 * @description 現場稼働予定作業員詳細情報管理コンポーネント
 * - 作業員情報を編集し、直接現場稼働予定ドキュメントを更新可能にしたコンポーネントです。
 * @extends SiteOperationScheduleDetailManager
 *****************************************************************************/
import { SiteOperationSchedule, SiteOperationScheduleDetail } from "@/schemas";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteOperationScheduleWorkerDetailManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const loadingsStore = useLoadingsStore();

/*****************************************************************************
 * TEMPLATE REF
 *****************************************************************************/
const component = useTemplateRef("component");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalSchedule = ref(new SiteOperationSchedule());
const internalWorker = ref(new SiteOperationScheduleDetail());

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function toCreate({ schedule, worker = new SiteOperationScheduleDetail() }) {
  internalSchedule.value = schedule;
  internalWorker.value = worker;
  component.value?.toCreate(internalWorker.value);
}
function toUpdate({ schedule, worker }) {
  internalSchedule.value = schedule;
  internalWorker.value = worker;
  component.value?.toUpdate(internalWorker.value);
}
function toDelete({ schedule, worker }) {
  internalSchedule.value = schedule;
  internalWorker.value = worker;
  component.value?.toDelete(internalWorker.value);
}

async function handleCreate(worker) {
  const loadingKey = loadingsStore.add("作業員情報を更新中...");
  try {
    internalSchedule.value.addWorker(worker);
    await internalSchedule.value.update();
  } finally {
    loadingsStore.remove(loadingKey);
  }
}

async function handleUpdate(worker) {
  const loadingKey = loadingsStore.add("作業員情報を更新中...");
  try {
    internalSchedule.value.changeWorker(worker);
    await internalSchedule.value.update();
  } finally {
    loadingsStore.remove(loadingKey);
  }
}

async function handleDelete(worker) {
  const loadingKey = loadingsStore.add("作業員情報を更新中...");
  try {
    internalSchedule.value.removeWorker(worker);
    await internalSchedule.value.update();
  } finally {
    loadingsStore.remove(loadingKey);
  }
}
/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({ toCreate, toUpdate, toDelete });
</script>

<template>
  <SiteOperationScheduleDetailManager
    v-bind="$attrs"
    ref="component"
    :model-value="internalWorker"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
  />
</template>
