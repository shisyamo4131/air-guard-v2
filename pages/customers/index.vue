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
const selectedStatus = ref(Customer.STATUS_ACTIVE);
const statusOptions = [
  ...Object.values(Customer.STATUS),
  { title: "すべて", value: "ALL" },
];

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
  const constraints = selectedStatus.value === "ALL"
    ? []
    : [["where", "contractStatus", "==", selectedStatus.value]];
  customerInstance.subscribeDocs({ constraints });
}

function unsubscribe() {
  customerInstance.unsubscribe();
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(unsubscribe);
watch(selectedStatus, subscribe);
</script>

<template>
  <v-container class="align-start"
  style="height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom))"
  >
    <v-card class="fill-height d-flex flex-column" width="100%">
      <v-toolbar class="ps-4">
        <AtomsSearchTextField v-model="search" />
        <v-select
          v-model="selectedStatus"
          :items="statusOptions"
          label="状態"
          density="compact"
          variant="solo"
          flat
          hide-details
          class="mx-2"
          style="max-width: 180px; min-width: 120px"
        />
        <CustomerCreateDialog v-if="canWrite">
          <template #activator="{ open }">
            <v-btn icon="mdi-plus" @click="open" />
          </template>
        </CustomerCreateDialog>
      </v-toolbar>
      <CustomersDataTable
        class="flex-grow-1 overflow-hidden"
        :items="customerInstance.docs"
        :edit-icon="canWrite ? 'mdi-pencil' : 'mdi-eye'"
        hide-search
        :search="search"
        @click:update="handleClickUpdate"
      />
    </v-card>
  </v-container>
</template>
