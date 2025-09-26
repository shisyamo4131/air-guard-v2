<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SiteOperationScheduleManager" });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  siteId: { type: String, required: true },
});

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("EmployeesManager", useErrorsStore());
const { docs, events, dateRange, toUpdate } = useSiteOperationSchedulesManager({
  manager: useTemplateRef("manager"),
  siteId: props.siteId,
});

/***************************************************************************
 * COMPUTED PROPERTIES
 ***************************************************************************/
</script>

<template>
  <air-array-manager
    ref="manager"
    :model-value="docs"
    :schema="SiteOperationSchedule"
    :before-edit="(editMode, item) => (item.siteId = siteId)"
    :input-props="{
      excludedKeys: ['status', 'employees', 'outsourcers'],
    }"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="error"
    @error:clear="clearError"
  >
    <template #table="slotProps">
      <v-card>
        <v-toolbar density="comfortable">
          <v-toolbar-title>稼働予定</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-plus" @click="slotProps['onClick:create']()" />
        </v-toolbar>
        <v-card-text>
          <air-calendar
            style="min-height: 480px"
            :model-value="dateRange.from"
            :events="events"
            @click:event="
              (nativeEvent, { event }) => {
                if (!event.item.isEditable) return;
                slotProps['onClick:update'](event.item);
              }
            "
            @update:model-value="
              dateRange = {
                from: dayjs($event).toDate(),
                to: dayjs($event).endOf('month').toDate(),
              }
            "
          />
        </v-card-text>
      </v-card>
    </template>
  </air-array-manager>
</template>
