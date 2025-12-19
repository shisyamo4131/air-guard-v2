<script setup>
import { useCompanyManager } from "@/composables/useCompanyManager";
import { useAgreementsManager } from "../../composables/useAgreementsManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useCompanyManager();
const agreementsManager = useAgreementsManager(attrs.value.modelValue);
</script>

<template>
  <TemplatesBase :label="'設定-会社情報-'" fixed hide-prepend>
    <v-row>
      <!-- Base information column -->
      <v-col cols="12" md="4">
        <air-item-manager
          v-bind="attrs"
          :included-keys="[
            'companyName',
            'companyNameKana',
            { key: 'zipcode', display: false },
            { key: 'prefCode', display: false },
            { key: 'city', display: false },
            { key: 'address', display: false },
            { key: 'building', display: false },
            { key: 'fullAddress', title: '住所', editable: false },
            'tel',
            'fax',
            'bankName',
            'branchName',
            'accountType',
            'accountNumber',
            'accountHolder',
          ]"
        >
          <template #activator="{ props: activatorProps, displayItems }">
            <air-card popup color="primary">
              <template #title>基本情報</template>
              <template #text>
                <v-list :items="displayItems"> </v-list>
              </template>
              <template #actions>
                <MoleculesActionsEdit v-bind="activatorProps" />
              </template>
            </air-card>
          </template>
        </air-item-manager>
      </v-col>

      <!-- Settings information column -->
      <v-col cols="12" md="8">
        <air-item-manager
          v-bind="attrs"
          :included-keys="['minuteInterval', 'roundSetting']"
        >
          <template #activator="{ props: activatorProps, displayItems }">
            <air-card popup color="primary">
              <template #title>機能設定</template>
              <template #text>
                <v-list :items="displayItems"> </v-list>
              </template>
              <template #actions>
                <MoleculesActionsEdit v-bind="activatorProps" />
              </template>
            </air-card>
          </template>
        </air-item-manager>
      </v-col>
    </v-row>

    <!-- Agreements management row -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <OrganismsAgreementsManager v-bind="agreementsManager.attrs.value" />
        </v-card>
      </v-col>
    </v-row>
  </TemplatesBase>
</template>

<style></style>
