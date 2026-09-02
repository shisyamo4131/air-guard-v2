<script setup>
import { Customer } from "@/schemas";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";
import {
  CUSTOMER_OPERATION,
  customerOperationSchema,
  getCustomerOperationErrorMessage,
} from "@/composables/domain/customer/customerOperations";

const props = defineProps({
  title: { type: String, default: "取引先の新規登録" },
});
const emit = defineEmits(["created"]);

const { canWrite, createCustomer, isSaving } = useCustomerActions();
const dialog = ref(false);
const form = ref(null);
const draft = ref(null);
const errorMessage = ref("");
const schema = customerOperationSchema(CUSTOMER_OPERATION.CREATE);

function open() {
  if (!canWrite.value) return;
  draft.value = new Customer();
  errorMessage.value = "";
  dialog.value = true;
}

function close() {
  if (isSaving.value) return;
  dialog.value = false;
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
    const created = await createCustomer(draft.value);
    dialog.value = false;
    emit("created", created);
  } catch (error) {
    errorMessage.value = getCustomerOperationErrorMessage(
      error,
      "取引先を登録できませんでした。",
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
            :schema="schema"
            :update-properties="updateProperties"
            :disabled="isSaving"
            edit-mode="CREATE"
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
            :disabled="isSaving || !canWrite"
          >
            登録
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
