<script setup>
/*****************************************************************************
 * @file ./pages/super-user/index.vue
 * @description スーパーユーザー専用ページ
 *****************************************************************************/
import { useAuthStore } from "@/stores/useAuthStore";
import { httpsCallable } from "firebase/functions";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

const { $functions } = useNuxtApp();

/*****************************************************************************
 * SETUP AUTH STORE
 *****************************************************************************/
const auth = useAuthStore();
const { companyId } = auth;

/*****************************************************************************
 * SETUP MESSAGES STORE
 *****************************************************************************/
const messages = useMessagesStore();

/*****************************************************************************
 * SETUP LOGGER COMPOSABLE
 *****************************************************************************/
const logger = useLogger("pages/super-user/index.vue", useErrorsStore());

/*****************************************************************************
 * SETUP LOADINGS STORE
 *****************************************************************************/
const loadings = useLoadingsStore();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function onClickRebuildAllHistories() {
  const key = loadings.add("Re-building all histories...");
  try {
    const callable = httpsCallable($functions, "rebuildAllHistories");
    const result = await callable({ companyId });
    messages.add(result.data.message);
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(key);
  }
}

async function onClickRebuildSecurityReportIndexes() {
  const key = loadings.add("警備日報インデックスを再構築しています...");
  try {
    const callable = httpsCallable(
      $functions,
      "rebuildSecurityReportIndexes",
    );
    const result = await callable({ companyId });
    messages.add(result.data.message);
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(key);
  }
}
</script>

<template>
  <v-container class="d-flex flex-column ga-4">
    <v-card
      title="現場入場履歴再構築"
      subtitle="全会社の現場入場履歴を再構築します。"
    >
      <template #actions>
        <v-btn
          color="primary"
          text="実行"
          @click="onClickRebuildAllHistories"
        />
      </template>
    </v-card>
    <v-card
      title="警備日報インデックス再構築"
      subtitle="現在の会社に保存されている警備日報を基に、検索用インデックスを再構築します。"
    >
      <template #actions>
        <v-btn
          color="primary"
          text="実行"
          @click="onClickRebuildSecurityReportIndexes"
        />
      </template>
    </v-card>
  </v-container>
</template>
