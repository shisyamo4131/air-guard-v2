<script setup>
import { useSiteShiftTypeReorder } from "@/composables/useSiteShiftTypeReorder";

const { attrs, dialog, open } = useSiteShiftTypeReorder({
  type: "arrangement",
});
</script>

<template>
  <div>
    <SiteShiftTypeOrderReorder v-bind="attrs"> </SiteShiftTypeOrderReorder>
    {{ attrs.items }}
  </div>
</template>
