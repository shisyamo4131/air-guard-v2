<script setup>
/*****************************************************************************
 * @file ./components/Sites/DataTable/index.vue
 * @description A data table component of `Sites`.
 * @extends AirDataTable
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";
import { useConstants } from "@/composables/useConstants";
import { getSiteLifecyclePresentation } from "@/composables/domain/site/siteLifecyclePresentation";
import {
  formatSiteConstructionPeriod,
  getSiteCustomerLabel,
  getSitePresentationBadges,
} from "@/composables/domain/site/siteUiPresentation";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SitesDataTable", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  disabled: { type: Boolean, default: false },
  editIcon: { type: String, default: "mdi-pencil" },
  items: { type: Array, default: () => [] },
  mobileBreakpoint: { type: String, default: "md" },
  sortBy: {
    type: Array,
    default: () => [{ key: "code", order: "desc" }],
  },
});
const props = useDefaults(_props, "SitesDataTable");
const emit = defineEmits(["click:update"]);

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchCustomerComposable } = useFetch("SiteDataTable");
const { cachedCustomers, fetchCustomer } = fetchCustomerComposable;

/*****************************************************************************
 * SETUP CONSTANTS COMPOSABLE
 *****************************************************************************/
const { SECURITY_TYPE } = useConstants();

function lifecycleOf(item) {
  return getSiteLifecyclePresentation(item);
}

function badgesOf(item) {
  return getSitePresentationBadges(item);
}

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const headers = computed(() => {
  return [
    { title: "現場コード", key: "code", width: "180px" },
    { title: "現場名", key: "name" },
    { title: "状態", key: "lifecycle", sortable: false, width: "220px" },
    {
      title: "警備種別",
      key: "securityType",
      value: (item) => SECURITY_TYPE.value[item.securityType]?.title || "ERROR",
    },
    {
      title: "工期",
      key: "constructionPeriod",
      value: (item) => formatSiteConstructionPeriod(item),
    },
  ];
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.items,
  (newItems) => {
    newItems.forEach((item) => {
      if (item.customerId && !cachedCustomers[item.customerId]) {
        fetchCustomer(item.customerId);
      }
    });
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <air-data-table
    v-bind="{ ...props, ...$attrs }"
    :headers="headers"
    hide-search
    @click:update="emit('click:update', $event)"
  >
    <template #[`item.actions`]="{ item }">
      <v-btn
        :disabled="props.disabled"
        :icon="props.editIcon"
        size="small"
        variant="text"
        aria-label="現場詳細を表示"
        title="現場詳細を表示"
        @click="emit('click:update', item)"
      />
    </template>
    <!-- 現場名の下には取引先名を表示 -->
    <template #[`item.name`]="{ item }">
      <div>
        <div>{{ item.displayName }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ getSiteCustomerLabel(item, item.customerId ? cachedCustomers[item.customerId] : null) }}
        </div>
      </div>
    </template>
    <template #[`item.lifecycle`]="{ item }">
      <div class="d-flex ga-1 flex-wrap">
        <v-chip
          v-for="badge in badgesOf(item)"
          :key="badge.key"
          :color="badge.color"
          size="small"
          variant="tonal"
        >
          {{ badge.label }}
        </v-chip>
        <v-chip
          v-if="!badgesOf(item).some((badge) => badge.label === lifecycleOf(item).label)"
          :color="lifecycleOf(item).color"
          size="small"
          variant="outlined"
        >
          {{ lifecycleOf(item).label }}
        </v-chip>
        <v-chip
          v-if="lifecycleOf(item).automaticTerminationDate"
          size="small"
          variant="outlined"
        >
          自動終了予定 {{ lifecycleOf(item).automaticTerminationDate }}
        </v-chip>
      </div>
    </template>
  </air-data-table>
</template>
