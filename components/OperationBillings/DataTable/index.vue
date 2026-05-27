<script setup>
/*****************************************************************************
 * @file ./components/OperationBillings/DataTable/index.vue
 * @description A data-table component to display `OperationBilling` documents.
 * @extends AirDataTable
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  sortBy: {
    type: Array,
    default: () => [
      { key: "date", order: "desc" },
      { key: "shiftType", order: "asc" },
    ],
  },
});
const props = useDefaults(_props, "OperationBillingsDataTable");
const emit = defineEmits([]);
/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("OperationBillingsDataTable");
const { cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const headers = computed(() => {
  return [
    { title: "日付", key: "date", width: 120 },
    { title: "勤務区分", key: "shiftType", width: 120 },
    {
      title: "現場",
      key: "siteId",
      // value: (item) => cachedSites.value?.[item.siteId]?.name || "...loading",
    },
    { title: "売上（税抜）", key: "salesAmount" },
    { title: "消費税額", key: "tax" },
    { title: "請求金額（税込）", key: "billingAmount" },
    { title: "請求月", key: "billingMonth" },
  ];
});
</script>

<template>
  <air-data-table
    v-bind="$attrs"
    :headers="headers"
    mobile-breakpoint="md"
    :sort-by="props.sortBy"
  >
    <template #[`item.shiftType`]="{ item }">
      <ShiftTypeChip :shift-type="item.shiftType" label size="small" />
    </template>

    <template #[`item.siteId`]="{ item }">
      <v-tooltip text="この稼働実績は請求不可能状態です。">
        <template #activator="{ props }">
          <v-icon
            v-if="!item.isBillable"
            v-bind="props"
            icon="mdi-alert"
            color="error"
            size="small"
          />
        </template>
      </v-tooltip>
      {{ cachedSites?.[item.siteId]?.name || "...loading" }}
    </template>
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-data-table>
</template>
