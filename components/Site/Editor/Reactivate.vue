<script setup>
import SiteLifecycleInput from "@/components/Site/CustomInput/Lifecycle.vue";

const props = defineProps({ site: { type: Object, required: true } });
const emit = defineEmits(["completed"]);
</script>

<template>
  <SiteManager
    :model-value="props.site"
    :custom-input="SiteLifecycleInput"
    lifecycle-mode="REACTIVATE"
    label="現場を再有効化"
    @updated="emit('completed', $event)"
  >
    <template #activator="{ toUpdate }">
      <slot name="activator" :open="() => toUpdate(props.site)" :disabled="props.site.status !== 'TERMINATED'" />
    </template>
  </SiteManager>
</template>
