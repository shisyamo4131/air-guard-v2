<script setup>
import CustomInput from "@/components/OperationBilling/CustomInput/index.vue";
defineOptions({ inheritAttrs: false });
const props = defineProps({ doc: { type: Object, default: null }, customInput: { type: Object, default: () => CustomInput } });
const manager = useTemplateRef("manager");
defineExpose({ toCreate: (...args) => manager.value?.toCreate(...args), toUpdate: (...args) => manager.value?.toUpdate(...args), toDelete: (...args) => manager.value?.toDelete(...args) });
</script>
<template>
  <OperationManager ref="manager" v-bind="$attrs" kind="billing" :doc="props.doc" :custom-input="props.customInput" >
    <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
  </OperationManager>
</template>
