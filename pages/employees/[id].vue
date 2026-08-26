<script setup>
/*****************************************************************************
 * @file ./pages/employees/[id].vue
 *
 * [更新履歴]
 * 2026-06-11 - 警備員情報登録の VEmptyState を Activator に内包。
 *****************************************************************************/
import { useRoute } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useConstants } from "@/composables/useConstants";
import { User } from "@/schemas";

defineOptions({ name: "employee-detail" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const docId = useRoute().params.id;
const { doc } = useDocument("Employee", { docId });
const { EMPLOYMENT_STATUS } = useConstants();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const user = reactive(new User());
const userDocs = ref([]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const showResignedAlert = computed(() => {
  return doc?.employmentStatus === EMPLOYMENT_STATUS.value.RESIGNED.value;
});

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  if (!docId) return;
  userDocs.value = user.subscribeDocs({
    constraints: [["where", "employeeId", "==", docId]],
  });
});

onUnmounted(() => {
  user.unsubscribe();
  user.initialize();
});
</script>

<template>
  <v-container>
    <v-row>
      <!-- 非在職アラート -->
      <v-col cols="12" v-if="showResignedAlert">
        <v-alert type="error"> この従業員は現在在職していません。 </v-alert>
      </v-col>

      <!-- 左カラム -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <EmployeeManager :doc="doc" label="基本情報" hide-delete-btn>
              <template #activator="activatorProps">
                <EmployeeActivatorBase v-bind="activatorProps">
                  <template #actions>
                    <EmployeeLifecycleActions
                      class="flex-grow-1"
                      :employee="doc"
                      :linked-user="userDocs[0] || null"
                    />
                  </template>
                </EmployeeActivatorBase>
              </template>
            </EmployeeManager>
          </v-col>

          <!-- 国籍情報 -->
          <v-col cols="12">
            <EmployeeManager :doc="doc" hide-delete-btn label="国籍情報">
              <template #activator="activatorProps">
                <EmployeeActivatorNationality v-bind="activatorProps" />
              </template>
            </EmployeeManager>
          </v-col>

          <!-- ユーザー情報 -->
          <v-col cols="12" v-if="!showResignedAlert">
            <EmployeeUserManager :employee="doc" :user="userDocs[0] || user" />
          </v-col>
        </v-row>
      </v-col>

      <!-- 右カラム -->
      <v-col cols="12" md="8">
        <v-row>
          <v-col cols="12" md="4">
            <InsuranceTransitionManager
              v-model="doc.employmentInsurance"
              title="雇用保険"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
          <v-col cols="12" md="4">
            <InsuranceTransitionManager
              v-model="doc.healthInsurance"
              title="健康保険"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
          <v-col cols="12" md="4">
            <InsuranceTransitionManager
              v-model="doc.pensionInsurance"
              title="厚生年金"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>

          <!-- 警備員資格情報 -->
          <v-col cols="12">
            <EmployeeManager :doc="doc" hide-delete-btn label="警備員資格情報">
              <template #activator="activatorProps">
                <EmployeeActivatorSecurityGuard v-bind="activatorProps" />
              </template>
            </EmployeeManager>
          </v-col>

          <!-- 保有資格 -->
          <v-col cols="12">
            <EmployeeCertificationsManager
              v-model="doc.securityCertifications"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
