<script setup>
import { Company } from "air-guard-v2-schemas";
const errors = useErrorsStore();
const auth = useAuthStore();
const { company } = storeToRefs(auth);

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);

const isValid = ref(null);
</script>

<template>
  <v-container>
    <air-item-manager
      v-model="company"
      v-slot="slotProps"
      @error="errors.add($event)"
      @error:clear="errors.clear"
    >
      <v-dialog v-bind="slotProps.dialogProps" max-width="480" scrollable>
        <v-card>
          <v-toolbar>
            <v-toolbar-title>会社情報編集</v-toolbar-title>
            <v-spacer />
            <v-btn icon @click="slotProps.quitEditing">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-toolbar>
          <v-card-text>
            <MoleculesFormsCompany
              v-model="isValid"
              :item="slotProps.item"
              :update-properties="slotProps.updateProperties"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!isValid"
              variant="elevated"
              @click="slotProps.submit()"
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
          <v-btn
            color="primary"
            variant="elevated"
            @click="slotProps.toUpdate()"
          >
            編集する
          </v-btn>
        </v-card-actions>
      </v-card>
    </air-item-manager>
  </v-container>
</template>

<style></style>
