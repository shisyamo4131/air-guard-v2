<script setup>
/*****************************************************************************
 * @file pages/customers/[id].vue
 * @description 取引先情報詳細ページ
 *****************************************************************************/
import { useRoute, useRouter } from "vue-router";
import { Customer, Site } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";
import {
  CUSTOMER_BASIC_FIELDS,
  CUSTOMER_PAYMENT_FIELDS,
} from "@/composables/domain/customer/customerOperations";

/*****************************************************************************
 * OBTAIN PARAMS
 *****************************************************************************/
const route = useRoute();
const docId = route.params.id;

/*****************************************************************************
 * SETUP ROUTER COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("CustomerDetail", true);
const { fetchSite } = fetchSiteComposable;

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const customerInstance = reactive(new Customer());
const siteInstance = reactive(new Site());

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribe() {
  customerInstance.subscribe({ docId });
  const constraints = [
    ["where", "customerId", "==", docId],
    ["where", "status", "==", Site.STATUS_ACTIVE],
  ];
  const callback = fetchSite;
  siteInstance.subscribeDocs({ constraints }, callback);
}

function unsubscribe() {
  customerInstance.unsubscribe();
  siteInstance.unsubscribe();
}

function handleClickUpdateSite(item) {
  router.push(`/sites/${item.docId}`);
}

function handleArchived() {
  router.push("/customers");
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(unsubscribe);
</script>

<template>
  <v-container>
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <CustomerManager
              :model-value="customerInstance"
              :included-keys="CUSTOMER_BASIC_FIELDS"
              label="取引先基本情報の編集"
            >
              <template #activator="{ toUpdate }">
                <CustomerActivatorBase
                  :item="customerInstance"
                  title="基本情報"
                  editable
                  @click:edit="toUpdate"
                >
                  <template #actions>
                    <CustomerArchiveDialog
                      :customer="customerInstance"
                      @archived="handleArchived"
                    />
                  </template>
                </CustomerActivatorBase>
              </template>
            </CustomerManager>
          </v-col>

          <!-- 請求・回収条件 -->
          <v-col cols="12">
            <CustomerManager
              :model-value="customerInstance"
              :included-keys="CUSTOMER_PAYMENT_FIELDS"
              label="請求・回収条件の編集"
            >
              <template #activator="{ toUpdate }">
                <CustomerActivatorPayment
                  :item="customerInstance"
                  title="請求・回収条件"
                  editable
                  @click:edit="toUpdate"
                />
              </template>
            </CustomerManager>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" md="8">
        <v-row>
          <!-- 稼働中現場 -->
          <v-col cols="12">
            <v-card>
              <v-toolbar
                color="secondary"
                density="compact"
                title="稼働中現場"
              />
              <SitesDataTable
                :items="siteInstance.docs"
                hide-search
                @click:update="handleClickUpdateSite"
              />
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
