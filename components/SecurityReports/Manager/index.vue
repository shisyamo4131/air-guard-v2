<script setup>
/*****************************************************************************
 * @file ./components/SecurityReports/Manager/index.vue
 * @description A component to manage `SecurityReports`.
 *****************************************************************************/
import { useDefaults } from "vuetify";
/** SCHEMAS */
import { SiteOperationSchedule } from "@/schemas";
/** COMPOSABLES */
import { useSecurityReports } from "@/composables/storage/useSecurityReports";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  schedule: {
    type: Object,
    default: null,
    validator: (obj) => obj === null || obj instanceof SiteOperationSchedule,
  },
  imgProps: { type: Object, default: () => ({}) },
  thumb: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SecurityReportsManager");
const emit = defineEmits(["click:delete"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, reports, isDeleting, del } = useSecurityReports(
  toRef(() => props.schedule?.docId || null),
  {
    fetchOnChanged: true,
  },
);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const currentReport = ref(null);
</script>

<template>
  <v-card>
    <v-toolbar color="accent" density="compact" title="警備日報" />
    <v-card-text>
      <SecurityReportsWindow
        v-if="reports.length !== 0"
        :reports="reports"
        :img-props="props.imgProps"
        :thumb="props.thumb"
        @current-report="currentReport = $event"
      />
      <v-empty-state
        v-else
        title="警備日報は登録されていません"
        icon="mdi-image-off"
      />
    </v-card-text>
    <v-card-text>
      <v-file-input
        v-bind="attrs"
        density="compact"
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
        :disabled="!currentReport?.url"
        target="_blank"
        size="small"
        variant="text"
        prepend-icon="mdi-open-in-new"
        text="フルサイズ"
      />
    </v-card-actions>
  </v-card>
</template>
