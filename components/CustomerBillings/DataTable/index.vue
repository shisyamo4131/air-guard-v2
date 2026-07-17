<script setup>
/*****************************************************************************
 * @file ./components/CustomerBillings/DataTable/index.vue
 * @description A data table component of customer `Billing` documents.
 * @extends AirDataTable
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { Customer, Site } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";
import { formatCurrency } from "@/utils/formats/util";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomerBillingsDataTable", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  items: { type: Array, default: () => [] },
  mobileBreakpoint: { type: String, default: "md" },
  groupBy: {
    type: Array,
    default: () => [{ key: "groupKey", order: "asc" }],
  },
  sortBy: {
    type: Array,
    default: () => [{ key: "billingDateAt", order: "desc" }],
  },
});
const props = useDefaults(_props, "CustomerBillingsDataTable");
const emit = defineEmits([
  "click:edit",
  "click:billing-pdf",
  "click:consolidated-billing-pdf",
  "click:csv",
]);

/*****************************************************************************
 * SETUP FETCH COMPOSABLES
 *****************************************************************************/
const { fetchCustomerComposable, fetchSiteComposable } = useFetch(
  "CustomerBillingsDataTable",
);
const { cachedCustomers, fetchCustomer } = fetchCustomerComposable;
const { cachedSites, fetchSite } = fetchSiteComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Billingへ表示用の取引先・現場、取引先＋請求締日のグループ情報を付加します。
 */
const enrichedItems = computed(() =>
  props.items.map((billing) => {
    const customer =
      cachedCustomers.value[billing.customerId] || new Customer();
    const site = cachedSites.value[billing.siteId] || new Site();
    const billingDate = billing.billingDate;

    return {
      ...billing,
      customer,
      site,
      groupKey: `${billing.customerId}_${billingDate}`,
      groupLabel: `${customer.code}: ${customer.name} / 締日: ${billingDate}`,
    };
  }),
);

/**
 * `useCustomerBillingsManager` が提供していた請求一覧の列定義です。
 */
const headers = computed(() => [
  {
    title: "請求日",
    key: "billingDateAt",
    value: (item) => dayjs(item.billingDateAt).format("MM月DD日(ddd)"),
  },
  { title: "現場", key: "site.name" },
  {
    title: "実績数",
    key: "operationCount",
    value: (item) => (item.operationResults?.length ?? 0).toLocaleString(),
    align: "center",
  },
  {
    title: "売上額",
    key: "subtotal",
    value: (item) => formatCurrency(item.subtotal),
    align: "end",
  },
  {
    title: "消費税額",
    key: "taxAmount",
    value: (item) => formatCurrency(item.taxAmount),
    align: "end",
  },
  {
    title: "請求額",
    key: "totalAmount",
    value: (item) => formatCurrency(item.totalAmount),
    align: "end",
  },
  {
    title: "入金予定日",
    key: "paymentDueDate",
    value: (item) =>
      item.paymentDueDate
        ? dayjs(item.paymentDueDate).format("MM月DD日(ddd)")
        : "未設定",
  },
]);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Vuetifyのグループ情報から、親へ通知するBilling配列を取り出します。
 */
function getGroupBillings(groupItem) {
  return groupItem.items.map(({ raw }) => raw);
}

/**
 * グループ内の先頭のBillingから表示用ラベルを取得します。
 */
function getGroupLabel(groupItem) {
  return groupItem.items[0]?.raw?.groupLabel ?? groupItem.value;
}

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.items,
  (newItems) => {
    fetchCustomer(newItems);
    fetchSite(newItems);
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <air-data-table
    v-bind="{ ...props, ...$attrs }"
    :headers="headers"
    hide-search
    :items="enrichedItems"
  >
    <!-- 取引先・請求締日ごとの標準グループヘッダー -->
    <template #group-header="scope">
      <tr>
        <td :colspan="headers.length + 1">
          <v-btn
            class="me-2"
            :icon="
              scope.isGroupOpen(scope.item)
                ? 'mdi-chevron-up'
                : 'mdi-chevron-down'
            "
            variant="text"
            size="small"
            @click="scope.toggleGroup(scope.item)"
          />
          <strong>{{ getGroupLabel(scope.item) }}</strong>
          <v-chip class="ml-2" size="small">
            {{ scope.item.items.length }}件
          </v-chip>
        </td>
        <td class="text-right">
          <v-btn
            icon="mdi-file-delimited-outline"
            size="small"
            title="CSV出力"
            aria-label="CSV出力"
            @click.stop="emit('click:csv', getGroupBillings(scope.item))"
          />
          <v-btn
            icon="mdi-file-pdf-box"
            size="small"
            class="ml-4"
            title="統合請求書PDF出力"
            aria-label="統合請求書PDF出力"
            @click.stop="
              emit(
                'click:consolidated-billing-pdf',
                getGroupBillings(scope.item),
              )
            "
          />
        </td>
      </tr>
    </template>

    <!-- 請求行ごとの標準アクション -->
    <template #[`item.actions`]="{ item }">
      <v-btn
        icon="mdi-pencil"
        size="small"
        title="請求詳細・編集"
        aria-label="請求詳細・編集"
        @click.stop="emit('click:edit', item)"
      />
      <v-btn
        icon="mdi-file-pdf-box"
        size="small"
        class="ml-2"
        title="請求書PDF出力"
        aria-label="請求書PDF出力"
        @click.stop="emit('click:billing-pdf', item)"
      />
    </template>
  </air-data-table>
</template>
