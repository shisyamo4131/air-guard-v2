<script setup>
/*****************************************************************************
 * @file pages/sites/index.vue
 * @description 稼働中現場情報一覧ページ
 *****************************************************************************/
import { Site } from "@/schemas";
import { useRouter } from "vue-router";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "sites-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const siteInstance = reactive(new Site());
const search = ref("");
const selectedCustomerId = ref(null);
const selectedSecurityType = ref(null);
const filterDialog = ref(false);

/*****************************************************************************
 * SETUP ROUTER COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP USE FETCH COMPOSABLE
 *****************************************************************************/
const { fetchCustomerComposable } = useFetch("SiteIndex", true);
const { fetchCustomer, cachedCustomersArray } = fetchCustomerComposable;

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
  return siteInstance.docs.filter((site) => {
    return securityTypeIsMatched(site) && customerIdIsMatched(site);
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
 * METHODS
 *****************************************************************************/
function subscribe() {
  const constraints = [["where", "status", "==", Site.STATUS_ACTIVE]];
  const callback = (doc) => fetchCustomer(doc.customerId);
  siteInstance.subscribeDocs({ constraints }, callback);
}

function unsubscribe() {
  siteInstance.unsubscribe();
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(unsubscribe);
</script>

<template>
  <v-container class="fill-height align-start">
    <SitesManager
      class="fill-height"
      :docs="filteredSites"
      :handle-click-update="(item) => router.push(`/sites/${item.docId}`)"
      @create="(item) => router.push(`/sites/${item.docId}`)"
    >
      <template #table="slotProps">
        <v-toolbar class="mb-4 bg-transparent">
          <AtomsSearchTextField v-model="search" />
          <v-btn icon="mdi-plus" @click="() => slotProps.toCreate()" />

          <!-- フィルター用コンポーネント -->
          <v-dialog v-model="filterDialog" max-width="360px" persistent>
            <template #activator="{ props: activatorProps }">
              <v-btn v-bind="activatorProps" icon="mdi-filter" />
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
                    <v-icon icon="mdi-close" @click="filterDialog = false" />
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
        <SitesDataTable
          class="flex-grow-1"
          v-bind="slotProps"
          hide-search
          :search="search"
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
      </template>
    </SitesManager>
  </v-container>
</template>
