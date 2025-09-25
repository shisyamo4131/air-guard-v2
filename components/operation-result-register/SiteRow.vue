<script setup>
/*****************************************************************************
 * DEFINE(INJECT) COMPOSABLES
 *****************************************************************************/
const cachedSites = inject("cachedSites");

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  siteId: { type: String, default: undefined },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const name = computed(() => {
  if (!props.siteId) return "loading...";
  return cachedSites.value[props.siteId]?.name || "loading...";
});
</script>

<template>
  <tr>
    <td>現場</td>
    <td>{{ name }}</td>
  </tr>
</template>
