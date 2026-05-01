<script setup>
import { useRoute, useRouter } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useConstants } from "@/composables/useConstants";

// import { useEmployeeManager } from "@/composables/useEmployeeManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const docId = useRoute().params.id;
const router = useRouter();
const { doc } = useDocument("Employee", { docId });
const { EMPLOYMENT_STATUS } = useConstants();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
// const { attrs, toTerminated } = useEmployeeManager({ doc });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-row>
      <!-- 非在職アラート -->
      <v-col
        cols="12"
        v-if="doc.employmentStatus !== EMPLOYMENT_STATUS.ACTIVE.value"
      >
        <v-alert type="error"> この従業員は現在在職していません。 </v-alert>
      </v-col>

      <!-- 左カラム -->
      <v-col cols="12" md="4">
        <v-row>
          <v-col cols="12">
            <EmployeeManager type="base" :doc="doc">
              <template #default="{ item }">
                <!-- <EmployeeTableBaseInfo v-bind="item" /> -->
                <EmployeeListBase v-bind="item" />
                <air-textarea
                  label="備考"
                  :model-value="item.remarks"
                  variant="outlined"
                  readonly
                />
              </template>
              <template
                v-if="doc.employmentStatus !== EMPLOYMENT_STATUS.RESIGNED.value"
                #footer
              >
                <v-card-actions>
                  <EmployeeResignation
                    class="flex-grow-1"
                    :doc="doc"
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
                  </EmployeeResignation>
                </v-card-actions>
              </template>
            </EmployeeManager>
          </v-col>
          <v-col cols="12">
            <EmployeeManager type="nationality" :doc="doc">
              <template #default="{ item }">
                <!-- <EmployeeTableNationality v-bind="item" /> -->
                <EmployeeListNationality v-bind="item" />
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
          <v-col cols="12" md="8">
            <EmployeeManager type="securityGuard" :doc="doc">
              <template #default="{ item, toUpdate }">
                <EmployeeListSecurityGuard
                  v-if="item.hasSecurityGuardRegistration"
                  v-bind="item"
                />
                <v-empty-state
                  v-else
                  title="警備員登録未完了"
                  icon="mdi-alert-circle-outline"
                  action-text="情報を登録する"
                  @click:action="() => toUpdate()"
                >
                  <template #text>
                    <div>この従業員は警備員登録が完了していません。</div>
                    <div>緊急連絡先や血液型などの情報を登録してください。</div>
                  </template>
                </v-empty-state>
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
        <EmployeeManager :doc="doc" hide-delete-btn>
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
