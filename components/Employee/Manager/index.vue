<script setup>
import { Employee } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CreateInput from "@/components/Employee/CustomInput/ToRegist.vue";
import BaseInput from "@/components/Employee/CustomInput/Base.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  archiveMode: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    default: () => new Employee(),
    validator: (value) => value instanceof Employee,
  },
});
const emit = defineEmits(["created", "updated", "delete"]);
const { attrs } = useBaseManager("EmployeeManager");

function resolveCustomInput({ editMode }) {
  if (props.customInput) {
    return typeof props.customInput === "function"
      ? props.customInput({ editMode })
      : props.customInput;
  }
  return editMode === "CREATE" ? CreateInput : BaseInput;
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE" && !props.archiveMode) {
    throw new Error("従業員のアーカイブは詳細画面から実行してください。");
  }
  const proceed = await props.beforeEdit(editMode, item);
  if (proceed === false) return false;
  if (
    editMode === "UPDATE" &&
    item.employmentStatus !== Employee.STATUS_ACTIVE
  ) {
    throw new Error("退職済み従業員の通常情報は変更できません。");
  }
  return true;
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleUpdate(draft) {
  return await draft.update();
}

async function handleDelete(draft) {
  return await draft.delete();
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
    :disable-delete="!props.archiveMode"
    :hide-delete-btn="!props.archiveMode"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @create="emit('created', $event)"
    @update="emit('updated', $event)"
    @delete="emit('delete', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
