<script setup>
// Legacy callers may display a document, but persistence is operation-specific.
const props = defineProps({ doc: { type: Object, required: true } });
</script>
<template><slot name="activator" :item="props.doc" :can-edit="false" /></template>
