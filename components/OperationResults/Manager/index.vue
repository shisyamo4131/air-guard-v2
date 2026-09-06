<script setup>
import CustomInput from "@/components/OperationResult/CustomInput/index.vue";
defineOptions({ inheritAttrs: false });
const props = defineProps({ docs: { type: Array, default: () => [] }, customInput: { type: Object, default: () => CustomInput } });
</script>
<template>
  <OperationArrayManager v-bind="$attrs" kind="result" :docs="props.docs" :custom-input="props.customInput">
    <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
  </OperationArrayManager>
</template>
