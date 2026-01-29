<script setup>
import { ref, computed } from "vue";
import { mockEmployees } from "@/mocks/employees.js";
import { mockOutsourcers } from "@/mocks/outsourcers.js";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

const sizes = ["small", "medium", "large"];
const variants = ["default", "success", "warning", "error", "disabled"];

// useFetchEmployeeとuseFetchOutsourcerのインスタンスを作成し、モックデータをキャッシュに追加
const employeeComposable = useFetchEmployee();
const { pushEmployees } = employeeComposable;
pushEmployees(mockEmployees);

const outsourcerComposable = useFetchOutsourcer();
const { pushOutsourcers } = outsourcerComposable;
pushOutsourcers(mockOutsourcers);

// isEmployeeの切り替え
const isEmployee = ref(true);

// 選択された従業員/外注先のインデックス
const selectedEmployeeIndex = ref(0);
const selectedOutsourcerIndex = ref(0);

// 選択された従業員/外注先
const selectedEmployee = computed(
  () => mockEmployees[selectedEmployeeIndex.value],
);
const selectedOutsourcer = computed(
  () => mockOutsourcers[selectedOutsourcerIndex.value],
);

// 現在選択されているワーカー
const currentWorker = computed(() => {
  return isEmployee.value ? selectedEmployee.value : selectedOutsourcer.value;
});

// 従業員選択用のオプション
const employeeOptions = computed(() =>
  mockEmployees.map((emp, index) => ({
    value: index,
    title: `${emp.displayName} (${emp.code})`,
    subtitle: emp.remarks,
  })),
);

// 外注先選択用のオプション
const outsourcerOptions = computed(() =>
  mockOutsourcers.map((out, index) => ({
    value: index,
    title: `${out.displayName} (${out.code})`,
    subtitle: out.remarks,
  })),
);

const highlight = ref(false);
const removable = ref(false);
const showDraggableIcon = ref(false);
const hideTime = ref(false);
const startTime = ref("09:00");
const endTime = ref("18:00");
const highlightStartTime = ref(false);
const highlightEndTime = ref(false);

const handleRemove = (label) => {
  console.log(`削除ボタンがクリックされました: ${label}`);
};
</script>

<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">WorkerTag</h1>
        <p class="text-body-2 text-grey mb-4">
          isEmployeeプロパティに応じて、EmployeeTagまたはOutsourcerTagを動的に切り替えます。
        </p>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロール</h2>
          <v-row>
            <v-col cols="12">
              <v-switch v-model="isEmployee" color="primary" hide-details>
                <template #label>
                  <span class="text-h6">
                    {{ isEmployee ? "従業員モード" : "外注先モード" }}
                  </span>
                </template>
              </v-switch>
            </v-col>
            <v-col v-if="isEmployee" cols="12">
              <v-select
                v-model="selectedEmployeeIndex"
                :items="employeeOptions"
                label="表示する従業員を選択"
                density="compact"
                hide-details
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props">
                    <v-list-item-subtitle class="text-caption">
                      {{ item.raw.subtitle }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
            <v-col v-else cols="12">
              <v-select
                v-model="selectedOutsourcerIndex"
                :items="outsourcerOptions"
                label="表示する外注先を選択"
                density="compact"
                hide-details
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props">
                    <v-list-item-subtitle class="text-caption">
                      {{ item.raw.subtitle }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
            <v-col cols="12">
              <v-card variant="tonal" color="info" class="pa-3">
                <div class="text-caption mb-2">
                  <strong
                    >選択中の{{ isEmployee ? "従業員" : "外注先" }}情報:</strong
                  >
                </div>
                <div class="text-caption">
                  <strong>コード:</strong> {{ currentWorker.code }}
                </div>
                <div class="text-caption">
                  <strong>{{ isEmployee ? "氏名" : "名称" }}:</strong>
                  {{
                    isEmployee ? currentWorker.displayName : currentWorker.name
                  }}
                </div>
                <div v-if="isEmployee" class="text-caption">
                  <strong>役職:</strong> {{ currentWorker.title || "なし" }}
                </div>
                <div v-if="isEmployee" class="text-caption">
                  <strong>雇用状態:</strong>
                  {{
                    currentWorker.employmentStatus === "active"
                      ? "在職中"
                      : "退職"
                  }}
                </div>
                <div v-if="!isEmployee" class="text-caption">
                  <strong>略称:</strong> {{ currentWorker.displayName }}
                </div>
                <div v-if="!isEmployee" class="text-caption">
                  <strong>契約状態:</strong>
                  {{
                    currentWorker.contractStatus === "active"
                      ? "契約中"
                      : "契約終了"
                  }}
                </div>
                <div class="text-caption mt-2 text-grey-darken-1">
                  {{ currentWorker.remarks }}
                </div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-switch
                v-model="highlight"
                label="ハイライト表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-switch
                v-model="removable"
                label="削除可能"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-switch
                v-model="showDraggableIcon"
                label="ドラッグアイコン表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-switch
                v-model="hideTime"
                label="時刻を非表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-switch
                v-model="highlightStartTime"
                label="開始時刻を強調"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-switch
                v-model="highlightEndTime"
                label="終了時刻を強調"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="startTime"
                label="開始時刻"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="endTime"
                label="終了時刻"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12">
              <div class="text-subtitle-2 mb-2">プレビュー</div>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :highlight="highlight"
                :removable="removable"
                :show-draggable-icon="showDraggableIcon"
                :hide-time="hideTime"
                :start-time="startTime"
                :end-time="endTime"
                :highlight-start-time="highlightStartTime"
                :highlight-end-time="highlightEndTime"
                @click:remove="
                  handleRemove(currentWorker.displayName || currentWorker.name)
                "
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
            <v-col v-for="size in sizes" :key="size" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">{{ size.toUpperCase() }}</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                :size="size"
                start-time="09:00"
                end-time="18:00"
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
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                start-time="09:00"
                end-time="18:00"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻表示なし（hideTime）</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :hide-time="true"
                start-time="09:00"
                end-time="18:00"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻未設定（--:--表示）</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">夜勤シフト</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                start-time="22:00"
                end-time="06:00"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                開始時刻強調（highlightStartTime）
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                start-time="09:00"
                end-time="18:00"
                :highlight-start-time="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                終了時刻強調（highlightEndTime）
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                start-time="09:00"
                end-time="18:00"
                :highlight-end-time="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">両方強調（個別設定を表示）</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                start-time="10:30"
                end-time="17:30"
                :highlight-start-time="true"
                :highlight-end-time="true"
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
            <v-col v-for="variant in variants" :key="variant" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">
                {{ variant.toUpperCase() }}
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                :variant="variant"
                size="medium"
                start-time="09:00"
                end-time="18:00"
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
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="primary">
                    {{ isEmployee ? "mdi-account-star" : "mdi-domain" }}
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Label スロット</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    {{ isEmployee ? "リーダー" : "優良業者" }}
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Footer スロット</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
              >
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary" class="mr-1">
                      {{ isEmployee ? "シフトA" : "施設警備" }}
                    </v-chip>
                    <span class="text-grey">
                      {{
                        isEmployee ? "休憩: 12:00-13:00" : "対応可能人数: 50名"
                      }}
                    </span>
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">全スロット組み合わせ</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
                :hide-time="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="success">
                    {{ isEmployee ? "mdi-shield-star" : "mdi-star" }}
                  </v-icon>
                </template>
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    {{ isEmployee ? "班長" : "優良" }}
                  </v-chip>
                </template>
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    {{ isEmployee ? "現場A" : "東京都新宿区" }}
                  </div>
                </template>
                <template #footer>
                  <div class="text-caption">
                    <v-chip size="x-small" color="success" variant="outlined">
                      {{ isEmployee ? "経験10年" : "実績10年以上" }}
                    </v-chip>
                  </div>
                </template>
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1">mdi-check</v-icon>
                    {{ isEmployee ? "確認済" : "即時対応可" }}
                  </div>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 複合的なカスタマイズ -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">複合的なカスタマイズ</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                {{
                  isEmployee ? "リーダー（特別表示）" : "優良業者（特別表示）"
                }}
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="success"
                :highlight="true"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="success">
                    {{ isEmployee ? "mdi-shield-star" : "mdi-star" }}
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">アラート付き</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="warning"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
                <template #append-footer>
                  <div class="text-warning text-caption">
                    <v-icon size="x-small" class="mr-1">mdi-alert</v-icon>
                    {{ isEmployee ? "資格更新必要" : "契約更新確認必要" }}
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                {{ isEmployee ? "新人" : "新規契約" }}
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #append-label>
                  <v-chip size="x-small" color="info" class="ml-2">
                    {{ isEmployee ? "新人" : "新規" }}
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">エラー状態</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="error"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #prepend-action>
                  <v-icon size="small" color="error">
                    mdi-alert-octagon
                  </v-icon>
                </template>
                <template #append-footer>
                  <div class="text-error text-caption">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-close-circle</v-icon
                    >
                    {{ isEmployee ? "資格期限切れ" : "契約終了" }}
                  </div>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- ハイライト状態の組み合わせ -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">ハイライト状態</h2>
          <v-row>
            <v-col v-for="variant in variants" :key="variant" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">
                {{ variant.toUpperCase() }} + Highlight
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                :variant="variant"
                size="medium"
                :highlight="true"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 実際の使用例 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">実際の使用例</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                {{ isEmployee ? "通常の従業員" : "通常の外注先" }}
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">確定済み</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="success"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    {{ isEmployee ? "出勤済" : "確定" }}
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">警告</h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="warning"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-clock-alert
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                {{ isEmployee ? "欠勤" : "対応不可" }}
              </h3>
              <WorkerTag
                :is-employee="isEmployee"
                :id="currentWorker.docId"
                :fetch-employee-composable="employeeComposable"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="error"
                :removable="true"
                start-time="09:00"
                end-time="18:00"
              >
                <template #append-label>
                  <v-chip size="x-small" color="error" class="ml-2">
                    {{ isEmployee ? "欠勤" : "対応不可" }}
                  </v-chip>
                </template>
              </WorkerTag>
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
