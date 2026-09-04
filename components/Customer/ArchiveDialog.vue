<script setup>
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useCustomerArchiveAction } from "@/composables/application/customer/useCustomerArchiveAction";
import { toCustomerArchiveUiError } from "@/composables/domain/customer/customerArchiveUiContract";

const props = defineProps({
  customer: { type: Object, required: true },
});
const emit = defineEmits(["archived"]);

const messages = useMessagesStore();
const { archive, canArchive, isPending, resetAttempt } =
  useCustomerArchiveAction();

const dialog = ref(false);
const form = ref(null);
const reason = ref("");
const failureMessage = ref("");
const target = ref(null);
const archiveSubmitting = ref(false);

const archivePending = computed(() =>
  target.value?.docId ? isPending(target.value.docId) : false,
);
const archiveBusy = computed(
  () => archiveSubmitting.value || archivePending.value,
);
const reasonRules = [
  (value) =>
    (typeof value === "string" && value.trim().length > 0) ||
    "理由は必須です。",
  (value) => value?.trim().length <= 200 || "理由は200文字以内です。",
];

watch(reason, (value, previous) => {
  if (value === previous || archiveBusy.value) return;
  resetAttempt();
  failureMessage.value = "";
});

watch(
  () => props.customer?.docId,
  (value, previous) => {
    if (value === previous || archiveBusy.value) return;
    resetAttempt();
    failureMessage.value = "";
  },
);

function resetDialog() {
  resetAttempt();
  reason.value = "";
  failureMessage.value = "";
  target.value = null;
  form.value?.resetValidation?.();
}

function openDialog() {
  if (!canArchive.value || !props.customer?.docId) return;
  resetDialog();
  target.value = Object.freeze({
    docId: props.customer.docId,
    code: props.customer.code || "-",
    name: props.customer.name || "-",
  });
  dialog.value = true;
}

function closeDialog() {
  if (archiveBusy.value) return;
  dialog.value = false;
  resetDialog();
}

function handleDialogModel(value) {
  if (value) return;
  closeDialog();
}

async function handleArchive() {
  if (!target.value || archiveBusy.value || !canArchive.value) return;
  archiveSubmitting.value = true;

  try {
    failureMessage.value = "";
    const validation = await form.value?.validate();
    if (!validation?.valid) return;
    await archive({
      customer: target.value,
      reason: reason.value,
      getCurrentCustomer: () => props.customer,
      getCurrentReason: () => reason.value,
    });
    dialog.value = false;
    messages.add("取引先をアーカイブしました。");
    emit("archived");
    resetDialog();
  } catch (error) {
    failureMessage.value = toCustomerArchiveUiError(error).message;
  } finally {
    archiveSubmitting.value = false;
  }
}
</script>

<template>
  <div v-if="canArchive">
    <v-btn
      color="error"
      prepend-icon="mdi-archive-arrow-down-outline"
      text="アーカイブ"
      variant="outlined"
      @click="openDialog"
    />

    <v-dialog
      :model-value="dialog"
      max-width="600"
      :persistent="archiveBusy"
      @update:model-value="handleDialogModel"
    >
      <v-card>
        <v-toolbar color="error" density="compact" title="取引先のアーカイブ">
          <template #append>
            <v-btn
              aria-label="閉じる"
              :disabled="archiveBusy"
              icon="mdi-close"
              @click="closeDialog"
            />
          </template>
        </v-toolbar>
        <v-card-text>
          <p>
            取引先コード: <strong>{{ target?.code }}</strong><br>
            取引先名: <strong>{{ target?.name }}</strong>
          </p>
          <v-alert class="my-4" density="compact" type="warning">
            この操作は誤登録・重複した取引先専用です。現場・稼働実績・請求から参照されている場合は実行できません。アーカイブ後は通常画面から復元できません。
          </v-alert>
          <v-form ref="form" @submit.prevent="handleArchive">
            <v-textarea
              v-model="reason"
              auto-grow
              counter="200"
              :disabled="archiveBusy"
              label="アーカイブ理由"
              maxlength="200"
              :rules="reasonRules"
              rows="3"
            />
          </v-form>
          <p class="text-caption">
            理由には個人情報・認証情報などの不要な情報を入力しないでください。
          </p>
          <v-alert
            v-if="failureMessage"
            class="mt-4"
            density="compact"
            type="error"
          >
            {{ failureMessage }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="archiveBusy"
            text="キャンセル"
            @click="closeDialog"
          />
          <v-btn
            color="error"
            :disabled="archiveBusy"
            :loading="archiveBusy"
            text="アーカイブする"
            @click="handleArchive"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
