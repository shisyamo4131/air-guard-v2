<script setup>
/*****************************************************************************
 * @file pages/sites/index.vue
 * @description 稼働中現場情報一覧ページ
 *****************************************************************************/
import { useRouter } from "vue-router";
import { useFetch } from "@/composables/fetch/useFetch";
import { getSiteLifecyclePresentation } from "@/composables/domain/site/siteLifecyclePresentation";
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

function handleBeforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return true;
  router.push(`/sites/${item.docId}`);
  return false;
}

/*****************************************************************************
 * SETUP USE FETCH COMPOSABLE
 *****************************************************************************/
const { fetchCustomerComposable } = useFetch("SiteIndex", true);
const { fetchCustomer, cachedCustomersArray } = fetchCustomerComposable;
const {
  errorMessage: siteErrorMessage,
  isLoaded: sitesLoaded,
  isLoading: sitesLoading,
  items: activeSites,
} = useActiveSiteLiveRead({
  search,
  customerId: selectedCustomerId,
  securityType: selectedSecurityType,
  onItem: (site) => {
    if (site?.customerId) fetchCustomer(site.customerId);
  },
});

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const displayedSites = computed(() => {
  if (!search.value.trim()) return activeSites.value;
  return [...activeSites.value].sort((left, right) => {
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
    <SitesManager
      :before-edit="handleBeforeEdit"
      :model-value="displayedSites"
      @create="(item) => router.push(`/sites/${item.docId}`)"
    >
      <template #table="{ items, toCreate, toUpdate }">
        <v-card class="fill-height d-flex flex-column" width="100%">
          <AppMasterListToolbar v-model:search="search" :search-delay="300">
            <template #append>
              <v-btn
                icon="mdi-plus"
                aria-label="現場を新規登録"
                title="現場を新規登録"
                @click="() => toCreate()"
              />

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
            </template>
          </AppMasterListToolbar>
          <v-alert
            v-if="siteErrorMessage"
            type="error"
            variant="tonal"
            class="mx-4 mb-3"
          >
            {{ siteErrorMessage }}
          </v-alert>
          <v-alert
            v-else-if="sitesLoaded && displayedSites.length === 0"
            type="info"
            variant="tonal"
            class="mx-4 mb-3"
          >
            条件に一致する稼働中の現場はありません。
          </v-alert>
          <SitesDataTable
            v-model:page="page"
            class="flex-grow-1 overflow-hidden"
            :items="items"
            :sort-by="[]"
            :items-per-page="20"
            :loading="sitesLoading"
            edit-icon="mdi-pencil"
            @click:update="toUpdate"
          />
        </v-card>
      </template>
    </SitesManager>
  </AppViewportContainer>
</template>
