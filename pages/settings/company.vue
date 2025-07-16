<script setup>
/**
 * @file organisms/CompanyManager.vue
 * @description 会社情報管理
 */
import { Company, Agreement } from "@/schemas";

/** define stores */
const auth = useAuthStore();

/** define company-id */
const companyId = auth.companyId;

/** define model */
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
  <v-container>
    <ItemManager
      :model="model"
      v-slot="slotProps"
      :input-props="{
        excludedKeys: ['agreements'],
      }"
    >
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesEditCard v-bind="slotProps.editorProps" hide-delete-btn>
          <air-item-input v-bind="slotProps.inputProps"> </air-item-input>
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
      <array-manager
        v-model="model.agreements"
        :schema="Agreement"
        label="会社規定取極め"
        :table-props="{
          hideDefaultFooter: true,
          itemsPerPage: -1,
          sortBy: [{ key: 'from', order: 'desc' }],
        }"
        @submit:complete="model.update()"
      />
    </v-card>
  </v-container>
</template>

<style></style>
