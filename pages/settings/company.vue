<script setup>
import { Company } from "air-guard-v2-schemas";
const auth = useAuthStore();
const { company } = storeToRefs(auth);

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);

const isValid = ref(null);
</script>

<template>
  <v-container>
    <ItemManager :schema="company" v-slot="slotProps">
      <v-dialog v-bind="slotProps.dialogProps" max-width="480" scrollable>
        <MoleculesCardsEditor
          label="会社情報編集"
          :disable-submit="!isValid"
          @click:close="slotProps.quitEditing"
          @click:submit="slotProps.submit"
        >
          <MoleculesFormsCompany
            v-model="isValid"
            :item="slotProps.item"
            :update-properties="slotProps.updateProperties"
          />
        </MoleculesCardsEditor>
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
          <v-btn
            color="primary"
            variant="elevated"
            @click="slotProps.toUpdate()"
          >
            編集する
          </v-btn>
        </v-card-actions>
      </v-card>
    </ItemManager>
  </v-container>
</template>

<style></style>
