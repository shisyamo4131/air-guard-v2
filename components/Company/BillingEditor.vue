<script setup>
import { Company } from "@/schemas";
import { useCompanyBillingUpdate } from "@/composables/application/company/useCompanyBillingUpdate";

const props = defineProps({
  company: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Company,
  },
  title: { type: String, default: "振込先の編集" },
});

const { updateCompanyBilling } = useCompanyBillingUpdate();
const dialog = ref(false);
const form = ref(null);
const draft = ref(null);
const baseline = ref(null);
const sourceAtOpen = ref(null);
const isSaving = ref(false);
const errorMessage = ref("");
const hasExternalChanges = ref(false);
const clearIntent = ref(false);
const pendingOwnSnapshot = ref(null);

function billingSnapshot(source) {
  return Company.getBillingValue(source);
}

function snapshotsEqual(left, right) {
  return Company.billingFields.every((field) =>
    Object.is(left?.[field] ?? null, right?.[field] ?? null),
  );
}

function hasBillingConflict() {
  if (!snapshotsEqual(billingSnapshot(props.company), sourceAtOpen.value)) {
    hasExternalChanges.value = true;
  }
  return hasExternalChanges.value;
}

function observeBillingSnapshot(current) {
  if (!dialog.value) return;
  if (
    pendingOwnSnapshot.value &&
    snapshotsEqual(current, pendingOwnSnapshot.value)
  ) {
    sourceAtOpen.value = current;
    return;
  }
  if (!snapshotsEqual(current, sourceAtOpen.value)) {
    hasExternalChanges.value = true;
  }
}

function resetDraft() {
  const value = Company.getBillingDraftValue(props.company);
  draft.value = props.company.clone();
  Object.assign(draft.value, value);
  baseline.value = value;
  sourceAtOpen.value = billingSnapshot(props.company);
  hasExternalChanges.value = false;
  clearIntent.value = false;
  pendingOwnSnapshot.value = null;
  errorMessage.value = "";
}

function open() {
  resetDraft();
  dialog.value = true;
}

function close() {
  if (isSaving.value) return;
  dialog.value = false;
}

function reloadLatest() {
  if (isSaving.value) return;
  resetDraft();
}

function updateProperties(changes) {
  Object.assign(draft.value, changes);
  clearIntent.value = false;
}

function clearBilling() {
  Object.assign(
    draft.value,
    Object.fromEntries(Company.billingFields.map((field) => [field, null])),
  );
  clearIntent.value = true;
  errorMessage.value = "";
}

async function save() {
  if (isSaving.value || hasBillingConflict()) return;

  isSaving.value = true;
  errorMessage.value = "";
  let saveSucceeded = false;
  try {
    const validation = await form.value?.validate();
    if (validation && !validation.valid) return;
    if (hasBillingConflict()) return;

    let expectedSnapshot;
    try {
      expectedSnapshot = Company.normalizeBilling({
        invoiceNumber: props.company.invoiceNumber ?? null,
        ...Company.getBillingValue(draft.value),
      });
    } catch {
      errorMessage.value =
        "振込先は5項目すべてを入力するか、すべて削除してください。";
      return;
    }

    if (hasBillingConflict()) return;
    pendingOwnSnapshot.value = expectedSnapshot;
    await updateCompanyBilling({
      latest: props.company,
      baseline: baseline.value,
      draft: draft.value,
      clearIntent: clearIntent.value,
    });
    saveSucceeded = true;
    dialog.value = false;
  } catch (error) {
    errorMessage.value =
      error?.message || "振込先を更新できませんでした。";
  } finally {
    pendingOwnSnapshot.value = null;
    isSaving.value = false;
    if (!saveSucceeded && dialog.value) hasBillingConflict();
  }
}

watch(
  () => billingSnapshot(props.company),
  (current) => observeBillingSnapshot(current),
  { deep: true },
);
</script>

<template>
  <slot name="activator" :open="open" :item="props.company" />

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
              別の画面で振込先が更新されました。現在の入力内容は保存できません。
              最新情報を読み直して、必要な内容を再入力してください。
            </div>
            <div class="mt-3">
              <v-btn
                size="small"
                variant="outlined"
                :disabled="isSaving"
                @click="reloadLatest"
              >
                最新値を読み直す
              </v-btn>
            </div>
          </v-alert>

          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ errorMessage }}
          </v-alert>

          <v-alert type="info" variant="tonal" class="mb-4">
            振込先を登録する場合は、5項目すべてを入力してください。
          </v-alert>

          <air-item-input
            v-if="draft"
            :item="draft"
            :schema="Company.billingSchema"
            :update-properties="updateProperties"
            :disabled="isSaving"
            edit-mode="UPDATE"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="error"
            variant="text"
            :disabled="isSaving || hasExternalChanges"
            @click="clearBilling"
          >
            振込先をすべて削除
          </v-btn>
          <v-spacer />
          <v-btn :disabled="isSaving" variant="text" @click="close">
            キャンセル
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :loading="isSaving"
            :disabled="isSaving || hasExternalChanges"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
