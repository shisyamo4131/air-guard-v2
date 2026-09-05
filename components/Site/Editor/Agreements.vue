<script setup>
import { Site } from "@/schemas";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import {
  SITE_OPERATION,
  SiteOperationError,
  cloneSiteValue,
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
});

const operation = SITE_OPERATION.UPDATE_AGREEMENTS;
const { canWrite, isSaving, updateAgreements } = useSiteActions();
const dialog = ref(false);
const draft = ref([]);
const baseline = ref(null);
const hasConflict = ref(false);
const draftRevision = ref(0);

function cloneAgreements(value) {
  return cloneSiteValue(Array.isArray(value) ? value : []);
}

function open() {
  if (!canWrite.value || isSaving.value) return;
  reloadLatest();
  dialog.value = true;
}

function close() {
  if (!isSaving.value) dialog.value = false;
}

function agreementKey(item) {
  return item?._beforeData?.key ?? item?.key;
}

function reloadLatest() {
  if (isSaving.value) return;
  draft.value = cloneAgreements(props.site.agreementsV2);
  baseline.value = siteSnapshot(props.site, operation);
  hasConflict.value = false;
  // A deliberate reload also discards the manager's retained failed item draft.
  draftRevision.value += 1;
}

function refreshConflict(nextAgreements) {
  hasConflict.value = !!baseline.value && conflictingSiteFields({
    operation,
    baseline: baseline.value,
    latest: props.site,
    draft: { agreementsV2: nextAgreements },
  }).length > 0;
  return hasConflict.value;
}

function safeAgreementError(error) {
  if (error?.code === "conflict") hasConflict.value = true;
  return new Error(getSiteOperationErrorMessage(
    error,
    "取極めを保存できませんでした。通信状態を確認して、もう一度お試しください。",
  ));
}

async function persist(nextAgreements) {
  if (refreshConflict(nextAgreements)) {
    throw safeAgreementError(new SiteOperationError(
      "conflict",
      "取極めが別の画面で更新されました。入力内容を確認して最新値を読み直してください。",
    ));
  }
  try {
    const result = await updateAgreements({
      latest: () => props.site,
      baseline: baseline.value,
      agreements: cloneAgreements(nextAgreements),
    });
    if (result.updated) {
      draft.value = cloneAgreements(result.candidate.agreementsV2);
      baseline.value = siteSnapshot(result.candidate, operation);
    }
    hasConflict.value = false;
    return result;
  } catch (error) {
    throw safeAgreementError(error);
  }
}

async function createAgreement(item) {
  await persist([...draft.value, cloneSiteValue(item)]);
}

async function updateAgreement(item) {
  const key = agreementKey(item);
  const index = draft.value.findIndex((agreement) => agreementKey(agreement) === key);
  if (index < 0) throw new Error("更新する取極めを確認できません。");
  const next = cloneAgreements(draft.value);
  next[index] = cloneSiteValue(item);
  await persist(next);
}

async function deleteAgreement(item) {
  const key = agreementKey(item);
  const index = draft.value.findIndex((agreement) => agreementKey(agreement) === key);
  if (index < 0) throw new Error("削除する取極めを確認できません。");
  const next = cloneAgreements(draft.value);
  next.splice(index, 1);
  await persist(next);
}
</script>

<template>
  <MoleculesFloatingTitleCard title="取極め" color="secondary">
    <v-card-text class="py-0">
      <AgreementsViewer :agreements="props.site.agreementsV2" />
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-pencil"
        variant="text"
        :disabled="!canWrite || isSaving"
        @click="open"
      >
        取極めを編集
      </v-btn>
    </v-card-actions>
  </MoleculesFloatingTitleCard>

  <v-dialog v-model="dialog" max-width="1000" persistent scrollable>
    <v-card>
      <v-toolbar color="secondary" density="compact" title="取極めの編集" />
      <v-card-text>
        <v-alert v-if="hasConflict" type="warning" variant="tonal" class="mb-4">
          <div>
            取極めが別の画面で更新されました。現在の入力は保持されています。
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
        <AgreementsManager
          :key="draftRevision"
          :model-value="draft"
          :cutoff-date="props.site.customer?.cutoffDate"
          :handle-create="createAgreement"
          :handle-update="updateAgreement"
          :handle-delete="deleteAgreement"
          :disabled="isSaving"
          :disable-submit="isSaving"
          :disable-update="isSaving"
          :disable-delete="isSaving"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" variant="text" @click="close">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
