<script>
/*****************************************************************************
 * @file ./components/Employee/Certifications/Table.vue
 * @description 従業員の保有資格を表示するテーブルコンポーネント
 *****************************************************************************/

/*****************************************************************************
 * 列のデフォルト定義
 *****************************************************************************/
const defaultHeaders = [
  { title: "資格名", key: "name" },
  { title: "取得日/有効期限", key: "issueDateAt" },
  { title: "番号/発行機関", key: "issuedBy" },
];
</script>

<script setup>
import dayjs from "dayjs";
import { useDefaults, useDisplay } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  headers: { type: Array, default: () => defaultHeaders },
  itemsPerPage: { type: Number, default: 5 },
  sortBy: { type: Array, default: () => [{ key: "name", order: "asc" }] },
});
const props = useDefaults(_props, "EmployeeCertificationsTable");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { mobile } = useDisplay();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const itemsPerPage = computed(() => {
  return mobile.value ? 1 : props.itemsPerPage;
});

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
function formatDate(date) {
  return date ? dayjs(date).format("YYYY年MM月DD日") : "-";
}
</script>

<template>
  <air-data-table
    :class="{ 'mobile-view': mobile }"
    :headers="props.headers"
    hide-search
    :hide-default-header="mobile"
    item-key="key"
    :items-per-page="itemsPerPage"
    :mobile="null"
    :sort-by="props.sortBy"
  >
    <template #[`item.issueDateAt`]="{ item }">
      <div class="d-flex flex-column">
        <div>{{ formatDate(item.issueDateAt) }}</div>
        <div>
          <small>
            {{ `有効期限: ${formatDate(item.expirationDateAt)}` }}
          </small>
        </div>
      </div>
    </template>
    <template #[`item.issuedBy`]="{ item }">
      <div class="d-flex flex-column">
        <div>{{ item.serialNumber }}</div>
        <small>{{ item.issuedBy }}</small>
      </div>
    </template>
  </air-data-table>
</template>

<style scoped>
.mobile-view :deep(.v-data-table-footer__items-per-page),
.mobile-view :deep(.v-data-table-footer__info) {
  display: none !important;
}
</style>
