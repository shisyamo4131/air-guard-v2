<script setup>
import { OperationResultEmployee } from "@/schemas";
import OperationResultStartTimeEditor from "@/components/operation-results/StartTimeEditor.vue";
import OperationResultEndTimeEditor from "@/components/operation-results/EndTimeEditor.vue";
import { useFetchEmployee } from "@/composables/useFetchEmployee";

/** define-props */
const props = defineProps({
  isEditing: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] },
});

/** define-emits */
const emits = defineEmits(["update:isEditing", "update:modelValue"]);

/** define-composables */
const { fetchEmployee, cachedEmployees } = useFetchEmployee();

/** cloned modelValue */
const clonedModelValue = ref([]);

/** component's editing condition */
const isEditing = ref(false);

/** define editors to manage `startAt` and `endAt` */
const editors = {
  startAt: OperationResultStartTimeEditor,
  endAt: OperationResultEndTimeEditor,
};

/** for component tag */
const editTarget = ref(null);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const editComponent = computed(() => {
  return editors[editTarget.value];
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(() => props.modelValue, _initClonedModelValue, {
  immediate: true,
  deep: true,
});

watch(
  () => props.isEditing,
  (newVal) => {
    isEditing.value = newVal;
    emits("update:isEditing", newVal);
  },
  { immediate: true }
);

watch(clonedModelValue, (newVal) => {
  fetchEmployee(newVal);
});

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/

/**
 * Clone the modelValue to `clonedModelValue`.
 */
function _initClonedModelValue() {
  clonedModelValue.value = props.modelValue.map((item) => item.clone());
}

/**
 * Cancel the editing and reset the cloned model value.
 */
function cancel() {
  isEditing.value = false;
  _initClonedModelValue();
}

/**
 * Submit the changes and emit the updated model value.
 */
function submit() {
  emits("update:modelValue", clonedModelValue.value);
  isEditing.value = false;
}
</script>

<template>
  <ArrayManager
    v-model="clonedModelValue"
    :schema="OperationResultEmployee"
    v-slot="slotProps"
  >
    <v-card>
      <v-toolbar density="comfortable">
        <v-toolbar-title>稼働実績明細（従業員）</v-toolbar-title>
        <v-spacer />
        <v-btn v-if="!isEditing" icon="mdi-pencil" @click="isEditing = true" />
        <div v-else>
          <v-btn icon="mdi-close" @click="cancel" />
          <v-btn icon="mdi-check" @click="submit" />
        </div>
      </v-toolbar>
      <OperationResultsDataTable
        :items="slotProps.items"
        :is-editing="isEditing"
        :employees="cachedEmployees"
        @add="
          slotProps.toCreate();
          $nextTick(() => {
            slotProps.updateProperties({ employeeId: $event });
            slotProps.submit();
          });
        "
        @click:startAt="
          editTarget = 'startAt';
          slotProps.toUpdate($event);
        "
        @click:endAt="
          editTarget = 'endAt';
          slotProps.toUpdate($event);
        "
        @click:isQualificated="
          editTarget = null;
          slotProps.toUpdate($event.item);
          $nextTick(() => {
            slotProps.updateProperties({
              isQualificated: $event.value,
            });
            slotProps.submit();
          });
        "
        @click:isOjt="
          editTarget = null;
          slotProps.toUpdate($event.item);
          $nextTick(() => {
            slotProps.updateProperties({
              isOjt: $event.value,
            });
            slotProps.submit();
          });
        "
      />
      <v-dialog
        :model-value="slotProps.isEditing && !!editTarget"
        @update:modelValue="slotProps.quitEditing"
        width="auto"
        :fullscreen="$vuetify.display.xs"
      >
        <component
          :is="editComponent"
          :item="slotProps.item"
          :submit="slotProps.submit"
          :update-properties="slotProps.updateProperties"
          @click:close="slotProps.quitEditing"
        />
      </v-dialog>
    </v-card>
  </ArrayManager>
</template>
