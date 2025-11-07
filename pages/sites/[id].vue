<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description Site detail page
 * @author shisyamo4131
 */
import dayjs from "dayjs";
import { useRoute } from "vue-router";
import { useSiteManager } from "@/composables/useSiteManager";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";

/*****************************************************************************
 * ROUTER
 *****************************************************************************/
const route = useRoute();
const siteId = route.params.id;

/*****************************************************************************
 * STORES & COMPOSABLES
 *****************************************************************************/
/** Site Manager */
const { doc, attrs, set } = useSiteManager();
set(siteId);

/** Date Range */
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

/** Site Operation Schedules Manager */
const schedulesManager = useSiteOperationSchedulesManager({
  dateRangeComposable,
  useDebounced: true,
});
schedulesManager.set({ siteId });

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const items = computed(() => {
  return [
    {
      title: "CODE",
      props: { subtitle: doc.code, prependIcon: "mdi-code-tags" },
    },
    {
      title: "住所",
      props: {
        subtitle: `${doc.zipcode} ${doc.fullAddress}`,
        prependIcon: "mdi-map-marker",
      },
    },
    {
      title: "建物名",
      props: {
        subtitle: doc.building || "-",
        prependIcon: "mdi-office-building-marker",
      },
    },
    {
      title: "取引先",
      props: {
        subtitle: doc.customer?.name || "loading",
        prependIcon: "mdi-domain",
      },
    },
    {
      title: "備考",
      props: {
        subtitle: doc.remarks || "-",
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
      <v-toolbar-title>{{ doc.name }}</v-toolbar-title>
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
        <OrganismsSiteOperationSchedulesManager
          v-bind="schedulesManager.attrs.value"
        >
          <template #table="{ toCreate, toUpdate }">
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>稼働予定</v-toolbar-title>
                <v-spacer />
                <v-btn icon="mdi-plus" @click="toCreate()" />
              </v-toolbar>
              <v-card-text>
                <v-container class="pt-0">
                  <MoleculesMonthSelector
                    :model-value="dateRange.from"
                    @date-range="dateRange = $event"
                  />
                </v-container>
                <air-calendar
                  style="min-height: 520px"
                  :model-value="dateRange.from"
                  :events="schedulesManager.events.value"
                  @click:event="
                    (nativeEvent, { event }) => {
                      toUpdate(event.item);
                    }
                  "
                />
              </v-card-text>
            </v-card>
          </template>
        </OrganismsSiteOperationSchedulesManager>
      </v-col>
      <v-col>
        <v-card>
          <OrganismsAgreementsManager
            v-model="doc.agreements"
            use-default
            @submit:complete="doc.update()"
          />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
