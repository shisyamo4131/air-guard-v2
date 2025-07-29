<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
  agreements: { type: Array, default: () => [] },
});

const manager = useTemplateRef("manager");
const { initialize, arrayManager } = useSiteOperationScheduleManager({
  manager,
  siteId: props.siteId,
});

/** A date for the current month */
const currentDate = ref([new Date()]);

/** Period of the current month calculated from currentDate */
const period = computed(() => {
  const start = dayjs(currentDate.value[0]).startOf("month").toDate();
  const end = dayjs(currentDate.value[0]).endOf("month").toDate();
  return { start, end };
});

/**
 * Start subscribing to the SiteOperationSchedule documents
 * when the period changes or the component is mounted.
 */
watch(
  period,
  async (newVal) => {
    const siteId = props.siteId;
    const [startAt, endAt] = [newVal.start, newVal.end];
    if (!siteId || !startAt || !endAt) return;
    initialize({ from: startAt, to: endAt, siteId });
  },
  { immediate: true, deep: true }
);
</script>

<template>
  <ArrayManager
    ref="manager"
    v-slot="slotProps"
    v-bind="arrayManager"
    :dialog-props="{ maxWidth: 600 }"
    :input-props="{
      excludedKeys: ['status', 'employees', 'outsourcers'],
    }"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesSiteOperationScheduleEditor
        v-bind="slotProps.editorProps"
        :agreements="props.agreements"
      />
    </v-dialog>
    <slot name="default" v-bind="slotProps">
      <v-card>
        <v-toolbar density="comfortable">
          <v-toolbar-title>稼働予定</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-plus" @click="slotProps.toCreate()" />
        </v-toolbar>
        <v-container class="pt-0">
          <air-calendar
            v-model="currentDate"
            :events="slotProps.items.map((schedule) => schedule.toEvent())"
            hide-week-number
            @click:event="slotProps.toUpdate($event.item)"
          />
        </v-container>
      </v-card>
    </slot>
  </ArrayManager>
</template>
