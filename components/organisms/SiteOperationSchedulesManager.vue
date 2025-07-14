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
            <air-date-input v-bind="attrs" autocomplete="off" />
          </template>
          <template #after-dateAt>
            <v-col cols="12">
              <OrganismsAgreementSelector
                label="取極めから選択"
                :date="slotProps.item.dateAt"
                :items="auth.company.agreements"
                @select="
                  slotProps.updateProperties({
                    dayType: $event.dayType,
                    shiftType: $event.shiftType,
                    startAt: $event.startAt,
                    endAt: $event.endAt,
                    breakMinutes: $event.breakMinutes,
                  })
                "
              />
            </v-col>
          </template>
          <template #startAt="{ attrs }">
            <air-date-time-picker-input
              v-bind="attrs"
              :rules="[
                (v) => {
                  const { dateAt, startAt } = slotProps.item;
                  if (!startAt || !dateAt) return true;
                  if (slotProps.item.shiftType === 'day') {
                    const date = dayjs(dateAt).format('YYYY-MM-DD');
                    const startDate = dayjs(startAt).format('YYYY-MM-DD');
                    return date === startDate || '開始時刻が日付と一致しません';
                  } else {
                    const date = dayjs(dateAt).format('YYYY-MM-DD');
                    const startDate = dayjs(startAt).format('YYYY-MM-DD');
                    const allowedDate = dayjs(dateAt)
                      .add(1, 'day')
                      .format('YYYY-MM-DD');
                    if (startDate === date || startDate === allowedDate)
                      return true;
                    return '開始日時の日付が不正です';
                  }
                },
              ]"
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
