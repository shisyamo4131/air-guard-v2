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

defineOptions({ name: "employee-detail" });
const route = useRoute();
const { doc, users: userDocs, userError, loading, error, missing, canRead } = useEmployeeDetailRead(() => String(route.params.id || ""));
const user = new User();
const showResignedAlert = computed(() => doc.value?.employmentStatus === "RESIGNED");
</script>

<template>
  <v-container>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-if="error || userError" type="error">{{ error || userError }}</v-alert>
    <v-alert v-else-if="missing" type="info">従業員情報が存在しません。</v-alert>
    <v-alert v-else-if="!canRead && !loading" type="info">従業員情報を閲覧できません。</v-alert>
    <v-row v-if="doc">
      <!-- 非在職アラート -->
      <v-col cols="12" v-if="showResignedAlert">
        <v-alert type="error"> この従業員は現在在職していません。 </v-alert>
      </v-col>

      <!-- 左カラム -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <EmployeeEditor :employee="doc" operation="basic" title="基本情報">
              <template #default="{ open, canEdit }">
                <EmployeeActivatorBase :item="doc" title="基本情報" :can-edit="canEdit" @click:edit="open">
                  <template #actions>
                    <EmployeeLifecycleActions
                      class="flex-grow-1"
                      :employee="doc"
                      :linked-user="userDocs[0] || null"
                    />
                  </template>
                </EmployeeActivatorBase>
              </template>
            </EmployeeEditor>
          </v-col>

          <!-- 国籍情報 -->
          <v-col cols="12">
            <EmployeeEditor :employee="doc" operation="nationality" title="国籍情報">
              <template #default="{ open, canEdit }">
                <EmployeeActivatorNationality :item="doc" title="国籍情報" :can-edit="canEdit" @click:edit="open" />
              </template>
            </EmployeeEditor>
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
            <EmployeeEditor :employee="doc" operation="security" title="警備員登録">
              <template #default="{ open, canEdit }"><EmployeeActivatorSecurityGuard :item="doc" title="警備員登録" :can-edit="canEdit" @click:edit="open" /></template>
            </EmployeeEditor>
          </v-col>
          <v-col cols="12"><EmployeeCertificationsManager :employee="doc" /></v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
