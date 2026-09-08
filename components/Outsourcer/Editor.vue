<script setup>
import { Outsourcer } from "@/schemas";
import { useOutsourcerActions } from "@/composables/application/outsourcer/useOutsourcerActions";
import {
  OUTSOURCER_OPERATION,
  getOutsourcerOperationErrorMessage,
  hasOutsourcerOperationConflict,
  outsourcerOperationSchema,
  outsourcerSnapshot,
  outsourcerSnapshotsEqual,
} from "@/composables/domain/outsourcer/outsourcerOperations";

const props = defineProps({
  outsourcer: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Outsourcer,
  },
});
const emit = defineEmits(["updated"]);
const { canWrite, isSaving, updateOutsourcer } = useOutsourcerActions();
const operation = OUTSOURCER_OPERATION.UPDATE;
const schema = outsourcerOperationSchema(operation);
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
  return outsourcerSnapshot(props.outsourcer, operation);
}

function observeCurrentSnapshot() {
  const current = currentSnapshot();
  if (pendingOwnSnapshot.value) {
    if (
      outsourcerSnapshotsEqual(current, pendingOwnSnapshot.value, operation) ||
      outsourcerSnapshotsEqual(current, sourceAtOpen.value, operation)
    )
      return;
  }
  if (failedOwnSnapshot.value) {
    if (outsourcerSnapshotsEqual(current, failedOwnSnapshot.value, operation)) {
      isWaitingForRollback.value = true;
      return;
    }
    if (outsourcerSnapshotsEqual(current, sourceAtOpen.value, operation)) {
      failedOwnSnapshot.value = null;
      isWaitingForRollback.value = false;
      return;
    }
    failedOwnSnapshot.value = null;
    isWaitingForRollback.value = false;
  }
  hasExternalChanges.value = hasOutsourcerOperationConflict({
    baseline: baseline.value,
    latest: current,
    draft: draft.value,
  });
}

function resetDraft() {
  draft.value = props.outsourcer.clone();
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
  if (!isSaving.value && !isWaitingForRollback.value) resetDraft();
}

function updateProperties(changes) {
  Object.assign(draft.value, changes);
  if (dialog.value) observeCurrentSnapshot();
}

async function save() {
  if (isSaving.value || !canWrite.value || isWaitingForRollback.value) return;
  observeCurrentSnapshot();
  if (hasExternalChanges.value) return;
  errorMessage.value = "";
  try {
    observeCurrentSnapshot();
    if (hasExternalChanges.value) return;
    pendingOwnSnapshot.value = outsourcerSnapshot(draft.value, operation);
    failedOwnSnapshot.value = null;
    const result = await updateOutsourcer({
      latest: () => props.outsourcer,
      baseline: baseline.value,
      draft: draft.value,
    });
    dialog.value = false;
    emit("updated", result);
  } catch (error) {
    failedOwnSnapshot.value = pendingOwnSnapshot.value;
    errorMessage.value = getOutsourcerOperationErrorMessage(
      error,
      "外注先を更新できませんでした。",
    );
  } finally {
    pendingOwnSnapshot.value = null;
    if (dialog.value) observeCurrentSnapshot();
  }
}

watch(
  currentSnapshot,
  () => {
    if (dialog.value) observeCurrentSnapshot();
  },
  { deep: true },
);

defineExpose({ open });
</script>

<template>
  <AppEditorDialog
    v-model="dialog"
    title="外注先情報の編集"
    mode="UPDATE"
    :loading="isSaving"
    :disabled="!canWrite"
    :submit-disabled="isWaitingForRollback || hasExternalChanges"
    @submit="save"
  >
          <v-alert
            v-if="hasExternalChanges"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <div>
              別の画面で同じ項目が更新されました。現在の入力内容は保存できません。
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
