<script setup>
/*****************************************************************************
 * @file components/Customer/Manager/index.vue
 * @description AirItemManagerを使った取引先通常作成・更新コンポーネント
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";
import { CustomerOperationError } from "@/composables/domain/customer/customerOperations";
import {
  captureCustomerCreationScope,
  initializeCommittedCustomerDraft,
} from "@/composables/application/customer/customerCreationBridge";

const props = defineProps({
  doc: {
    type: Object,
    default: () => new Customer(),
    validator: (value) => value instanceof Customer,
  },
  includedKeys: { type: Array, required: true },
  title: { type: String, required: true },
});
const emit = defineEmits(["created"]);

const auth = useAuthStore();
const { attrs } = useBaseManager("CustomerManager");
const { canWrite, createCustomer, isSaving, updateCustomer } =
  useCustomerActions();
let committedCreationScope = null;

const operationDisabled = computed(
  () => !canWrite.value || isSaving.value,
);

function clearCreationScope() {
  committedCreationScope = null;
}

function rejectUnsupportedOperation() {
  throw new CustomerOperationError(
    "invalid-operation",
    "この画面では指定された取引先操作を実行できません。",
  );
}

function beforeEdit(editMode) {
  clearCreationScope();
  if (!["CREATE", "UPDATE"].includes(editMode)) {
    return rejectUnsupportedOperation();
  }
  if (operationDisabled.value) {
    throw new CustomerOperationError(
      "permission-denied",
      "取引先を変更する権限を確認できません。",
    );
  }
  if (editMode === "UPDATE" && !props.doc.docId) {
    throw new CustomerOperationError(
      "invalid-customer",
      "取引先の最新情報を確認できません。",
    );
  }
  return true;
}

function toCreate(slotProps) {
  if (operationDisabled.value) return;
  clearCreationScope();
  return slotProps.toCreate(new Customer());
}

async function handleUpdate(draft) {
  return await updateCustomer({
    latest: () => props.doc,
    draft,
  });
}

async function handleCreate(draft) {
  clearCreationScope();
  const creationScope = captureCustomerCreationScope(auth);
  try {
    const created = await createCustomer(draft);
    if (!initializeCommittedCustomerDraft(draft, created)) {
      throw new CustomerOperationError(
        "create-failed",
        "取引先を登録できませんでした。",
      );
    }
    committedCreationScope = creationScope;
  } catch (error) {
    clearCreationScope();
    throw error;
  }
}

function handleCreated(created) {
  const creationScope = committedCreationScope;
  clearCreationScope();
  if (!created?.docId || !creationScope) return;
  emit("created", created, creationScope);
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :included-keys="props.includedKeys"
    :label="props.title"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': props.title,
    }"
    :before-edit="beforeEdit"
    :disable-submit="operationDisabled"
    :disable-update="operationDisabled || !props.doc.docId"
    :disable-delete="true"
    :hide-delete-btn="true"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @create="handleCreated"
    @quit="clearCreationScope"
  >
    <template #activator="slotProps">
      <slot
        name="activator"
        :item="props.doc"
        :disabled="operationDisabled"
        :to-create="() => toCreate(slotProps)"
        :to-update="() => slotProps.toUpdate(props.doc)"
      />
    </template>
  </air-item-manager>
</template>
