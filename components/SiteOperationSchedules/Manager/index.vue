<script setup>
import { useBaseManager } from "@/composables/useBaseManager";
import { SiteOperationSchedule } from "@/schemas";
import { useDefaults } from "vuetify";
import CustomInput from "@/components/SiteOperationSchedule/CustomInput";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/siteOperationScheduleHandlers";

defineOptions({ name: "SiteOperationSchedulesManager", inheritAttrs: false });

const _props = defineProps({
  customInput: { type: [Object, Function], default: () => CustomInput },
  docs: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every((item) => item instanceof SiteOperationSchedule),
  },
  dateAt: { type: Object, default: () => new Date() },
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
});
const props = useDefaults(_props, "SiteOperationSchedulesManager");
const emit = defineEmits(["update:date-range"]);
const { attrs } = useBaseManager("SiteOperationSchedulesManager");
const slots = useSlots();
const forwardedSlotNames = computed(() =>
  Object.keys(slots).filter((name) => name !== "table"),
);
const events = computed(() => props.docs.map((doc) => doc.toEvent()));
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
                aria-label="稼働予定を登録"
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
    <template v-for="name in forwardedSlotNames" #[name]="scope">
      <slot :name="name" v-bind="scope || {}" />
    </template>
  </air-array-manager>
</template>
