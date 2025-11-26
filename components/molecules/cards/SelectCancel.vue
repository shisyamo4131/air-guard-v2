<script setup>
/**
 * SelectCancel.vue
 * @description SelectCancel component to select or cancel from a dialog.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { useDefaults } from "vuetify";

/** SETUP PROPS & EMITS */
const _props = defineProps({
  modelValue: { type: undefined, default: null },
  subtitle: { type: String, default: undefined },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "MoleculesCardsSelectCancel");

const emit = defineEmits(["update:modelValue"]);

/** SETUP REACTIVE OBJECTS */
const internalValue = ref(null); // Local copy of modelValue
const component = ref(null); // Reference to child component
const dialog = ref(false); // Dialog visibility

/** WATCHERS */
watch(
  () => props.modelValue,
  (newVal) => {
    internalValue.value = newVal;
  },
  { immediate: true }
);

watch(dialog, (newVal) => {
  if (newVal) return;
  internalValue.value = props.modelValue;
  if (component.value && component.value.reset) {
    component.value.reset();
  }
});

/** METHODS */
function onClickSelect() {
  emit("update:modelValue", internalValue.value);
  dialog.value = false;
}

function onClickCancel() {
  dialog.value = false;
}
</script>

<template>
  <AtomsDialogsFullscreen v-model="dialog">
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>
    <template #default>
      <v-card>
        <v-card-title v-if="title">{{ title }}</v-card-title>
        <v-card-subtitle v-if="subtitle">{{ subtitle }}</v-card-subtitle>
        <v-card-text>
          <slot
            name="default"
            v-bind="{
              ref: (el) => (component = el),
              modelValue: internalValue,
              'onUpdate:modelValue': (newVal) => (internalValue = newVal),
            }"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="onClickCancel">キャンセル</v-btn>
          <v-btn color="primary" @click="onClickSelect">選択</v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </AtomsDialogsFullscreen>
</template>
