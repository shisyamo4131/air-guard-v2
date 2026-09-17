<script setup>
/*****************************************************************************
 * @file ./pages/employees/[id].vue
 *
 * [更新履歴]
 * 2026-06-11 - 警備員情報登録の VEmptyState を Activator に内包。
 *****************************************************************************/
import { useRoute } from "vue-router";
import { useEmployeeDetailRead } from "@/composables/application/employee/useEmployeeDetailRead";
import { User } from "@/schemas";
import { useEmployeeArchive } from "@/composables/application/employee/useEmployeeArchive";
import EmployeeBaseInput from "@/components/Employee/CustomInput/Base.vue";
import EmployeeNationalityInput from "@/components/Employee/CustomInput/Nationality.vue";
import EmployeeSecurityGuardInput from "@/components/Employee/CustomInput/SecurityGuard.vue";

defineOptions({ name: "employee-detail" });
const route = useRoute();
const { doc, users: userDocs, userError, loading, error, missing, canRead, excludeArchived } = useEmployeeDetailRead(() => String(route.params.id || ""));
const user = new User();
const showResignedAlert = computed(() => doc.value?.employmentStatus === "RESIGNED");
const employeeId = computed(() => String(route.params.id || ""));
const archive = useEmployeeArchive(employeeId, doc);
function archived() { excludeArchived(employeeId.value); return navigateTo("/employees"); }
async function preflightAndDelete(toDelete) {
  if (await archive.preflight()) toDelete();
}
</script>

<template>
  <v-container>
    <v-alert v-if="archive.message.value" type="warning" class="mb-3">{{ archive.message.value }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-if="error || userError" type="error">{{ error || userError }}</v-alert>
    <v-alert v-else-if="missing" type="info">従業員情報が存在しません。</v-alert>
    <v-alert v-else-if="!canRead && !loading" type="info">従業員情報を閲覧できません。</v-alert>
    <v-row v-if="doc">
      <v-col cols="12">
        <EmployeeManager
          :model-value="doc"
          archive-mode
          label="従業員のアーカイブ"
          @delete="archived"
        >
          <template #activator="{ toDelete }">
            <v-btn
              color="error"
              variant="outlined"
              text="従業員をアーカイブ"
              :loading="archive.busy.value"
              :disabled="!archive.canStart.value"
              @click="() => preflightAndDelete(toDelete)"
            />
          </template>
        </EmployeeManager>
      </v-col>
      <!-- 非在職アラート -->
      <v-col cols="12" v-if="showResignedAlert">
        <v-alert type="error"> この従業員は現在在職していません。 </v-alert>
      </v-col>

      <!-- 左カラム -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <EmployeeManager :model-value="doc" :custom-input="EmployeeBaseInput" label="基本情報">
              <template #activator="{ toUpdate }">
                <EmployeeActivatorBase :item="doc" title="基本情報" :can-edit="!showResignedAlert" @click:edit="toUpdate">
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
            <EmployeeManager :model-value="doc" :custom-input="EmployeeNationalityInput" label="国籍情報">
              <template #activator="{ toUpdate }">
                <EmployeeActivatorNationality :item="doc" title="国籍情報" :can-edit="!showResignedAlert" @click:edit="toUpdate" />
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
          <v-col v-for="insurance in [{ key: 'employmentInsurance', title: '雇用保険' }, { key: 'healthInsurance', title: '健康保険' }, { key: 'pensionInsurance', title: '厚生年金' }]" :key="insurance.key" cols="12" md="4">
            <InsuranceTransitionManager :employee="doc" :kind="insurance.key" :title="insurance.title" />
          </v-col>
          <v-col cols="12">
            <EmployeeManager :model-value="doc" :custom-input="EmployeeSecurityGuardInput" label="警備員登録">
              <template #activator="{ toUpdate }"><EmployeeActivatorSecurityGuard :item="doc" title="警備員登録" :can-edit="!showResignedAlert" @click:edit="toUpdate" /></template>
            </EmployeeManager>
          </v-col>
          <v-col cols="12"><EmployeeCertificationsManager :employee="doc" /></v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
