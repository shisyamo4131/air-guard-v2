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
  <v-container>
    <v-toolbar class="mb-4" density="compact">
      <v-btn icon="mdi-chevron-left" @click="$router.go(-1)" />
      <v-toolbar-title>設定-会社情報-</v-toolbar-title>
    </v-toolbar>
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
  </v-container>
</template>

<style></style>
