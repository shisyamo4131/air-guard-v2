<script setup>
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useOperationResultRegister } from "@/composables/dataLayers/useOperationResultRegister";
import { useOperationResultRegisterManager } from "@/composables/useOperationResultRegisterManager";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
/** data layer composable */
const { docs, cachedSites, cachedEmployees, cachedOutsourcers } =
  useOperationResultRegister();

/** manager composable */
const manager = useOperationResultRegisterManager({
  docs,
  cachedSites,
});

/** status updater composable */
const statusUpdater = useArrangementNotificationManager();

/*****************************************************************************
 * HELPER FUNCTIONS
 *****************************************************************************/
function dateFormat(date) {
  return dayjs(date).locale("ja").format("YYYY年MM月DD日(ddd)");
}

function shiftTypeLabel(shiftType) {
  return SiteOperationSchedule.SHIFT_TYPE[shiftType]?.title || "";
}

function getOvertimeWorkMinutes(worker, agreement, notification) {
  if (!agreement) return "-";
  const totalMinutes =
    notification?.totalWorkMinutes ?? worker?.totalWorkMinutes;
  return totalMinutes ? totalMinutes - agreement.regulationWorkMinutes : "-";
}

function getWorkerDisplayName(workerId) {
  return (
    cachedEmployees.value[workerId]?.displayName ||
    cachedOutsourcers.value[workerId]?.displayName ||
    "loading..."
  );
}

function formatTimeRange(start, end) {
  return `${start || ""} - ${end || ""}`;
}

function formatAgreementDetails(agreement) {
  if (!agreement) return "";
  return [
    shiftTypeLabel(agreement.shiftType),
    formatTimeRange(agreement.startTime, agreement.endTime),
    `(実働: ${agreement.regulationWorkMinutes || 0}分)`,
    `(休憩: ${agreement.breakMinutes || 0}分)`,
  ].join(" ");
}

function getWorkerTimeInfo(worker) {
  const notification = manager.getNotification(worker.notificationKey);
  return {
    startTime: notification?.actualStartTime || worker?.startTime || "",
    endTime: notification?.actualEndTime || worker?.endTime || "",
    breakMinutes: notification?.actualBreakMinutes || worker?.breakMinutes || 0,
    isStartNextDay: notification?.actualIsStartNextDay,
  };
}
</script>

<template>
  <air-array-manager v-bind="manager.attrs.value">
    <template #[`item.dateAt`]="{ item }">
      <div>{{ dayjs(item.dateAt).format("MM月DD日(ddd)") }}</div>
    </template>
    <template #[`item.siteId`]="{ item }">
      <div v-if="cachedSites[item.siteId]">
        <div>{{ cachedSites[item.siteId].name }}</div>
        <div>
          {{ cachedSites[item.siteId]?.customer?.name || "取引先未設定" }}
        </div>
      </div>
      <v-progress-circular v-else indeterminate size="small" />
    </template>
    <template #input="{ item }">
      <v-table>
        <tbody>
          <!-- 基本情報 -->
          <tr>
            <td>日付</td>
            <td>{{ dateFormat(item?.dateAt) }}</td>
          </tr>

          <!-- TR: 取引先 -->
          <tr>
            <td>取引先</td>

            <!-- 仮登録現場の場合はその旨を表示 -->
            <!-- NOTE: 仮登録現場の場合は稼働実績（OperationResult）登録不可 -->
            <!-- NOTE: 将来ここから直接取引先を設定できるようにしたいが、cachedSites にキャッシュされている現場情報はパッシブに更新されないので注意 -->
            <td v-if="cachedSites[item.siteId]?.isTemporary">
              <span class="text-warning">
                取引先未設定の為、稼働実績として登録できません。
              </span>
            </td>

            <!-- 本登録現場であれば取引先名を表示 -->
            <td v-else>{{ cachedSites[item.siteId]?.customer?.name }}</td>
          </tr>

          <!-- TR: 現場名 -->
          <tr>
            <td>現場名</td>
            <td>{{ cachedSites[item.siteId]?.name || "loading..." }}</td>
          </tr>

          <tr>
            <td>取極め</td>

            <!-- 取極めが存在すればフォーマットして出力 -->
            <td v-if="manager.agreement.value">
              {{ formatAgreementDetails(manager.agreement.value) }}
            </td>

            <!-- 取極めが存在しない場合は警告表示 -->
            <!-- NOTE: 取極めが存在しなくても稼働実績（OperationResult）の登録は可能 -->
            <td v-else>
              <v-icon class="mr-1" color="warning" size="small">
                mdi-alert-circle
              </v-icon>
              <span class="text-warning">
                該当する取極めは登録されていません。
              </span>
            </td>
          </tr>

          <!-- TR: 当日時間 -->
          <tr>
            <td>当日時間</td>
            <td>
              {{ shiftTypeLabel(item?.shiftType) }}
              {{ formatTimeRange(item?.startTime, item?.endTime) }}
            </td>
          </tr>

          <!-- TR: 作業員リスト -->
          <tr>
            <td>作業員</td>
            <td>
              <v-table>
                <tbody>
                  <tr v-for="worker in item?.workers || []" :key="worker.id">
                    <!-- 作業員名 -->
                    <td>
                      <AtomsIconsHasLicense
                        v-if="
                          manager.getNotification(worker.notificationKey)
                            ?.isQualified
                        "
                      />
                      <AtomsIconsIsOjt
                        v-if="
                          manager.getNotification(worker.notificationKey)?.isOjt
                        "
                      />
                      {{ getWorkerDisplayName(worker.id) }}
                    </td>

                    <!-- 勤務時間 -->
                    <td>
                      <div
                        class="d-flex align-center"
                        style="position: relative"
                      >
                        <AtomsChipsIsStartNextDay
                          v-if="getWorkerTimeInfo(worker).isStartNextDay"
                          style="position: absolute; top: -10px"
                        />
                        {{ getWorkerTimeInfo(worker).startTime }}
                        -
                        {{ getWorkerTimeInfo(worker).endTime }}
                        (休憩: {{ getWorkerTimeInfo(worker).breakMinutes }}分 /
                        残業:
                        {{
                          getOvertimeWorkMinutes(
                            worker,
                            manager.agreement.value,
                            manager.getNotification(worker.notificationKey),
                          )
                        }}分)
                      </div>
                    </td>

                    <!-- ステータス -->
                    <td>
                      <v-chip
                        v-if="!manager.getNotification(worker.notificationKey)"
                        color="error"
                        prepend-icon="mdi-alert"
                        size="small"
                      >
                        配置通知がありません
                      </v-chip>
                      <ArrangementNotificationChip
                        v-else
                        :notification="
                          manager.getNotification(worker.notificationKey)
                        "
                        @click="
                          statusUpdater.toUpdate(
                            manager.getNotification(worker.notificationKey),
                          )
                        "
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- アクション・アラート -->
      <OrganismsArrangementNotificationStatusUpdater
        v-bind="statusUpdater.attrs.value"
      />

      <!-- 配置通知が作成されていない作業員がいる場合の警告 -->
      <v-container v-if="!manager.hasNotifications.value">
        <v-banner color="error" icon="mdi-alert">
          <v-banner-text>
            配置通知が作成されていない作業員がいます。「作成」ボタンを押すと配置通知を作成します。
          </v-banner-text>
          <template #actions>
            <v-btn @click="manager.notify">作成</v-btn>
          </template>
        </v-banner>
      </v-container>

      <!-- 下番実績がない従業員がいる場合の警告 -->
      <!-- NOTE: 稼働実績の作成自体は可能 -> 現場稼働予定の定時設定で稼働実績が作成される -->
      <v-container v-else-if="!manager.isAllLeaved.value">
        <AtomsAlertsWarn
          >下番実績のない作業員がいます。残業なしの定時で稼働実績が作成されます。</AtomsAlertsWarn
        >
      </v-container>
    </template>
  </air-array-manager>
</template>
