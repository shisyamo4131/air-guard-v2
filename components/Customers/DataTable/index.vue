<script setup>
/*****************************************************************************
 * @file ./components/Customers/DataTable/index.vue
 * @description A data table component of `Customers`.
 * @extends AirDataTable
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "CustomersDataTable", inheritAttrs: false });

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
const props = useDefaults(_props, "CustomersDataTable");
const emit = defineEmits([]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const headers = computed(() => {
  return [
    { title: "コード", key: "code", width: "180px" },
    { title: "取引先名", key: "name" },
    { title: "所在地", key: "fullAddress" },
  ];
});
</script>

<template>
  <air-data-table v-bind="{ ...props, ...$attrs }" :headers="headers">
    <!-- 取引先名 & 支店名 -->
    <template #[`item.name`]="{ item }">
      <div>
        <div>{{ item.name }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ item.branchName }}
        </div>
      </div>
    </template>

    <!-- 所在地 & 建物名 -->
    <template #[`item.fullAddress`]="{ item }">
      <div>
        <div>{{ item.fullAddress }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ item.building }}
        </div>
      </div>
    </template>
  </air-data-table>
</template>
