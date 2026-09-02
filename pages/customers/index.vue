<script setup>
/*****************************************************************************
 * @file pages/customers/index.vue
 * @description 取引先情報一覧ページ
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useRouter } from "vue-router";
import { useCustomerActions } from "@/composables/application/customer/useCustomerActions";

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
const { canWrite } = useCustomerActions();

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
    <v-card class="fill-height d-flex flex-column" width="100%">
      <v-toolbar class="mb-4 bg-transparent" density="compact">
        <AtomsSearchTextField v-model="search" />
        <CustomerCreateDialog v-if="canWrite">
          <template #activator="{ open }">
            <v-btn icon="mdi-plus" @click="open" />
          </template>
        </CustomerCreateDialog>
      </v-toolbar>
      <CustomersDataTable
        class="flex-grow-1"
        :items="customerInstance.docs"
        :edit-icon="canWrite ? 'mdi-pencil' : 'mdi-eye'"
        hide-search
        :search="search"
        @click:update="handleClickUpdate"
      />
    </v-card>
  </v-container>
</template>
