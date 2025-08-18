<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";
import { useDateRange } from "../../composables/useDateRange";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
});

/** define composables */
const { company } = useAuthStore();
const { currentBaseDate, dateRange, debouncedDateRange } = useDateRange({
  baseDate: new Date(),
  dayCount: dayjs(new Date()).daysInMonth(),
});
const fetchSiteComposable = useFetchSite();
const { cachedSites } = fetchSiteComposable;
const { docs, events } = useSiteOperationSchedulesManager({
  manager: useTemplateRef("manager"),
  siteId: props.siteId,
  dateRange: debouncedDateRange,
});

/***************************************************************************
 * COMPUTED PROPERTIES
 ***************************************************************************/
</script>

<template>
  <ArrayManager
    ref="manager"
    v-slot="slotProps"
    :model-value="docs"
    :schema="SiteOperationSchedule"
    :before-edit="
      (editMode, item) => {
        item.siteId = siteId;
      }
    "
    :dialog-props="{ maxWidth: 600 }"
    :input-props="{
      excludedKeys: ['status', 'employees', 'outsourcers'],
    }"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesSiteOperationScheduleEditor
        v-bind="slotProps.editorProps"
        :agreements="
          cachedSites[props.siteId]?.agreements || company.agreements
        "
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
            :model-value="[currentBaseDate]"
            :events="events"
            @click:event="slotProps.toUpdate($event.item)"
            @update:model-value="
              dateRange = {
                from: dayjs($event).toDate(),
                to: dayjs($event).endOf('month').toDate(),
              }
            "
          />
        </v-container>
      </v-card>
    </slot>
  </ArrayManager>
</template>
