<script setup>
import { ref, computed } from "vue";
import { mockEmployees } from "./test.mock.js";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";

const sizes = ["small", "medium", "large"];
const variants = ["default", "success", "warning", "error", "disabled"];

// useFetchEmployeeのインスタンスを作成し、モックデータをキャッシュに追加
const employeeComposable = useFetchEmployee();
const { pushEmployees } = employeeComposable;

// モックデータを事前にキャッシュに追加（Firestoreアクセスを回避）
pushEmployees(mockEmployees);

// 選択された従業員のインデックス
const selectedEmployeeIndex = ref(0);

// 選択された従業員
const selectedEmployee = computed(
  () => mockEmployees[selectedEmployeeIndex.value],
);

// 従業員選択用のオプション
const employeeOptions = computed(() =>
  mockEmployees.map((emp, index) => ({
    value: index,
    title: `${emp.displayName} (${emp.code})`,
    subtitle: emp.remarks,
  })),
);

const highlight = ref(false);
const removable = ref(false);

const handleRemove = (label) => {
  console.log(`削除ボタンがクリックされました: ${label}`);
};
</script>

<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">WorkerTag</h1>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロール</h2>
          <v-row>
            <v-col cols="12">
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
            <v-col cols="12">
              <v-card variant="tonal" color="info" class="pa-3">
                <div class="text-caption mb-2">
                  <strong>選択中の従業員情報:</strong>
                </div>
                <div class="text-caption">
                  <strong>コード:</strong> {{ selectedEmployee.code }}
                </div>
                <div class="text-caption">
                  <strong>氏名:</strong> {{ selectedEmployee.displayName }}
                </div>
                <div class="text-caption">
                  <strong>役職:</strong> {{ selectedEmployee.title || "なし" }}
                </div>
                <div class="text-caption">
                  <strong>雇用状態:</strong>
                  {{
                    selectedEmployee.employmentStatus === "active"
                      ? "在職中"
                      : "退職"
                  }}
                </div>
                <div class="text-caption">
                  <strong>外国人:</strong>
                  {{ selectedEmployee.isForeigner ? "はい" : "いいえ" }}
                </div>
                <div class="text-caption">
                  <strong>警備員登録:</strong>
                  {{
                    selectedEmployee.hasSecurityGuardRegistration
                      ? "あり"
                      : "なし"
                  }}
                </div>
                <div
                  v-if="selectedEmployee.securityCertifications?.length > 0"
                  class="text-caption"
                >
                  <strong>資格:</strong>
                  {{
                    selectedEmployee.securityCertifications
                      .map((c) => c.abbreviation || c.name)
                      .join(", ")
                  }}
                </div>
                <div class="text-caption mt-2 text-grey-darken-1">
                  {{ selectedEmployee.remarks }}
                </div>
              </v-card>
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
            <v-col cols="12">
              <div class="text-subtitle-2 mb-2">プレビュー</div>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :highlight="highlight"
                :removable="removable"
                @click:remove="handleRemove(selectedEmployee.displayName)"
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
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                :size="size"
                :highlight="highlight"
                :removable="removable"
                @click:remove="handleRemove(selectedEmployee.displayName)"
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
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                :variant="variant"
                size="medium"
                :removable="removable"
                @click:remove="handleRemove(variant)"
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
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="primary">
                    mdi-account-star
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Label スロット</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    リーダー
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Footer スロット</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    現場A
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Footer スロット</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary" class="mr-1">
                      シフトA
                    </v-chip>
                    <span class="text-grey">休憩: 12:00-13:00</span>
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Footer スロット</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-check-circle</v-icon
                    >
                    出勤確認済み
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Action スロット</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                3つのフッタースロット組み合わせ
              </h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    東京支店
                  </div>
                </template>
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary">日勤</v-chip>
                  </div>
                </template>
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1">mdi-check</v-icon>
                    確認済
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12">
              <h3 class="text-subtitle-2 mb-2">全フッタースロットのテスト</h3>
              <p class="text-caption text-grey mb-2">
                prepend-footer → footer → append-footer の順で表示されます
              </p>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="large"
                :removable="true"
              >
                <template #prepend-footer>
                  <v-list-item-subtitle class="text-caption text-primary">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-office-building</v-icon
                    >
                    配属: 本社ビル 3階
                  </v-list-item-subtitle>
                </template>
                <template #footer>
                  <v-list-item-subtitle
                    class="d-flex align-center text-caption"
                  >
                    <v-chip size="x-small" color="success" class="mr-1"
                      >正社員</v-chip
                    >
                    <v-chip size="x-small" color="info">リーダー</v-chip>
                  </v-list-item-subtitle>
                </template>
                <template #append-footer>
                  <v-list-item-subtitle class="text-caption text-warning">
                    <v-icon size="x-small" class="mr-1">mdi-alert</v-icon>
                    備考: 資格更新が近づいています (2026/02/15)
                  </v-list-item-subtitle>
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
              <h3 class="text-subtitle-2 mb-2">リーダー（特別表示）</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                variant="success"
                :highlight="true"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="success">
                    mdi-shield-star
                  </v-icon>
                </template>
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    班長
                  </v-chip>
                </template>
                <template #footer>
                  <div class="text-caption">
                    <v-chip size="x-small" color="success" variant="outlined">
                      経験10年
                    </v-chip>
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">アラート付き作業員</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                variant="warning"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
                <template #append-footer>
                  <div class="text-warning text-caption">
                    <v-icon size="x-small" class="mr-1">mdi-alert</v-icon>
                    資格更新必要
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">新人作業員</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="info" class="ml-2">
                    新人
                  </v-chip>
                </template>
                <template #prepend-footer>
                  <div class="text-caption text-info">
                    <v-icon size="x-small" class="mr-1">mdi-information</v-icon>
                    研修期間中 (2026/01/15 - 2026/03/15)
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">エラー状態</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                variant="error"
                :removable="true"
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
                    資格期限切れ (2025/12/31)
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
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                :variant="variant"
                size="medium"
                :highlight="true"
                :removable="true"
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
              <h3 class="text-subtitle-2 mb-2">通常の作業員</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻未定の作業員</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="grey" class="ml-2">
                    調整中
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">正社員（出勤済み）</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                variant="success"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    出勤済
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">派遣社員（遅刻警告）</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                variant="warning"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-clock-alert
                  </v-icon>
                </template>
                <template #append-footer>
                  <span class="text-warning text-caption ml-2">
                    (遅刻の可能性)
                  </span>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">欠勤者</h3>
              <WorkerTag
                :worker-id="selectedEmployee.docId"
                :fetch-employee-composable="employeeComposable"
                size="medium"
                variant="error"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="error" class="ml-2">
                    欠勤
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
