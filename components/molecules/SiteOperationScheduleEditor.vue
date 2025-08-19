<script setup>
/** define options */
defineOptions({ inheritAttrs: false });

/** define props */
const props = defineProps({
  inputProps: { type: Object, required: true },
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <MoleculesCardsEdit v-bind="$attrs">
    <template #default>
      <air-item-input v-bind="props.inputProps"> </air-item-input>
    </template>
  </MoleculesCardsEdit>
</template>
