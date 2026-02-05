<script setup>
/**
 * @file components/SiteOperationSchedule/Draggable/Workers/test.vue
 * @description SiteOperationScheduleDraggableWorkers コンポーネントのテストページ
 * - モックデータを使用してWorkers追加・並び替え・削除の動作を確認
 * - 親コンポーネントが emitted された schedule オブジェクトを受け取り、
 *   自身の状態を更新できることを確認
 */
import { ref, computed } from "vue";
import SiteOperationScheduleDraggableWorkers from "./index.vue";
import WorkerSelectorMolecules from "@/components/molecules/WorkerSelector.vue";
import SiteOperationScheduleWorkerTag from "@/components/SiteOperationSchedule/Worker/Tag/index.vue";
import EmployeeTag from "@/components/Employee/Tag/index.vue";
import OutsourcerTag from "@/components/Outsourcer/Tag/index.vue";
import { schedules } from "@/mocks/siteOperationSchedules.js";
import { mockEmployees } from "@/mocks/employees.js";
import { mockOutsourcers } from "@/mocks/outsourcers.js";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

/*****************************************************************************
 * INITIALIZE
 *****************************************************************************/
// useFetchEmployeeのインスタンスを作成し、モックデータをキャッシュに追加
const employeeComposable = useFetchEmployee();
const { pushEmployees } = employeeComposable;

// useFetchOutsourcerのインスタンスを作成し、モックデータをキャッシュに追加
const outsourcerComposable = useFetchOutsourcer();
const { pushOutsourcers } = outsourcerComposable;

// モックデータを事前にキャッシュに追加（Firestoreアクセスを回避）
pushEmployees(mockEmployees);
pushOutsourcers(mockOutsourcers);

/*****************************************************************************
 * CONTROL STATES
 *****************************************************************************/
// 現場稼働予定オブジェクト（テスト対象のモデル）
// モックデータの最初の要素をコピーして使用
const schedule = ref(schedules[0]);

// イベントログ
const eventLogs = ref([]);

// 全作業員（employees + outsourcers）を結合した配列
const allWorkers = computed(() => {
  return [...schedule.value.employees, ...schedule.value.outsourcers];
});

// WorkerSelector用のリスト
// pull: 'clone' のため、追加済みでもリストから除外しない
const availableEmployees = computed(() => mockEmployees);
const availableOutsourcers = computed(() => mockOutsourcers);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * SiteOperationScheduleDraggableWorkers から emitted された
 * update:modelValue イベントを処理
 */
function handleScheduleUpdate(newSchedule) {
  const timestamp = new Date().toLocaleTimeString();

  // 親コンポーネント側で schedule を更新（モデルの更新を確認）
  // 新しいインスタンスを作成して更新（参照ではなく値のコピー）
  schedule.value = new SiteOperationSchedule(newSchedule);

  // イベントログに記録
  eventLogs.value.push({
    timestamp,
    type: "update:modelValue",
    employeesCount: newSchedule.employees.length,
    outsourcersCount: newSchedule.outsourcers.length,
    allWorkersCount: [...newSchedule.employees, ...newSchedule.outsourcers]
      .length,
    schedule: JSON.parse(JSON.stringify(newSchedule)),
  });
}

/**
 * イベントログをクリア
 */
function clearLogs() {
  eventLogs.value = [];
}

/**
 * 指定したインデックスの作業員を削除（テスト用）
 */
function removeWorker(index) {
  const isEmployee = index < schedule.value.employees.length;
  const worker = isEmployee
    ? schedule.value.employees[index]
    : schedule.value.outsourcers[index - schedule.value.employees.length];

  schedule.value.removeWorker(worker.id, isEmployee);
  handleScheduleUpdate(schedule.value);
}

/**
 * インデックス1の従業員とインデックス0の従業員を入れ替える（テスト用）
 * modelValueの変更がdraggableのchangeイベントをemitするかを確認
 */
function swapEmployees() {
  if (schedule.value.employees.length >= 2) {
    schedule.value.moveWorker({
      oldIndex: 1,
      newIndex: 0,
      isEmployee: true,
    });
    handleScheduleUpdate(schedule.value);
  }
}
</script>

<template>
  <div class="d-flex fill-height">
    <!-- 左側メインエリア -->
    <div class="flex-grow-1 d-flex flex-column pa-4">
      <!-- タイトル -->
      <v-card class="mb-4">
        <v-card-title
          >SiteOperationScheduleDraggableWorkers テスト</v-card-title
        >
        <v-card-text>
          <p class="mb-2">
            <strong>テスト概要：</strong>
            モックデータを使用して、作業員の追加・並び替え・削除の動作を確認
          </p>
          <p class="mb-0">
            <strong>初期状態：</strong>
            従業員 {{ schedule.employees.length }} 件、外注先
            {{ schedule.outsourcers.length }} 件
          </p>
        </v-card-text>
      </v-card>

      <!-- 現在の状態表示 -->
      <v-card
        class="mb-4"
        style="max-height: 500px; display: flex; flex-direction: column"
      >
        <v-card-title>現在の状態</v-card-title>
        <v-card-text
          class="flex-grow-1"
          style="overflow: hidden; display: flex; flex-direction: column"
        >
          <div class="d-flex gap-2 mb-4 align-center flex-shrink-0">
            <v-chip color="blue">
              従業員: {{ schedule.employees.length }}
            </v-chip>
            <v-chip color="green">
              外注先: {{ schedule.outsourcers.length }}
            </v-chip>
            <v-chip color="purple"> 合計: {{ allWorkers.length }} </v-chip>
            <v-spacer />
            <v-btn
              size="small"
              color="primary"
              variant="outlined"
              @click="swapEmployees"
              :disabled="schedule.employees.length < 2"
            >
              従業員[0]と[1]を入れ替え
            </v-btn>
          </div>

          <!-- 作業員リスト -->
          <div
            class="flex-grow-1"
            style="display: flex; flex-direction: column; min-height: 0"
          >
            <h4 class="mb-2 flex-shrink-0">現在の作業員一覧</h4>
            <div v-if="allWorkers.length === 0" class="text-grey">
              作業員がまだ追加されていません
            </div>
            <!-- スクロールコンテナ -->
            <div v-else class="flex-grow-1 overflow-auto" style="min-height: 0">
              <v-table dense class="bg-grey-lighten-5">
                <thead>
                  <tr>
                    <th>インデックス</th>
                    <th>種別</th>
                    <th>ID</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(worker, index) in allWorkers" :key="index">
                    <td>{{ index }}</td>
                    <td>
                      <v-chip
                        :color="worker.isEmployee ? 'blue' : 'green'"
                        size="small"
                      >
                        {{ worker.isEmployee ? "従業員" : "外注先" }}
                      </v-chip>
                    </td>
                    <td class="font-monospace text-caption">{{ worker.id }}</td>
                    <td>
                      <v-btn
                        size="x-small"
                        icon="mdi-delete"
                        variant="text"
                        color="error"
                        @click="removeWorker(index)"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- 作業員リスト（左）と作業員選択（右）を左右分割 -->
      <div class="d-flex gap-4 flex-grow-1" style="min-height: 0">
        <!-- 左：DraggableWorkers -->
        <v-card
          class="flex-1 d-flex flex-column"
          style="min-width: 0; min-height: 0"
        >
          <v-card-title>作業員リスト（ドラッグ可能）</v-card-title>
          <v-divider />
          <v-card-text
            class="flex-grow-1 overflow-y-auto"
            style="min-height: 0"
          >
            <div
              class="border-2 border-dashed rounded pa-4 bg-grey-lighten-4"
              style="min-height: 200px"
            >
              <SiteOperationScheduleDraggableWorkers
                :model-value="schedule"
                @update:model-value="handleScheduleUpdate"
              >
                <template #default="slotProps">
                  <SiteOperationScheduleWorkerTag
                    v-bind="slotProps"
                    :fetch-employee-composable="employeeComposable"
                    :fetch-outsourcer-composable="outsourcerComposable"
                  />
                </template>
              </SiteOperationScheduleDraggableWorkers>
            </div>
          </v-card-text>
        </v-card>

        <!-- 右：WorkerSelector -->
        <v-card
          class="flex-1 d-flex flex-column"
          style="min-width: 0; min-height: 0"
        >
          <v-card-title>作業員を追加</v-card-title>
          <v-divider />
          <v-card-text
            class="flex-grow-1 pa-0"
            style="min-height: 0; overflow: hidden"
          >
            <WorkerSelectorMolecules
              :employees="availableEmployees"
              :outsourcers="availableOutsourcers"
              @tab-changed="(index) => console.log('Tab changed:', index)"
            >
              <template #employee="{ rawElement }">
                <EmployeeTag
                  :doc-id="rawElement?.docId"
                  :fetch-employee-composable="employeeComposable"
                  is-draggable
                />
              </template>
              <template #outsourcer="{ rawElement }">
                <OutsourcerTag
                  :doc-id="rawElement?.docId"
                  :fetch-outsourcer-composable="outsourcerComposable"
                  is-draggable
                />
              </template>
            </WorkerSelectorMolecules>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- 右サイドバー：イベントログ -->
    <v-navigation-drawer
      permanent
      location="right"
      width="400"
      class="border-start"
    >
      <v-card class="fill-height d-flex flex-column">
        <v-card-title>
          <div class="d-flex justify-space-between align-center">
            <span>イベントログ</span>
            <v-btn
              size="small"
              variant="text"
              @click="clearLogs"
              :disabled="eventLogs.length === 0"
            >
              クリア
            </v-btn>
          </div>
        </v-card-title>
        <v-divider />
        <v-card-text class="flex-grow-1 overflow-y-auto">
          <div v-if="eventLogs.length === 0" class="text-grey">
            イベントがまだ発火していません
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(log, index) in eventLogs"
              :key="index"
              class="border pa-2 rounded bg-grey-lighten-5"
            >
              <div class="d-flex gap-2 align-center mb-1">
                <v-chip
                  size="small"
                  :color="log.type === 'update:modelValue' ? 'orange' : 'blue'"
                >
                  {{ log.type }}
                </v-chip>
                <span class="text-caption text-grey">{{ log.timestamp }}</span>
              </div>
              <div v-if="log.type === 'update:modelValue'" class="text-caption">
                <div>従業員: {{ log.employeesCount }}</div>
                <div>外注先: {{ log.outsourcersCount }}</div>
                <div>合計: {{ log.allWorkersCount }}</div>
              </div>
              <div v-else class="text-caption">
                {{ log.message }}
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-navigation-drawer>
  </div>
</template>

<style scoped>
.cursor-move {
  cursor: move;
}

.space-y-2 > * + * {
  margin-top: 0.5rem;
}
</style>
