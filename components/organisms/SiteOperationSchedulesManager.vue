<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
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

/***************************************************************************
 * METHODS
 ***************************************************************************/
function onClickEvent(nativeEvent, { event }) {
  if (!event.item.isEditable) return;
  toUpdate(event.item);
}
</script>

<template>
  <air-array-manager
    ref="manager"
    :model-value="docs"
    :schema="SiteOperationSchedule"
    :before-edit="(editMode, item) => (item.siteId = siteId)"
    :input-props="{
      excludedKeys: ['siteId', 'employees', 'outsourcers'],
    }"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="(e) => error({ error: e })"
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
          <v-container class="pt-0">
            <MoleculesMonthSelector
              :model-value="dateRange.from"
              @date-range="dateRange = $event"
            />
          </v-container>
          <air-calendar
            style="min-height: 520px"
            :model-value="dateRange.from"
            :events="events"
            @click:event="onClickEvent"
          />
        </v-card-text>
      </v-card>
    </template>
    <template #shiftType="{ attrs }">
      <v-radio-group v-bind="attrs" inline>
        <v-radio label="日勤" value="DAY" />
        <v-radio label="夜勤" value="NIGHT" />
      </v-radio-group>
    </template>
    <template #isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
  </air-array-manager>
</template>
