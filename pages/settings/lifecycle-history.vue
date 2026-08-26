<script setup>
/*****************************************************************************
 * @file ./pages/settings/lifecycle-history.vue
 * @description 会社管理者向けの退職・アカウント削除履歴ページです。
 *****************************************************************************/
import { useLifecycleOperationHistory } from "../../composables/application/user/useLifecycleOperationHistory";

defineOptions({ name: "lifecycle-history" });

const {
  eligible,
  errorMessage,
  hasNextPage,
  hasPreviousPage,
  items,
  loaded,
  loading,
  loadNext,
  loadPrevious,
  retry,
} = useLifecycleOperationHistory();

const operationLabels = Object.freeze({
  "employee-retirement": "従業員退職",
  "standalone-registered-user-deletion": "単独ユーザー削除",
  "employee-reinstatement": "誤退職訂正",
});
const statusSettings = Object.freeze({
  processing: Object.freeze({ label: "処理中", color: "info" }),
  retrying: Object.freeze({ label: "再処理中", color: "warning" }),
  completed: Object.freeze({ label: "完了", color: "success" }),
});
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value) {
  return dateTimeFormatter.format(new Date(value));
}

function operationLabel(item) {
  return operationLabels[item.operationType];
}

function statusSetting(item) {
  return statusSettings[item.status];
}

function targetLabel(item) {
  return item.subjectDisplayName ?? item.employeeId ?? "―";
}
</script>

<template>
  <v-container v-if="eligible" class="py-6">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h5 mb-1">退職・アカウント削除履歴</h1>
        <p class="text-body-2 text-medium-emphasis mb-4">
          退職、単独ユーザー削除、誤退職訂正の処理状況を新しい順に表示します。
        </p>

        <v-alert
          v-if="errorMessage"
          class="mb-4"
          type="error"
          variant="tonal"
        >
          <div class="d-flex flex-wrap align-center justify-space-between ga-2">
            <span>{{ errorMessage }}</span>
            <v-btn
              :disabled="loading"
              variant="text"
              @click="retry"
            >
              再試行
            </v-btn>
          </div>
        </v-alert>

        <v-card variant="outlined">
          <v-progress-linear
            v-if="loading"
            color="primary"
            indeterminate
          />

          <div
            v-if="!loaded && loading"
            class="pa-8 text-center text-medium-emphasis"
          >
            履歴を読み込んでいます…
          </div>

          <div
            v-else-if="loaded && items.length === 0"
            class="pa-8 text-center text-medium-emphasis"
          >
            退職・アカウント削除履歴はありません。
          </div>

          <template v-else-if="items.length > 0">
            <v-table class="d-none d-md-block">
              <thead>
                <tr>
                  <th>実行日時</th>
                  <th>操作</th>
                  <th>対象</th>
                  <th>理由</th>
                  <th>実行者</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in items" :key="`${item.createdAt}-${index}`">
                  <td class="text-no-wrap">{{ formatDateTime(item.createdAt) }}</td>
                  <td>
                    <div>{{ operationLabel(item) }}</div>
                    <v-chip
                      v-if="item.includesUserAccountDeletion"
                      class="mt-1"
                      color="warning"
                      size="x-small"
                      variant="tonal"
                    >
                      アカウント削除対象あり
                    </v-chip>
                  </td>
                  <td>
                    <div>{{ targetLabel(item) }}</div>
                    <div
                      v-if="item.effectiveDate"
                      class="text-caption text-medium-emphasis"
                    >
                      退職日: {{ item.effectiveDate }}
                    </div>
                  </td>
                  <td>{{ item.reason ?? "―" }}</td>
                  <td>{{ item.actorDisplayName }}</td>
                  <td>
                    <v-chip
                      :color="statusSetting(item).color"
                      size="small"
                      variant="tonal"
                    >
                      {{ statusSetting(item).label }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div class="d-md-none pa-3">
              <v-card
                v-for="(item, index) in items"
                :key="`${item.createdAt}-${index}`"
                class="mb-3"
                variant="tonal"
              >
                <v-card-title class="text-subtitle-1 d-flex align-center ga-2">
                  <span>{{ operationLabel(item) }}</span>
                  <v-chip
                    :color="statusSetting(item).color"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ statusSetting(item).label }}
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <dl class="lifecycle-history-details">
                    <dt>実行日時</dt>
                    <dd>{{ formatDateTime(item.createdAt) }}</dd>
                    <dt>対象</dt>
                    <dd>
                      {{ targetLabel(item) }}
                      <span v-if="item.effectiveDate">
                        （退職日: {{ item.effectiveDate }}）
                      </span>
                    </dd>
                    <dt>理由</dt>
                    <dd>{{ item.reason ?? "―" }}</dd>
                    <dt>実行者</dt>
                    <dd>{{ item.actorDisplayName }}</dd>
                  </dl>
                  <v-chip
                    v-if="item.includesUserAccountDeletion"
                    class="mt-3"
                    color="warning"
                    size="small"
                    variant="tonal"
                  >
                    アカウント削除対象あり
                  </v-chip>
                </v-card-text>
              </v-card>
            </div>
          </template>

          <v-divider v-if="loaded" />
          <v-card-actions v-if="loaded" class="justify-end">
            <v-btn
              :disabled="loading || !hasPreviousPage"
              prepend-icon="mdi-chevron-left"
              variant="text"
              @click="loadPrevious"
            >
              前へ
            </v-btn>
            <v-btn
              :disabled="loading || !hasNextPage"
              append-icon="mdi-chevron-right"
              variant="text"
              @click="loadNext"
            >
              次へ
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.lifecycle-history-details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
}

.lifecycle-history-details dt {
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 500;
}

.lifecycle-history-details dd {
  margin: 0;
}
</style>
