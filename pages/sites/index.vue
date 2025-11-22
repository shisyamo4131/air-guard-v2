<script setup>
import { useSitesManager } from "@/composables/useSitesManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useSitesManager();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager
      class="fill-height"
      v-bind="attrs"
      :input-props="{ excludedKeys: ['agreements'] }"
    />
  </TemplatesFixedHeightContainer>
</template>
