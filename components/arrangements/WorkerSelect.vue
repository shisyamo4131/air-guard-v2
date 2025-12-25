<script setup>
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";

const props = defineProps({
  employees: { type: Array, default: () => [] },
  outsourcers: { type: Array, default: () => [] },
  cachedSites: { type: Object, default: () => ({}) },
});

const instance = reactive(new SiteOperationSchedule());
const component = ref(null);

function handleChange({ event }) {
  if (event.added) {
    const { id, isEmployee } = event.added.element;
    instance.addWorker({ id, isEmployee }, event.added.newIndex);
  } else if (event.moved) {
    const { element, oldIndex, newIndex } = event.moved;
    const { isEmployee } = element;
    instance.moveWorker({ oldIndex, newIndex, isEmployee });
  } else if (event.removed) {
    const { workerId, isEmployee } = event.removed.element;
    instance.removeWorker({ workerId, isEmployee });
  }
}

defineExpose({
  set: (item) => {
    instance.initialize(item);
    component.value.toUpdate();
  },
});
</script>

<template>
  <air-item-manager
    :ref="(el) => (component = el)"
    :model-value="instance"
    :handle-update="(item) => item.update()"
  >
    <template #editor="editorProps">
      <v-card class="d-flex flex-column" style="height: 100vh">
        <template #title>{{
          cachedSites?.[editorProps.props.item.siteId]?.name || "loading..."
        }}</template>
        <template #subtitle>{{
          `${dayjs(editorProps.props.item.dateAt).format("M月D日(ddd) ")}
          ${
            SiteOperationSchedule.DAY_TYPE[editorProps.props.item.dayType].title
          }
          ${
            SiteOperationSchedule.SHIFT_TYPE[editorProps.props.item.shiftType]
              .title
          }
          `
        }}</template>
        <div
          class="pa-2 pt-0 d-flex flex-column flex-grow-1 ga-2"
          style="min-height: 0"
        >
          <v-card style="height: 280px">
            <div class="h-100 overflow-y-auto">
              <MoleculesWorkerSelector
                :employees="employees"
                :outsourcers="outsourcers"
              >
                <template #employee="{ rawElement, id }">
                  <MoleculesTagBase :label="rawElement.displayName" />
                </template>
                <template #outsourcer="{ rawElement }">
                  <MoleculesTagBase :label="rawElement.displayName" />
                </template>
              </MoleculesWorkerSelector>
            </div>
          </v-card>
          <v-card style="flex: 1; min-height: 120px">
            <div class="h-100 overflow-y-auto">
              <ArrangementsDraggableWorkers
                :schedule="editorProps.props.item"
                hide-edit
                hide-notification
                @change="handleChange"
              />
            </div>
          </v-card>
        </div>
        <template #actions>
          <MoleculesActionsSubmitCancel v-bind="editorProps.actions" />
        </template>
      </v-card>
    </template>
  </air-item-manager>
</template>
