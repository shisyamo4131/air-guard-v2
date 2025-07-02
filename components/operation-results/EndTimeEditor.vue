<script setup>
const props = defineProps({
  item: { type: Object, required: true },
  submit: { type: Function, required: true },
  updateProperties: { type: Function, required: true },
});
const emit = defineEmits(["click:close"]);
</script>

<template>
  <v-card>
    <v-toolbar density="comfortable" color="transparent">
      <v-toolbar-title>終了時刻</v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-close" @click="emit('click:close')" />
    </v-toolbar>
    <v-container>
      <v-confirm-edit
        :model-value="props.item.endTime"
        cancel-text="元に戻す"
        @update:modelValue="props.updateProperties({ endTime: $event })"
        @save="props.submit()"
      >
        <template #default="{ model: proxyModel, actions }">
          <v-time-picker v-model="proxyModel.value" format="24hr">
          </v-time-picker>
          <component :is="actions" />
        </template>
      </v-confirm-edit>
    </v-container>
  </v-card>
</template>
