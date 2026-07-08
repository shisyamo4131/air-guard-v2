<script setup>
/*****************************************************************************
 * @file ./components/SiteShiftTypeOrder/ListItem/index.vue
 * @description 現場オーダーのリストアイテムコンポーネント
 * @property {String} shiftType - The shift type identifier
 * @property {String} siteId - The site identifier
 * @property {Object} fetchSiteComposable - Optional composable for fetching site data
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SiteShiftTypeOrderListItem", inheritAttrs: false });

/*****************************************************************************
 * SETUP PROPS
 *****************************************************************************/
const _props = defineProps({
  shiftType: { type: String, required: true },
  siteId: { type: String, required: true },
  fetchSiteComposable: { type: Object, default: undefined },
});
const props = useDefaults(_props, "SiteShiftTypeOrderListItem");

/*****************************************************************************
 * SETUP FETCH COMPOSABLE
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("SiteShiftTypeOrderListItem");
const { fetchSite, cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(() => props.siteId, fetchSite, { immediate: true });

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const title = computed(() => {
  return cachedSites.value[props.siteId]?.displayName || "...loading";
});
</script>

<template>
  <v-list-item v-bind="$attrs" :title="title">
    <!-- SLOT: PREPEND -->
    <!-- 勤務区分Chip を表示 -->
    <template #prepend>
      <ShiftTypeChip
        class="mr-2"
        :shift-type="props.shiftType"
        label
        size="small"
      />
    </template>
  </v-list-item>
</template>
