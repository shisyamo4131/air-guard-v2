<script setup>
import CustomInput from "@/components/SiteOperationSchedule/CustomInput/index.vue";
defineOptions({ inheritAttrs: false });
const props = defineProps({ docs: { type: Array, default: () => [] }, customInput: { type: Object, default: () => CustomInput }, dateAt: { type: Object, default: () => new Date() } });
const emit = defineEmits(["update:date-range"]);
const events = computed(() => props.docs.map((item) => item.toEvent()));
</script>
<template>
  <OperationArrayManager v-bind="$attrs" kind="schedule" :docs="props.docs" :custom-input="props.customInput">
    <template #table="table">
      <slot name="table" v-bind="table">
        <v-card>
          <v-toolbar color="secondary" density="compact" title="稼働予定">
            <v-spacer /><v-btn icon="mdi-plus" aria-label="稼働予定を登録" @click="table.toCreate()" />
          </v-toolbar>
          <v-card-text>
            <SiteOperationSchedulesCalendar :model-value="props.dateAt" :events="events" @update:date-range="emit('update:date-range', $event)" @click:event="table.toUpdate($event)" />
          </v-card-text>
        </v-card>
      </slot>
    </template>
  </OperationArrayManager>
</template>
