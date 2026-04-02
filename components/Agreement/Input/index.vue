<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Input/index.vue
 * @description 取極め管理用コンポーネント
 * - AirArrayManager, AirItemManager の input-default スロットに配置して使用する。
 * @property {Object} componentAttrs - 各入力コンポーネントに渡す属性オブジェクト
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { AgreementV2 } from "@/schemas";
import RateSetInput from "./RateSet.vue";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementInput");

/*****************************************************************************
 * DEFINE CONSTANTS
 *****************************************************************************/
const dayTypes = Object.keys(AgreementV2.DAY_TYPE).map((key) => {
  return {
    value: key,
    title: AgreementV2.DAY_TYPE[key].title,
  };
});

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
const tab = ref("WEEKDAY");
</script>

<template>
  <v-row>
    <!-- LEFT SIDE -->
    <v-col cols="12" md="6">
      <v-row>
        <!-- DATE -->
        <v-col cols="12">
          <air-date-input v-bind="props.componentAttrs['dateAt']" />
        </v-col>
        <!-- START TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input v-bind="props.componentAttrs['startTime']" />
        </v-col>
        <!-- END TIME -->
        <v-col cols="12" md="6">
          <air-time-picker-input v-bind="props.componentAttrs['endTime']" />
        </v-col>
        <!-- IS START NEXT DAY -->
        <v-col cols="12">
          <MoleculesInputsIsStartNextDay
            v-bind="props.componentAttrs['isStartNextDay']"
          />
        </v-col>
        <!-- REGULATION WORK MINUTES -->
        <v-col cols="12" md="6">
          <air-number-input
            v-bind="props.componentAttrs['regulationWorkMinutes']"
          />
        </v-col>
        <!-- BREAK MINUTES -->
        <v-col cols="12" md="6">
          <air-number-input v-bind="props.componentAttrs['breakMinutes']" />
        </v-col>
        <!-- BILLING UNIT TYPE -->
        <v-col cols="12" md="6">
          <air-select v-bind="props.componentAttrs['billingUnitType']" />
        </v-col>
        <!-- CUTOFF DATE -->
        <v-col cols="12" md="6">
          <air-select v-bind="props.componentAttrs['cutoffDate']" />
        </v-col>
        <!-- INCLUDE BREAK IN BILLING -->
        <v-col cols="12">
          <air-checkbox
            v-bind="props.componentAttrs['includeBreakInBilling']"
          />
        </v-col>
      </v-row>
    </v-col>
    <!-- RIGHT SIDE -->
    <v-col cols="12" md="6">
      <h4 class="text-title">単価情報</h4>
      <v-row>
        <!-- DAY TYPE TABS -->
        <v-col cols="12">
          <v-tabs
            v-model="tab"
            center-active
            grow
            show-arrows
            density="compact"
          >
            <v-tab
              v-for="dayType in dayTypes"
              :key="dayType.value"
              :value="dayType.value"
              >{{ dayType.title }}</v-tab
            >
          </v-tabs>
        </v-col>
        <v-tabs-window v-model="tab" class="flex-grow-1">
          <v-tabs-window-item
            v-for="dayType in dayTypes"
            :key="dayType.value"
            :value="dayType.value"
          >
            <v-row>
              <v-col cols="12">
                <RateSetInput
                  v-bind="props.componentAttrs['rates']"
                  :day-type="dayType.value"
                  :disabled="props.disabled"
                  :label="`${dayType.title}単価`"
                />
              </v-col>
            </v-row>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-row>
    </v-col>
  </v-row>
</template>
