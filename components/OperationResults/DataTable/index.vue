<script setup>
/*****************************************************************************
 * @file ./components/OperationResults/DataTable/index.vue
 * @description A data-table component to display `OperationResult` documents.
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
const props = useDefaults(_props, "OperationResultsDataTable");
const emit = defineEmits([]);
/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("OperationResultsDataTable");
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
      value: (item) => cachedSites.value?.[item.siteId]?.name || "...loading",
    },
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
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-data-table>
</template>
