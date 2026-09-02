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
  title: { type: String, default: "取引先基本情報の編集" },
});

const { canWrite, isSaving, updateBasic } = useCustomerActions();
const operation = CUSTOMER_OPERATION.UPDATE_BASIC;
const schema = customerOperationSchema(operation);
const dialog = ref(false);
const form = ref(null);
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

function close() {
  if (isSaving.value) return;
  dialog.value = false;
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
    const validation = await form.value?.validate();
    if (validation && !validation.valid) return;
    if (checkConflict() || isWaitingForRollback.value) return;
    pendingOwnSnapshot.value = customerSnapshot(draft.value, operation);
    failedOwnSnapshot.value = null;
    isWaitingForRollback.value = false;
    await updateBasic({
      latest: props.customer,
      baseline: baseline.value,
      draft: draft.value,
    });
    dialog.value = false;
  } catch (error) {
    failedOwnSnapshot.value = pendingOwnSnapshot.value;
    errorMessage.value = getCustomerOperationErrorMessage(
      error,
      "取引先の基本情報を更新できませんでした。",
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

  <v-dialog v-model="dialog" max-width="800" persistent scrollable>
    <v-form ref="form" :disabled="isSaving" @submit.prevent="save">
      <v-card>
        <v-toolbar color="secondary" density="compact" :title="props.title" />
        <v-card-text>
          <v-alert
            v-if="hasExternalChanges"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <div>
              別の画面で基本情報が更新されました。現在の入力内容は保存できません。
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
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isSaving" variant="text" @click="close">
            キャンセル
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :loading="isSaving"
            :disabled="isSaving || isWaitingForRollback || hasExternalChanges || !canWrite"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
