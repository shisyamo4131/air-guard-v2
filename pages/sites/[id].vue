<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description 現場情報詳細ページ
 * - ルートパラメータ [id] は Sites コレクションのドキュメント id
 * - ドキュメント id をもとに Site クラスからドキュメント情報を取得して表示
 */
import { reactive, onMounted, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { Site } from "~/schemas/Site";

const route = useRoute();
const model = reactive(new Site());

const items = computed(() => {
  return [
    {
      title: "CODE",
      props: { subtitle: model.code, prependIcon: "mdi-magnify" },
    },
    {
      title: "住所",
      props: { subtitle: model.fullAddress, prependIcon: "mdi-map-marker" },
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

onMounted(async () => {
  const docId = route.params.id;
  if (docId) await model.fetch({ docId });
});

onUnmounted(() => {});
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
        <v-card>
          <v-toolbar density="comfortable">
            <v-toolbar-title>稼働予定</v-toolbar-title>
            <v-spacer />
          </v-toolbar>
          <v-container class="pt-0">
            <air-calendar hide-week-number />
          </v-container>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
