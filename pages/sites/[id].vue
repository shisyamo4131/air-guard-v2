<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description 現場情報詳細ページ
 * - ルートパラメータ [id] は Sites コレクションのドキュメント id
 * - ドキュメント id をもとに Site クラスからドキュメント情報を取得して表示
 */
import { reactive, onMounted, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { Site } from "~/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

const { error, clearError } = useLogger("SiteManager", useErrorsStore());

/** define-stores */
const auth = useAuthStore();

const route = useRoute();
const siteId = route.params.id;
const model = reactive(new Site());

const items = computed(() => {
  return [
    {
      title: "CODE",
      props: { subtitle: model.code, prependIcon: "mdi-code-tags" },
    },
    {
      title: "住所",
      props: {
        subtitle: `${model.zipcode} ${model.fullAddress}`,
        prependIcon: "mdi-map-marker",
      },
    },
    {
      title: "建物名",
      props: {
        subtitle: model.building,
        prependIcon: "mdi-office-building-marker",
      },
    },
    {
      title: "取引先",
      props: {
        subtitle: model.customer?.name || "loading",
        prependIcon: "mdi-domain",
      },
    },
  ];
});

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
    <v-row>
      <v-col cols="12">
        <v-toolbar density="compact">
          <v-toolbar-title>{{ model.name }}</v-toolbar-title>
        </v-toolbar>
      </v-col>
      <v-col cols="12" md="4">
        <air-item-manager
          :model-value="model"
          :input-props="{
            excludedKeys: ['agreements'],
          }"
          :handle-create="(item) => item.create()"
          :handle-update="(item) => item.update()"
          :handle-delete="(item) => item.delete()"
          v-slot="{ toUpdate }"
          @error="error"
          @error:clear="clearError"
        >
          <v-card border flat>
            <v-list slim :items="items" />
            <v-card-actions>
              <v-btn color="primary" block @click="toUpdate()">編集</v-btn>
            </v-card-actions>
          </v-card>
        </air-item-manager>
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

<style scoped>
:deep(.v-list-item-title) {
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
  font-size: 0.75rem;
  font-weight: 400;
  letter-spacing: 0.0333333333em;
}

:deep(.v-list-item-subtitle) {
  color: rgba(var(--v-theme-on-surface), 1) !important;
  opacity: 1;
  font-size: 0.875rem;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
}
</style>
