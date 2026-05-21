<script setup>
import { useRoute, useRouter } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useActiveSites } from "@/composables/dataLayers/useActiveSites";

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const route = useRoute();
const router = useRouter();
const docId = route.params.id;
const { doc } = useDocument("Customer", { docId });

/** 稼働中現場ドキュメントの取得 */
const { docs: activeSites } = useActiveSites({ customerId: docId });
</script>

<template>
  <v-container>
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <CustomerManager :doc="doc" label="基本情報" hide-delete-btn>
              <template #activator="activatorProps">
                <CustomerActivatorBase v-bind="activatorProps" />
              </template>
            </CustomerManager>
          </v-col>

          <!-- 請求・回収条件 -->
          <v-col cols="12">
            <CustomerManager :doc="doc" label="請求・回収条件" hide-delete-btn>
              <template #activator="activatorProps">
                <CustomerActivatorPayment v-bind="activatorProps" />
              </template>
            </CustomerManager>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" md="8">
        <v-row>
          <!-- 稼働中現場 -->
          <v-col cols="12">
            <v-card>
              <v-toolbar
                color="secondary"
                density="compact"
                title="稼働中現場"
              />
              <SitesDataTable :items="activeSites" />
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <CustomerManager
          :doc="doc"
          hide-delete-btn
          @submit:complete="router.replace('/customers')"
        >
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              text="この取引先を削除する"
              @click="() => toDelete()"
            />
          </template>
          <template #editor="{ actions: editorActions }">
            <v-card>
              <template #prepend>
                <v-icon icon="mdi-alert" color="error" />
              </template>
              <template #title> 削除処理 </template>
              <template #text>
                <div>本当に削除しますか？</div>
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                />
              </template>
            </v-card>
          </template>
        </CustomerManager>
      </v-col>
    </v-row>
  </v-container>
</template>
