<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description 現場情報詳細ページ
 * - ルートパラメータ [id] は Sites コレクションのドキュメント id
 * - ドキュメント id をもとに Site クラスからドキュメント情報を取得して表示
 */
import { reactive, onMounted, computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Site, Agreement } from "~/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/** define-stores */
const auth = useAuthStore();

const route = useRoute();
const siteId = route.params.id;
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
  await model.subscribe({ docId: siteId });
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
          <v-toolbar density="comfortable">
            <v-toolbar-title>{{ model.name }}</v-toolbar-title>
            <v-spacer />
            <ItemManager
              :model="model"
              :input-props="{
                excludedKeys: ['agreements'],
              }"
            >
            </ItemManager>
          </v-toolbar>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <OrganismsSiteOperationSchedulesManager :site-id="siteId" />
      </v-col>
      <v-col>
        <v-card>
          <array-manager
            v-model="model.agreements"
            :schema="Agreement"
            :table-props="{
              hideDefaultFooter: true,
              itemsPerPage: -1,
              sortBy: [{ key: 'from', order: 'desc' }],
            }"
            :before-edit="
              (editMode, item) => {
                if (editMode === 'CREATE') item.startTime = '09:00';
              }
            "
            @submit:complete="model.update()"
          >
            <template #input="slotProps">
              <air-item-input v-bind="slotProps">
                <template #after-dateAt>
                  <OrganismsAgreementSelector
                    label="取極めから選択"
                    :items="auth.company.agreements"
                    @select="
                      $event.dateAt = slotProps.item.dateAt;
                      slotProps.updateProperties({ ...$event });
                    "
                  />
                </template>
              </air-item-input>
            </template>
          </array-manager>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
