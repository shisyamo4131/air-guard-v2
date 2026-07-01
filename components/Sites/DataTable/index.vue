<script setup>
/*****************************************************************************
 * @file ./components/Sites/DataTable/index.vue
 * @description A data table component of `Sites`.
 * @extends AirDataTable
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SitesDataTable", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  mobileBreakpoint: { type: String, default: "md" },
  sortBy: {
    type: Array,
    default: () => [{ key: "code", order: "desc" }],
  },
});
const props = useDefaults(_props, "SitesDataTable");
const emit = defineEmits([]);

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchCustomerComposable } = useFetch("SiteDataTable");
const { cachedCustomers } = fetchCustomerComposable;

/*****************************************************************************
 * SETUP CONSTANTS COMPOSABLE
 *****************************************************************************/
const { SECURITY_TYPE } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const headers = computed(() => {
  return [
    { title: "現場コード", key: "code", width: "180px" },
    { title: "現場名", key: "name" },
    {
      title: "警備種別",
      key: "securityType",
      value: (item) => SECURITY_TYPE.value[item.securityType]?.title || "ERROR",
    },
    {
      title: "工期",
      key: "constructionPeriod",
      value: (item) => {
        const start = item.constructionPeriodStartAt
          ? new Date(item.constructionPeriodStartAt).toLocaleDateString()
          : "未設定";
        const end = item.constructionPeriodEndAt
          ? new Date(item.constructionPeriodEndAt).toLocaleDateString()
          : "未設定";
        return `${start} ~ ${end}`;
      },
    },
  ];
});
</script>

<template>
  <air-data-table v-bind="{ ...props, ...$attrs }" :headers="headers">
    <!-- 現場名の下には取引先名を表示 -->
    <template #[`item.name`]="{ item }">
      <div>
        <div>{{ item.displayName }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ cachedCustomers[item.customerId]?.abbreviation || "...loading" }}
        </div>
      </div>
    </template>
  </air-data-table>
</template>
