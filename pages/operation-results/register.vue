<script setup>
import { onMounted, onUnmounted } from "vue";
import { SiteOperationSchedule, OperationResult } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchArrangementNotification } from "@/composables/fetch/useFetchArrangementNotification";
const { fetchSite, cachedSites } = useFetchSite();
const { fetchEmployee, cachedEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers } = useFetchOutsourcer();
const { fetchArrangementNotification, cachedArrangementNotifications } =
  useFetchArrangementNotification();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new SiteOperationSchedule());
const selectedDoc = ref(null);

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const logger = useLogger("register", useErrorsStore());

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/** Returns the applicable agreement for the selected document */
const agreement = computed(() => {
  if (!selectedDoc?.value) return null;
  const site = cachedSites.value[selectedDoc?.value?.siteId];
  if (!site) return null;
  return site.getAgreement(selectedDoc.value);
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function submit() {
  try {
    if (!agreement.value) throw new Error("取極めが未登録です。");
    await selectedDoc.value.syncToOperationResult(agreement.value);
    selectedDoc.value = null;
  } catch (error) {
    logger.error(error);
  }
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  model.subscribeDocs({
    constraints: [["where", "operationResultId", "==", ""]],
    callback: (item) => {
      fetchSite(item);
      fetchEmployee(item.employeeIds);
      fetchOutsourcer(item.outsourcerIds);
      item.workers.forEach((worker) => {
        const key = `${item.docId}-${worker.workerId}`;
        fetchArrangementNotification(key);
      });
    },
  });
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-data-table
      :headers="[
        { title: '日付', key: 'date' },
        {
          title: '現場',
          key: 'siteId',
          value: (item) => cachedSites[item.siteId]?.name || 'loading...',
        },
      ]"
      :items="model.docs"
      @click:update="(item) => (selectedDoc = item)"
    >
    </air-data-table>
    <v-dialog
      :model-value="!!selectedDoc"
      max-width="800"
      scrollable
      persistent
      @update:model-value="() => (selectedDoc = null)"
    >
      <v-card>
        <v-toolbar flat density="compact">
          <v-toolbar-title>稼働実績詳細</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="selectedDoc = null">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-table>
            <tbody>
              <tr>
                <td>日付</td>
                <td>{{ selectedDoc?.date || "" }}</td>
              </tr>
              <tr>
                <td>現場</td>
                <td>
                  {{ cachedSites[selectedDoc?.siteId]?.name || "loading..." }}
                </td>
              </tr>
              <tr>
                <td>時間</td>
                <td>
                  {{
                    SiteOperationSchedule.SHIFT_TYPE[selectedDoc?.shiftType]
                      ?.title || ""
                  }}
                  {{
                    `${selectedDoc?.startTime || ""} - ${
                      selectedDoc?.endTime || ""
                    }`
                  }}
                </td>
              </tr>
              <tr>
                <td>作業員</td>
                <td>
                  <v-table>
                    <tbody>
                      <tr
                        v-for="worker in selectedDoc?.workers || []"
                        :key="worker.id"
                      >
                        <td>
                          {{
                            cachedEmployees[worker.employeeId]?.displayName ||
                            cachedOutsourcers[worker.outsourcerId]
                              ?.displayName ||
                            "loading..."
                          }}
                        </td>
                        <td>
                          {{
                            cachedArrangementNotifications[
                              worker.notificationKey
                            ]?.actualStartTime || ""
                          }}
                          -
                          {{
                            cachedArrangementNotifications[
                              worker.notificationKey
                            ]?.actualEndTime || ""
                          }}
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-container>
          <v-alert v-if="!agreement">取極めが未登録です。</v-alert>
        </v-container>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn :disabled="!agreement" @click="submit">取込</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </TemplatesFixedHeightContainer>
</template>
