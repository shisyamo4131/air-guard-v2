<script setup>
import dayjs from "dayjs";
import { useRoute } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
// import { useEmployeeManager } from "@/composables/useEmployeeManager";
import { useCertificationsManager } from "@/composables/useCertificationsManager";

/** SETUP */
const docId = useRoute().params.id;
const { doc } = useDocument("Employee", { docId });
// const { attrs, toTerminated } = useEmployeeManager({ doc });
const certificationsManager = useCertificationsManager(doc);

/** FOR TERMINATION PROCESS */
const dateOfTermination = ref(null); // 退職日
const reasonOfTermination = ref(null); // 退職理由
const validTermination = ref(false); // 退職処理フォームのバリデーション状態
const terminateDialog = ref(false); // 退職処理ダイアログ表示フラグ
watch(terminateDialog, (newVal) => {
  if (newVal) return;
  dateOfTermination.value = null;
  reasonOfTermination.value = null;
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-row>
      <v-col cols="12" v-if="doc.employmentStatus !== 'ACTIVE'">
        <v-alert type="error"> この従業員は現在在職していません。 </v-alert>
      </v-col>
      <!-- 基本情報 -->
      <v-col cols="12" md="4">
        <EmployeeManager type="base" :doc="doc">
          <template #default="{ item }">
            <EmployeeTableBaseInfo v-bind="item" />
          </template>
        </EmployeeManager>
      </v-col>

      <!-- 警備員登録情報 -->
      <v-col cols="12" md="8">
        <v-row>
          <v-col cols="12">
            <EmployeeManager type="securityGuard" :doc="doc">
              <template #default="{ item, toUpdate }">
                <EmployeeTableSecurityGuardInfo
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
          <v-col cols="12">
            <!-- 保有資格 -->
            <EmployeeCertificationsManager
              v-model="doc.securityCertifications"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
        </v-row>
      </v-col>

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <!-- <air-item-manager v-bind="attrs" hide-delete-btn>
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
                削除すると復元することはできません。本当に削除しますか？
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                  color="error"
                />
              </template>
            </v-card>
          </template>
        </air-item-manager> -->
      </v-col>
    </v-row>
  </TemplatesFixedHeightContainer>
</template>
