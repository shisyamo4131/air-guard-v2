<script setup>
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES / STORES
 *****************************************************************************/
const { error, clearError } = useLogger("CompanyManager", useErrorsStore());

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const model = defineModel({ type: Object, required: true });
const props = defineProps({
  handleCreate: { type: Function, default: (item) => item.create() },
  handleUpdate: { type: Function, default: (item) => item.update() },
  handleDelete: { type: Function, default: (item) => item.delete() },
});
</script>

<template>
  <air-item-manager
    :model-value="model"
    :editor-props="{ hideDeleteBtn: true }"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @error="error"
    @error:clear="clearError"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>

<style></style>
