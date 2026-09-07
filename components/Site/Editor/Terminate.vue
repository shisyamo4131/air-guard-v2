<script setup>
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import { getSiteOperationErrorMessage } from "@/composables/domain/site/siteOperations";

const props = defineProps({ site: { type: Object, required: true } });
const emit = defineEmits(["completed"]);
const { canWrite, isSaving, terminate } = useSiteActions();
const dialog = ref(false);
const reason = ref("");
const errorMessage = ref("");

function open() {
  if (!canWrite.value || props.site.status !== "ACTIVE") return;
  reason.value = "";
  errorMessage.value = "";
  dialog.value = true;
}

async function save() {
  const normalized = reason.value.trim();
  if (!normalized || normalized.length > 200 || isSaving.value) return;
  try {
    const result = await terminate({ siteId: props.site.docId, reason: normalized });
    dialog.value = false;
    emit("completed", result);
  } catch (error) {
    errorMessage.value = getSiteOperationErrorMessage(error, "現場を終了できませんでした。予定を確認してください。");
  }
}
</script>

<template>
  <slot name="activator" :open="open" :disabled="!canWrite || props.site.status !== 'ACTIVE'" />
  <v-dialog v-model="dialog" max-width="560" persistent>
    <v-card>
      <v-toolbar color="warning" density="compact" title="現場を終了" />
      <v-card-text>
        <v-alert type="warning" variant="tonal" class="mb-4">
          JST当日以降の予定または未処理予定がある現場は終了できません。
        </v-alert>
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>
        <v-textarea v-model="reason" label="終了理由" maxlength="200" counter :disabled="isSaving" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="dialog = false">キャンセル</v-btn>
        <v-btn color="warning" :loading="isSaving" :disabled="!reason.trim() || reason.trim().length > 200" @click="save">終了する</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
