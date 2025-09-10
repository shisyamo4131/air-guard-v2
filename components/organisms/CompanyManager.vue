<script setup>
/**
 * @file organisms/CompanyManager.vue
 * @description A component to manage company information
 */
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { Company } from "@/schemas";

/*****************************************************************************
 * DEFINE COMPOSABLES / STORES
 *****************************************************************************/
const { error, clearError } = useLogger("CompanyManager", useErrorsStore());
const auth = useAuthStore();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const companyId = auth.companyId;
const model = reactive(new Company());

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  await model.subscribe({ docId: companyId });
});

onUnmounted(() => {
  model.unsubscribe();
});

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);
</script>

<template>
  <div>
    <ItemManager
      :modelValue="model"
      v-slot="slotProps"
      :input-props="{
        excludedKeys: ['agreements'],
      }"
      :handle-create="(item) => item.create()"
      :handle-update="(item) => item.update()"
      :handle-delete="(item) => item.delete()"
      @error="error"
      @error:clear="clearError"
    >
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesCardsEdit v-bind="slotProps.editorProps" hide-delete-btn>
          <air-item-input v-bind="slotProps.inputProps"> </air-item-input>
        </MoleculesCardsEdit>
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
                  {{ model[field] || "-" }}
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
            prepend-icon="mdi-pencil"
            @click="slotProps.toUpdate()"
            >編集</v-btn
          >
        </v-card-actions>
      </v-card>
    </ItemManager>
    <v-card>
      <OrganismsAgreementsManager
        v-model="model.agreements"
        @submit:complete="model.update()"
      />
    </v-card>
  </div>
</template>

<style></style>
