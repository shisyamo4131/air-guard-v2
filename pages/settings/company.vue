<script setup>
/**
 * @file pages/settings/company.vue
 * @description 会社情報管理
 */
import { useAuthStore } from "@/stores/useAuthStore";
import { RoundSetting } from "@/schemas";

/*****************************************************************************
 * DEFINE COMPOSABLES / STORES
 *****************************************************************************/
const auth = useAuthStore();
</script>

<template>
  <v-container>
    <v-toolbar class="mb-4" density="compact">
      <v-btn icon="mdi-chevron-left" @click="$router.go(-1)" />
      <v-toolbar-title>設定-会社情報-</v-toolbar-title>
    </v-toolbar>
    <v-row>
      <v-col cols="12" md="4">
        <MoleculesCompanyManager
          :model-value="auth.company"
          :input-props="{
            excludedKeys: ['agreements', 'minuteInterval', 'roundSetting'],
          }"
        >
          <template #activator="{ attrs }">
            <air-information-card
              v-bind="attrs"
              :items="[
                {
                  title: '会社名',
                  props: {
                    subtitle: `${auth.company.companyName}`,
                    prependIcon: 'mdi-tag',
                  },
                },
                {
                  title: '住所',
                  props: {
                    subtitle: `${auth.company.zipcode} ${auth.company.fullAddress}`,
                    prependIcon: 'mdi-map-marker',
                    lines: 'two',
                  },
                },
                {
                  title: '建物',
                  props: {
                    subtitle: auth.company.building || '-',
                    prependIcon: 'mdi-office-building-marker',
                  },
                },
                {
                  title: '電話番号',
                  props: {
                    subtitle: auth.company.tel || '-',
                    prependIcon: 'mdi-phone',
                  },
                },
                {
                  title: 'FAX番号',
                  props: {
                    subtitle: auth.company.fax || '-',
                    prependIcon: 'mdi-fax',
                  },
                },
              ]"
            />
          </template>
        </MoleculesCompanyManager>
      </v-col>
      <v-col cols="12" md="8">
        <MoleculesCompanyManager
          :model-value="auth.company"
          :input-props="{
            includedKeys: ['minuteInterval', 'roundSetting'],
          }"
        >
          <template #activator="{ attrs }">
            <air-information-card
              v-bind="attrs"
              :items="[
                {
                  title: '時刻選択間隔（分）',
                  props: {
                    subtitle: `${auth.company.minuteInterval} 分`,
                    prependIcon: 'mdi-timer-sand',
                  },
                },
                {
                  title: '端数処理',
                  props: {
                    subtitle: RoundSetting.label(auth.company.roundSetting),
                    prependIcon: 'mdi-calculator-variant-outline',
                  },
                },
              ]"
            />
          </template>
        </MoleculesCompanyManager>
      </v-col>
      <v-col cols="12">
        <v-card>
          <OrganismsAgreementsManager
            v-model="auth.company.agreements"
            @submit:complete="auth.company.update()"
          >
          </OrganismsAgreementsManager>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style></style>
