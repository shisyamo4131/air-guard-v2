<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Card/index.vue
 * @description 取極め情報表示コンポーネント
 * @author shisyamo4131
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/** SETUP PROPS */
const _props = defineProps({
  agreement: { type: Object, default: null },
  isSelected: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementCard");

const { label, formatted, dayType, shiftType } = useIndex(props);
</script>

<template>
  <v-card prepend-icon="mdi-file-document-outline">
    <!-- タイトル -->
    <template #title>
      <span class="text-subtitle-1">{{ label }}</span>
    </template>

    <!-- 選択中アイコン -->
    <template v-if="props.isSelected" #append>
      <v-chip
        prepend-icon="mdi-check-circle-outline"
        text="選択中"
        color="info"
        label
        density="compact"
      />
    </template>

    <!-- 単価情報テーブル -->
    <v-table density="compact">
      <tbody>
        <tr>
          <td>区分</td>
          <td>
            <DayTypeChip :day-type="dayType" label density="compact" />
          </td>
          <td>
            <ShiftTypeChip :shift-type="shiftType" label density="compact" />
          </td>
        </tr>
        <tr>
          <td>基本</td>
          <td>{{ formatted.unitPriceBase }}</td>
          <td>{{ formatted.overTimeUnitPriceBase }}</td>
        </tr>
        <tr>
          <td>資格</td>
          <td>{{ formatted.unitPriceQualified }}</td>
          <td>{{ formatted.overTimeUnitPriceQualified }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-card>
</template>

<style scoped>
td:nth-child(2),
td:nth-child(3) {
  text-align: center;
}
</style>
