<script setup>
/*****************************************************************************
 * @file ./components/atoms/icons/HasLicense.vue
 * @description
 *****************************************************************************/
import { useDefaults } from "vuetify";

defineOptions({ name: "AtomsIconsHasLicense", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "orange" },
});
const props = useDefaults(_props, "AtomsIconsHasLicense");
</script>

<template>
  <v-icon v-bind="$attrs" :color="props.color" icon="mdi-license" />
</template>
