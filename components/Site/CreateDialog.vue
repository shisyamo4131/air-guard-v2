<script setup>
import { Site } from "@/schemas";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import {
  SITE_OPERATION,
  getSiteOperationErrorMessage,
  siteOperationSchema,
} from "@/composables/domain/site/siteOperations";

const props = defineProps({
  title: { type: String, default: "現場の新規登録" },
});
const emit = defineEmits(["created"]);
const { canWrite, createSite, isSaving } = useSiteActions();
const dialog = ref(false);
const form = ref(null);
const draft = ref(null);
const errorMessage = ref("");
const schema = siteOperationSchema(SITE_OPERATION.CREATE).filter(
  ({ key }) => !["customerId", "customerName"].includes(key),
);

function open() {
  if (!canWrite.value) return;
  draft.value = new Site();
  errorMessage.value = "";
  dialog.value = true;
}

function close() {
  if (!isSaving.value) dialog.value = false;
}

function updateProperties(changes) {
  Object.assign(draft.value, changes);
}

async function save() {
  if (isSaving.value || !canWrite.value || !draft.value) return;
  errorMessage.value = "";
  try {
    const validation = await form.value?.validate();
    if (validation && !validation.valid) return;
    const created = await createSite(draft.value);
    dialog.value = false;
    emit("created", created);
  } catch (error) {
    errorMessage.value = getSiteOperationErrorMessage(
      error,
      "現場を登録できませんでした。",
    );
  }
}
</script>

<template>
  <slot v-if="canWrite" name="activator" :open="open" />
  <v-dialog v-model="dialog" max-width="800" persistent scrollable>
    <v-form ref="form" :disabled="isSaving" @submit.prevent="save">
      <v-card>
        <v-toolbar color="secondary" density="compact" :title="props.title" />
        <v-card-text>
          <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
            {{ errorMessage }}
          </v-alert>
          <template v-if="draft">
            <air-text-field
              v-model="draft.customerName"
              label="取引先名"
              :required="!draft.customerId"
              :counter="20"
              maxlength="20"
              clearable
            />
            <CustomerAutocomplete v-model="draft.customerId" clearable />
            <air-item-input
              :item="draft"
              :schema="schema"
              :update-properties="updateProperties"
              :disabled="isSaving"
              edit-mode="CREATE"
            />
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isSaving" variant="text" @click="close">キャンセル</v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :loading="isSaving"
            :disabled="isSaving || !canWrite"
          >
            登録
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
