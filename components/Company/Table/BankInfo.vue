<script setup>
/*****************************************************************************
 * @file ./components/Company/Table/BankInfo.vue
 * @description 会社の口座情報表示テーブル
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  bankName: { type: String, default: "" },
  branchName: { type: String, default: "" },
  accountType: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  accountHolder: { type: String, default: "" },
});
const props = useDefaults(_props, "CompanyTableBankInfo");
</script>

<template>
  <v-table>
    <tbody>
      <tr>
        <td>銀行名</td>
        <td>{{ props.bankName }}</td>
      </tr>
      <tr>
        <td>支店名</td>
        <td>{{ props.branchName }}</td>
      </tr>
      <tr>
        <td>口座種別</td>
        <td>{{ props.accountType }}</td>
      </tr>
      <tr>
        <td>口座番号</td>
        <td>{{ props.accountNumber }}</td>
      </tr>
      <tr>
        <td>口座名義</td>
        <td>{{ props.accountHolder }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
