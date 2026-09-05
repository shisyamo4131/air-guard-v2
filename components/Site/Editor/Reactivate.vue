<script setup>
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import { getSiteOperationErrorMessage } from "@/composables/domain/site/siteOperations";

const props = defineProps({ site: { type: Object, required: true } });
const emit = defineEmits(["completed"]);
const { canWrite, isSaving, reactivate } = useSiteActions();
const dialog = ref(false);
const reason = ref("");
const startDate = ref("");
const endDate = ref("");
const errorMessage = ref("");

function open() {
  if (!canWrite.value || props.site.status !== "TERMINATED") return;
  reason.value = "";
  startDate.value = "";
  endDate.value = "";
  errorMessage.value = "";
  dialog.value = true;
}

async function save() {
  const normalized = reason.value.trim();
  if (!normalized || normalized.length > 200 || !startDate.value || !endDate.value || startDate.value > endDate.value || isSaving.value) return;
  try {
    const result = await reactivate({
      siteId: props.site.docId,
      reason: normalized,
      constructionPeriodStartDate: startDate.value,
      constructionPeriodEndDate: endDate.value,
    });
    dialog.value = false;
    emit("completed", result);
  } catch (error) {
    errorMessage.value = getSiteOperationErrorMessage(error, "現場を再有効化できませんでした。");
  }
}
</script>

<template>
  <slot name="activator" :open="open" :disabled="!canWrite || props.site.status !== 'TERMINATED'" />
  <v-dialog v-model="dialog" max-width="620" persistent>
    <v-card>
      <v-toolbar color="primary" density="compact" title="現場を再有効化" />
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">取引先は変更せず、新しい工期と再開理由を保存します。</v-alert>
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>
        <v-row>
          <v-col cols="12" md="6"><v-text-field v-model="startDate" type="date" label="工期開始日" :disabled="isSaving" /></v-col>
          <v-col cols="12" md="6"><v-text-field v-model="endDate" type="date" label="工期終了日" :disabled="isSaving" /></v-col>
          <v-col cols="12"><v-textarea v-model="reason" label="再開理由" maxlength="200" counter :disabled="isSaving" /></v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="dialog = false">キャンセル</v-btn>
        <v-btn color="primary" :loading="isSaving" :disabled="!reason.trim() || !startDate || !endDate || startDate > endDate" @click="save">再有効化する</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
