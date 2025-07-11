<script setup>
import { OperationResultEmployee } from "@/schemas";
import { useFetchEmployee } from "@/composables/useFetchEmployee";

/** define-props */
const props = defineProps({
  defaultAttendance: {
    type: Object,
    default: () => ({
      startAt: new Date(),
      endAt: new Date(),
    }),
  },
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
        :default-attendance="props.defaultAttendance"
        :items="slotProps.items"
        :is-editing="isEditing"
        :employees="cachedEmployees"
        @update:items="clonedModelValue = $event"
      />
    </v-card>
  </ArrayManager>
</template>
