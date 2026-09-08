<script setup>
/*****************************************************************************
 * @file components/App/EditorDialog.vue
 * @description エディターダイアログコンポーネント
 * @property {Boolean} modelValue - ダイアログの表示状態
 * @property {String} title - ダイアログのタイトル
 * @property {String} mode - 操作モード（'CREATE' または 'UPDATE'）
 * @property {Boolean} loading - ローディング状態
 * @property {Boolean} disabled - 無効化状態
 * @property {Boolean} submitDisabled - 入力は維持したまま提出だけを無効化する状態
 * @property {String|Number} maxWidth - ダイアログの最大幅
 * @emit update:modelValue - ダイアログの表示状態の更新イベント
 * @emit cancel - キャンセルイベント
 * @emit submit - 提出イベント
 * @emit validation-error - 検証エラーイベント
 *****************************************************************************/
import { computed, nextTick, ref, watch } from "vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "AppEditorDialog", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, required: true },
  mode: {
    type: String,
    required: true,
    validator: (value) => ["CREATE", "UPDATE"].includes(value),
  },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  maxWidth: { type: [String, Number], default: 480 },
});

const emit = defineEmits([
  "update:modelValue",
  "cancel",
  "submit",
  "validation-error",
]);

/*****************************************************************************
 * DEFINE STATE & COMPUTED PROPERTIES
 *****************************************************************************/
const submitLocked = ref(false);
let submitGeneration = 0;
const validMode = computed(() => ["CREATE", "UPDATE"].includes(props.mode));
const unavailable = computed(
  () =>
    props.loading ||
    props.disabled ||
    props.submitDisabled ||
    submitLocked.value ||
    !validMode.value,
);
const submitLabel = computed(() => {
  if (!validMode.value) return "";
  return props.mode === "CREATE" ? "登録" : "更新";
});

function invalidatePendingSubmit() {
  submitGeneration += 1;
  submitLocked.value = false;
}

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  [() => props.loading, () => props.modelValue],
  ([loading, modelValue], [previousLoading]) => {
    if (!modelValue || (previousLoading && !loading)) {
      invalidatePendingSubmit();
    }
  },
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function open() {
  if (unavailable.value) return;
  emit("update:modelValue", true);
}

function cancel() {
  if (props.loading) return;
  invalidatePendingSubmit();
  emit("update:modelValue", false);
  emit("cancel");
}

function updateModelValue(value) {
  if (value) open();
  else cancel();
}

async function submit(event) {
  if (unavailable.value) return;
  const generation = ++submitGeneration;
  submitLocked.value = true;
  try {
    const validation = await event;
    if (generation !== submitGeneration) return;
    if (validation?.valid !== true) {
      invalidatePendingSubmit();
      return;
    }
    if (
      props.modelValue !== true ||
      props.loading ||
      props.disabled ||
      props.submitDisabled ||
      !validMode.value ||
      !submitLocked.value
    ) {
      invalidatePendingSubmit();
      return;
    }
    emit("submit");
    nextTick(() => {
      if (generation === submitGeneration && !props.loading) {
        submitLocked.value = false;
      }
    });
  } catch (error) {
    if (generation !== submitGeneration) return;
    invalidatePendingSubmit();
    emit("validation-error", error);
  }
}
</script>

<template>
  <slot name="activator" :open="open" :disabled="unavailable" />

  <v-dialog
    v-bind="$attrs"
    :model-value="props.modelValue"
    :max-width="props.maxWidth"
    :aria-label="props.title"
    persistent
    scrollable
    @update:model-value="updateModelValue"
  >
    <v-form
      :disabled="props.loading || props.disabled"
      @submit.prevent="submit"
    >
      <v-card :border="false">
        <v-toolbar color="secondary" density="compact" :title="props.title" />
        <v-card-text>
          <slot />
        </v-card-text>
        <v-card-actions>
          <slot name="prepend-actions" />
          <v-spacer />
          <AtomsBtnsCancel
            type="button"
            :disabled="props.loading"
            @click="cancel"
          />
          <AtomsBtnsSubmit
            type="submit"
            :text="submitLabel"
            :loading="props.loading"
            :disabled="unavailable"
          />
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
