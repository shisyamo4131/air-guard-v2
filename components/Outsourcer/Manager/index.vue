<script setup>
import { Outsourcer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/Outsourcer/CustomInput.vue";

defineOptions({ name: "OutsourcerManager", inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  modelValue: {
    type: Object,
    default: () => new Outsourcer(),
    validator: (value) => value instanceof Outsourcer,
  },
});
const emit = defineEmits(["created", "updated"]);
const { attrs } = useBaseManager("OutsourcerManager");

function rejectDirectDelete() {
  throw new Error("外注先は直接削除できません。");
}

function resolveCustomInput(context) {
  if (props.customInput) {
    return typeof props.customInput === "function"
      ? props.customInput(context)
      : props.customInput;
  }
  return CustomInput;
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return rejectDirectDelete();
  return await props.beforeEdit(editMode, item);
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleUpdate(draft) {
  return await draft.update();
}
</script>

<template>
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.modelValue"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': $attrs.label,
    }"
    :before-edit="beforeEdit"
    :custom-input="resolveCustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectDirectDelete"
    @create="emit('created', $event)"
    @update="emit('updated', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
