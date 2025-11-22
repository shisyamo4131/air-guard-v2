<script setup>
import { useCompanyManager } from "@/composables/useCompanyManager";
import { useAgreementsManager } from "../../composables/useAgreementsManager";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, info } = useCompanyManager();
const agreementsManager = useAgreementsManager(attrs.value.modelValue);
</script>

<template>
  <TemplatesDetail :label="'設定-会社情報-'" fixed hide-prepend>
    <v-row>
      <!-- Base information column -->
      <v-col cols="12" md="4">
        <air-item-manager
          v-bind="attrs"
          :input-props="{
            excludedKeys: ['agreements', 'minuteInterval', 'roundSetting'],
          }"
        >
          <template #activator="activatorProps">
            <air-information-card v-bind="activatorProps" :items="info.base" />
          </template>
        </air-item-manager>
      </v-col>

      <!-- Settings information column -->
      <v-col cols="12" md="8">
        <air-item-manager
          v-bind="attrs"
          :input-props="{
            includedKeys: ['minuteInterval', 'roundSetting'],
          }"
        >
          <template #activator="activatorProps">
            <air-information-card
              v-bind="activatorProps"
              :items="info.settings"
            />
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
  </TemplatesDetail>
</template>

<style></style>
