<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationScheduleDetail/CustomInput/index.vue
 * @description 現場稼働予定明細編集用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { SiteOperationScheduleDetail } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof SiteOperationScheduleDetail,
  },
});
const props = useDefaults(_props, "SiteOperationScheduleDetailCustomInput");
</script>

<template>
  <v-row dense>
    <v-col cols="12" md="6">
      <air-time-picker-input v-bind="props.componentAttrs['startTime']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-time-picker-input v-bind="props.componentAttrs['endTime']" />
    </v-col>
    <v-col cols="12">
      <is-start-next-day-checkbox
        v-bind="props.componentAttrs['isStartNextDay']"
      />
    </v-col>
    <v-col cols="12">
      <AtomsHourInput
        v-bind="props.componentAttrs['breakMinutes']"
        label="休憩時間"
        :step="0.5"
      />
    </v-col>
    <v-col cols="12" md="6">
      <air-checkbox v-bind="props.componentAttrs['isQualified']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-checkbox v-bind="props.componentAttrs['isOjt']" />
    </v-col>
  </v-row>
</template>
