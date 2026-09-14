<script setup>
const props = defineProps({
  customInput: { type: [Object, Function], default: null },
  editor: { type: Object, required: true },
  errors: { type: Array, default: null },
  onReload: { type: Function, default: null },
  title: { type: String, default: "稼働情報" },
});

const message = computed(() => {
  const error = (props.errors || props.editor.errors)?.at?.(-1);
  return error?.message || "";
});
</script>

<template>
  <v-card :title="props.title">
    <v-card-text>
      <v-progress-linear v-if="props.editor.isLoading" indeterminate />
      <v-alert v-if="message" class="mb-3" type="info">{{ message }}</v-alert>
      <template v-if="props.editor.isDelete">
        この情報を削除します。よろしいですか？
      </template>
      <air-item-input v-else v-bind="props.editor.inputProps">
        <template #default="{ componentAttrs }">
          <component
            :is="props.customInput"
            v-if="props.customInput"
            v-bind="props.editor.inputProps"
            :component-attrs="componentAttrs"
          />
        </template>
      </air-item-input>
    </v-card-text>
    <v-card-actions>
      <v-btn
        v-if="props.onReload"
        :disabled="props.editor.isLoading"
        @click="props.onReload(props.editor.item || props.editor.inputProps?.item)"
      >
        最新値を読み直す
      </v-btn>
      <v-spacer />
      <v-btn
        :disabled="props.editor.isLoading"
        @click="props.editor.actions['onClick:cancel']"
      >
        キャンセル
      </v-btn>
      <v-btn
        color="primary"
        :loading="props.editor.isLoading"
        :disabled="
          (!props.editor.isDelete && props.editor.disabled) ||
          props.editor.disableSubmit ||
          props.editor.isLoading
        "
        @click="props.editor.actions['onClick:submit']"
      >
        {{ props.editor.isDelete ? "削除" : "保存" }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
