<script setup>
import { useAuthStore } from "@/stores/useAuthStore";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const { company: doc } = auth;
</script>

<template>
  <TemplatesFixedHeightContainer>
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
            <CompanyManager :doc="doc" />
          </v-col>
          <v-col cols="12">
            <!-- 口座情報 -->
            <CompanyManager :doc="doc" type="bank" />
          </v-col>
          <!-- 設定情報 -->
          <v-col cols="12">
            <CompanyManager :doc="doc" type="setting" />
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
  </TemplatesFixedHeightContainer>
</template>

<style></style>
