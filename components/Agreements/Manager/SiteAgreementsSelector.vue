<script setup>
/*****************************************************************************
 * AgreementsManager 専用 現場取極め選択参照コンポーネント
 *****************************************************************************/
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  updateProperties: { type: Function, required: true },
});
</script>

<template>
  <AgreementsSelector
    :agreements="props.modelValue"
    clear-on-select
    return-object
    select-strategy="single"
    @update:modelValue="
      ($event) => {
        props.updateProperties({ ...$event.billingInfo });
      }
    "
  >
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        :disabled="!props.modelValue.length"
        block
        color="primary"
      >
        現場取極め参照
      </v-btn>
    </template>
  </AgreementsSelector>
</template>
