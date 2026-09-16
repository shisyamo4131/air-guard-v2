<script setup>
import SiteLifecycleInput from "@/components/Site/CustomInput/Lifecycle.vue";

const props = defineProps({ site: { type: Object, required: true } });
const emit = defineEmits(["completed"]);
</script>

<template>
  <SiteManager
    :model-value="props.site"
    :custom-input="SiteLifecycleInput"
    lifecycle-mode="TERMINATE"
    label="現場を終了"
    @updated="emit('completed', $event)"
  >
    <template #activator="{ toUpdate }">
      <slot name="activator" :open="() => toUpdate(props.site)" :disabled="props.site.status !== 'ACTIVE'" />
    </template>
  </SiteManager>
</template>
