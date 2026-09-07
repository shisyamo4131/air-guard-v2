<script setup>
import { Outsourcer } from "@/schemas";
import { useOutsourcerActions } from "@/composables/application/outsourcer/useOutsourcerActions";
import {
  OUTSOURCER_OPERATION,
  getOutsourcerOperationErrorMessage,
  outsourcerOperationSchema,
} from "@/composables/domain/outsourcer/outsourcerOperations";

const emit = defineEmits(["created"]);
const { canWrite, createOutsourcer, isSaving } = useOutsourcerActions();
const dialog = ref(false);
const form = ref(null);
const draft = ref(null);
const errorMessage = ref("");
const schema = outsourcerOperationSchema(OUTSOURCER_OPERATION.CREATE);

function open() {
  if (!canWrite.value) return;
  draft.value = new Outsourcer();
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
    const created = await createOutsourcer(draft.value);
    dialog.value = false;
    emit("created", created);
  } catch (error) {
    errorMessage.value = getOutsourcerOperationErrorMessage(
      error,
      "外注先を登録できませんでした。",
    );
  }
}

defineExpose({ open });
</script>

<template>
  <v-dialog v-model="dialog" max-width="800" persistent scrollable>
    <v-form ref="form" :disabled="isSaving" @submit.prevent="save">
      <v-card>
        <v-toolbar color="secondary" density="compact" title="外注先の新規登録" />
        <v-card-text>
          <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
            {{ errorMessage }}
          </v-alert>
          <air-item-input
            v-if="draft"
            :item="draft"
            :schema="schema"
            :update-properties="updateProperties"
            :disabled="isSaving"
            edit-mode="CREATE"
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
            :disabled="isSaving || !canWrite"
          >
            登録
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
