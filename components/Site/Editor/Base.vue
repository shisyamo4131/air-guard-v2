<script setup>
import { Site } from "@/schemas";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import {
  SITE_OPERATION,
  conflictingSiteFields,
  getSiteOperationErrorMessage,
  siteOperationSchema,
  siteSnapshot,
} from "@/composables/domain/site/siteOperations";

const props = defineProps({
  site: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
  title: { type: String, default: "現場基本情報の編集" },
});
const { canWrite, isSaving, updateBasic } = useSiteActions();
const operation = SITE_OPERATION.UPDATE_BASIC;
const schema = siteOperationSchema(operation).filter(({ key }) => key !== "zipcode");
const dialog = ref(false);
const draft = ref(null);
const baseline = ref(null);
const errorMessage = ref("");
const conflictFields = ref([]);

function refreshConflict() {
  conflictFields.value = draft.value && baseline.value
    ? conflictingSiteFields({
        operation,
        baseline: baseline.value,
        latest: props.site,
        draft: draft.value,
      })
    : [];
  return conflictFields.value.length > 0;
}

function resetDraft() {
  draft.value = props.site.clone();
  baseline.value = siteSnapshot(props.site, operation);
  errorMessage.value = "";
  conflictFields.value = [];
}

function open() {
  if (!canWrite.value || props.site.status !== "ACTIVE") return;
  resetDraft();
  dialog.value = true;
}

function reloadLatest() {
  if (!isSaving.value) resetDraft();
}

function updateProperties(changes) {
  Object.assign(draft.value, changes);
  refreshConflict();
}

async function save() {
  if (isSaving.value || !canWrite.value || !draft.value || refreshConflict()) return;
  errorMessage.value = "";
  try {
    if (refreshConflict()) return;
    await updateBasic({
      latest: () => props.site,
      baseline: baseline.value,
      draft: draft.value,
    });
    dialog.value = false;
  } catch (error) {
    errorMessage.value = getSiteOperationErrorMessage(
      error,
      "現場の基本情報を更新できませんでした。",
    );
    refreshConflict();
  }
}

watch(() => props.site.toObject(), () => {
  if (dialog.value) refreshConflict();
}, { deep: true });
</script>

<template>
  <slot name="activator" :open="open" :item="props.site" :disabled="!canWrite || props.site.status !== 'ACTIVE'" />
  <AppEditorDialog
    v-model="dialog"
    :title="props.title"
    mode="UPDATE"
    :loading="isSaving"
    :disabled="!canWrite"
    :submit-disabled="!!conflictFields.length"
    :max-width="800"
    @submit="save"
  >
          <v-alert v-if="conflictFields.length" type="warning" variant="tonal" class="mb-4">
            <div>入力中の項目が別の画面で更新されました。最新値を読み直してください。</div>
            <v-btn class="mt-3" size="small" variant="outlined" :disabled="isSaving" @click="reloadLatest">
              最新値を読み直す
            </v-btn>
          </v-alert>
          <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
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
          <SitePostalCodeInput
            v-if="draft"
            v-model="draft.zipcode"
            :item="draft"
            :update-properties="updateProperties"
          />
  </AppEditorDialog>
</template>
