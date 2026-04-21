<script setup>
/*****************************************************************************
 * @file ./components/Company/Table/BaseInfo.vue
 * @description 会社の基本情報表示テーブル
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  code: { type: String, default: "" }, // 従業員コード
  fullName: { type: String, default: "" }, // 氏名
  fullNameKana: { type: String, default: "" }, // 氏名（カナ）
  displayName: { type: String, default: "" }, // 表示名
  gender: { type: String, default: "" }, // 性別
  dateOfBirth: { type: Object, default: null }, // 生年月日
  dateOfHire: { type: Object, default: null }, // 入社日
  title: { type: String, default: "" }, // 肩書
  zipcode: { type: String, default: "" }, // 郵便番号
  fullAddress: { type: String, default: "" }, // 住所（都道府県、市区町村、町域・番地を結合したもの）
  building: { type: String, default: "" }, // 建物名
  mobile: { type: String, default: "" }, // 携帯電話番号
  email: { type: String, default: "" }, // メールアドレス
  remarks: { type: String, default: "" }, // 備考
});
const props = useDefaults(_props, "EmployeeTableBaseInfo");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedDateOfBirth = computed(() => {
  return props.dateOfBirth ? dayjs(props.dateOfBirth).format("YYYY/MM/DD") : "";
});
const formattedDateOfHire = computed(() => {
  return props.dateOfHire ? dayjs(props.dateOfHire).format("YYYY/MM/DD") : "";
});
</script>

<template>
  <v-table>
    <tbody>
      <tr>
        <td>従業員コード</td>
        <td>{{ props.code }}</td>
      </tr>
      <tr>
        <td>従業員名</td>
        <td>{{ props.fullName }}</td>
      </tr>
      <tr>
        <td>従業員名（カナ）</td>
        <td>{{ props.fullNameKana }}</td>
      </tr>
      <tr>
        <td>性別</td>
        <td>{{ props.gender }}</td>
      </tr>
      <tr>
        <td>生年月日</td>
        <td>{{ formattedDateOfBirth }}</td>
      </tr>
      <tr>
        <td>郵便番号</td>
        <td>{{ props.zipcode }}</td>
      </tr>
      <tr>
        <td>住所</td>
        <td>{{ props.fullAddress }}</td>
      </tr>
      <tr>
        <td>建物名</td>
        <td>{{ props.building }}</td>
      </tr>
      <tr>
        <td>携帯番号</td>
        <td>{{ props.mobile }}</td>
      </tr>
      <tr>
        <td>メールアドレス</td>
        <td>{{ props.email }}</td>
      </tr>
      <tr>
        <td>入社日</td>
        <td>{{ formattedDateOfHire }}</td>
      </tr>
      <tr>
        <td>肩書</td>
        <td>{{ props.title }}</td>
      </tr>
      <tr>
        <td>備考</td>
        <td>{{ props.remarks }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
