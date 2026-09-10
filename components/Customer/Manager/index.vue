<script setup>
/*****************************************************************************
 * @file components/Customer/Manager/index.vue
 * @description AirItemManagerを使った取引先通常作成・更新コンポーネント
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";
import {
  CustomerOperationError,
  getCustomerOperationErrorMessage,
} from "@/composables/domain/customer/customerOperations";
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
  operation: {
    type: String,
    default: "UPDATE",
    validator: (value) => ["CREATE", "UPDATE"].includes(value),
  },
  title: { type: String, required: true },
});
const emit = defineEmits(["created"]);

const auth = useAuthStore();
const { attrs } = useBaseManager("CustomerManager");
const { canWrite, createCustomer, isSaving, updateCustomer } =
  useCustomerActions();
const isEditing = ref(false);
const stableSnapshot = shallowRef(new Customer(props.doc.toObject()));
const editorForm = ref(null);
let committedCreationScope = null;

const operationDisabled = computed(
  () =>
    !canWrite.value ||
    isSaving.value ||
    (props.operation === "UPDATE" && !props.doc.docId),
);
const submitText = computed(() =>
  props.operation === "CREATE" ? "登録" : "更新",
);

function syncFromListener() {
  stableSnapshot.value = new Customer(props.doc.toObject());
}

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
  if (editMode !== props.operation) return rejectUnsupportedOperation();
  if (operationDisabled.value) {
    throw new CustomerOperationError(
      "permission-denied",
      "取引先を変更する権限を確認できません。",
    );
  }
  return true;
}

function openManager(slotProps) {
  if (operationDisabled.value) return;
  if (props.operation === "CREATE") {
    clearCreationScope();
    return slotProps.toCreate(new Customer());
  }
  syncFromListener();
  return slotProps.toUpdate(stableSnapshot.value);
}

function handleEditing(value) {
  isEditing.value = value;
  if (!value) {
    clearCreationScope();
    if (props.operation === "UPDATE") syncFromListener();
  }
}

function ignoreManagerModelValue() {
  // Firestore listenerだけを表示用modelの正本にする。
  return undefined;
}

function editorErrorMessage(errors) {
  const error = errors?.[0];
  return getCustomerOperationErrorMessage(
    error,
    props.operation === "CREATE"
      ? "取引先を登録できませんでした。"
      : "取引先情報を更新できませんでした。",
  );
}

async function submitEditor(editorAttrs) {
  if (
    editorAttrs.isLoading ||
    editorAttrs.disabled ||
    editorAttrs.disableSubmit
  ) return;
  const validation = await editorForm.value?.validate();
  if (validation && validation.valid !== true) return;
  await editorAttrs["onClick:submit"]();
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

watch(
  () => props.doc,
  () => {
    if (!isEditing.value) syncFromListener();
  },
  { deep: true },
);
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="stableSnapshot"
    :included-keys="props.includedKeys"
    :label="props.title"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': props.title,
    }"
    :before-edit="beforeEdit"
    :disable-update="operationDisabled"
    :disable-delete="true"
    :hide-delete-btn="true"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    :is-editing="isEditing"
    @update:is-editing="handleEditing"
    @update:model-value="ignoreManagerModelValue"
    @create="handleCreated"
    @quit="clearCreationScope"
  >
    <template #activator="slotProps">
      <slot
        name="activator"
        :item="props.doc"
        :disabled="operationDisabled"
        :open="() => openManager(slotProps)"
      />
    </template>

    <template #editor="editorAttrs">
      <v-form
        ref="editorForm"
        :disabled="editorAttrs.disabled"
        @submit.prevent="submitEditor(editorAttrs)"
      >
        <v-card :border="false">
          <v-toolbar
            color="secondary"
            density="compact"
            :title="props.title"
          />
          <v-card-text>
            <v-alert
              v-if="editorAttrs.errors.length"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ editorErrorMessage(editorAttrs.errors) }}
            </v-alert>
            <air-item-input v-bind="editorAttrs.inputProps" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <AtomsBtnsCancel
              type="button"
              :disabled="editorAttrs.isLoading"
              @click="editorAttrs['onClick:cancel']"
            />
            <AtomsBtnsSubmit
              type="submit"
              :text="submitText"
              :loading="editorAttrs.isLoading"
              :disabled="editorAttrs.disabled || editorAttrs.disableSubmit"
            />
          </v-card-actions>
        </v-card>
      </v-form>
    </template>
  </air-item-manager>
</template>
