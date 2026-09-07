<script setup>
defineProps({ controller: { type: Object, required: true }, title: { type: String, default: "稼働情報" }, customInput: { type: Object, default: null }, inputProps: { type: Object, default: () => ({}) } });
</script>
<template>
  <v-alert v-if="controller.message.value && !controller.opened.value" type="info" class="my-2">{{ controller.message.value }}</v-alert>
  <v-dialog :model-value="controller.opened.value" persistent scrollable max-width="760">
    <v-card :title="title">
      <v-card-text>
        <v-progress-linear v-if="controller.loading.value" indeterminate />
        <v-alert v-if="controller.message.value" class="mb-3" type="info">{{ controller.message.value }}</v-alert>
        <template v-if="controller.action === 'delete' || controller.rowAction === 'remove'">
          この情報を削除します。よろしいですか？
        </template>
        <template v-else-if="controller.draft.value">
          <air-item-input v-if="customInput" :item="controller.draft.value" :schema="controller.inputSchema.value" :update-properties="controller.update" :disabled="controller.disabled.value" :edit-mode="controller.action === 'create' ? 'CREATE' : 'UPDATE'">
            <template #default="input">
              <component :is="customInput" v-bind="{ ...input, ...inputProps }" :item="controller.draft.value" :disabled="controller.disabled.value" @pending="controller.setInputPending?.($event)" />
            </template>
          </air-item-input>
          <air-item-input v-else :item="controller.draft.value" :schema="controller.inputSchema.value" :update-properties="controller.update" :disabled="controller.disabled.value" :edit-mode="controller.action === 'create' ? 'CREATE' : 'UPDATE'" />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="controller.action !== 'create'" :disabled="controller.busy.value || controller.loading.value" @click="controller.reload">最新値を読み直す</v-btn>
        <v-spacer />
        <v-btn :disabled="controller.busy.value" @click="controller.close">キャンセル</v-btn>
        <v-btn color="primary" :loading="controller.busy.value" :disabled="controller.saveDisabled?.value ?? controller.disabled.value" @click="controller.save">{{ controller.action === 'delete' ? '削除' : '保存' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
