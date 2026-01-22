/*****************************************************************************
 * SiteOrderListItem 用コンポーザブル
 * @dependencies useFetchSite
 *****************************************************************************/
import * as Vue from "vue";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

export function useIndex(props) {
  /** SETUP COMPOSABLES */
  const { cachedSites, fetchSite } =
    props.fetchSiteComposable || useFetchSite();

  /** WATCHERS */
  Vue.watch(
    () => props.siteId,
    (newSiteId) => fetchSite(newSiteId),
    { immediate: true },
  );

  /** title */
  const title = Vue.computed(() => {
    return cachedSites.value[props.siteId]?.name || "...loading";
  });

  /** attrs */
  const attrs = Vue.computed(() => {
    return {
      title: title.value,
    };
  });

  return { attrs };
}
