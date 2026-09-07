<script setup>
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useSiteArchiveAction } from "@/composables/application/site/useSiteArchiveAction";
import { toSiteArchiveUiError } from "@/composables/domain/site/siteArchiveUiContract";

const props = defineProps({ site: { type: Object, required: true } });
const emit = defineEmits(["archived"]);
const messages = useMessagesStore();
const { archive, canArchive, isPending, resetAttempt } = useSiteArchiveAction();
const dialog = ref(false);
const form = ref(null);
const reason = ref("");
const failureMessage = ref("");
const target = ref(null);
const submitting = ref(false);
const pending = computed(() => target.value?.docId ? isPending(target.value.docId) : false);
const busy = computed(() => submitting.value || pending.value);
const reasonRules = [
  (value) => (typeof value === "string" && value.trim().length > 0) || "理由は必須です。",
  (value) => value?.trim().length <= 200 || "理由は200文字以内です。",
];

watch(reason, (value, previous) => {
  if (value === previous || busy.value) return;
  resetAttempt(); failureMessage.value = "";
});
watch(() => props.site?.docId, (value, previous) => {
  if (value === previous || busy.value) return;
  resetAttempt(); failureMessage.value = "";
});

function resetDialog() {
  resetAttempt(); reason.value = ""; failureMessage.value = ""; target.value = null;
  form.value?.resetValidation?.();
}
function openDialog() {
  if (!canArchive.value || !props.site?.docId) return;
  resetDialog();
  target.value = Object.freeze({
    docId: props.site.docId, code: props.site.code || "-",
    name: props.site.displayName || props.site.name || "-",
  });
  dialog.value = true;
}
function closeDialog() {
  if (busy.value) return;
  dialog.value = false; resetDialog();
}
function handleDialogModel(value) { if (!value) closeDialog(); }
async function handleArchive() {
  if (!target.value || busy.value || !canArchive.value) return;
  submitting.value = true;
  try {
    failureMessage.value = "";
    const validation = await form.value?.validate();
    if (!validation?.valid) return;
    await archive({
      site: target.value, reason: reason.value,
      getCurrentSite: () => props.site, getCurrentReason: () => reason.value,
    });
    dialog.value = false;
    messages.add("現場をアーカイブしました。");
    emit("archived"); resetDialog();
  } catch (error) {
    failureMessage.value = toSiteArchiveUiError(error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div v-if="canArchive">
    <v-btn color="error" prepend-icon="mdi-archive-arrow-down-outline"
      text="アーカイブ" variant="outlined" @click="openDialog" />
    <v-dialog :model-value="dialog" max-width="600" :persistent="busy"
      @update:model-value="handleDialogModel">
      <v-card>
        <v-toolbar color="error" density="compact" title="現場のアーカイブ">
          <template #append>
            <v-btn aria-label="閉じる" :disabled="busy" icon="mdi-close" @click="closeDialog" />
          </template>
        </v-toolbar>
        <v-card-text>
          <p>現場コード: <strong>{{ target?.code }}</strong><br>
            現場名: <strong>{{ target?.name }}</strong></p>
          <v-alert class="my-4" density="compact" type="warning">
            この操作は誤登録・重複した現場専用です。予定・実績・配置通知・請求・入場履歴から参照されている場合は実行できません。アーカイブ後は通常画面から復元できません。
          </v-alert>
          <v-form ref="form" @submit.prevent="handleArchive">
            <v-textarea v-model="reason" auto-grow counter="200" :disabled="busy"
              label="アーカイブ理由" maxlength="200" :rules="reasonRules" rows="3" />
          </v-form>
          <p class="text-caption">理由には個人情報・認証情報などの不要な情報を入力しないでください。</p>
          <v-alert v-if="failureMessage" class="mt-4" density="compact" type="error">
            {{ failureMessage }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="busy" text="キャンセル" @click="closeDialog" />
          <v-btn color="error" :disabled="busy" :loading="busy"
            text="アーカイブする" @click="handleArchive" />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
