<script setup>
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useOperationResultRegistManager } from "@/composables/useOperationResultRegistManager";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";

const instance = reactive(new SiteOperationSchedule());

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const fetchSiteComposable = useFetchSite();
const { fetchSite, cachedSites } = fetchSiteComposable;
const fetchEmployeeComposable = useFetchEmployee();
const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;
const fetchOutsourcerComposable = useFetchOutsourcer();
const { fetchOutsourcer, cachedOutsourcers } = fetchOutsourcerComposable;

provide("cachedSites", cachedSites);
provide("cachedEmployees", cachedEmployees);
provide("cachedOutsourcers", cachedOutsourcers);

const {
  keyMappedNotifications,
  attrs,
  applicableAgreement,
  notify,
  hasNotifications,
  isAllLeaved,
} = useOperationResultRegistManager({
  docs: instance.docs,
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
});

const statusUpdater = useArrangementNotificationManager();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribe() {
  // Subscribe to SiteOperationSchedule that are not yet linked to an operationResultId and are dated up to yesterday
  const constraints = [
    ["where", "operationResultId", "==", null],
    ["where", "date", "<", dayjs().format("YYYY-MM-DD")],
    ["orderBy", "date"],
  ];

  // Define callback to fetch related data
  const callback = (item) => {
    fetchSite(item);
    fetchEmployee(item.employeeIds);
    fetchOutsourcer(item.outsourcerIds);
  };

  instance.subscribeDocs({ constraints }, callback);
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  subscribe();
});

onUnmounted(() => {
  instance.unsubscribe();
});
</script>

<template>
  <air-array-manager v-bind="attrs">
    <template #input="{ item }">
      <v-table>
        <tbody>
          <OperationResultRegisterDateRow :date-at="item?.dateAt" />
          <OperationResultRegisterSiteRow :site-id="item?.siteId" />
          <OperationResultRegisterAgreementRow
            :agreement="applicableAgreement"
          />
          <OperationResultRegisterTimeRow :schedule="item" />
          <OperationResultRegisterWorkersRow
            :agreement="applicableAgreement"
            :notifications="keyMappedNotifications"
            :workers="item?.workers || []"
            @click:notification="statusUpdater.set"
            @click:notify="notify"
          />
        </tbody>
      </v-table>

      <OrganismsArrangementNotificationStatusUpdater
        v-bind="statusUpdater.attrs.value"
      />
      <v-container v-if="!hasNotifications">
        <v-banner color="error" icon="mdi-alert">
          <v-banner-text>
            配置通知が作成されていない作業員がいます。先に作成する必要があります。
          </v-banner-text>
          <template v-slot:actions>
            <v-btn @click="notify">作成</v-btn>
          </template>
        </v-banner>
      </v-container>
      <v-container v-else-if="!isAllLeaved">
        <AtomsAlertsWarn> 下番実績のない作業員がいます。 </AtomsAlertsWarn>
      </v-container>
    </template>
  </air-array-manager>
</template>
