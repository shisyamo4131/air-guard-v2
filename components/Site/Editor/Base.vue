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
const schema = siteOperationSchema(operation);
const dialog = ref(false);
const form = ref(null);
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
  if (!canWrite.value) return;
  resetDraft();
  dialog.value = true;
}

function close() {
  if (!isSaving.value) dialog.value = false;
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
    const validation = await form.value?.validate();
    if (validation && !validation.valid) return;
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
  <slot name="activator" :open="open" :item="props.site" :disabled="!canWrite" />
  <v-dialog v-model="dialog" max-width="800" persistent scrollable>
    <v-form ref="form" :disabled="isSaving" @submit.prevent="save">
      <v-card>
        <v-toolbar color="secondary" density="compact" :title="props.title" />
        <v-card-text>
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
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isSaving" variant="text" @click="close">キャンセル</v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :loading="isSaving"
            :disabled="isSaving || !!conflictFields.length || !canWrite"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
