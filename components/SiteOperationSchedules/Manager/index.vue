<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedules/Manager/index.vue
 * @description A component to manage `SiteOperationSchedules`.
 * @extends AirArrayManager
 * @emit update:date-range {Object} - Emits the selected date range when it changes.
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { SiteOperationSchedule } from "@/schemas";
import { useDefaults } from "vuetify";
import CustomInput from "@/components/SiteOperationSchedule/CustomInput";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/siteOperationScheduleHandlers";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteOperationSchedulesManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  docs: { type: Array, default: () => [] },
  dateAt: { type: Object, default: () => new Date() }, // 初期表示させる日を設定
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
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
const events = computed(() => {
  return props.docs.map((doc) => doc.toEvent());
});
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.docs"
    :schema="SiteOperationSchedule"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :disable-update="(item) => !!item.operationResultId"
    :disable-delete="(item) => !!item.operationResultId"
    :custom-input="props.customInput"
  >
    <template #table="tableProps">
      <slot name="table" v-bind="tableProps">
        <v-card>
          <v-toolbar color="secondary" density="compact" title="稼働予定">
            <template #append>
              <v-btn
                icon="mdi-plus"
                size="small"
                @click="() => tableProps.toCreate()"
              />
            </template>
          </v-toolbar>
          <v-card-text>
            <SiteOperationSchedulesCalendar
              :model-value="props.dateAt"
              :events="events"
              @update:date-range="emit('update:date-range', $event)"
              @click:event="tableProps.toUpdate($event)"
            />
          </v-card-text>
        </v-card>
      </slot>
    </template>
  </air-array-manager>
</template>
