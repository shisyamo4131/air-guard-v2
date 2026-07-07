<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedule/CustomInput/index.vue
 * @description 現場稼働予定編集用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Operation } from "@/schemas";
import { useSetRegularTime } from "@/composables/useSetRegularTime";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Operation,
  },
  updateProperties: { type: Function, required: true },
});
const props = useDefaults(_props, "OperationResultCustomInput");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { set, addMessage } = useSetRegularTime(
  {
    siteId: () => props.item.siteId,
    date: () => props.item.date,
    shiftType: () => props.item.shiftType,
  },
  (agreement) => {
    props.updateProperties({
      startTime: agreement.startTime,
      endTime: agreement.endTime,
      isStartNextDay: agreement.isStartNextDay,
      breakMinutes: agreement.breakMinutes,
      regulationWorkMinutes: agreement.regulationWorkMinutes,
    });
    addMessage({ color: "success", text: "取極めから定時を設定しました。" });
  },
);

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("SiteOperationScheduleCustomInput");
const { cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * @description 現場IDが変更された場合、現場の警備種別を取得して更新する
 * [更新履歴]
 * 2026-07-07 - `immediate: true` を追加（配置管理上での新規現場予定作成時に警備種別が自動設定されなかったのを修正）
 */
watch(
  () => props.item.siteId,
  (newSiteId, oldSiteId) => {
    if (newSiteId && newSiteId !== oldSiteId) {
      const securityType = cachedSites.value?.[newSiteId]?.securityType;
      if (securityType) {
        props.updateProperties({ securityType });
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <v-row>
    <v-col v-if="props.item.operationResultId" cols="12">
      <v-alert
        type="info"
        density="compact"
        text="既に稼働実績が作成された現場稼働予定です。"
      />
    </v-col>
    <v-col cols="12">
      <SiteAutocomplete v-bind="props.componentAttrs['siteId']" creatable />
    </v-col>
    <v-col cols="12">
      <air-select v-bind="props.componentAttrs['securityType']" />
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="props.componentAttrs['dateAt']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-select v-bind="props.componentAttrs['dayType']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-select v-bind="props.componentAttrs['shiftType']" />
    </v-col>
    <v-col cols="12">
      <v-btn
        text="取極めから定時を設定"
        block
        color="primary"
        :disabled="props.disabled"
        variant="flat"
        @click="set"
      />
    </v-col>
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
    <v-col cols="12" md="6">
      <AtomsHourInput
        v-bind="props.componentAttrs['breakMinutes']"
        label="休憩時間"
        :step="0.5"
      />
    </v-col>
    <v-col cols="12" md="6">
      <AtomsHourInput
        v-bind="props.componentAttrs['regulationWorkMinutes']"
        label="規定実働時間"
        :step="0.5"
      />
    </v-col>
    <v-col cols="12">
      <air-number-input v-bind="props.componentAttrs['requiredPersonnel']" />
    </v-col>
    <v-col cols="12">
      <air-checkbox v-bind="props.componentAttrs['qualificationRequired']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['workDescription']" />
    </v-col>
    <v-col cols="12">
      <air-textarea v-bind="props.componentAttrs['remarks']" />
    </v-col>
  </v-row>
</template>
