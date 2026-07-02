<script setup>
/*****************************************************************************
 * @file pages/customers/index.vue
 * @description 取引先情報一覧ページ
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useRouter } from "vue-router";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "customers-index" });

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const customerInstance = reactive(new Customer());
const search = ref("");

/*****************************************************************************
 * SETUP ROUTER COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleClickUpdate(item) {
  router.push(`/customers/${item.docId}`);
}

function subscribe() {
  const constraints = [
    ["where", "contractStatus", "==", Customer.STATUS_ACTIVE],
  ];
  customerInstance.subscribeDocs(constraints);
}

function unsubscribe() {
  customerInstance.unsubscribe();
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(unsubscribe);
</script>

<template>
  <v-container class="fill-height align-start">
    <CustomersManager
      class="fill-height"
      :docs="customerInstance.docs"
      :handle-click-update="handleClickUpdate"
    >
      <template #table="slotProps">
        <v-toolbar class="mb-4 bg-transparent" density="compact">
          <AtomsSearchTextField v-model="search" />
          <v-btn icon="mdi-plus" @click="() => slotProps.toCreate()" />
        </v-toolbar>
        <CustomersDataTable
          class="flex-grow-1"
          v-bind="slotProps"
          hide-search
          :search="search"
        />
      </template>
    </CustomersManager>
  </v-container>
</template>
