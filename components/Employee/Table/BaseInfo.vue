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
  nationality: { type: String, default: "" }, // 国籍
  isForeigner: { type: Boolean, default: false }, // 外国人かどうか
  foreignName: { type: String, default: "" }, // 外国人氏名
  residenceStatus: { type: String, default: "" }, // 在留資格
  periodOfStay: { type: Object, default: null }, // 在留期間満了日
  remarks: { type: String, default: "" }, // 備考
});
const props = useDefaults(_props, "EmployeeTableBaseInfo");
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
        <td>国籍</td>
        <td>{{ props.nationality }}</td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>外国人氏名</td>
        <td>{{ props.foreignName }}</td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>在留資格</td>
        <td>{{ props.residenceStatus }}</td>
      </tr>
      <tr v-if="props.isForeigner">
        <td>在留期間</td>
        <td>{{ props.periodOfStay }}</td>
      </tr>
      <tr>
        <td>備考</td>
        <td>{{ props.remarks }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
