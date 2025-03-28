<script setup>
/**
 * 非同期処理中の状態をユーザーに伝えるローディング用ダイアログ。
 * - `modelValue` で表示の制御を行います。
 * - `message` には進捗メッセージを表示します。
 * - `icon` に表示用アイコン名（Vuetify icon）を指定できます。
 *
 * A loading dialog component for indicating async operations in progress.
 * - Controlled via `modelValue` (v-model).
 * - `message` displays a custom message below the spinner.
 * - `icon` defines the Vuetify icon shown on the left side.
 */

import { watch, ref } from "vue";

// Props
const props = defineProps({
  modelValue: { type: Boolean, required: true },
  message: { type: String, default: "処理中です..." },
  icon: { type: String, default: "$vuetify-outline" },
});

// Emits
const emit = defineEmits(["update:modelValue"]);

// Local binding for dialog
const dialog = ref(props.modelValue);

// Sync prop changes to local dialog
watch(
  () => props.modelValue,
  (val) => {
    dialog.value = val;
  }
);

// Emit update when dialog is toggled
watch(dialog, (val) => {
  if (val !== props.modelValue) {
    emit("update:modelValue", val);
  }
});
</script>

<template>
  <v-dialog v-model="dialog" max-width="320" persistent>
    <v-list class="py-2" color="primary" elevation="12" rounded="lg">
      <v-list-item>
        <!-- Icon (left) -->
        <template #prepend>
          <div class="pe-4">
            <v-icon :icon="icon" color="primary" size="x-large" />
          </div>
        </template>

        <!-- Message (center) -->
        <div class="text-body-1 font-weight-medium text-wrap me-2">
          {{ message }}
        </div>

        <!-- Spinner (right) -->
        <template #append>
          <v-progress-circular
            color="primary"
            indeterminate
            size="16"
            width="2"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-dialog>
</template>
