<script setup>
/*****************************************************************************
 * @file ./components/Company/Table/BaseInfo.vue
 * @description 会社の基本情報表示テーブル
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  companyName: { type: String, default: "" },
  companyNameKana: { type: String, default: "" },
  tel: { type: String, default: "" },
  fax: { type: String, default: "" },
  fullAddress: { type: String, default: "" },
});
const props = useDefaults(_props, "CompanyTableBaseInfo");
</script>

<template>
  <v-table>
    <tbody>
      <tr>
        <td>会社名</td>
        <td>{{ props.companyName }}</td>
      </tr>
      <tr>
        <td>会社名（カナ）</td>
        <td>{{ props.companyNameKana }}</td>
      </tr>
      <tr>
        <td>住所</td>
        <td>{{ props.fullAddress }}</td>
      </tr>
      <tr>
        <td>電話番号</td>
        <td>{{ props.tel }}</td>
      </tr>
      <tr>
        <td>FAX番号</td>
        <td>{{ props.fax }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
