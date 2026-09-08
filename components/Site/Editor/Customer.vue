<script setup>
import { Site } from "@/schemas";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import {
  SITE_OPERATION,
  conflictingSiteFields,
  getSiteOperationErrorMessage,
  siteSnapshot,
} from "@/composables/domain/site/siteOperations";

const props = defineProps({
  site: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
  title: { type: String, default: "現場の取引先変更" },
});
const { canWrite, isSaving, updateCustomer } = useSiteActions();
const operation = SITE_OPERATION.UPDATE_CUSTOMER;
const dialog = ref(false);
const draft = ref(null);
const baseline = ref(null);
const errorMessage = ref("");
const hasConflict = ref(false);

function refreshConflict() {
  hasConflict.value = !!draft.value && !!baseline.value &&
    conflictingSiteFields({
      operation,
      baseline: baseline.value,
      latest: props.site,
      draft: draft.value,
    }).length > 0;
  return hasConflict.value;
}

function resetDraft() {
  draft.value = props.site.clone();
  baseline.value = siteSnapshot(props.site, operation);
  errorMessage.value = "";
  hasConflict.value = false;
}

function open() {
  if (!canWrite.value || props.site.status !== "ACTIVE") return;
  resetDraft();
  dialog.value = true;
}

async function save() {
  if (isSaving.value || !canWrite.value || !draft.value || refreshConflict()) return;
  errorMessage.value = "";
  try {
    await updateCustomer({
      latest: () => props.site,
      baseline: baseline.value,
      draft: draft.value,
    });
    dialog.value = false;
  } catch (error) {
    errorMessage.value = getSiteOperationErrorMessage(
      error,
      "現場の取引先を更新できませんでした。",
    );
    refreshConflict();
  }
}

watch(() => props.site.customerId, () => {
  if (dialog.value) refreshConflict();
});
</script>

<template>
  <slot name="activator" :open="open" :item="props.site" :disabled="!canWrite || props.site.status !== 'ACTIVE'" />
  <AppEditorDialog
    v-model="dialog"
    :title="props.title"
    mode="UPDATE"
    :loading="isSaving"
    :disabled="!canWrite"
    :submit-disabled="hasConflict"
    :max-width="600"
    @submit="save"
  >
        <v-alert v-if="hasConflict" type="warning" variant="tonal" class="mb-4">
          <div>取引先が別の画面で更新されました。最新値を読み直してください。</div>
          <v-btn class="mt-3" size="small" variant="outlined" :disabled="isSaving" @click="resetDraft">
            最新値を読み直す
          </v-btn>
        </v-alert>
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
          {{ errorMessage }}
        </v-alert>
        <CustomerAutocomplete
          v-if="draft"
          v-model="draft.customerId"
          :clearable="!props.site.customerId"
          :disabled="isSaving"
          @update:model-value="refreshConflict"
        />
        <v-alert v-if="props.site.customerId" type="info" variant="tonal" density="compact">
          設定済みの取引先を未設定へ戻すことはできません。
        </v-alert>
  </AppEditorDialog>
</template>
