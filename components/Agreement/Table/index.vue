<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Table/index.vue
 * @description 単一取極め情報表示用テーブルコンポーネント
 * @author shisyamo4131
 *
 * @property {Agreement} agreement - 表示する取極め情報
 * @property {boolean} isValid - 取極めが現在適用中かどうか
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { AgreementV2, CutoffDate } from "@/schemas";
import ValidChip from "./ValidChip.vue";

/*****************************************************************************
 * SETUP PROPS
 *****************************************************************************/
const _props = defineProps({
  agreement: { type: Object, required: true },
  isValid: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementTable");

/*****************************************************************************
 * DEFINE CONSTANTS
 *****************************************************************************/
const dayTypes = Object.keys(AgreementV2.DAY_TYPE).map((key) => {
  return {
    value: key,
    title: AgreementV2.DAY_TYPE[key].title,
  };
});

/*****************************************************************************
 * SETUP STATES & COMPUTED PROPERTIES
 *****************************************************************************/
const tab = Vue.ref("WEEKDAY");

/**
 * 適用開始日ラベル
 */
const startDateLabel = computed(() => {
  const startDate = dayjs(props.agreement.dateAt)
    .tz("Asia/Tokyo")
    .format("YYYY年MM月DD日");
  return `${startDate}～`;
});

/**
 * 時間ラベル
 */
const timeLabel = computed(() => {
  const startTime = props.agreement.startTime || "N/A";
  const endTime = props.agreement.endTime || "N/A";
  return `${startTime} ～ ${endTime}`;
});

/**
 * 請求単位ラベル
 */
const billingUnitTypeLabel = computed(() => {
  return AgreementV2.BILLING_UNIT_TYPE[props.agreement.billingUnitType].title;
});

/*****************************************************************************
 * DEFINE FUNCTIONS
 *****************************************************************************/
/**
 * 価格ラベルを返す関数
 * @param dayType
 * @param shiftType
 * @param isQualified
 * @param isBase
 */
function priceLabel(dayType, isQualified, isBase) {
  const priceType = isBase ? "unitPrice" : "overtimeUnitPrice";
  const qualificationType = isQualified ? "Qualified" : "Base";
  if (!props.agreement.rates[dayType]) {
    console.warn(`Agreement does not have data for dayType: ${dayType}`);
    console.warn("Agreement data:", props.agreement);
    return "N/A";
  }
  const price =
    props.agreement.rates[dayType][`${priceType}${qualificationType}`];
  return price.toLocaleString();
}
</script>

<template>
  <div>
    <!-- 適用開始日、締日、請求単位 -->
    <v-table density="compact">
      <tbody>
        <tr>
          <th>適用開始</th>
          <td>
            <div class="d-flex flex-grow-1 align-center justify-end">
              <ValidChip v-if="props.isValid" />
              {{ startDateLabel }}
            </div>
          </td>
        </tr>
        <tr>
          <th>時間</th>
          <td>
            <div class="d-flex flex-grow-1 align-center justify-end">
              {{ timeLabel }}
            </div>
          </td>
        </tr>
        <tr>
          <th>実働・休憩</th>
          <td>
            <div class="d-flex flex-grow-1 align-center justify-end">
              {{
                `${props.agreement.regulationWorkMinutes}分 / ${props.agreement.breakMinutes}分`
              }}
            </div>
          </td>
        </tr>
        <tr>
          <th>締日・請求単位</th>
          <!-- Agreement.cutoffDate-->
          <td style="text-align: right">
            {{
              `${CutoffDate.getDisplayText(props.agreement.cutoffDate)} / ${billingUnitTypeLabel}`
            }}
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-divider />
    <v-tabs v-model="tab" center-active grow show-arrows density="compact">
      <v-tab
        v-for="dayType in dayTypes"
        :key="dayType.value"
        :value="dayType.value"
        >{{ dayType.title }}</v-tab
      >
    </v-tabs>
    <v-divider />
    <v-tabs-window v-model="tab">
      <v-tabs-window-item
        v-for="dayType in dayTypes"
        :key="dayType.value"
        :value="dayType.value"
      >
        <v-table class="prices-table" density="compact">
          <thead>
            <tr>
              <th></th>
              <th>基本単価</th>
              <th>残業単価</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>通常</th>
              <td>
                <div>
                  {{ priceLabel(dayType.value, false, true) }}
                </div>
              </td>
              <td>
                <div>
                  {{ priceLabel(dayType.value, false, false) }}
                </div>
              </td>
            </tr>
            <tr>
              <th>資格者</th>
              <td>
                <div>
                  {{ priceLabel(dayType.value, true, true) }}
                </div>
              </td>
              <td>
                <div>
                  {{ priceLabel(dayType.value, true, false) }}
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>

<style scoped>
.prices-table thead tr th {
  text-align: center !important;
}

.prices-table tbody tr td {
  text-align: center !important;
}
</style>
