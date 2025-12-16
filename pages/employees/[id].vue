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
</script>

<template>
  <TemplatesBase fixed>
    <v-row>
      <!-- 基本情報 -->
      <v-col cols="12" md="4">
        <v-row>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'lastName',
                'firstName',
                'lastNameKana',
                'firstNameKana',
                'displayName',
                'gender',
                'dateOfBirth',
                'dateOfHire',
                'mobile',
                'email',
              ]"
              hide-delete-btn
            >
              <template #activator="{ attrs: activatorProps }">
                <v-card :title="doc.fullName" :subtitle="doc.fullNameKana">
                  <template #prepend>
                    <v-icon
                      :color="GENDER[doc.gender].color"
                      icon="mdi-account"
                    />
                  </template>
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        prepend-icon="mdi-tag"
                        :title="doc.displayName"
                        subtitle="表示名"
                      />
                      <v-list-item
                        prepend-icon="mdi-cake"
                        :title="`${dayjs(doc.dateOfBirth).format(
                          'YYYY年MM月DD日'
                        )}(${doc.age.years}歳${doc.age.months}ヶ月)`"
                        subtitle="生年月日"
                      />
                      <v-list-item
                        prepend-icon="mdi-calendar"
                        :title="`${dayjs(doc.dateOfHire).format(
                          'YYYY年MM月DD日'
                        )}(${doc.yearsOfService.years}年${
                          doc.yearsOfService.months
                        }ヶ月)`"
                        subtitle="入社日"
                      />
                      <v-list-item
                        prepend-icon="mdi-cellphone"
                        :title="doc.mobile"
                        subtitle="携帯電話"
                      />
                      <v-list-item
                        prepend-icon="mdi-email"
                        :title="doc.email"
                        subtitle="メール"
                      />
                    </v-list>
                  </template>
                  <MoleculesCardActionsEdit v-bind="activatorProps" />
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'zipcode',
                'prefCode',
                'city',
                'address',
                'building',
              ]"
              hide-delete-btn
            >
              <template #activator="{ attrs: activatorProps }">
                <v-card
                  :title="`${doc.city}${doc.address}`"
                  :subtitle="`${doc.zipcode} ${doc.fullAddress} ${doc.building}`"
                >
                  <template #prepend>
                    <v-icon color="red" icon="mdi-map-marker" />
                  </template>
                  <template #text>
                    <v-skeleton-loader type="image" />
                  </template>
                  <MoleculesCardActionsEdit v-bind="activatorProps" />
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'nationality',
                'isForeigner',
                'foreignName',
                'residenceStatus',
                'periodOfStay',
              ]"
              hide-delete-btn
            >
              <template #activator="{ attrs: activatorProps }">
                <v-card
                  prepend-icon="mdi-earth"
                  :title="doc.isForeigner ? doc.nationality : '日本'"
                  subtitle="国籍"
                >
                  <template v-if="doc.isForeigner" #text>
                    <v-list slim>
                      <v-list-item
                        :title="doc.foreignName"
                        subtitle="本名(外国人の場合)"
                      />
                      <v-list-item
                        :title="doc.residenceStatus"
                        subtitle="在留資格"
                      />
                      <v-list-item
                        :title="`${dayjs(doc.periodOfStay).format(
                          'YYYY年MM月DD日(ddd)'
                        )}`"
                        subtitle="在留期間満了日"
                      />
                    </v-list>
                  </template>
                  <MoleculesCardActionsEdit v-bind="activatorProps" />
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>

      <!-- 警備員登録情報 -->
      <v-col cols="12" md="8">
        <v-row>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              hide-delete-btn
              :included-keys="[
                'hasSecurityGuardRegistration',
                'dateOfSecurityGuardRegistration',
                'bloodType',
                'emergencyContactName',
                'emergencyContactRelation',
                'emergencyContactRelationDetail',
                'emergencyContactAddress',
                'emergencyContactPhone',
                'domicile',
              ]"
            >
              <template #activator="{ attrs: activatorProps }">
                <v-card
                  v-if="doc.hasSecurityGuardRegistration"
                  prepend-icon="mdi-shield-check"
                  title="警備員資格情報"
                >
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="`${dayjs(
                          doc.dateOfSecurityGuardRegistration
                        ).format('YYYY年MM月DD日')}`"
                        subtitle="警備員登録日"
                      />
                      <v-list-item :title="doc.bloodType" subtitle="血液型" />
                      <v-list-item
                        :title="`${doc.emergencyContactName}(${doc.emergencyContactRelationDetail})`"
                        subtitle="緊急連絡先"
                      />
                      <v-list-item
                        :title="doc.emergencyContactAddress"
                        subtitle="緊急連絡先住所"
                      />
                      <v-list-item
                        :title="doc.emergencyContactPhone"
                        subtitle="緊急連絡先電話番号"
                      />
                    </v-list>
                  </template>
                  <MoleculesCardActionsEdit v-bind="activatorProps" />
                </v-card>
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
          <v-col cols="12">
            <!-- 保有資格 -->
            <OrganismsCertificationsManager
              v-bind="certificationsManager.attrs.value"
            >
              <template #table="tableProps">
                <v-card prepend-icon="mdi-card-account-details-outline">
                  <template #append>
                    <v-icon
                      icon="mdi-plus"
                      @click="() => tableProps.toCreate()"
                    />
                  </template>
                  <template #title>保有資格</template>
                  <air-data-table v-bind="tableProps" />
                </v-card>
              </template>
            </OrganismsCertificationsManager>
          </v-col>
        </v-row>
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
  </TemplatesBase>
</template>
