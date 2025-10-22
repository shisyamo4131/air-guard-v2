<script setup>
/*****************************************************************************
 * OperationResultManager ver 1.0.0
 * @author shisyamo4131
 * @description A component to manage operation result.
 * ---------------------------------------------------------------------------
 * @props {Object} modelValue - The operation result model. (Reactive)
 * @props {Function} handleCreate - Function to handle creation of operation result.
 * @props {Function} handleUpdate - Function to handle update of operation result.
 * @props {Function} handleDelete - Function to handle deletion of operation result.
 * @props {Array} includedKeys - Keys to include in the input form.
 * @props {String} label - Label for the operation result.
 *****************************************************************************/
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("SiteManager", useErrorsStore());

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const model = defineModel({ type: Object, required: true });
const props = defineProps({
  handleCreate: { type: Function, default: (item) => item.create() },
  handleUpdate: { type: Function, default: (item) => item.update() },
  handleDelete: { type: Function, default: (item) => item.delete() },
  includedKeys: {
    type: Array,
    default: () => [
      "code",
      "siteId",
      "dateAt",
      "dayType",
      "shiftType",
      "startTime",
      "endTime",
      "breakMinutes",
      "workDescription",
      "remarks",
    ],
  },
  label: { type: String, default: "稼働実績" },
});
</script>

<template>
  <air-item-manager
    :model-value="model"
    :dialog-props="{ maxWidth: 600 }"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    :input-props="{ includedKeys: includedKeys }"
    :label="label"
    @error="error"
    @error:clear="clearError"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
