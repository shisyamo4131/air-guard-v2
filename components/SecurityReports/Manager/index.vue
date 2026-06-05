<script setup>
/*****************************************************************************
 * @file ./components/SecurityReports/Manager/index.vue
 * @description A component to manage `SecurityReports`.
 *****************************************************************************/
import { useDefaults } from "vuetify";
/** COMPOSABLES */
import { useSecurityReports } from "@/composables/storage/useSecurityReports";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  scheduleId: { type: String, default: null },
  imgProps: { type: Object, default: () => ({}) },
  thumb: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SecurityReportsManager");
const emit = defineEmits(["click:delete"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, reports, isDeleting, del, isUploading } = useSecurityReports(
  toRef(() => props.scheduleId),
  { fetchOnChanged: true },
);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const currentReport = ref(null); // 現在表示中の警備日報
</script>

<template>
  <div class="d-flex flex-column">
    <SecurityReportsWindow
      v-if="reports.length !== 0"
      class="flex-grow-1"
      :reports="reports"
      :img-props="props.imgProps"
      :thumb="props.thumb"
      @current-report="currentReport = $event"
    />
    <div v-else class="flex-grow-1">
      <v-empty-state icon="mdi-image-off" />
    </div>
    <v-card-text class="flex-grow-0 pb-0">
      <v-file-input
        v-bind="attrs"
        density="compact"
        :disabled="!props.scheduleId"
        variant="outlined"
        hide-details
      />
    </v-card-text>
    <v-card-actions class="justify-space-between">
      <v-btn
        color="error"
        size="small"
        variant="text"
        prepend-icon="mdi-trash-can"
        :disabled="isDeleting(currentReport) || !currentReport?.url"
        :loading="isDeleting(currentReport)"
        text="削除"
        @click="del(currentReport)"
      />
      <v-btn
        :href="currentReport?.url"
        :disabled="!currentReport?.url || isUploading"
        target="_blank"
        size="small"
        variant="text"
        prepend-icon="mdi-open-in-new"
        text="フルサイズ"
      />
    </v-card-actions>
  </div>
</template>
