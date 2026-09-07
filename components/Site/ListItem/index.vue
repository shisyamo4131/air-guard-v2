<script setup>
/*****************************************************************************
 * @file ./components/Site/ListItem/index.vue
 * @description A ListItem component of Site.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";
import { getSiteLifecyclePresentation } from "@/composables/domain/site/siteLifecyclePresentation";
import {
  formatSiteConstructionPeriod,
  getSiteCustomerLabel,
  getSitePresentationBadges,
} from "@/composables/domain/site/siteUiPresentation";

defineOptions({ name: "SiteListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // ListItem
});
const props = useDefaults(_props, "SiteListItem");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalItem = reactive(new Site());
watch(
  () => props.item,
  (newValue) => {
    internalItem.initialize(newValue?.raw || newValue || null);
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Returns `name` used to `title` of `VListItem`.
 */
const title = computed(() => {
  return internalItem.name || "N/A";
});

const subtitle = computed(() => {
  const customer = getSiteCustomerLabel(internalItem);
  const code = internalItem.code || "コード未設定";
  const address = internalItem.fullAddress || "住所未設定";
  const period = formatSiteConstructionPeriod(internalItem);
  return `${customer} / ${code} / ${address} / 工期 ${period}`;
});
const lifecycle = computed(() => getSiteLifecyclePresentation(internalItem));
const badges = computed(() => getSitePresentationBadges(internalItem));
</script>

<template>
  <v-list-item v-bind="$attrs" :title="title" :subtitle="subtitle">
    <template #append>
      <div class="d-flex ga-1 flex-wrap justify-end">
      <v-chip
        v-for="badge in badges"
        :key="badge.key"
        :color="badge.color"
        size="small"
        variant="tonal"
      >
        {{ badge.label }}
      </v-chip>
      <v-chip
        v-if="!badges.some((badge) => badge.label === lifecycle.label)"
        :color="lifecycle.color"
        size="small"
        variant="outlined"
      >
        {{ lifecycle.label }}
      </v-chip>
      <v-chip
        v-if="lifecycle.automaticTerminationDate"
        size="small"
        variant="outlined"
      >
        自動終了予定 {{ lifecycle.automaticTerminationDate }}
      </v-chip>
      </div>
    </template>
    <!-- SUBTITLE -->
    <!-- Option 1: Use `subtitle` prop for a single line. -->
    <!-- <v-list-item v-bind="$attrs" :subtitle="internalItem.someProperty"> -->

    <!-- Option 2: Use `v-list-item-subtitle` for multiple lines (idiomatic Vuetify). -->
    <!-- <v-list-item-subtitle>{{ internalItem.someProperty1 }}</v-list-item-subtitle> -->
    <!-- <v-list-item-subtitle>{{ internalItem.someProperty2 }}</v-list-item-subtitle> -->
  </v-list-item>
</template>
