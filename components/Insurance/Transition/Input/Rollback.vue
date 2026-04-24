<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Input/Rollback.vue
 * @description 保険加入状態復元用入力コンポーネント
 * @note `AirItemManager` の `customInput` として利用
 *****************************************************************************/
import { computed } from "vue";
import { useDefaults } from "vuetify";
import { INSURANCE_STATUS_VALUES as STATUS } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // Insurance インスタンス
  componentAttrs: { type: Object, default: () => ({}) }, // AirItemManager の スロットプロパティから提供されるコンポーネント属性
  updateProperties: { type: Function, required: true }, // AirItemManager の スロットプロパティから提供されるプロパティ更新関数
});
const props = useDefaults(_props, "InsuranceTransitionInputRollback");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const latestStatus = computed(() => {
  if (props.item.history.length === 0) {
    return null;
  }
  return props.item.history[props.item.history.length - 1];
});

const currentStatusInfo = computed(() => {
  const statusObj = Object.values(STATUS).find(
    (s) => s.value === props.item.status,
  );
  return {
    label: statusObj?.title || "不明",
    color: getStatusColor(props.item.status),
  };
});

const restoredStatusInfo = computed(() => {
  if (!latestStatus.value) return null;
  const statusObj = Object.values(STATUS).find(
    (s) => s.value === latestStatus.value.status,
  );
  return {
    label: statusObj?.title || "不明",
    color: getStatusColor(latestStatus.value.status),
  };
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function getStatusColor(status) {
  switch (status) {
    case STATUS.ENROLLED.value:
      return "success";
    case STATUS.EXEMPT.value:
      return "warning";
    case STATUS.NOT_ENROLLED.value:
      return "grey";
    default:
      return "grey";
  }
}

function formatDate(date) {
  if (!date) return "-";
  if (!(date instanceof Date)) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
</script>

<template>
  <v-row v-if="latestStatus">
    <v-col cols="12">
      <v-alert type="info" variant="tonal">
        <div class="d-flex align-center">
          <v-icon class="mr-2">mdi-restore</v-icon>
          <div>
            <div class="font-weight-bold">保険加入状態の復元処理</div>
            <div class="text-caption">
              履歴から最新の状態（{{
                props.item.history.length
              }}件目）を復元します
            </div>
          </div>
        </div>
      </v-alert>
    </v-col>

    <!-- 現在の状態 -->
    <v-col cols="12" md="6">
      <v-card elevation="2" class="h-100">
        <v-card-title class="bg-grey-lighten-3 d-flex align-center">
          <v-icon class="mr-2" color="grey-darken-2">mdi-clock-outline</v-icon>
          現在の状態
        </v-card-title>
        <v-card-text>
          <v-list density="compact" class="pa-0">
            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-circle-outline</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                状態
              </v-list-item-title>
              <template #append>
                <v-chip
                  :color="currentStatusInfo.color"
                  size="small"
                  variant="flat"
                >
                  {{ currentStatusInfo.label }}
                </v-chip>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-calendar</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                資格取得日
              </v-list-item-title>
              <template #append>
                <span class="font-weight-medium">
                  {{ formatDate(props.item.enrollmentDateAt) }}
                </span>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-card-account-details</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                被保険者番号
              </v-list-item-title>
              <template #append>
                <span class="font-weight-medium">
                  {{ props.item.number || "-" }}
                </span>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-progress-clock</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                手続き中
              </v-list-item-title>
              <template #append>
                <v-chip
                  :color="props.item.isProcessing ? 'warning' : 'success'"
                  size="small"
                  variant="flat"
                >
                  {{ props.item.isProcessing ? "はい" : "いいえ" }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- 復元後の状態 -->
    <v-col cols="12" md="6">
      <v-card elevation="2" class="h-100" color="success" variant="outlined">
        <v-card-title class="bg-success-lighten-5 d-flex align-center">
          <v-icon class="mr-2" color="success">mdi-restore-alert</v-icon>
          復元後の状態
        </v-card-title>
        <v-card-text>
          <v-list density="compact" class="pa-0">
            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-circle-outline</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                状態
              </v-list-item-title>
              <template #append>
                <v-chip
                  :color="restoredStatusInfo.color"
                  size="small"
                  variant="flat"
                >
                  {{ restoredStatusInfo.label }}
                </v-chip>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-calendar</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                資格取得日
              </v-list-item-title>
              <template #append>
                <span class="font-weight-medium">
                  {{ formatDate(latestStatus.enrollmentDateAt) }}
                </span>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-card-account-details</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                被保険者番号
              </v-list-item-title>
              <template #append>
                <span class="font-weight-medium">
                  {{ latestStatus.number || "-" }}
                </span>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item>
              <template #prepend>
                <v-icon size="small">mdi-progress-clock</v-icon>
              </template>
              <v-list-item-title class="text-caption text-grey-darken-1">
                手続き中
              </v-list-item-title>
              <template #append>
                <v-chip color="success" size="small" variant="flat">
                  いいえ
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12">
      <v-alert type="warning" variant="tonal" density="compact">
        <div class="text-caption">
          <v-icon size="small" class="mr-1">mdi-information</v-icon>
          この操作により、履歴から1件削除され、上記の状態に復元されます。
        </div>
      </v-alert>
    </v-col>
  </v-row>

  <!-- 現在の状態が遷移条件を満たしていない場合 -->
  <v-row v-else>
    <v-col cols="12">
      <v-alert type="error" variant="tonal">
        <div class="d-flex align-center">
          <v-icon class="mr-2">mdi-alert-circle</v-icon>
          <div>
            <div class="font-weight-bold">復元できません</div>
            <div class="text-caption">
              履歴が存在しないか、現在の状態が遷移条件を満たしていません。
            </div>
          </div>
        </div>
      </v-alert>
    </v-col>
  </v-row>
</template>
