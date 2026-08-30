<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
import { useCompanyStore } from "@/stores/useCompanyStore";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const companyStore = useCompanyStore();
const { company: doc } = companyStore;
const auth = useAuthStore();
const canEditProfile = computed(
  () =>
    auth.isSuperUser === false &&
    auth.user?.isAdmin === true &&
    auth.user?.isTemporary === false &&
    auth.user?.disabled === false,
);
const canEditBilling = canEditProfile;
const canEditOperations = canEditProfile;
</script>

<template>
  <v-container>
    <!-------------------------------------------------------------------------
      ROW: DIVIDES 2 COLUMNS
      LEFT COLUMN: COLS=12 (MOBILE), COLS=6 (TABLET), COLS=4 (DESKTOP)
      RIGHT COLUMN: COLS=12 (MOBILE), COLS=6 (TABLET), COLS=8 (DESKTOP)
    -------------------------------------------------------------------------->
    <v-row>
      <!-----------------------------------------------------------------------
        LEFT SIDE
      ------------------------------------------------------------------------>
      <v-col cols="12" md="6" lg="4">
        <!---------------------------------------------------------------------
          ROW: 1 COLUMN
        ---------------------------------------------------------------------->
        <v-row>
          <v-col cols="12">
            <!-- 会社情報 -->
            <CompanyProfileEditor :company="doc">
              <template #activator="{ open }">
                <CompanyActivatorBase
                  :item="doc"
                  :editable="canEditProfile"
                  @click:edit="open"
                />
              </template>
            </CompanyProfileEditor>
          </v-col>
          <v-col cols="12">
            <!-- 口座情報 -->
            <CompanyBillingEditor :company="doc">
              <template #activator="{ open }">
                <CompanyActivatorBank
                  :item="doc"
                  :editable="canEditBilling"
                  @click:edit="open"
                />
              </template>
            </CompanyBillingEditor>
          </v-col>
          <!-- 設定情報 -->
          <v-col cols="12">
            <CompanyOperationsEditor :company="doc">
              <template #activator="{ open }">
                <CompanyActivatorSetting
                  :item="doc"
                  :editable="canEditOperations"
                  @click:edit="open"
                />
              </template>
            </CompanyOperationsEditor>
          </v-col>
        </v-row>
      </v-col>

      <!-----------------------------------------------------------------------
        RIGHT SIDE
      ------------------------------------------------------------------------>
      <v-col>
        <v-row>
          <!-- 取極め情報 -->
          <v-col cols="12">
            <AgreementsManager
              v-model="doc.agreementsV2"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<style></style>
