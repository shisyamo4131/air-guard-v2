<script setup>
/**
 * AgreementGroup.vue
 * @version 1.0.0
 * @author shisyamo4131
 * @description A component for selecting an agreement.
 */

/** SETUP PROPS & EMITS */
const props = defineProps({
  clearable: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  modelValue: { type: Object, default: null },
});

const emit = defineEmits(["update:modelValue"]);

/** SETUP STATES */
const internalValue = ref(null);
watch(
  () => props.modelValue,
  (newVal) => {
    internalValue.value = newVal?.key || null;
  },
  { immediate: true }
);
watch(internalValue, (newKey) => {
  const item = props.items.find((item) => item.key === newKey) || null;
  emit("update:modelValue", item);
});

/** SETUP COMPUTED PROPERTIES */
/**
 * Returns the agreements with a "not selected" option prepended.
 */
const agreements = computed(() => {
  if (!props.clearable) return props.items;
  return [{ key: null }, ...props.items];
});

/** METHODS */
function reset() {
  internalValue.value = null;
}

/** EXPOSE */
defineExpose({
  reset,
});
</script>

<template>
  <v-item-group v-model="internalValue" mandatory selected-class="bg-primary">
    <v-row>
      <v-col
        v-for="(agreement, index) of agreements || []"
        :key="index"
        cols="12"
        sm="6"
        md="4"
      >
        <v-item v-slot="{ selectedClass, toggle }" :value="agreement.key">
          <MoleculesAgreementCard
            v-if="agreement.key"
            :agreement="agreement"
            :class="selectedClass"
            @click="toggle"
            variant="flat"
            border
          />
          <v-card
            v-else
            :class="selectedClass"
            variant="flat"
            border
            height="100%"
            @click="toggle"
          >
            <v-card-text
              class="d-flex align-center justify-center"
              style="height: 100%"
            >
              <div>未選択</div>
            </v-card-text>
          </v-card>
        </v-item>
      </v-col>
    </v-row>
  </v-item-group>
</template>
