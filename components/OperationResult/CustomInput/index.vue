<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/CustomInput/index.vue
 * @description 稼働実績登録用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Operation } from "@/schemas";
import { useSetRegularTime } from "@/composables/useSetRegularTime";
import { useSiteOperationRead } from "@/composables/dataLayers/site/useSiteOperationRead";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
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

const siteReads = useSiteOperationRead(() => [
  props.item,
  props.item.siteId,
  props.item.securityType,
]);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * @description 現場IDが変更された場合、現場の警備種別を取得して更新する
 */
watch(
  () => [props.item, props.item.siteId, ...siteReads.identity.value],
  async ([item, siteId], [oldItem, oldSiteId] = []) => {
    if (item !== oldItem || siteId === oldSiteId) return;
    const request = siteReads.begin(siteId);
    if (!request) return;
    try {
      const site = await siteReads.read(request);
      if (request.isCurrent() && site?.securityType) {
        props.updateProperties({ securityType: site.securityType });
      }
    } catch {
      if (request.isCurrent()) {
        addMessage({
          color: "warning",
          text: "現場の警備種別を取得できませんでした。もう一度現場を選択してください。",
        });
      }
    }
  },
  { flush: "sync" },
);
</script>

<template>
  <v-row>
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
        variant="flat"
        color="primary"
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
