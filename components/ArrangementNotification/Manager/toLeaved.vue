<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/Manager/toLeaved.vue
 * @description A component to manage `ArrangementNotification` document to be `LEAVED`.
 * @extends AirItemManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import {
  uploadSecurityReport,
  listSecurityReports,
  deleteSecurityReport,
} from "@/utils/storage";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  siteOperationScheduleId: {
    type: String,
    required: true,
  },
});
const props = useDefaults(_props, "ArrangementNotificationManagerToLeaved");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const reports = ref([]);
const isUploading = ref(false);
const isListing = ref(false);
const uploadError = ref(null);
const listError = ref(null);
const deletingPaths = ref(new Set());
const file = ref(null);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * file が選択されたらアップロードを実行する
 */
watch(file, async (newFile) => {
  if (!newFile) return;
  uploadError.value = null;
  isUploading.value = true;
  try {
    await uploadSecurityReport(props.siteOperationScheduleId, newFile);
    await fetchReports();
  } catch (e) {
    uploadError.value = e.message;
  } finally {
    isUploading.value = false;
    file.value = null;
  }
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * 警備日報写真の一覧を取得する
 */
async function fetchReports() {
  if (!props.siteOperationScheduleId) {
    listError.value = "scheduleId を入力してください。";
    return;
  }
  listError.value = null;
  isListing.value = true;
  try {
    reports.value = await listSecurityReports(props.siteOperationScheduleId);
  } catch (e) {
    listError.value = e.message;
  } finally {
    isListing.value = false;
  }
}

/**
 * 警備日報写真を削除する
 * @param report
 */
async function onDelete(report) {
  const path = report.ref.fullPath;
  deletingPaths.value = new Set([...deletingPaths.value, path]);
  try {
    await deleteSecurityReport(report.ref);
    reports.value = reports.value.filter((r) => r.ref.fullPath !== path);
  } catch (e) {
    console.error(e);
  } finally {
    const next = new Set(deletingPaths.value);
    next.delete(path);
    deletingPaths.value = next;
  }
}
</script>

<template>
  <air-item-manager hide-delete-btn>
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>
    <template #input-default="{ componentAttrs }">
      <v-row>
        <!-- DATEAT -->
        <v-col cols="12">
          <air-date-input v-bind="componentAttrs[`dateAt`]" disabled />
        </v-col>

        <!-- ACTUAL START TIME -->
        <v-col cols="12">
          <air-time-picker-input v-bind="componentAttrs[`actualStartTime`]" />
        </v-col>

        <!-- ACTUAL IS START NEXT DAY -->
        <v-col cols="12">
          <IsStartNextDayCheckbox
            v-bind="componentAttrs[`actualIsStartNextDay`]"
          />
        </v-col>

        <!-- ACTUAL END TIME -->
        <v-col cols="12">
          <air-time-picker-input v-bind="componentAttrs[`actualEndTime`]" />
        </v-col>

        <!-- ACTUAL BREAK MINUTES -->
        <v-col cols="12">
          <air-number-input v-bind="componentAttrs[`actualBreakMinutes`]" />
        </v-col>

        <!-- SECURITY REPORT FILE UPLOADER -->
        <v-col cols="12">
          <v-file-input
            v-model="file"
            label="日報写真をアップロード"
            accept="image/*"
            variant="outlined"
            :loading="isUploading"
            :disabled="isUploading"
            class="mb-1"
          />
        </v-col>
      </v-row>
      <!-- 取得した画像一覧 -->
      <v-row v-if="reports.length">
        <v-col
          v-for="report in reports"
          :key="report.ref.fullPath"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card>
            <!-- サムネイルがあればサムネイル、なければ本体 URL を表示 -->
            <v-img
              :src="report.thumbUrl ?? report.url"
              aspect-ratio="1.5"
              cover
            >
              <template #placeholder>
                <v-row class="fill-height ma-0" align="center" justify="center">
                  <v-progress-circular indeterminate color="grey" />
                </v-row>
              </template>
            </v-img>
            <v-card-actions>
              <v-btn
                color="error"
                size="small"
                variant="text"
                :loading="deletingPaths.has(report.ref.fullPath)"
                @click="onDelete(report)"
              >
                削除
              </v-btn>
              <v-spacer />
              <v-btn
                :href="report.url"
                target="_blank"
                size="small"
                variant="text"
              >
                フルサイズを開く
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </air-item-manager>
</template>
