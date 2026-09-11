<script setup>
import { Employee } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CreateInput from "@/components/Employee/CustomInput/ToRegist.vue";
import BaseInput from "@/components/Employee/CustomInput/Base.vue";

defineOptions({ name: "EmployeesManager", inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  modelValue: {
    type: Array,
    default: () => [],
    validator: (value) => value.every((item) => item instanceof Employee),
  },
});
const { attrs } = useBaseManager("EmployeesManager");

function rejectDirectDelete() {
  throw new Error("従業員は直接削除できません。");
}

function resolveCustomInput({ editMode }) {
  if (props.customInput) {
    return typeof props.customInput === "function"
      ? props.customInput({ editMode })
      : props.customInput;
  }
  return editMode === "CREATE" ? CreateInput : BaseInput;
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return rejectDirectDelete();
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
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    class="fill-height"
    :model-value="props.modelValue"
    :schema="Employee"
    label="従業員の新規登録"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': '従業員の新規登録',
    }"
    :before-edit="beforeEdit"
    :custom-input="resolveCustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectDirectDelete"
  >
    <template #table="tableAttrs">
      <slot name="table" v-bind="tableAttrs" />
    </template>
  </air-array-manager>
</template>
