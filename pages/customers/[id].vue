<script setup>
/*****************************************************************************
 * @file pages/customers/[id].vue
 * @description 取引先情報詳細ページ
 *****************************************************************************/
import { useRoute, useRouter } from "vue-router";
import { Customer, Site } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

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
const { fetchSiteComposable } = useFetch("CustomerManager", true);
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
              :doc="customerInstance"
              label="基本情報"
              hide-delete-btn
            >
              <template #activator="activatorProps">
                <CustomerActivatorBase v-bind="activatorProps" />
              </template>
            </CustomerManager>
          </v-col>

          <!-- 請求・回収条件 -->
          <v-col cols="12">
            <CustomerManager
              :doc="customerInstance"
              label="請求・回収条件"
              hide-delete-btn
            >
              <template #activator="activatorProps">
                <CustomerActivatorPayment v-bind="activatorProps" />
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

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <CustomerManager
          :doc="customerInstance"
          hide-delete-btn
          @submit:complete="router.replace('/customers')"
        >
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              text="この取引先を削除する"
              @click="() => toDelete()"
            />
          </template>
          <template #editor="{ actions: editorActions }">
            <v-card>
              <template #prepend>
                <v-icon icon="mdi-alert" color="error" />
              </template>
              <template #title> 削除処理 </template>
              <template #text>
                <div>本当に削除しますか？</div>
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                />
              </template>
            </v-card>
          </template>
        </CustomerManager>
      </v-col>
    </v-row>
  </v-container>
</template>
