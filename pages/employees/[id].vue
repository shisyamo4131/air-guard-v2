<script setup>
import dayjs from "dayjs";
import { useRoute } from "vue-router";
import { useEmployee } from "@/composables/dataLayers/useEmployee";
import { useEmployeeManager } from "@/composables/useEmployeeManager";
import { useConstants } from "@/composables/useConstants";
import { useCertificationsManager } from "@/composables/useCertificationsManager";

/** SETUP */
const docId = useRoute().params.id;
const { doc } = useEmployee({ docId });
const { attrs, toTerminated } = useEmployeeManager({ doc });
const certificationsManager = useCertificationsManager(doc);
const { GENDER } = useConstants();

/** FOR TERMINATION PROCESS */
const dialogForTerminated = ref(false);
const dateOfTermination = ref(null);
const reasonOfTermination = ref(null);
const validTermination = ref(false);
const onClickCancelTermination = () => {
  dialogForTerminated.value = false;
  dateOfTermination.value = null;
  reasonOfTermination.value = null;
};

const includedKeys = computed(() => {
  return [
    "code",
    {
      key: "lastName",
      display: false,
    },
    {
      key: "firstName",
      display: false,
    },
    {
      key: "fullName",
      title: "氏名",
      value: (item) =>
        `${item.fullName}${
          item.isForeigner ? "(" + item.foreignName + ")" : ""
        }`,
      editable: false,
    },
    {
      key: "lastNameKana",
      display: false,
    },
    {
      key: "firstNameKana",
      display: false,
    },
    {
      key: "gender",
      display: false,
    },
    {
      key: "dateOfBirth",
      value: (item) => {
        return `${dayjs(item.dateOfBirth).format("YYYY年MM月DD日")} (${
          item.age.years
        }歳${item.age.months}ヶ月)`;
      },
    },
    {
      key: "zipcode",
      display: false,
    },
    {
      key: "prefCode",
      display: false,
    },
    {
      key: "city",
      display: false,
    },
    {
      key: "address",
      display: false,
    },
    {
      key: "fullAddress",
      title: "住所",
      value: (item) => `${item.zipcode} ${item.fullAddress}`,
      editable: false,
    },
    { key: "building", display: false },
    "mobile",
    "email",
    {
      key: "dateOfHire",
      title: "入社日",
      value: (item) => {
        return `${dayjs(item.dateOfHire).format("YYYY年MM月DD日")} (${
          item.yearsOfService.years
        }年${item.yearsOfService.months}ヶ月)`;
      },
    },
    {
      key: "nationality",
      title: "国籍",
      value: (item) => (item.isForeigner ? item.nationality : "日本"),
    },
    {
      key: "isForeigner",
      display: false,
    },
    "foreignName",
    {
      key: "residenceStatus",
      title: "在留資格",
      value: (item) => (item.isForeigner ? item.residenceStatus : "-"),
    },
    {
      key: "periodOfStay",
      title: "在留期間満了日",
      value: (item) =>
        item.isForeigner
          ? dayjs(item.periodOfStay).format("YYYY年MM月DD日(ddd)")
          : "-",
    },
  ];
});
</script>

<template>
  <TemplatesDetail :label="doc.fullName" fixed>
    <v-container>
      <v-row>
        <!-- 基本情報 -->
        <v-col cols="12" md="4">
          <air-item-manager v-bind="attrs" :included-keys="includedKeys">
            <template
              #activator="{ attrs: activatorProps, displayItems, item }"
            >
              <air-information-card
                v-bind="activatorProps"
                :items="displayItems"
                :item="item"
              >
                <!-- 氏名に性別アイコンを追加 -->
                <template #item.fullName="{ item, internalItem }">
                  <v-list-item v-bind="internalItem">
                    <template #subtitle>
                      <div class="d-flex flex-column">
                        <span class="text-caption">
                          {{ item.fullNameKana }}
                        </span>
                        <span>
                          {{ internalItem.props.subtitle }}
                          <v-icon
                            :icon="GENDER[item.gender].icon"
                            :color="GENDER[item.gender].color"
                            size="small"
                          />
                        </span>
                      </div>
                    </template>
                  </v-list-item>
                </template>
                <template #item.fullAddress="{ item, internalItem }">
                  <v-list-item v-bind="internalItem">
                    <template #subtitle>
                      <div class="d-flex flex-column">
                        <span>{{ `〒${item.zipcode}` }}</span>
                        <span>{{ item.fullAddress }}</span>
                        <span>{{ item.building }}</span>
                      </div>
                    </template>
                  </v-list-item>
                </template>
              </air-information-card>
            </template>
          </air-item-manager>
        </v-col>

        <!-- 警備員登録情報 -->
        <v-col cols="12" md="8">
          <air-item-manager
            v-bind="attrs"
            hide-delete-btn
            :included-keys="[
              { key: 'hasSecurityGuardRegistration', display: false },
              {
                key: 'dateOfSecurityGuardRegistration',
                value: (item) =>
                  dayjs(item.dateOfSecurityGuardRegistration).format(
                    'YYYY年MM月DD日'
                  ),
              },
              'bloodType',
              { key: 'emergencyContactName', title: '緊急連絡先' },
              { key: 'emergencyContactRelation', display: false },
              { key: 'emergencyContactRelationDetail', display: false },
              { key: 'emergencyContactAddress', display: false },
              { key: 'emergencyContactPhone', display: false },
              'domicile',
              { key: 'securityCertifications', editable: false },
            ]"
          >
            <template
              #activator="{ attrs: activatorProps, displayItems, item }"
            >
              <air-information-card
                v-if="item.hasSecurityGuardRegistration"
                v-bind="activatorProps"
                :items="displayItems"
                :item="item"
              >
                <template #item.emergencyContactName="{ item, internalItem }">
                  <v-list-item v-bind="internalItem">
                    <template #subtitle>
                      <div class="d-flex flex-column ga-1">
                        <span>
                          {{ internalItem.props.subtitle }}
                          {{ `(${item.emergencyContactRelationDetail})` }}
                        </span>
                        <span>
                          {{ item.emergencyContactAddress }}
                        </span>
                        <span>
                          {{ item.emergencyContactPhone }}
                        </span>
                      </div>
                    </template>
                  </v-list-item>
                </template>
                <template #item.securityCertifications>
                  <v-container>
                    <v-card>
                      <OrganismsCertificationsManager
                        v-bind="certificationsManager.attrs.value"
                      />
                    </v-card>
                  </v-container>
                </template>
              </air-information-card>
              <v-card v-else>
                <v-card-text class="text-center">
                  <v-icon
                    icon="mdi-alert-circle-outline"
                    size="48"
                    color="warning"
                  />
                  <div class="text-h6 mt-2">警備員登録未完了</div>
                  <div class="mt-1">
                    この従業員は警備員登録が完了していません。<br />
                    緊急連絡先や血液型などの情報を登録してください。
                  </div>
                </v-card-text>
                <v-card-actions>
                  <v-btn
                    block
                    color="primary"
                    text="情報を登録する"
                    @click="() => activatorProps['onClick:edit']()"
                  />
                </v-card-actions>
              </v-card>
            </template>
          </air-item-manager>
        </v-col>

        <!-- 退職処理ボタン -->
        <v-col cols="12">
          <AtomsDialogsFullscreen v-model="dialogForTerminated" maxWidth="360">
            <template #activator="{ props: activatorProps }">
              <v-btn
                v-bind="activatorProps"
                block
                color="error"
                text="退職処理"
              />
            </template>
            <v-card>
              <template #title>
                <v-icon icon="mdi-alert" color="error" />
                退職処理
              </template>
              <template #text>
                <v-form v-model="validTermination">
                  <air-date-input
                    v-model="dateOfTermination"
                    :allowed-dates="
                      (date) => !dayjs(date).isBefore(dayjs(doc.dateOfHire))
                    "
                    label="退職日"
                    required
                  />
                  <air-text-field
                    v-model="reasonOfTermination"
                    label="退職理由"
                    required
                  />
                </v-form>
                <v-alert type="warning">
                  退職処理を行うと、この従業員は以降の配置や稼働実績への登録ができなくなります。
                </v-alert>
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  class="flex-grow-1 d-flex justify-space-between"
                  submitText="実行"
                  color="error"
                  :disabled="!validTermination"
                  @click:cancel="onClickCancelTermination"
                  @click:submit="
                    toTerminated(dateOfTermination, () => {
                      dialogForTerminated = false;
                      dateOfTermination.value = null;
                      reasonOfTermination.value = null;
                    })
                  "
                />
              </template>
            </v-card>
          </AtomsDialogsFullscreen>
        </v-col>
      </v-row>
    </v-container>
  </TemplatesDetail>
</template>
