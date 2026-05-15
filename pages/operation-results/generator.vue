<script setup>
/** DATA LAYER */
import { useUnconfirmedSiteOperationSchedules } from "@/composables/dataLayers/useUnconfirmedSiteOperationSchedules";
/** FETCH */
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
/** Subscribe to unconfirmed site operation schedules */
const { docs } = useUnconfirmedSiteOperationSchedules();

/** Setup fetch composable as root */
useFetch("OperationResultRegister", true);
</script>

<template>
  <TemplatesFixedHeightContainer>
    <OperationResultGenerator :site-operation-schedules="docs" />
  </TemplatesFixedHeightContainer>
</template>
