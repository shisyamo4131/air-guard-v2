<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
});

/** define-stores */
const auth = useAuthStore();

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

onUnmounted(() => {
  instance.unsubscribe();
});
</script>

<template>
  <ArrayManager
    v-slot="slotProps"
    :model-value="instance.docs"
    :schema="SiteOperationSchedule"
    :before-edit="(editMode, item) => (item.siteId = siteId)"
    :handle-create="async (item) => await item.create()"
    :handle-update="async (item) => await item.update()"
    :handle-delete="async (item) => await item.delete()"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesEditCard v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps.inputProps">
          <template #dateAt="{ attrs }">
            <air-date-input
              v-bind="attrs"
              autocomplete="off"
              @update:modelValue="
                ($event) => {
                  const { startAt, endAt, shiftType } = slotProps.item;
                  const defaultTime = auth.company.getDefaultTime(
                    $event,
                    shiftType
                  );

                  const setTime = (date, refDate) => {
                    if (!date || !refDate) return;
                    const d = dayjs(refDate);
                    date.setHours(d.hour(), d.minute(), 0, 0);
                  };

                  setTime(defaultTime.startAt, startAt);
                  setTime(defaultTime.endAt, endAt);

                  slotProps.updateProperties({
                    startAt: defaultTime.startAt,
                    endAt: defaultTime.endAt,
                  });
                }
              "
            />
          </template>
          <template #startAt="{ attrs }">
            <air-date-time-picker-input
              v-bind="attrs"
              @update:modelValue="
                ($event) => {
                  // $event (= startAt) の 9時間後 を取得して endAt を更新
                  const endAt = new Date($event);
                  endAt.setHours(endAt.getHours() + 9);
                  slotProps.updateProperties({ endAt });
                }
              "
            />
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
