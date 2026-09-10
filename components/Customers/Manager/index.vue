<script setup>
/*****************************************************************************
 * @file components/Customers/Manager/index.vue
 * @description AirArrayManagerを使った取引先一覧・選択文脈の作成入口
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";
import {
  captureCustomerCreationScope,
  initializeCommittedCustomerDraft,
} from "@/composables/application/customer/customerCreationBridge";
import {
  CUSTOMER_CREATE_FIELDS,
  CustomerOperationError,
  getCustomerOperationErrorMessage,
} from "@/composables/domain/customer/customerOperations";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  docs: { type: Array, default: () => [] },
  hideTable: { type: Boolean, default: false },
});
const emit = defineEmits(["created"]);

const auth = useAuthStore();
const { attrs } = useBaseManager("CustomersManager");
const { canWrite, createCustomer, isSaving } = useCustomerActions();
const editorForm = ref(null);
const errorMessage = ref("");
let committedCreationScope = null;

function rejectUnsupportedOperation() {
  throw new CustomerOperationError(
    "invalid-operation",
    "この画面では取引先の更新・削除を実行できません。",
  );
}

function beforeEdit(editMode) {
  errorMessage.value = "";
  if (editMode !== "CREATE") return rejectUnsupportedOperation();
  if (!canWrite.value) {
    throw new CustomerOperationError(
      "permission-denied",
      "取引先を変更する権限を確認できません。",
    );
  }
  return true;
}

function disableUpdate(item) {
  return Boolean(item?.docId);
}

async function handleCreate(draft) {
  committedCreationScope = null;
  const creationScope = captureCustomerCreationScope(auth);
  const created = await createCustomer(draft);
  if (!initializeCommittedCustomerDraft(draft, created)) {
    throw new CustomerOperationError(
      "create-failed",
      "取引先を登録できませんでした。",
    );
  }
  committedCreationScope = creationScope;
}

function handleCreated(created) {
  const creationScope = committedCreationScope;
  committedCreationScope = null;
  if (!created?.docId || !creationScope) return;
  emit("created", created, creationScope);
}

function handleManagerError(payload) {
  errorMessage.value = getCustomerOperationErrorMessage(
    payload?.error,
    "取引先を登録できませんでした。",
  );
}

function clearManagerError() {
  errorMessage.value = "";
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
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    class="fill-height"
    style="height: 100%"
    :model-value="props.docs"
    :schema="Customer"
    :included-keys="CUSTOMER_CREATE_FIELDS"
    label="取引先の新規登録"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': '取引先の新規登録',
    }"
    :before-edit="beforeEdit"
    :disable-submit="!canWrite || isSaving"
    :disable-update="disableUpdate"
    :disable-delete="true"
    :hide-delete-btn="true"
    :hide-table="props.hideTable"
    :handle-create="handleCreate"
    :handle-update="rejectUnsupportedOperation"
    :handle-delete="rejectUnsupportedOperation"
    @create="handleCreated"
    @error="handleManagerError"
    @error:clear="clearManagerError"
  >
    <template #header="{ toCreate }">
      <slot
        name="activator"
        :disabled="!canWrite || isSaving"
        :open="() => toCreate()"
      />
    </template>

    <template #table="tableAttrs">
      <slot
        name="table"
        v-bind="tableAttrs"
        :can-write="canWrite"
        :is-saving="isSaving"
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
            title="取引先の新規登録"
          />
          <v-card-text>
            <v-alert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ errorMessage }}
            </v-alert>
            <air-item-input v-bind="editorAttrs.inputProps" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              :disabled="editorAttrs.isLoading"
              variant="text"
              @click="editorAttrs['onClick:cancel']"
            >
              キャンセル
            </v-btn>
            <v-btn
              type="submit"
              color="primary"
              variant="flat"
              :loading="editorAttrs.isLoading"
              :disabled="editorAttrs.disabled || editorAttrs.disableSubmit"
            >
              登録
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </template>
  </air-array-manager>
</template>
