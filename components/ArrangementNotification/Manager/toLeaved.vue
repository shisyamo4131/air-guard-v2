<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/Manager/toLeaved.vue
 * @description A component to manage `ArrangementNotification` document to be `LEAVED`.
 * @extends AirItemManager
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  siteOperationScheduleId: {
    type: String,
    required: true,
  },
});
const props = useDefaults(_props, "ArrangementNotificationManagerToLeaved");
</script>

<template>
  <air-item-manager hide-delete-btn>
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>
    <template #input-default="{ componentAttrs }">
      <v-row>
        <!-- DATEAT -->
        <v-col cols="12">
          <air-date-input v-bind="componentAttrs[`dateAt`]" disabled />
        </v-col>

        <!-- ACTUAL START TIME -->
        <v-col cols="12">
          <air-time-picker-input v-bind="componentAttrs[`actualStartTime`]" />
        </v-col>

        <!-- ACTUAL IS START NEXT DAY -->
        <v-col cols="12">
          <IsStartNextDayCheckbox
            v-bind="componentAttrs[`actualIsStartNextDay`]"
          />
        </v-col>

        <!-- ACTUAL END TIME -->
        <v-col cols="12">
          <air-time-picker-input v-bind="componentAttrs[`actualEndTime`]" />
        </v-col>

        <!-- ACTUAL BREAK MINUTES -->
        <v-col cols="12">
          <AtomsHourInput
            v-bind="componentAttrs[`actualBreakMinutes`]"
            label="休憩時間"
            :step="0.5"
          />
        </v-col>
      </v-row>
    </template>
  </air-item-manager>
</template>
