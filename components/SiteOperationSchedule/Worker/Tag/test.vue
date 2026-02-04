<script setup>
/**
 * @file components/SiteOperationSchedule/Worker/Tag/test.vue
 * @description SiteOperationScheduleWorkerTag コンポーネントのテストページ
 * - SiteOperationScheduleのモックデータを使用してWorkerTagの表示を確認
 */
import { ref, computed } from "vue";
import SiteOperationScheduleWorkerTag from "./index.vue";
import { schedules } from "@/mocks/siteOperationSchedules.js";
import { mockEmployees } from "@/mocks/employees.js";
import { mockOutsourcers } from "@/mocks/outsourcers.js";
import { mockArrangementNotifications } from "@/mocks/arrangementNotifications.js";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

/*****************************************************************************
 * INITIALIZE
 *****************************************************************************/
const schedule = schedules[0];

// useFetchEmployeeのインスタンスを作成し、モックデータをキャッシュに追加
const employeeComposable = useFetchEmployee();
const { pushEmployees } = employeeComposable;

// useFetchOutsourcerのインスタンスを作成し、モックデータをキャッシュに追加
const outsourcerComposable = useFetchOutsourcer();
const { pushOutsourcers } = outsourcerComposable;

// モックデータを事前にキャッシュに追加（Firestoreアクセスを回避）
pushEmployees(mockEmployees);
pushOutsourcers(mockOutsourcers);

// 全作業員（employees + outsourcers）を結合
const allWorkers = computed(() => {
  return [...schedule.employees, ...schedule.outsourcers];
});

// 配置通知のマップ（notificationKey -> ArrangementNotification）
const notificationsByKey = computed(() => {
  return mockArrangementNotifications.reduce((map, notification) => {
    map[notification.notificationKey] = notification;
    return map;
  }, {});
});

/*****************************************************************************
 * CONTROL STATES
 *****************************************************************************/
const selectedWorkerIndex = ref(0);
const selectedWorker = computed(
  () => allWorkers.value[selectedWorkerIndex.value],
);

// コントロール用の状態
const highlight = ref(false);
const removable = ref(true);
const disableEdit = ref(false);
const disableNotification = ref(false);
const showDraggableIcon = ref(false);
const hideTime = ref(false);
const hideEdit = ref(false);
const hideNotification = ref(false);
const scheduleIsEditable = ref(true);
const size = ref("medium");
const variant = ref("default");
const editIcon = ref("mdi-pencil");

const scheduleForTest = computed(() => {
  return {
    ...schedule,
    isEditable: scheduleIsEditable.value,
  };
});

const sizes = ["small", "medium", "large"];
const variants = ["default", "success", "warning", "error", "disabled"];
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-6">SiteOperationScheduleWorkerTag テスト</h1>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロールパネル</h2>

          <!-- 作業員選択 -->
          <v-select
            v-model="selectedWorkerIndex"
            :items="
              allWorkers.map((worker, index) => ({
                title: `${worker.isEmployee ? '従業員' : '外注先'}: ${worker.workerId}`,
                value: index,
              }))
            "
            label="作業員を選択"
            density="compact"
            class="mb-4"
          />

          <!-- プレビュー -->
          <div class="mb-4 pa-4 bg-grey-lighten-4 rounded">
            <h3 class="text-subtitle-2 mb-2">プレビュー</h3>
            <SiteOperationScheduleWorkerTag
              :worker="selectedWorker"
              :schedule="scheduleForTest"
              :notifications="notificationsByKey"
              :fetch-employee-composable="employeeComposable"
              :fetch-outsourcer-composable="outsourcerComposable"
              :highlight="highlight"
              :removable="removable"
              :disable-edit="disableEdit"
              :disable-notification="disableNotification"
              :show-draggable-icon="showDraggableIcon"
              :hide-time="hideTime"
              :hide-edit="hideEdit"
              :hide-notification="hideNotification"
              :size="size"
              :variant="variant"
              :edit-icon="editIcon"
            />
          </div>

          <!-- コントロール -->
          <v-row dense>
            <v-col cols="12" md="6">
              <v-switch
                v-model="scheduleIsEditable"
                label="スケジュール編集可能 (schedule.isEditable)"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="highlight"
                label="ハイライト表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="removable"
                label="削除可能"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="disableEdit"
                label="編集無効化"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="disableNotification"
                label="通知無効化"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="showDraggableIcon"
                label="ドラッグアイコン表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="hideTime"
                label="時刻非表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="hideEdit"
                label="編集ボタン非表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="hideNotification"
                label="通知エリア非表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="size"
                :items="sizes"
                label="サイズ"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="variant"
                :items="variants"
                label="バリアント"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editIcon"
                label="編集アイコン"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- サイズバリアント -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">サイズバリアント</h2>
          <v-row>
            <v-col v-for="sizeItem in sizes" :key="sizeItem" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">
                {{ sizeItem.toUpperCase() }}
              </h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                :size="sizeItem"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- カラーバリアント -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">カラーバリアント (Medium サイズ)</h2>
          <v-row>
            <v-col
              v-for="variantItem in variants"
              :key="variantItem"
              cols="12"
              md="4"
            >
              <h3 class="text-subtitle-2 mb-2">
                {{ variantItem.toUpperCase() }}
              </h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                :variant="variantItem"
                size="medium"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 全作業員の一覧 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">全作業員の一覧</h2>
          <v-row>
            <v-col
              v-for="(worker, index) in allWorkers"
              :key="worker.workerId"
              cols="12"
              md="4"
            >
              <h3 class="text-subtitle-2 mb-2">
                {{ worker.isEmployee ? "従業員" : "外注先" }} {{ index + 1 }}
              </h3>
              <SiteOperationScheduleWorkerTag
                :worker="worker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 時刻表示のテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">時刻表示のテスト</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻表示あり（デフォルト）</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻表示なし（hideTime）</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :hide-time="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- スロットのテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">スロットのテスト</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Label スロット</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="primary">
                    {{
                      selectedWorker.isEmployee
                        ? "mdi-account-star"
                        : "mdi-domain"
                    }}
                  </v-icon>
                </template>
              </SiteOperationScheduleWorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Label スロット</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    {{ selectedWorker.isQualified ? "有資格" : "無資格" }}
                  </v-chip>
                </template>
              </SiteOperationScheduleWorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Footer スロット</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="info" class="mr-1">
                      休憩: {{ selectedWorker.breakMinutes }}分
                    </v-chip>
                  </div>
                </template>
              </SiteOperationScheduleWorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">編集・削除ボタン組み合わせ</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- アイコンカスタマイズのテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">アイコンカスタマイズ</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">デフォルト編集アイコン</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                カスタム編集アイコン（mdi-cog）
              </h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                edit-icon="mdi-cog"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">編集のみ（削除なし）</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="false"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">削除のみ（編集なし）</h3>
              <SiteOperationScheduleWorkerTag
                :worker="selectedWorker"
                :schedule="scheduleForTest"
                :notifications="notificationsByKey"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>

<style scoped>
.v-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
