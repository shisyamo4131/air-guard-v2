<script setup>
import { Company } from "air-guard-v2-schemas";
const auth = useAuthStore();
const { company } = storeToRefs(auth);

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);
</script>

<template>
  <v-container>
    <air-item-manager
      v-model="company"
      v-slot="{
        dialogProps,
        item,
        submit,
        toUpdate,
        updateProperties,
        quitEditing,
      }"
    >
      <v-dialog v-bind="dialogProps" max-width="480" scrollable>
        <v-card>
          <v-toolbar>
            <v-toolbar-title>会社情報編集</v-toolbar-title>
            <v-spacer />
            <v-btn icon @click="quitEditing">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-toolbar>
          <v-card-text>
            <MoleculesFormsCompany
              :item="item"
              :update-properties="updateProperties"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="elevated" @click="submit()"
              >確定</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-card class="mx-auto" elevation="2">
        <v-card-title> 会社情報 </v-card-title>
        <v-container>
          <v-list lines="two" density="compact">
            <template v-for="field in companyFields" :key="field">
              <v-list-item>
                <v-list-item-subtitle>
                  {{ Company.classProps[field]?.label || field }}
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
          <v-btn color="primary" variant="elevated" @click="toUpdate()">
            編集する
          </v-btn>
        </v-card-actions>
      </v-card>
    </air-item-manager>
  </v-container>
</template>

<style></style>
