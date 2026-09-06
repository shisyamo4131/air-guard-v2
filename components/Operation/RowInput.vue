<script setup>
import { useOperationArticleInput } from "@/composables/application/operation/useOperationArticleInput";
const props = defineProps({ item: { type: Object, required: true }, componentAttrs: { type: Object, required: true }, updateProperties: { type: Function, required: true }, disabled: { type: Boolean, default: false } });
const emit = defineEmits(["pending"]);
const article = useOperationArticleInput(props, emit);
</script>
<template>
  <v-row>
    <template v-if="'articleId' in item">
      <v-col v-if="article.error.value" cols="12"><v-alert type="warning">{{ article.error.value }}</v-alert></v-col>
      <v-col cols="12"><ArticleAutocomplete :model-value="item.articleId" :disabled="disabled" :loading="article.pending.value" required @update:model-value="article.chooseArticle" /></v-col>
      <v-col cols="6"><air-number-input v-bind="componentAttrs.price" :disabled="disabled" @update:model-value="article.changePrice" /></v-col>
      <v-col cols="6"><air-number-input v-bind="componentAttrs.quantity" :disabled="disabled" /></v-col>
    </template>
    <template v-else>
      <v-col cols="12">
        <EmployeeAutocomplete v-if="item.isEmployee" v-bind="componentAttrs.id" :disabled="disabled" label="従業員" />
        <OutsourcerAutocomplete v-else v-bind="componentAttrs.id" :disabled="disabled" label="外注先" />
      </v-col>
      <v-col cols="6"><air-time-picker-input v-bind="componentAttrs.startTime" :disabled="disabled" /></v-col>
      <v-col cols="6"><air-time-picker-input v-bind="componentAttrs.endTime" :disabled="disabled" /></v-col>
      <v-col cols="12"><IsStartNextDayCheckbox v-bind="componentAttrs.isStartNextDay" :disabled="disabled" /></v-col>
      <v-col cols="6"><AtomsHourInput v-bind="componentAttrs.breakMinutes" :disabled="disabled" label="休憩時間" :step="0.5" /></v-col>
      <v-col cols="6"><AtomsHourInput v-bind="componentAttrs.regulationWorkMinutes" :disabled="disabled" label="規定実働時間" :step="0.5" /></v-col>
      <v-col cols="6"><air-checkbox v-bind="componentAttrs.isQualified" :disabled="disabled" /></v-col>
      <v-col cols="6"><air-checkbox v-bind="componentAttrs.isOjt" :disabled="disabled" /></v-col>
    </template>
  </v-row>
</template>
