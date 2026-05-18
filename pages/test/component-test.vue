<script setup>
import {
  uploadSecurityReport,
  listSecurityReports,
  deleteSecurityReport,
} from "@/utils/storage";
import { useAuthStore } from "@/stores/useAuthStore";

const { $storage } = useNuxtApp();
const auth = useAuthStore();

const scheduleId = ref("");
const reports = ref([]);
const isUploading = ref(false);
const isListing = ref(false);
const deletingPaths = ref(new Set());
const uploadError = ref(null);
const listError = ref(null);

/** ファイルアップロード */
async function onFileChange(file) {
  if (!file) return;
  if (!scheduleId.value) {
    uploadError.value = "scheduleId を入力してください。";
    return;
  }
  uploadError.value = null;
  isUploading.value = true;
  try {
    await uploadSecurityReport(
      $storage,
      auth.companyId,
      scheduleId.value,
      file,
      auth.uid,
    );
    await fetchReports();
  } catch (e) {
    uploadError.value = e.message;
  } finally {
    isUploading.value = false;
  }
}

/** ファイル一覧取得 */
async function fetchReports() {
  if (!scheduleId.value) {
    listError.value = "scheduleId を入力してください。";
    return;
  }
  listError.value = null;
  isListing.value = true;
  try {
    reports.value = await listSecurityReports(
      $storage,
      auth.companyId,
      scheduleId.value,
    );
  } catch (e) {
    listError.value = e.message;
  } finally {
    isListing.value = false;
  }
}

/** ファイル削除 */
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
  <v-container>
    <v-card class="mb-4">
      <v-card-title>Storage ユーティリティー テスト</v-card-title>
      <v-card-subtitle>
        companyId: <strong>{{ auth.companyId ?? "(未取得)" }}</strong> / uid:
        <strong>{{ auth.uid ?? "(未取得)" }}</strong>
      </v-card-subtitle>
      <v-card-text>
        <v-text-field
          v-model="scheduleId"
          label="scheduleId (SiteOperationSchedule の docId)"
          variant="outlined"
          density="compact"
          class="mb-2"
        />

        <!-- アップロード -->
        <v-file-input
          label="写真をアップロード"
          accept="image/*"
          variant="outlined"
          density="compact"
          :loading="isUploading"
          :disabled="isUploading"
          class="mb-1"
          @update:model-value="onFileChange"
        />
        <v-alert v-if="uploadError" type="error" density="compact" class="mb-2">
          {{ uploadError }}
        </v-alert>

        <!-- 一覧取得 -->
        <v-btn
          color="primary"
          :loading="isListing"
          :disabled="isListing || !scheduleId"
          @click="fetchReports"
        >
          一覧を取得
        </v-btn>
        <v-alert v-if="listError" type="error" density="compact" class="mt-2">
          {{ listError }}
        </v-alert>
      </v-card-text>
    </v-card>

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
          <v-img :src="report.thumbUrl ?? report.url" aspect-ratio="1.5" cover>
            <template #placeholder>
              <v-row class="fill-height ma-0" align="center" justify="center">
                <v-progress-circular indeterminate color="grey" />
              </v-row>
            </template>
          </v-img>
          <v-card-subtitle class="text-caption">
            {{ report.ref.name }}<br />
            {{ new Date(report.timeCreated).toLocaleString("ja-JP") }}<br />
            サムネイル: {{ report.thumbUrl ? "あり" : "なし（生成待ち）" }}
          </v-card-subtitle>
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

    <v-alert v-else-if="!isListing" type="info" density="compact">
      「一覧を取得」を押してください。
    </v-alert>
  </v-container>
</template>
