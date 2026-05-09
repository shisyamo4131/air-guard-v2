<script setup>
import { useRoute, useRouter } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useConstants } from "@/composables/useConstants";
import CustomInputResignation from "@/components/Employee/CustomInput/Resignation.vue";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const docId = useRoute().params.id;
const router = useRouter();
const { doc } = useDocument("Employee", { docId });
const { EMPLOYMENT_STATUS } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const showResignedAlert = computed(() => {
  return doc?.employmentStatus === EMPLOYMENT_STATUS.value.RESIGNED.value;
});
</script>

<template>
  <TemplatesFixedHeightContainer>
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
                  <template v-if="!showResignedAlert" #actions>
                    <EmployeeManager
                      class="flex-grow-1"
                      :doc="doc"
                      label="退職処理"
                      hide-delete-btn
                      :handle-update="
                        (item) =>
                          item.toTerminated(
                            item.dateOfTermination,
                            item.reasonOfTermination,
                          )
                      "
                      :custom-input="CustomInputResignation"
                      @submit:complete="router.replace('/employees')"
                    >
                      <template #activator="{ toUpdate }">
                        <v-btn
                          block
                          color="warning"
                          variant="flat"
                          text="退職処理"
                          @click="() => toUpdate()"
                        />
                      </template>
                    </EmployeeManager>
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
          <v-col cols="12">
            <UserManager :employee="doc" />
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
                <EmployeeActivatorSecurityGuard
                  v-if="activatorProps.item.hasSecurityGuardRegistration"
                  v-bind="activatorProps"
                />
                <v-card v-else>
                  <v-empty-state
                    title="警備員登録未完了"
                    icon="mdi-alert-circle-outline"
                    action-text="情報を登録する"
                    @click:action="() => activatorProps.toUpdate()"
                  >
                    <template #text>
                      <div>この従業員は警備員登録が完了していません。</div>
                      <div>
                        緊急連絡先や血液型などの情報を登録してください。
                      </div>
                    </template>
                  </v-empty-state>
                </v-card>
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

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <EmployeeManager
          :doc="doc"
          hide-delete-btn
          @submit:complete="router.replace('/employees')"
        >
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              text="この従業員を削除する"
              @click="() => toDelete()"
            />
          </template>
          <template #editor="{ actions: editorActions }">
            <v-card>
              <template #prepend>
                <v-icon icon="mdi-alert" color="error" />
              </template>
              <template #title> 削除処理 </template>
              <template #text>
                <div>在職中の従業員です。本当に削除しますか？</div>
                <v-alert type="warning" density="compact" class="mt-4">
                  <div>
                    <div>一度削除すると復元することはできません。</div>
                    <div>
                      AirGuard のユーザーアカウントも同時に削除されます。
                    </div>
                  </div>
                </v-alert>
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                />
              </template>
            </v-card>
          </template>
        </EmployeeManager>
      </v-col>
    </v-row>
  </TemplatesFixedHeightContainer>
</template>
