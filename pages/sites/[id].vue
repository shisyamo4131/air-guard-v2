<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description Site detail page
 * @author shisyamo4131
 */
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSiteManager } from "@/composables/useSiteManager";

const auth = useAuthStore();
const route = useRoute();
const siteId = route.params.id;

const { instance, attrs } = useSiteManager({ docId: siteId });
const items = computed(() => {
  return [
    {
      title: "CODE",
      props: { subtitle: instance.code, prependIcon: "mdi-code-tags" },
    },
    {
      title: "住所",
      props: {
        subtitle: `${instance.zipcode} ${instance.fullAddress}`,
        prependIcon: "mdi-map-marker",
      },
    },
    {
      title: "建物名",
      props: {
        subtitle: instance.building || "-",
        prependIcon: "mdi-office-building-marker",
      },
    },
    {
      title: "取引先",
      props: {
        subtitle: instance.customer?.name || "loading",
        prependIcon: "mdi-domain",
      },
    },
    {
      title: "備考",
      props: {
        subtitle: instance.remarks || "-",
        prependIcon: "mdi-comment-text",
        lines: "two",
      },
    },
  ];
});
</script>
<template>
  <v-container>
    <v-toolbar class="mb-4" density="compact">
      <v-btn icon="mdi-chevron-left" @click="$router.go(-1)" />
      <v-toolbar-title>{{ instance.name }}</v-toolbar-title>
    </v-toolbar>
    <v-row>
      <v-col cols="12" md="4">
        <OrganismsSiteManager v-bind="attrs">
          <template #default="{ toUpdate }">
            <v-card border flat>
              <v-list class="v-list--info-display" slim :items="items" />
              <v-card-actions>
                <v-btn color="primary" block @click="toUpdate()">編集</v-btn>
              </v-card-actions>
            </v-card>
          </template>
        </OrganismsSiteManager>
      </v-col>
      <v-col cols="12" md="8">
        <OrganismsSiteOperationSchedulesManager :site-id="siteId" />
      </v-col>
      <v-col>
        <v-card>
          <MoleculesAgreementsManager
            v-model="instance.agreements"
            :default-agreements="auth.company.agreements"
            @submit:complete="instance.update()"
          />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
