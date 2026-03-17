<script setup>
/*****************************************************************************
 * AgreementsManager 専用 会社取極め選択参照コンポーネント
 *****************************************************************************/
import { useAuthStore } from "@/stores/useAuthStore.js";

const props = defineProps({
  updateProperties: { type: Function, required: true },
});

const auth = useAuthStore();
</script>

<template>
  <AgreementsSelector
    :agreements="auth.company.agreements"
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
        :disabled="!auth.company.agreements.length"
        block
        color="secondary"
      >
        会社取極め参照
      </v-btn>
    </template>
  </AgreementsSelector>
</template>
