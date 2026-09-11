<script setup>
import { onBeforeUnmount } from "vue";
import { Site } from "@/schemas";
import {
  SiteOperationError,
  cloneSiteValue,
} from "@/composables/domain/site/siteOperations";
import { siteAgreementsHaveZeroPrice } from "@/composables/domain/site/siteAgreementContract";

const props = defineProps({
  site: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
});

const draft = ref([]);
const draftRevision = ref(0);
const zeroPriceDialog = ref(false);
const isEditing = ref(false);
const managerDisabled = computed(
  () => props.site.status !== Site.STATUS_ACTIVE || zeroPriceDialog.value,
);
let resolveZeroPriceConfirmation = null;

function cloneAgreements(value) {
  return cloneSiteValue(Array.isArray(value) ? value : []);
}

function confirmZeroPrices(nextAgreements) {
  if (resolveZeroPriceConfirmation !== null) {
    throw new SiteOperationError(
      "operation-in-progress",
      "0円単価の保存確認中です。確認またはキャンセルしてから、もう一度お試しください。",
    );
  }
  if (!siteAgreementsHaveZeroPrice(nextAgreements)) return Promise.resolve(true);
  zeroPriceDialog.value = true;
  return new Promise((resolve) => {
    resolveZeroPriceConfirmation = resolve;
  });
}

function finishZeroPriceConfirmation(confirmed) {
  const resolve = resolveZeroPriceConfirmation;
  if (typeof resolve !== "function") return;
  resolveZeroPriceConfirmation = null;
  zeroPriceDialog.value = false;
  resolve(confirmed === true);
}

onBeforeUnmount(() => finishZeroPriceConfirmation(false));

function agreementKey(item) {
  return item?._beforeData?.key ?? item?.key;
}

function reloadLatest() {
  if (zeroPriceDialog.value) return;
  draft.value = cloneAgreements(props.site.agreementsV2);
  // A deliberate reload also discards the manager's retained failed item draft.
  draftRevision.value += 1;
}

watch(
  () => props.site.agreementsV2,
  () => {
    if (!isEditing.value) reloadLatest();
  },
  { deep: true, immediate: true },
);

async function persist(nextAgreements) {
  const candidate = new Site({
    ...cloneSiteValue(props.site),
    agreementsV2: cloneAgreements(nextAgreements),
  });
  const result = await candidate.update();
  draft.value = cloneAgreements(candidate.agreementsV2);
  return result;
}

async function createAgreement(item) {
  const next = [...draft.value, cloneSiteValue(item)];
  if (!await confirmZeroPrices(next)) {
    throw new SiteOperationError("save-cancelled", "0円単価の保存をキャンセルしました。");
  }
  await persist(next);
}

async function updateAgreement(item) {
  const key = agreementKey(item);
  const index = draft.value.findIndex((agreement) => agreementKey(agreement) === key);
  if (index < 0) throw new Error("更新する取極めを確認できません。");
  const next = cloneAgreements(draft.value);
  next[index] = cloneSiteValue(item);
  if (!await confirmZeroPrices(next)) {
    throw new SiteOperationError("save-cancelled", "0円単価の保存をキャンセルしました。");
  }
  await persist(next);
}

async function deleteAgreement(item) {
  const key = agreementKey(item);
  const index = draft.value.findIndex((agreement) => agreementKey(agreement) === key);
  if (index < 0) throw new Error("削除する取極めを確認できません。");
  const next = cloneAgreements(draft.value);
  next.splice(index, 1);
  if (!await confirmZeroPrices(next)) {
    throw new SiteOperationError("save-cancelled", "0円単価の保存をキャンセルしました。");
  }
  await persist(next);
}
</script>

<template>
  <v-alert type="info" variant="tonal" class="mb-4">
    変更は、今後新しく作成される実績、または別の明示的な再適用・訂正操作を行った既存実績にだけ反映されます。この画面で取極めを保存するだけでは、作成済み実績の取極めは変更されません。
  </v-alert>
  <AgreementsManager
    :key="draftRevision"
    v-model:is-editing="isEditing"
    :model-value="draft"
    :cutoff-date="props.site.customer?.cutoffDate"
    :handle-create="createAgreement"
    :handle-update="updateAgreement"
    :handle-delete="deleteAgreement"
    :disabled="managerDisabled"
    :disable-submit="managerDisabled"
    :disable-update="managerDisabled"
    :disable-delete="managerDisabled"
  />

  <v-dialog :model-value="zeroPriceDialog" max-width="560" persistent>
    <v-card>
      <v-card-title>0円の単価を保存しますか？</v-card-title>
      <v-card-text>
        16項目の単価のいずれかに0円が設定されています。0円は有効な単価です。内容を確認して保存してください。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="finishZeroPriceConfirmation(false)">キャンセル</v-btn>
        <v-btn color="warning" variant="flat" @click="finishZeroPriceConfirmation(true)">
          0円を含めて保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
