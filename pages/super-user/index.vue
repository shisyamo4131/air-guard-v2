<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
import { httpsCallable } from "firebase/functions";

/*****************************************************************************
 * SETUP AUTH STORE
 *****************************************************************************/
const auth = useAuthStore();
const { companyId } = auth;

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function onClickRebuildAllHistories() {
  try {
    const callable = httpsCallable($functions, "rebuildAllHistories");
    const result = await callable({ companyId });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}
</script>

<template>
  <v-container>
    {{ auth.roles }}
    <v-card
      title="現場入場履歴再構築"
      subtitle="全会社の現場入場履歴を再構築します。"
    >
      <template #actions>
        <v-btn
          color="primary"
          label="実行"
          @click="onClickRebuildAllHistories"
        />
      </template>
    </v-card>
  </v-container>
</template>
