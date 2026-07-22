<script setup>
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useFetch } from "@/composables/fetch/useFetch";
import { useRoute, useRouter } from "vue-router";

// 稼働実績複製ボタンは開発者のみに限定しておく
import { useAuthStore } from "@/stores/useAuthStore";
const auth = useAuthStore();

/*****************************************************************************
 * ROUTER
 *****************************************************************************/
const route = useRoute();
const router = useRouter();
const docId = route.params.id;

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const {
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchArticleComposable,
} = useFetch("OperationResult", true);
const { fetchSite } = fetchSiteComposable;
const { fetchEmployee } = fetchEmployeeComposable;
const { fetchOutsourcer } = fetchOutsourcerComposable;
const { fetchArticle } = fetchArticleComposable;
const { doc } = useDocument("OperationResult", { docId }, (doc) => {
  if (!doc?.docId) return;
  fetchSite(doc.siteId);
  fetchEmployee(doc.employeeIds);
  fetchOutsourcer(doc.outsourcerIds);
  fetchArticle(doc.articles);
});
</script>

<template>
  <v-container class="fill-height align-start">
    <v-row>
      <v-col v-if="doc.isLocked" cols="12">
        <v-alert
          color="warning"
          icon="mdi-lock"
          density="compact"
          text="この稼働実績は編集ロックされています。編集はできません。"
        >
        </v-alert>
      </v-col>
      <!-- LEFT SIDE -->
      <v-col cols="12" lg="3">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <OperationResultManager :doc="doc" label="基本情報" hide-delete-btn>
              <template #activator="activatorProps">
                <OperationResultActivatorBase
                  v-bind="activatorProps"
                  :disabled="doc.isLocked"
                />
              </template>
            </OperationResultManager>
          </v-col>
          <v-col v-if="auth.isDeveloper" cols="12">
            <OperationResultDuplicator
              @duplicated="router.replace(`/operation-results/${$event.docId}`)"
            >
              <template #activator="{ set }">
                <v-btn
                  color="primary"
                  text="この稼働実績を複製する"
                  block
                  @click="set(doc)"
                />
              </template>
            </OperationResultDuplicator>
          </v-col>
          <!-- 警備日報 -->
          <v-col cols="12">
            <v-card>
              <v-toolbar color="secondary" density="compact" title="警備日報" />
              <SecurityReportsManager :schedule-id="doc?.docId" />
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" lg="9">
        <v-row>
          <v-col cols="12">
            <OperationResultWorkersManager
              v-model="doc.workers"
              :disabled="doc.isLocked"
              :default-start-time="doc.startTime"
              :default-end-time="doc.endTime"
              :default-is-start-next-day="doc.isStartNextDay"
              :default-break-minutes="doc.breakMinutes"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
          <v-col cols="12">
            <ArticleDetailsManager
              v-model="doc.articles"
              :disabled="doc.isLocked"
              label="稼働外売上"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
        </v-row>
      </v-col>

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <OperationResultManager
          :doc="doc"
          hide-delete-btn
          @submit:complete="() => router.replace('/operation-results')"
        >
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              :disabled="doc.isLocked"
              text="この稼働実績を削除する"
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
                削除すると復元することはできません。本当に削除しますか？
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                  color="error"
                />
              </template>
            </v-card>
          </template>
        </OperationResultManager>
      </v-col>
    </v-row>
  </v-container>
</template>
