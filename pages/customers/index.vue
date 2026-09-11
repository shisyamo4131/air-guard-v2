<script setup>
/*****************************************************************************
 * @file pages/customers/index.vue
 * @description 取引先情報一覧ページ
 *****************************************************************************/
import { Customer } from "@/schemas";
import { normalizeTokenText } from "@shisyamo4131/air-firebase-v2/utils/tokenMap";
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
const selectedStatus = ref(Customer.STATUS_ACTIVE);
const statusOptions = [
  ...Object.values(Customer.STATUS),
  { title: "すべて", value: "ALL" },
];

/*****************************************************************************
 * SETUP ROUTER COMPOSABLES
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleBeforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return true;
  router.push(`/customers/${item.docId}`);
  return false;
}

function subscribe() {
  const normalizedSearch = normalizeTokenText(search.value);
  const statusConstraints =
    selectedStatus.value === "ALL"
      ? []
      : [["where", "contractStatus", "==", selectedStatus.value]];
  const constraints = normalizedSearch || [
    ...statusConstraints,
    ["orderBy", "updatedAt", "desc"],
    ["limit", 20],
  ];
  customerInstance.subscribeDocs({
    constraints,
    options: normalizedSearch ? statusConstraints : [],
  });
}

function unsubscribe() {
  customerInstance.unsubscribe();
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(unsubscribe);
watch([selectedStatus, search], subscribe);
</script>

<template>
  <AppViewportContainer>
    <CustomersManager
      :before-edit="handleBeforeEdit"
      :model-value="customerInstance.docs"
    >
      <template #table="{ items, toCreate, toUpdate }">
        <v-card class="fill-height d-flex flex-column" width="100%">
          <AppMasterListToolbar v-model:search="search" :search-delay="300">
            <template #append>
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
              <v-btn icon="mdi-plus" @click="() => toCreate()" />
            </template>
          </AppMasterListToolbar>
          <CustomersDataTable
            class="flex-grow-1 overflow-hidden"
            :items="items"
            :sort-by="[]"
            edit-icon="mdi-pencil"
            hide-search
            @click:update="toUpdate"
          />
        </v-card>
      </template>
    </CustomersManager>
  </AppViewportContainer>
</template>
