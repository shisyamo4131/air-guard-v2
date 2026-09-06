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
