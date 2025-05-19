<script setup>
import { Company } from "air-guard-v2-schemas";
const auth = useAuthStore();
const { company } = storeToRefs(auth);

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);
</script>

<template>
  <v-container>
    <v-card class="mx-auto" elevation="2">
      <v-card-title> 会社情報 </v-card-title>
      <v-container>
        <v-list lines="two" density="compact">
          <template v-for="field in companyFields" :key="field">
            <v-list-item>
              <v-list-item-subtitle>
                {{ companyFields[field]?.label || field }}
              </v-list-item-subtitle>
              <v-list-item-title>
                {{ company[field] || "-" }}
              </v-list-item-title>
            </v-list-item>
            <v-divider
              v-if="field !== companyFields[companyFields.length - 1]"
            ></v-divider>
          </template>
        </v-list>
      </v-container>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          :disabled="!!companyFetchError"
          variant="elevated"
        >
          編集する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<style></style>
