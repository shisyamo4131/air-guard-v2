<script setup>
/**
 * @file organisms/CompanyManager.vue
 * @description 会社情報管理
 */
import { Company } from "@/schemas";

/** ストア連携 */
const auth = useAuthStore();

const { company } = storeToRefs(auth);

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);
</script>

<template>
  <v-container>
    <ItemManager :model="company" v-slot="slotProps" label="会社情報">
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesEditCard v-bind="slotProps.editorProps" hide-delete-btn>
          <air-item-input v-bind="slotProps.inputProps" />
        </MoleculesEditCard>
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
          <AtomsBtnsEdit color="primary" @click="slotProps.toUpdate()" />
        </v-card-actions>
      </v-card>
    </ItemManager>
  </v-container>
</template>

<style></style>
