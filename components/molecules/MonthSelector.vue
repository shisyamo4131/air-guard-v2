<script setup>
import dayjs from "dayjs";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  modelValue: { type: Date, default: new Date() },
});

const emit = defineEmits(["update:modelValue", "from", "to", "date-range"]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalModel = ref(props.modelValue);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const monthString = computed(() => {
  return dayjs(internalModel.value).format("YYYY年MM月");
});

const from = computed(() => {
  return dayjs(internalModel.value).startOf("month").toDate();
});

const to = computed(() => {
  return dayjs(internalModel.value).endOf("month").toDate();
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.modelValue,
  (newVal) => {
    internalModel.value = newVal;
  }
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onClickPrev() {
  internalModel.value = dayjs(internalModel.value)
    .startOf("month")
    .subtract(1, "month")
    .toDate();
  emit("from", from.value);
  emit("to", to.value);
  emit("date-range", { from: from.value, to: to.value });
}

function onClickNext() {
  internalModel.value = dayjs(internalModel.value)
    .startOf("month")
    .add(1, "month")
    .toDate();
  emit("from", from.value);
  emit("to", to.value);
  emit("date-range", { from: from.value, to: to.value });
}
</script>

<template>
  <div class="d-flex align-center justify-space-between">
    <v-btn icon="mdi-chevron-left" size="small" @click="onClickPrev" />
    <v-card flat class="text-h6">
      <span>{{ monthString }}</span>
    </v-card>
    <v-btn icon="mdi-chevron-right" size="small" @click="onClickNext" />
  </div>
</template>
