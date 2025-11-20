<script setup>
/**
 * A component for selecting an agreement.
 */

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  clearable: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  modelValue: { type: Object, default: null },
});
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Binding model for this component.
 * - getter: returns the key of `props.modelValue` or null.
 * - setter: finds the item in `props.items` by key and emits it via `update:modelValue`.
 */
const internalModelValue = computed({
  get() {
    return props.modelValue?.key || null;
  },
  set(value) {
    const item = props.items.find((item) => item.key === value) || null;
    emit("update:modelValue", item);
  },
});

/**
 * Returns the agreements with a "not selected" option prepended.
 */
const agreements = computed(() => {
  if (!props.clearable) return props.items;
  return [{ key: null }, ...props.items];
});
</script>

<template>
  <v-item-group
    v-model="internalModelValue"
    mandatory
    selected-class="bg-primary"
  >
    <v-container>
      <v-row>
        <v-col v-for="(agreement, index) of agreements || []" :key="index">
          <v-item v-slot="{ selectedClass, toggle }" :value="agreement.key">
            <v-card :class="selectedClass" @click="toggle">
              <v-card-text v-if="!agreement.key">
                <div>未選択</div>
              </v-card-text>
              <v-card-text v-else>
                <div>{{ `${agreement.date} ～` }}</div>
                <div>{{ `${agreement.dayType} ${agreement.shiftType}` }}</div>
                <div>{{ `基本単価: ${agreement.unitPriceBase}` }}</div>
                <div>{{ `資格単価: ${agreement.unitPriceQualified}` }}</div>
              </v-card-text>
            </v-card>
          </v-item>
        </v-col>
      </v-row>
    </v-container>
  </v-item-group>
</template>
