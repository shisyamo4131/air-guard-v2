<script setup>
/**
 * @file ./pages/collection-routes/[id].vue
 * @description ルート詳細ページ
 * - ルートパラメータ [id] は CollectionRoutes コレクションのドキュメントID
 * - ドキュメント id をもとに CollectionRoute クラスからドキュメント情報を取得して表示
 */
import { reactive, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { CollectionRoute } from "~/schemas/CollectionRoute";

const route = useRoute();
const model = reactive(new CollectionRoute());

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
          <v-toolbar>
            <v-toolbar-title>{{ model.name }}</v-toolbar-title>
            <v-spacer />
            <ItemManager
              :model="model"
              v-slot="slotProps"
              label="回収ルート情報"
            >
              <v-dialog v-bind="slotProps.dialogProps">
                <template #activator>
                  <v-btn icon="mdi-pencil" @click="slotProps.toUpdate()" />
                </template>
                <MoleculesCardsEditor v-bind="slotProps.editorProps">
                  <air-item-input
                    v-bind="slotProps"
                    :schema="CollectionRoute.schema"
                  />
                </MoleculesCardsEditor>
              </v-dialog>
            </ItemManager>
          </v-toolbar>
          <v-list>
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-identifier</v-icon>
              </template>
              <v-list-item-subtitle> CODE </v-list-item-subtitle>
              <v-list-item-title>
                {{ model.code }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <template #prepend>
                <v-icon>mdi-tag-outline</v-icon>
              </template>
              <v-list-item-subtitle> ルート名 </v-list-item-subtitle>
              <v-list-item-title>
                {{ model.name }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <OrganismsCollectionRouteStopsManager :model="model" />
      </v-col>
    </v-row>
  </v-container>
</template>
