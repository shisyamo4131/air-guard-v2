<script setup>
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "ArrangementNotificationManagerToLeaved",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    validator: (value) => value instanceof ArrangementNotification,
  },
});
const props = useDefaults(_props, "ArrangementNotificationManagerToLeaved");
const emit = defineEmits(["submit:complete"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("ArrangementNotificationManagerToLeaved");
const manager = useTemplateRef("manager");

const fields = [
  "dateAt",
  "actualStartTime",
  "actualIsStartNextDay",
  "actualEndTime",
  "actualBreakMinutes",
];
const schema = fields.map((key) => ({
  key,
  ...ArrangementNotification.classProps[key],
}));

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function rejectUnsupportedOperation() {
  throw new Error("この画面では配置通知の作成・削除を実行できません。");
}

async function beforeEdit(editMode) {
  if (editMode !== "UPDATE") return rejectUnsupportedOperation();
  return true;
}

async function handleUpdate(item) {
  await item.toLeaved();
}

function handleComplete(event) {
  emit("submit:complete", event);
}

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
const toUpdate = (...args) => manager.value?.toUpdate(...args);
defineExpose({ toUpdate });
</script>

<template>
  <air-item-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.modelValue"
    :included-keys="schema"
    :before-edit="beforeEdit"
    disable-delete
    hide-delete-btn
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @submit:complete="handleComplete"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps">
        <v-btn
          color="primary"
          :disabled="slotProps.disableUpdate"
          @click="slotProps.toUpdate(props.modelValue)"
        >
          下番する
        </v-btn>
      </slot>
    </template>
    <template #input-default="{ componentAttrs }">
      <v-row>
        <v-col cols="12"
          ><air-date-input v-bind="componentAttrs.dateAt" disabled
        /></v-col>
        <v-col cols="12"
          ><air-time-picker-input v-bind="componentAttrs.actualStartTime"
        /></v-col>
        <v-col cols="12"
          ><IsStartNextDayCheckbox v-bind="componentAttrs.actualIsStartNextDay"
        /></v-col>
        <v-col cols="12"
          ><air-time-picker-input v-bind="componentAttrs.actualEndTime"
        /></v-col>
        <v-col cols="12"
          ><AtomsHourInput
            v-bind="componentAttrs.actualBreakMinutes"
            label="休憩時間"
            :step="0.5"
        /></v-col>
      </v-row>
    </template>
  </air-item-manager>
</template>
