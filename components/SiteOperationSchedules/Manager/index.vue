<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedules/Manager/index.vue
 * @description A component to manage `SiteOperationScheduls`.
 * @extends AirArrayManager
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { SiteOperationSchedule } from "@/schemas";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  dateAt: { type: Object, default: () => new Date() },
  siteId: { type: [String, Object], default: null },
});
const props = useDefaults(_props, "SiteOperationSchedulesManager");
const emit = defineEmits(["update:date-range"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SiteOperationSchedulesManager");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const excludedKeys = computed(() => {
  const result = ["employees", "outsourcers"];
  if (props.siteId) result.push("siteId");
  return result;
});

const events = computed(() => {
  return props.docs.map((doc) => doc.toEvent());
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function beforeEdit(editMode, item) {
  if (props.siteId) item.siteId = props.siteId;
}
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="props.docs"
    :schema="SiteOperationSchedule"
    :before-edit="beforeEdit"
    :excluded-keys="excludedKeys"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    :disable-update="(item) => !!item.operationResultId"
    :disable-delete="(item) => !!item.operationResultId"
  >
    <template #table="{ toUpdate, toCreate }">
      <v-card>
        <v-toolbar color="secondary" density="compact" title="稼働予定">
          <template #append>
            <v-btn icon="mdi-plus" size="small" @click="() => toCreate()" />
          </template>
        </v-toolbar>
        <v-card-text>
          <SiteOperationSchedulesCalendar
            :date-at="props.dateAt"
            :events="events"
            @update:date-range="emit('update:date-range', $event)"
            @click:event="toUpdate($event)"
          />
        </v-card-text>
      </v-card>
    </template>
    <template #[`input.shiftType`]="{ attrs }">
      <v-radio-group v-bind="attrs" inline>
        <v-radio label="日勤" value="DAY" />
        <v-radio label="夜勤" value="NIGHT" />
      </v-radio-group>
    </template>
    <template #[`input.isStartNextDay`]="{ attrs }">
      <IsStartNextDayCheckbox v-bind="attrs" />
    </template>
  </air-array-manager>
</template>
