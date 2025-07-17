<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { getDayType } from "air-guard-v2-schemas/constants";
import { SiteOperationSchedule } from "@/schemas";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
  agreements: { type: Array, default: () => [] },
});

/** SiteOperationSchedule instance */
const instance = reactive(new SiteOperationSchedule());

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
    subscribe(siteId, startAt, endAt);
  },
  { immediate: true, deep: true }
);

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onUnmounted(() => {
  instance.unsubscribe();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Start subscribing to the SiteOperationSchedule documents
 * when the period changes or the component is mounted.
 * @param siteId
 * @param startAt
 * @param endAt
 */
function subscribe(siteId, startAt, endAt) {
  instance.subscribeDocs({
    constraints: [
      ["where", "siteId", "==", siteId],
      ["where", "startAt", ">=", startAt],
      ["where", "startAt", "<=", endAt],
    ],
  });
}
</script>

<template>
  <ArrayManager
    v-slot="slotProps"
    :model-value="instance.docs"
    :schema="SiteOperationSchedule"
    :before-edit="(editMode, item) => (item.siteId = siteId)"
    :dialog-props="{ maxWidth: 600 }"
    :input-props="{
      excludedKeys: ['status', 'employees', 'outsourcers'],
    }"
    :handle-create="async (item) => await item.create()"
    :handle-update="async (item) => await item.update()"
    :handle-delete="async (item) => await item.delete()"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesEditCard
        v-bind="slotProps.editorProps"
        :disable-delete="slotProps.item.status !== 'DRAFT'"
      >
        <air-item-input v-bind="slotProps.inputProps">
          <template #dateAt="{ attrs }">
            <air-date-input
              v-bind="attrs"
              @update:modelValue="
                slotProps.updateProperties({ dayType: getDayType($event) })
              "
            />
          </template>
          <template #after-dateAt>
            <v-col cols="12">
              <OrganismsAgreementSelector
                :items="props.agreements"
                @select="
                  $event.dateAt = slotProps.item.dateAt;
                  slotProps.updateProperties($event);
                "
              >
                <template #activator="{ props: activatorProps }">
                  <v-btn v-bind="activatorProps" block color="primary"
                    >取極めから複製</v-btn
                  >
                </template>
              </OrganismsAgreementSelector>
            </v-col>
          </template>
        </air-item-input>
      </MoleculesEditCard>
    </v-dialog>
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
  </ArrayManager>
</template>
