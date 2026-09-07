<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedule/CustomInput/index.vue
 * @description 現場稼働予定編集用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Operation } from "@/schemas";
import { useSetRegularTime } from "@/composables/useSetRegularTime";
import { useSiteOperationRead } from "@/composables/dataLayers/site/useSiteOperationRead";
import {
  attachSiteScheduleConfirmation,
  clearSiteScheduleConfirmation,
} from "@/utils/siteOperationSchedule/siteScheduleGuard";

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
    draftValues: () => [
      props.item, props.item.startTime, props.item.endTime,
      props.item.isStartNextDay, props.item.breakMinutes, props.item.regulationWorkMinutes,
    ],
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
const siteReads = useSiteOperationRead(() => [
  props.item, props.item.siteId, props.item.securityType,
]);
let securityTypeBasis = null;
const confirmationOperationId = Symbol("site-schedule-editor");

function onSiteSelectionConfirmed(context) {
  clearSiteScheduleConfirmation(props.item);
  if (!context) return;
  attachSiteScheduleConfirmation(props.item, {
    ...context,
    operationId: confirmationOperationId,
  });
}

onBeforeUnmount(() => clearSiteScheduleConfirmation(props.item));

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * @description 現場IDが変更された場合、現場の警備種別を取得して更新する
 * [更新履歴]
 * 2026-07-07 - `immediate: true` を追加（配置管理上での新規現場予定作成時に警備種別が自動設定されなかったのを修正）
 */
watch(
  () => [props.item, props.item.siteId, ...siteReads.identity.value],
  async ([item, siteId]) => {
    if (securityTypeBasis?.item !== item || securityTypeBasis?.siteId !== siteId) {
      securityTypeBasis = { item, siteId, value: item.securityType };
    }
    // Keep edits made while the User access check is still pending, too.
    if (item.securityType !== securityTypeBasis.value) return;
    const request = siteReads.begin(siteId);
    if (!request) return;
    try {
      const site = await siteReads.read(request);
      if (request.isCurrent() && site?.securityType) {
        props.updateProperties({ securityType: site.securityType });
      }
    } catch {
      if (request.isCurrent()) {
        addMessage({ color: "warning", text: "現場の警備種別を取得できませんでした。もう一度現場を選択してください。" });
      }
    }
  },
  { immediate: true, flush: "sync" },
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
      <SiteAutocomplete
        v-bind="props.componentAttrs['siteId']"
        creatable
        @site-selection-confirmed="onSiteSelectionConfirmed"
      />
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
