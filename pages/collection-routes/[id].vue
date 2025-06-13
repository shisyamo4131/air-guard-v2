<script setup>
/**
 * @file ./pages/collection-routes/[id].vue
 * @description ルート詳細ページ
 * - ルートパラメータ [id] は CollectionRoutes コレクションのドキュメントID
 * - ドキュメント id をもとに CollectionRoute クラスからドキュメント情報を取得して表示
 */
import { reactive, onMounted, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useLogger } from "~/composables/useLogger";
import { CollectionRoute } from "~/schemas/CollectionRoute";

const logger = useLogger();

const route = useRoute();
const model = reactive(new CollectionRoute());

const items = computed(() => {
  return [
    {
      title: "ルートコード",
      props: { subtitle: model.code, prependIcon: "mdi-identifier" },
    },
    {
      title: "ルート名",
      props: { subtitle: model.name, prependIcon: "mdi-map-marker" },
    },
  ];
});

onMounted(async () => {
  const docId = route.params.id;
  if (docId) await model.subscribe({ docId });
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-item>
            <v-card-title>{{ model.name }}</v-card-title>
          </v-card-item>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <OrganismsCollectionRouteStopsManager :model="model" />
      </v-col>
    </v-row>
  </v-container>
</template>
