<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/CustomInput/index.vue
 * @description A custom-input component of `ArrangementNotification`.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";

defineOptions({
  name: "ArrangementNotificationCustomInput",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, required: true },
  item: {
    type: Object,
    default: null,
    validator: (value) =>
      value === null || value instanceof ArrangementNotification,
  },
});
const props = useDefaults(_props, "ArrangementNotificationCustomInput");
</script>

<template>
  <div>
    <v-row>
      <v-col cols="12">
        <ArrangementNotificationStatusChipGroup
          v-bind="componentAttrs['status']"
          mandatory
          column
        />
      </v-col>
      <!-- DATEAT -->
      <v-col cols="12">
        <air-date-input v-bind="componentAttrs[`dateAt`]" disabled />
      </v-col>
    </v-row>
    <v-expand-transition>
      <v-row v-show="props.item.isLeaved">
        <!-- ACTUAL START TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input v-bind="componentAttrs[`actualStartTime`]" />
        </v-col>

        <!-- ACTUAL END TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input v-bind="componentAttrs[`actualEndTime`]" />
        </v-col>

        <!-- ACTUAL IS START NEXT DAY -->
        <v-col cols="12">
          <IsStartNextDayCheckbox
            v-bind="componentAttrs[`actualIsStartNextDay`]"
          />
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
    </v-expand-transition>
  </div>
</template>
