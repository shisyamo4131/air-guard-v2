<script setup>
import { computed, ref } from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";

defineOptions({ name: "component-test" });

const EMPLOYEE_IDS = [
  "2I2KFQeFnzUjz67b12pQ",
  "2m2cUBlFtJrP3jWGbQSi",
  "4Fz2ox6RtQm0P126xwMj",
];

const {
  fetchEmployee,
  getEmployee,
  cachedEmployees,
  cachedEmployeesArray,
  clearCache,
} = useFetchEmployee();

const results = ref([]);
const isRunning = ref(false);

const cachedRows = computed(() =>
  cachedEmployeesArray.value.map((employee) => ({
    docId: employee.docId,
    name: employee.displayName || employee.name || "（名称なし）",
  })),
);

function addResult(name, passed, detail, startedAt) {
  results.value.push({
    name,
    passed,
    detail,
    elapsedMs: Math.round(performance.now() - startedAt),
  });
}

async function runCase(name, test) {
  const startedAt = performance.now();
  try {
    const detail = await test();
    addResult(name, true, detail, startedAt);
  } catch (error) {
    addResult(name, false, error?.message || String(error), startedAt);
  }
}

async function testSharedSinglePromise() {
  clearCache();
  const id = EMPLOYEE_IDS[0];

  const firstRequest = fetchEmployee(id);
  const secondRequest = fetchEmployee(id);

  // 後続リクエストだけを待っても、先行取得結果が利用可能であることを確認する。
  await secondRequest;
  if (!cachedEmployees.value[id]) {
    throw new Error("後続Promiseの完了時点で従業員がキャッシュにありません。 ");
  }

  await firstRequest;
  const count = cachedEmployeesArray.value.filter(
    (employee) => employee.docId === id,
  ).length;
  if (count !== 1) {
    throw new Error(`同じ従業員が ${count} 件キャッシュされています。`);
  }

  return `後続Promiseが先行取得を待機し、キャッシュ件数は ${count} 件でした。`;
}

async function testOverlappingBatches() {
  clearCache();
  const [firstId, sharedId, lastId] = EMPLOYEE_IDS;

  const firstBatch = fetchEmployee([firstId, sharedId]);
  const secondBatch = fetchEmployee([sharedId, lastId]);

  await secondBatch;
  for (const id of [sharedId, lastId]) {
    if (!cachedEmployees.value[id]) {
      throw new Error(`後続バッチ完了時点で ${id} がキャッシュにありません。`);
    }
  }

  await firstBatch;
  const cachedIds = new Set(
    cachedEmployeesArray.value.map((employee) => employee.docId),
  );
  for (const id of EMPLOYEE_IDS) {
    if (!cachedIds.has(id)) {
      throw new Error(`全バッチ完了後も ${id} がキャッシュにありません。`);
    }
  }
  if (cachedEmployeesArray.value.length !== EMPLOYEE_IDS.length) {
    throw new Error(
      `キャッシュ件数が ${cachedEmployeesArray.value.length} 件です。`,
    );
  }

  return "重複IDを含む2つのバッチが3件を重複なく取得しました。";
}

async function testGetEmployeeDuringFetch() {
  clearCache();
  const id = EMPLOYEE_IDS[2];

  const firstRequest = fetchEmployee(id);
  const employee = await getEmployee(id);
  await firstRequest;

  if (!employee || employee.docId !== id) {
    throw new Error("取得中のIDに対してgetEmployeeが結果を返しませんでした。 ");
  }

  return `getEmployeeが ${employee.displayName || employee.name || id} を返しました。`;
}

async function runAllTests() {
  if (isRunning.value) return;
  isRunning.value = true;
  results.value = [];

  try {
    await runCase("同一IDのPromise共有", testSharedSinglePromise);
    await runCase("重複するバッチ取得", testOverlappingBatches);
    await runCase("取得中のgetEmployee", testGetEmployeeDuringFetch);
  } finally {
    isRunning.value = false;
  }
}

function reset() {
  clearCache();
  results.value = [];
}
</script>

<template>
  <v-container>
    <v-card title="useFetchBase 並行取得テスト">
      <v-card-text>
        <p class="mb-4">
          Employeesコレクションの実データを使用して、同一IDへの後続呼び出しが
          先行Promiseを待機することを確認します。
        </p>

        <div class="d-flex ga-2 mb-6">
          <v-btn
            color="primary"
            :loading="isRunning"
            :disabled="isRunning"
            @click="runAllTests"
          >
            全テスト実行
          </v-btn>
          <v-btn variant="outlined" :disabled="isRunning" @click="reset">
            初期化
          </v-btn>
        </div>

        <v-table v-if="results.length" class="mb-6">
          <thead>
            <tr>
              <th>テスト</th>
              <th>結果</th>
              <th>所要時間</th>
              <th>詳細</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in results" :key="result.name">
              <td>{{ result.name }}</td>
              <td>
                <v-chip :color="result.passed ? 'success' : 'error'" size="small">
                  {{ result.passed ? "PASS" : "FAIL" }}
                </v-chip>
              </td>
              <td>{{ result.elapsedMs }} ms</td>
              <td>{{ result.detail }}</td>
            </tr>
          </tbody>
        </v-table>

        <h3 class="text-subtitle-1 mb-2">現在のキャッシュ</h3>
        <v-table density="compact">
          <thead>
            <tr>
              <th>docId</th>
              <th>従業員名</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="employee in cachedRows" :key="employee.docId">
              <td>{{ employee.docId }}</td>
              <td>{{ employee.name }}</td>
            </tr>
            <tr v-if="cachedRows.length === 0">
              <td colspan="2" class="text-medium-emphasis">
                キャッシュは空です。
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>
