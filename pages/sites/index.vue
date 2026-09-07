<script setup>
/*****************************************************************************
 * @file pages/sites/index.vue
 * @description 稼働中現場情報一覧ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { useFetch } from "@/composables/fetch/useFetch";
import { getSiteLifecyclePresentation } from "@/composables/domain/site/siteLifecyclePresentation";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import { useActiveSiteLiveRead } from "@/composables/dataLayers/site/useSiteUiReads";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "sites-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const search = ref("");
const selectedCustomerId = ref(null);
const selectedSecurityType = ref(null);
const filterDialog = ref(false);
const page = ref(1);

/*****************************************************************************
 * SETUP ROUTER COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP USE FETCH COMPOSABLE
 *****************************************************************************/
const { fetchCustomerComposable } = useFetch("SiteIndex", true);
const { fetchCustomer, cachedCustomersArray } = fetchCustomerComposable;
const { canWrite, isSaving } = useSiteActions();
const {
  errorMessage: siteErrorMessage,
  isLoaded: sitesLoaded,
  isLoading: sitesLoading,
  items: activeSites,
} = useActiveSiteLiveRead({
  onItem: (site) => {
    if (site?.customerId) fetchCustomer(site.customerId);
  },
});

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const filteredSites = computed(() => {
  const securityTypeIsMatched = (site) => {
    if (!selectedSecurityType.value) return true;
    return site.securityType === selectedSecurityType.value;
  };
  const customerIdIsMatched = (site) => {
    if (!selectedCustomerId.value) return true;
    return site.customerId === selectedCustomerId.value;
  };
  return activeSites.value
    .filter((site) => securityTypeIsMatched(site) && customerIdIsMatched(site))
    .sort((left, right) => {
      const leftEnded =
        getSiteLifecyclePresentation(left).label.startsWith("工期終了");
      const rightEnded =
        getSiteLifecyclePresentation(right).label.startsWith("工期終了");
      if (leftEnded !== rightEnded)
        return Number(leftEnded) - Number(rightEnded);
      return String(right.code || "").localeCompare(
        String(left.code || ""),
        "ja",
      );
    });
});

const confirmEditModel = computed({
  get() {
    return {
      customerId: selectedCustomerId.value,
      securityType: selectedSecurityType.value,
    };
  },
  set(value) {
    selectedCustomerId.value = value.customerId;
    selectedSecurityType.value = value.securityType;
  },
});

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
watch([search, selectedCustomerId, selectedSecurityType], () => {
  page.value = 1;
});
</script>

<template>
  <AppViewportContainer>
    <v-card class="fill-height d-flex flex-column" width="100%">
      <v-toolbar class="ps-4">
        <AtomsSearchTextField v-model="search" />
        <SiteCreateDialog
          v-if="canWrite"
          @created="(item) => router.push(`/sites/${item.docId}`)"
        >
          <template #activator="{ open }">
            <v-btn
              :disabled="isSaving"
              icon="mdi-plus"
              aria-label="現場を新規登録"
              title="現場を新規登録"
              @click="open"
            />
          </template>
        </SiteCreateDialog>

        <!-- フィルター用コンポーネント -->
        <v-dialog v-model="filterDialog" max-width="360px" persistent>
          <template #activator="{ props: activatorProps }">
            <v-btn
              v-bind="activatorProps"
              icon="mdi-filter"
              aria-label="現場の絞り込み条件を設定"
              title="現場の絞り込み条件を設定"
            />
          </template>
          <v-confirm-edit
            v-model="confirmEditModel"
            @save="filterDialog = false"
            @cancel="filterDialog = false"
          >
            <template #default="{ model: proxyModel, actions }">
              <v-card prepend-icon="mdi-filter">
                <template #title>
                  <div class="text-h6">絞り込み条件設定</div>
                </template>
                <template #append>
                  <v-btn
                    icon="mdi-close"
                    size="small"
                    aria-label="絞り込み条件を閉じる"
                    title="絞り込み条件を閉じる"
                    @click="filterDialog = false"
                  />
                </template>
                <template #text>
                  <SecurityTypeSelect
                    v-model="proxyModel.value.securityType"
                    clearable
                    variant="outlined"
                    flat
                  />
                  <CustomerSelect
                    v-model="proxyModel.value.customerId"
                    clearable
                    :items="cachedCustomersArray"
                    variant="outlined"
                    flat
                    hide-details
                  />
                </template>
                <v-divider />
                <template #actions>
                  <component :is="actions" />
                </template>
              </v-card>
            </template>
          </v-confirm-edit>
        </v-dialog>
      </v-toolbar>
      <v-alert
        v-if="siteErrorMessage"
        type="error"
        variant="tonal"
        class="mx-4 mb-3"
      >
        {{ siteErrorMessage }}
      </v-alert>
      <v-alert
        v-else-if="sitesLoaded && filteredSites.length === 0"
        type="info"
        variant="tonal"
        class="mx-4 mb-3"
      >
        条件に一致する稼働中の現場はありません。
      </v-alert>
      <SitesDataTable
        v-model:page="page"
        class="flex-grow-1 overflow-hidden"
        :items="filteredSites"
        :search="search"
        :sort-by="[]"
        :items-per-page="20"
        :loading="sitesLoading"
        :edit-icon="canWrite ? 'mdi-pencil' : 'mdi-eye'"
        @click:update="(item) => router.push(`/sites/${item.docId}`)"
      />
      <!-- 2026-06-30 コメントアウト -->
      <!-- モバイル表示を兼ねて Iterator コンポーネントを利用していたが -->
      <!-- ユーザビリティを考慮した UI の決定が難しいため、一旦 DataTable を使うこととする。 -->
      <!-- <SitesIterator
            class="flex-grow-1"
            grid
            :sites="slotProps.items"
            :hide-default-footer="slotProps.hideDefaultFooter"
            :items-per-page="slotProps.itemsPerPage"
            show-create
            show-detail
            @click:create="() => slotProps.toCreate()"
            @click:detail="(item) => router.push(`/sites/${item.docId}`)"
          /> -->
    </v-card>
  </AppViewportContainer>
</template>
