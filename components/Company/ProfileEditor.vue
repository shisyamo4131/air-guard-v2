<script setup>
import { Company } from "@/schemas";
import { useCompanyProfileUpdate } from "@/composables/application/company/useCompanyProfileUpdate";

const props = defineProps({
  company: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Company,
  },
  title: { type: String, default: "会社基本情報の編集" },
});

const { updateCompanyProfile } = useCompanyProfileUpdate();
const dialog = ref(false);
const form = ref(null);
const draft = ref(null);
const baseline = ref(null);
const sourceAtOpen = ref(null);
const isSaving = ref(false);
const errorMessage = ref("");
const hasExternalChanges = ref(false);
const pendingOwnSnapshot = ref(null);

function profileSnapshot(source) {
  return Company.getProfileValue(source);
}

function snapshotsEqual(left, right) {
  return Company.profileFields.every((field) =>
    Object.is(left?.[field] ?? null, right?.[field] ?? null),
  );
}

function hasProfileConflict() {
  if (!snapshotsEqual(profileSnapshot(props.company), sourceAtOpen.value)) {
    hasExternalChanges.value = true;
  }
  return hasExternalChanges.value;
}

function observeProfileSnapshot(current) {
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
  draft.value = props.company.clone();
  baseline.value = props.company.clone();
  sourceAtOpen.value = profileSnapshot(props.company);
  hasExternalChanges.value = false;
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
}

async function save() {
  if (isSaving.value || hasProfileConflict()) return;

  isSaving.value = true;
  errorMessage.value = "";
  let saveSucceeded = false;
  try {
    const validation = await form.value?.validate();
    if (validation && !validation.valid) return;
    if (hasProfileConflict()) return;

    const expectedSnapshot = Company.normalizeProfile(
      profileSnapshot(draft.value),
    );
    if (hasProfileConflict()) return;
    pendingOwnSnapshot.value = expectedSnapshot;

    await updateCompanyProfile({
      latest: props.company,
      baseline: baseline.value,
      draft: draft.value,
    });
    saveSucceeded = true;
    dialog.value = false;
  } catch (error) {
    errorMessage.value = error?.message || "会社基本情報を更新できませんでした。";
  } finally {
    pendingOwnSnapshot.value = null;
    isSaving.value = false;
    if (!saveSucceeded && dialog.value) hasProfileConflict();
  }
}

watch(
  () => profileSnapshot(props.company),
  (current) => observeProfileSnapshot(current),
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
              別の画面で会社情報が更新されました。現在の入力内容は保存できません。
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

          <air-item-input
            v-if="draft"
            :item="draft"
            :schema="Company.profileSchema"
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
            :disabled="isSaving || hasExternalChanges"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
