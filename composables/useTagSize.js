/**
 * @file composables/useTagSize.js
 * @description A composable for managing tag size.
 */
import { ref } from "vue";

/** constants */
export const SELECTABLE_VALUES = ["small", "default", "large"];

/** props */
export const props = {
  tagSize: {
    type: String,
    default: "default",
    validator: (value) => SELECTABLE_VALUES.includes(value),
  },
};

/** emits */
export const emits = ["update:tag-size"];

/** main function */
export const useTagSize = (props, emit) => {
  // define refs
  const internalValue = ref(props.tagSize || "default");

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  /** Sync internalValue with props.tagSize */
  watch(
    () => props.tagSize,
    (newVal) => {
      if (SELECTABLE_VALUES.includes(newVal)) {
        internalValue.value = newVal;
      } else {
        console.error("Invalid tag size:", newVal);
      }
    },
    { immediate: true }
  );

  /** Emit 'update:tag-size' event if internalValue changes */
  watch(internalValue, (newVal) => emit("update:tag-size", newVal));

  /***************************************************************************
   * PROVIDES
   ***************************************************************************/
  return {
    internalValue,
  };
};
