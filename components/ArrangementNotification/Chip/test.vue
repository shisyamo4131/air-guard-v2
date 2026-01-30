<script setup>
/**
 * @file components/ArrangementNotification/chip/test.vue
 * @description ArrangementNotificationChip コンポーネントのテストページ
 */
import { ref, computed } from "vue";
import ArrangementNotificationChip from "./index.vue";
import { ArrangementNotification } from "@/schemas";
import { mockArrangementNotifications } from "@/mocks/arrangementNotifications.js";

/*****************************************************************************
 * INITIALIZE
 *****************************************************************************/
const statuses = Object.keys(ArrangementNotification.STATUS);
const sizes = ["x-small", "small", "default", "large", "x-large"];

/*****************************************************************************
 * CONTROL STATES
 *****************************************************************************/
const selectedNotificationIndex = ref(0);
const selectedNotification = computed(
  () => mockArrangementNotifications[selectedNotificationIndex.value],
);

const label = ref(true);
const size = ref("x-small");

// 通知選択用のオプション
const notificationOptions = mockArrangementNotifications.map(
  (notification, index) => ({
    title: `${notification.status} - ${notification.isEmployee ? "従業員" : "外注先"} (${notification.workerId})`,
    value: index,
  }),
);
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-6">ArrangementNotificationChip テスト</h1>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロールパネル</h2>

          <!-- プレビュー -->
          <div class="mb-4 pa-4 bg-grey-lighten-4 rounded">
            <h3 class="text-subtitle-2 mb-2">プレビュー</h3>
            <ArrangementNotificationChip
              :notification="selectedNotification"
              :label="label"
              :size="size"
            />
          </div>

          <!-- コントロール -->
          <v-row dense>
            <v-col cols="12">
              <v-select
                v-model="selectedNotificationIndex"
                :items="notificationOptions"
                label="配置通知を選択"
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
              <v-switch
                v-model="label"
                label="ラベル表示"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- ステータス一覧 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">ステータス一覧（モックデータ）</h2>
          <v-row>
            <v-col cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">仮配置（TEMPORARY）</h3>
              <div class="mb-2">
                <ArrangementNotificationChip />
              </div>
              <div class="text-caption text-grey">
                notification プロパティが指定されていない場合
              </div>
            </v-col>
            <v-col
              v-for="(notification, index) in mockArrangementNotifications"
              :key="notification.docId"
              cols="12"
              md="4"
            >
              <h3 class="text-subtitle-2 mb-2">
                {{ ArrangementNotification.STATUS[notification.status].title }}
                ({{ notification.status }})
              </h3>
              <div class="mb-2">
                <ArrangementNotificationChip :notification="notification" />
              </div>
              <div class="text-caption text-grey">
                {{ notification.isEmployee ? "従業員" : "外注先" }}:
                {{ notification.workerId }}
              </div>
              <div class="text-caption text-grey">
                {{ notification.startTime }} - {{ notification.endTime }}
              </div>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- サイズバリアント -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">サイズバリアント（モックデータ使用）</h2>
          <v-row>
            <v-col v-for="sizeItem in sizes" :key="sizeItem" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">
                {{ sizeItem.toUpperCase() }}
              </h3>
              <div class="d-flex flex-wrap gap-2">
                <ArrangementNotificationChip :size="sizeItem" />
                <ArrangementNotificationChip
                  v-for="notification in mockArrangementNotifications.slice(
                    0,
                    4,
                  )"
                  :key="notification.docId"
                  :notification="notification"
                  :size="sizeItem"
                />
              </div>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- ラベル表示の比較 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">ラベル表示の比較（モックデータ使用）</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">ラベルあり（label: true）</h3>
              <div class="d-flex flex-wrap gap-2">
                <ArrangementNotificationChip :label="true" />
                <ArrangementNotificationChip
                  v-for="notification in mockArrangementNotifications.slice(
                    0,
                    4,
                  )"
                  :key="notification.docId"
                  :notification="notification"
                  :label="true"
                />
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">ラベルなし（label: false）</h3>
              <div class="d-flex flex-wrap gap-2">
                <ArrangementNotificationChip :label="false" />
                <ArrangementNotificationChip
                  v-for="notification in mockArrangementNotifications.slice(
                    0,
                    4,
                  )"
                  :key="notification.docId"
                  :notification="notification"
                  :label="false"
                />
              </div>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 実用例 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">実用例（モックデータ使用）</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">リスト表示での使用例</h3>
              <v-list density="compact">
                <v-list-item
                  v-for="notification in mockArrangementNotifications.slice(
                    0,
                    5,
                  )"
                  :key="notification.docId"
                >
                  <v-list-item-title>
                    <div class="d-flex align-center">
                      <span class="mr-2">{{
                        notification.isEmployee ? "従業員" : "外注先"
                      }}</span>
                      <ArrangementNotificationChip
                        :notification="notification"
                        size="x-small"
                      />
                    </div>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">テーブル表示での使用例</h3>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>作業員</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="notification in mockArrangementNotifications.slice(
                      0,
                      5,
                    )"
                    :key="notification.docId"
                  >
                    <td>
                      {{ notification.isEmployee ? "従業員" : "外注先" }}
                    </td>
                    <td>
                      <ArrangementNotificationChip
                        :notification="notification"
                        size="x-small"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
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

.gap-2 {
  gap: 8px;
}
</style>
