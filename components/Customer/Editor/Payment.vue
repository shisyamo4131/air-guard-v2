<script setup>
import { Customer } from "@/schemas";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";
import {
  CUSTOMER_OPERATION,
  customerOperationSchema,
  customerSnapshot,
  customerSnapshotsEqual,
  getCustomerOperationErrorMessage,
} from "@/composables/domain/customer/customerOperations";

const props = defineProps({
  customer: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Customer,
  },
  title: { type: String, default: "請求・回収条件の編集" },
});

const { canWrite, isSaving, updatePayment } = useCustomerActions();
const operation = CUSTOMER_OPERATION.UPDATE_PAYMENT;
const schema = customerOperationSchema(operation);
const dialog = ref(false);
const draft = ref(null);
const baseline = ref(null);
const sourceAtOpen = ref(null);
const errorMessage = ref("");
const hasExternalChanges = ref(false);
const pendingOwnSnapshot = ref(null);
const failedOwnSnapshot = ref(null);
const isWaitingForRollback = ref(false);

function currentSnapshot() {
  return customerSnapshot(props.customer, operation);
}

function snapshotsEqual(left, right) {
  return customerSnapshotsEqual(left, right, operation);
}

function observeCurrentSnapshot() {
  const current = currentSnapshot();
  if (pendingOwnSnapshot.value) {
    if (
      snapshotsEqual(current, pendingOwnSnapshot.value) ||
      snapshotsEqual(current, sourceAtOpen.value)
    ) {
      return;
    }
  }
  if (failedOwnSnapshot.value) {
    if (snapshotsEqual(current, failedOwnSnapshot.value)) {
      isWaitingForRollback.value = true;
      return;
    }
    if (snapshotsEqual(current, sourceAtOpen.value)) {
      failedOwnSnapshot.value = null;
      isWaitingForRollback.value = false;
      return;
    }
  }
  if (!snapshotsEqual(current, sourceAtOpen.value)) {
    hasExternalChanges.value = true;
  }
}

function checkConflict() {
  observeCurrentSnapshot();
  return hasExternalChanges.value;
}

function resetDraft() {
  draft.value = props.customer.clone();
  baseline.value = currentSnapshot();
  sourceAtOpen.value = currentSnapshot();
  errorMessage.value = "";
  hasExternalChanges.value = false;
  pendingOwnSnapshot.value = null;
  failedOwnSnapshot.value = null;
  isWaitingForRollback.value = false;
}

function open() {
  if (!canWrite.value) return;
  resetDraft();
  dialog.value = true;
}

function reloadLatest() {
  if (isSaving.value || isWaitingForRollback.value) return;
  resetDraft();
}

function updateProperties(changes) {
  Object.assign(draft.value, changes);
}

async function save() {
  if (
    isSaving.value ||
    !canWrite.value ||
    checkConflict() ||
    isWaitingForRollback.value
  ) return;
  errorMessage.value = "";
  try {
    if (checkConflict() || isWaitingForRollback.value) return;
    pendingOwnSnapshot.value = customerSnapshot(draft.value, operation);
    failedOwnSnapshot.value = null;
    isWaitingForRollback.value = false;
    await updatePayment({
      latest: props.customer,
      baseline: baseline.value,
      draft: draft.value,
    });
    dialog.value = false;
  } catch (error) {
    failedOwnSnapshot.value = pendingOwnSnapshot.value;
    errorMessage.value = getCustomerOperationErrorMessage(
      error,
      "請求・回収条件を更新できませんでした。",
    );
  } finally {
    pendingOwnSnapshot.value = null;
    if (dialog.value) observeCurrentSnapshot();
  }
}

watch(currentSnapshot, () => {
  if (dialog.value) observeCurrentSnapshot();
}, { deep: true });
</script>

<template>
  <slot name="activator" :open="open" :item="props.customer" :disabled="!canWrite" />

  <AppEditorDialog
    v-model="dialog"
    :title="props.title"
    mode="UPDATE"
    :loading="isSaving"
    :disabled="!canWrite"
    :submit-disabled="isWaitingForRollback || hasExternalChanges"
    :max-width="800"
    @submit="save"
  >
          <v-alert
            v-if="hasExternalChanges"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <div>
              別の画面で請求・回収条件が更新されました。現在の入力内容は保存できません。
            </div>
            <v-btn
              class="mt-3"
              size="small"
              variant="outlined"
              :disabled="isSaving"
              @click="reloadLatest"
            >
              最新値を読み直す
            </v-btn>
          </v-alert>
          <v-alert
            v-if="isWaitingForRollback"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            保存前の状態を確認しています。少し待ってからもう一度保存してください。
          </v-alert>
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ errorMessage }}
          </v-alert>
          <air-item-input
            v-if="draft"
            :item="draft"
            :schema="schema"
            :update-properties="updateProperties"
            :disabled="isSaving"
            edit-mode="UPDATE"
          />
  </AppEditorDialog>
</template>
