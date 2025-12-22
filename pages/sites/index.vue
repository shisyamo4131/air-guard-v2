<script setup>
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useSitesManager } from "@/composables/useSitesManager";
import { Site } from "@/schemas";

/** SETUP  */
const options = [["where", "status", "==", Site.STATUS_ACTIVE]];
const { docs } = useDocuments("Site", {
  options: toRef(options),
  fetchAllOnEmpty: true,
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
