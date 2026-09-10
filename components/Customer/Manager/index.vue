<script setup>
/*****************************************************************************
 * @file components/Customer/Manager/index.vue
 * @description AirItemManagerを使った取引先通常更新コンポーネント
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";
import { CustomerOperationError } from "@/composables/domain/customer/customerOperations";

const props = defineProps({
  doc: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Customer,
  },
  includedKeys: { type: Array, required: true },
  title: { type: String, required: true },
});

const { attrs } = useBaseManager("CustomerManager");
const { canWrite, isSaving, updateCustomer } = useCustomerActions();
const isEditing = ref(false);
const stableSnapshot = shallowRef(new Customer(props.doc.toObject()));
const editorForm = ref(null);

const updateDisabled = computed(
  () => !canWrite.value || isSaving.value || !props.doc.docId,
);

function syncFromListener() {
  stableSnapshot.value = new Customer(props.doc.toObject());
}

function rejectUnsupportedOperation() {
  throw new CustomerOperationError(
    "invalid-operation",
    "この画面では取引先の作成・削除を実行できません。",
  );
}

function beforeEdit(editMode) {
  if (editMode !== "UPDATE") return rejectUnsupportedOperation();
  if (updateDisabled.value) {
    throw new CustomerOperationError(
      "permission-denied",
      "取引先を変更する権限を確認できません。",
    );
  }
  return true;
}

function openUpdate(toUpdate) {
  if (updateDisabled.value) return;
  syncFromListener();
  return toUpdate(stableSnapshot.value);
}

function handleEditing(value) {
  isEditing.value = value;
  if (!value) syncFromListener();
}

function ignoreManagerModelValue() {
  // Firestore listenerだけを表示用modelの正本にする。
  return undefined;
}

function editorErrorMessage(errors) {
  const error = errors?.[0];
  return error instanceof CustomerOperationError
    ? error.message
    : "取引先情報を更新できませんでした。";
}

async function submitEditor(editorAttrs) {
  if (
    editorAttrs.isLoading ||
    editorAttrs.disabled ||
    editorAttrs.disableSubmit
  ) return;
  const validation = await editorForm.value?.validate();
  if (validation && validation.valid !== true) return;
  await editorAttrs["onClick:submit"]();
}

async function handleUpdate(draft) {
  return await updateCustomer({
    latest: () => props.doc,
    draft,
  });
}

watch(
  () => props.doc,
  () => {
    if (!isEditing.value) syncFromListener();
  },
  { deep: true },
);
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="stableSnapshot"
    :included-keys="props.includedKeys"
    :label="props.title"
    :dialog-props="{
      maxWidth: 800,
      persistent: true,
      scrollable: true,
      'aria-label': props.title,
    }"
    :before-edit="beforeEdit"
    :disable-update="updateDisabled"
    :disable-delete="true"
    :hide-delete-btn="true"
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    :is-editing="isEditing"
    @update:is-editing="handleEditing"
    @update:model-value="ignoreManagerModelValue"
  >
    <template #activator="slotProps">
      <slot
        name="activator"
        :item="props.doc"
        :disabled="updateDisabled"
        :open="() => openUpdate(slotProps.toUpdate)"
      />
    </template>

    <template #editor="editorAttrs">
      <v-form
        ref="editorForm"
        :disabled="editorAttrs.disabled"
        @submit.prevent="submitEditor(editorAttrs)"
      >
        <v-card :border="false">
          <v-toolbar
            color="secondary"
            density="compact"
            :title="props.title"
          />
          <v-card-text>
            <v-alert
              v-if="editorAttrs.errors.length"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ editorErrorMessage(editorAttrs.errors) }}
            </v-alert>
            <air-item-input v-bind="editorAttrs.inputProps" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <AtomsBtnsCancel
              type="button"
              :disabled="editorAttrs.isLoading"
              @click="editorAttrs['onClick:cancel']"
            />
            <AtomsBtnsSubmit
              type="submit"
              text="更新"
              :loading="editorAttrs.isLoading"
              :disabled="editorAttrs.disabled || editorAttrs.disableSubmit"
            />
          </v-card-actions>
        </v-card>
      </v-form>
    </template>
  </air-item-manager>
</template>
