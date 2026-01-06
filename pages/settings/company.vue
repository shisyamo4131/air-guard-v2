<script setup>
import { useCompanyManager } from "@/composables/useCompanyManager";
import { useAgreementsManager } from "../../composables/useAgreementsManager";
import { DAY_OF_WEEK_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { RoundSetting } from "@/schemas";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, doc } = useCompanyManager();
const agreementsManager = useAgreementsManager(attrs.value.modelValue);
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- Base information column -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="['companyName', 'companyNameKana', 'tel', 'fax']"
            >
              <template #activator="{ props: activatorProps }">
                <v-card>
                  <template #title>{{ doc.companyName }}</template>
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="doc.companyNameKana"
                        subtitle="会社名（カナ）"
                        prepend-icon="mdi-tag"
                      />
                      <v-list-item
                        :title="doc.tel"
                        subtitle="電話番号"
                        prepend-icon="mdi-phone"
                      />
                      <v-list-item
                        :title="doc.fax"
                        subtitle="FAX番号"
                        prepend-icon="mdi-fax"
                      />
                    </v-list>
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
            </air-item-manager>
          </v-col>

          <!-- 所在地 -->
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
            >
              <template #activator="{ props: activatorProps }">
                <v-card
                  :title="`${doc.city}${doc.address}`"
                  :subtitle="`${doc.zipcode} ${doc.fullAddress} ${
                    doc.building || ''
                  }`"
                >
                  <template #prepend>
                    <v-icon color="red" icon="mdi-map-marker" />
                  </template>
                  <template #text>
                    <v-skeleton-loader type="image" />
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>

      <!-- CENTER -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- Bank information column -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'bankName',
                'branchName',
                'accountType',
                'accountNumber',
                'accountHolder',
              ]"
            >
              <template #activator="{ props: activatorProps }">
                <v-card>
                  <template #title>口座情報</template>
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="`${doc.bankName} ${doc.branchName}`"
                        prepend-icon="mdi-bank"
                      />
                      <v-list-item
                        :title="`${doc.accountType} ${doc.accountNumber}`"
                        prepend-icon="mdi-numeric"
                      />
                      <v-list-item
                        :title="`${doc.accountHolder}`"
                        prepend-icon="mdi-account"
                      />
                    </v-list>
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- Settings information column -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'minuteInterval',
                'roundSetting',
                'firstDayOfWeek',
              ]"
            >
              <template #activator="{ props: activatorProps }">
                <v-card>
                  <template #title>機能設定</template>
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="doc.minuteInterval"
                        subtitle="時刻選択間隔（分）"
                        prepend-icon="mdi-timer-sand"
                      />
                      <v-list-item
                        :title="RoundSetting.label(doc.roundSetting)"
                        subtitle="端数処理"
                        prepend-icon="mdi-sort-numeric-ascending"
                      />
                      <v-list-item
                        :title="DAY_OF_WEEK_VALUES[doc.firstDayOfWeek].title"
                        subtitle="週の始まり"
                        prepend-icon="mdi-calendar-week-begin"
                      />
                    </v-list>
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-row>
      <!-- Agreements management row -->
      <v-col cols="12">
        <v-card>
          <template #title>既定の取極め</template>
          <OrganismsAgreementsManager v-bind="agreementsManager.attrs.value" />
        </v-card>
      </v-col>
    </v-row>
  </TemplatesFixedHeightContainer>
</template>

<style></style>
