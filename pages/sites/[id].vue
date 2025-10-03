<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description 現場情報詳細ページ
 * - ルートパラメータ [id] は Sites コレクションのドキュメント id
 * - ドキュメント id をもとに Site クラスからドキュメント情報を取得して表示
 */
import { reactive, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { Site } from "~/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/** define-stores */
const auth = useAuthStore();

const route = useRoute();
const siteId = route.params.id;
const model = reactive(new Site());

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  await model.subscribe({ docId: siteId });
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>
<template>
  <v-container>
    <v-toolbar class="mb-4" density="compact">
      <v-btn icon="mdi-chevron-left" @click="$router.go(-1)" />
      <v-toolbar-title>{{ model.name }}</v-toolbar-title>
    </v-toolbar>
    <v-row>
      <v-col cols="12" md="4">
        <MoleculesSiteManager
          :model-value="model"
          :input-props="{
            excludedKeys: ['agreements'],
          }"
        />
      </v-col>
      <v-col cols="12" md="8">
        <OrganismsSiteOperationSchedulesManager :site-id="siteId" />
      </v-col>
      <v-col>
        <v-card>
          <MoleculesAgreementsManager
            v-model="model.agreements"
            :default-agreements="auth.company.agreements"
            @submit:complete="model.update()"
          />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
