<script setup>
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useSitesManager } from "@/composables/useSitesManager";
import { Site } from "@/schemas";

/** SETUP  */
const { docs } = useDocuments("Site", {
  constraints: [["where", "status", "==", Site.STATUS_ACTIVE]],
});
const { attrs } = useSitesManager({ docs });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager
      class="fill-height"
      v-bind="attrs"
      :excluded-keys="['agreements']"
    >
      <template #input.customerId="{ attrs }">
        <MoleculesAutocompleteCustomer v-bind="attrs" />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
