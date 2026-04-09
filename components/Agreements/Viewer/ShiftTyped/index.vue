<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Viewer/ShiftTyped/index.vue
 * @description AgreementsViewer 専用 特定勤務区分取極め情報表示コンポーネント
 * - `props.shiftType` で指定された勤務区分の取極め情報を表示するコンポーネント。
 *****************************************************************************/
import { SHIFT_TYPE_OPTIONS } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useIndex } from "./useIndex";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  agreements: { type: Array, default: () => [] },
  shiftType: {
    type: String,
    default: SHIFT_TYPE_OPTIONS[0].value,
    validator: (value) =>
      SHIFT_TYPE_OPTIONS.some((option) => option.value === value),
  },
});
const props = useDefaults(_props, "AgreementsViewerShiftTyped");
const emit = defineEmits(["update:currentAgreement", "update:currentIndex"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { agreements, validIndex, currentAgreement, currentIndex, next, prev } =
  useIndex(props.agreements, props.shiftType);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  currentAgreement,
  (newValue, oldValue) => {
    if (newValue?.key !== oldValue?.key) {
      emit("update:currentAgreement", newValue);
    }
  },
  { immediate: true },
);
watch(
  currentIndex,
  (newValue) => {
    emit("update:currentIndex", newValue);
  },
  { immediate: true },
);
</script>

<template>
  <v-window v-if="!!agreements.length" v-model="currentIndex">
    <v-window-item
      v-for="(agreement, index) in agreements"
      :key="index"
      :value="index"
    >
      <AgreementTable :agreement="agreement" :is-valid="index === validIndex" />
    </v-window-item>
  </v-window>
  <div v-else style="height: 318px">
    <v-empty-state
      title="取極め情報は未登録です"
      icon="mdi-alert-circle-outline"
      color="primary"
    />
  </div>
  <v-card-actions class="justify-space-between">
    <v-btn icon="mdi-chevron-left" size="small" @click="prev"></v-btn>
    <v-btn icon="mdi-chevron-right" size="small" @click="next"></v-btn>
  </v-card-actions>
</template>
